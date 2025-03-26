"use client";

import { useEffect, useState } from "react";
import { SupabaseService, User } from "../../lib/supabase";
import { parseQueryParams, getTelegramUserId, sendNotificationToBot } from "../../lib/utils";
import { calculateUserBalances, simplifyDebtsWithMembers } from "../../lib/financial-utils";
import Link from "next/link";
import { init, backButton } from "@telegram-apps/sdk";

interface SimplifiedDebt {
  from: User;
  to: User;
  amount: number;
}

export default function SettleUp() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [selectedDebts, setSelectedDebts] = useState<{
    [key: string]: boolean;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Initialize Telegram SDK only on client-side
    const initTelegramBackButton = async () => {
      try {
        init();
        backButton.mount();

        if (backButton.show.isAvailable()) {
          backButton.show();

          // Configure back button click handler to navigate to home page
          backButton.onClick(() => {
            window.location.href = `/?group_id=${groupId}`;
          });
        }

        return () => {
          backButton.hide();
        };
      } catch (error) {}
    };

    const cleanup = initTelegramBackButton();

    return () => {
      if (cleanup) {
        cleanup.then((cleanupFn) => {
          if (cleanupFn) cleanupFn();
        });
      }
    };
  }, [groupId]);

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;

      try {
        // Get the Telegram user ID using our utility function
        const telegramUserId = getTelegramUserId();

        if (!telegramUserId) {
          setError("Unable to identify user from Telegram");
          setLoading(false);
          return;
        }

        // Load user data
        const userData = await SupabaseService.getUserByTelegramId(
          telegramUserId
        );
        if (!userData) {
          setError("User not found. Please ensure you have joined the group.");
          setLoading(false);
          return;
        }
        setCurrentUser(userData);

        // First fetch members and wait for the result
        const membersData = await SupabaseService.getGroupMembers(groupId);
        setMembers(membersData);

        // Verify the user is a member of this group
        const isMember = membersData.some(
          (member) => member.uuid === userData.uuid
        );
        if (!isMember) {
          setError("You are not a member of this group.");
          setLoading(false);
          return;
        }

        // Then fetch debts after we have members
        const debtsData = await SupabaseService.getGroupDebts(groupId);

        if (!debtsData || debtsData.length === 0) {
          setDebts([]);
          setLoading(false);
          return;
        }

        // Make sure membersData is populated before calculating balances
        if (!membersData || membersData.length === 0) {
          setError("Failed to load group members");
          setLoading(false);
          return;
        }

        // Create a members map for direct access to use with balances
        const membersMap = new Map<string, User>();
        membersData.forEach((member) => membersMap.set(member.uuid, member));

        // Calculate balances and simplify debts using the utility functions
        const balances = calculateUserBalances(debtsData);
        const simplifiedDebts = simplifyDebtsWithMembers(balances, membersData);
        
        // Filter debts to only include those involving the current user
        const userDebts = simplifiedDebts.filter(
          debt => debt.from.uuid === userData.uuid || debt.to.uuid === userData.uuid
        );

        // Update state with filtered debts
        setDebts(userDebts);
      } catch (err) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [groupId]);

  const toggleDebtSelection = (debtId: string) => {
    setSelectedDebts((prev) => ({
      ...prev,
      [debtId]: !prev[debtId],
    }));
  };

  const handleSettleUp = async () => {
    if (!groupId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const debtsToSettle = debts.filter(
        (debt, index) => selectedDebts[`debt-${index}`]
      );

      if (debtsToSettle.length === 0) {
        setError("Please select at least one debt to settle");
        setIsSubmitting(false);
        return;
      }

      // Call API to settle the selected debts
      await SupabaseService.settleDebts(groupId, debtsToSettle);
      
      // Get the chat ID from the group ID
      const chatId = await SupabaseService.getGroupChatId(groupId);
      
      if (chatId) {
        // Send notification to the bot server API
        const notificationData = {
          chat_id: chatId,
          action: "settle_up",
          settlements: debtsToSettle.map((debt) => ({
            from: debt.from.username,
            to: debt.to.username,
            amount: debt.amount.toFixed(2),
          })),
        };
        
        try {
          // Use the utility function to send the notification
          await sendNotificationToBot(notificationData);
        } catch (err) {
          // Continue even if notification fails
          console.warn('Failed to send notification, but settlements were saved');
        }
      }

      window.location.href = `/?group_id=${groupId}`;
    } catch (err) {
      console.error('Error in handleSettleUp:', err);
      setError("Failed to settle debts");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-white">Settle Up</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-white">
          Your Outstanding Debts
        </h2>

        {!debts || debts.length === 0 ? (
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-md text-gray-300">
            You don't have any outstanding debts.
          </div>
        ) : (
          <div className="space-y-4">
            {debts.map((debt, index) => (
              <div
                key={`debt-${index}`}
                className="p-4 bg-gray-800 border border-gray-700 rounded-md flex items-center"
              >
                <input
                  type="checkbox"
                  id={`debt-${index}`}
                  className="mr-4 h-5 w-5 accent-blue-500"
                  checked={selectedDebts[`debt-${index}`] || false}
                  onChange={() => toggleDebtSelection(`debt-${index}`)}
                />
                <label htmlFor={`debt-${index}`} className="flex-1 text-white">
                  <span className="font-semibold">
                    {currentUser && debt.from.uuid === currentUser.uuid 
                      ? "You" 
                      : debt.from.username}
                  </span>{" "}
                  owes{" "}
                  <span className="font-semibold">
                    {currentUser && debt.to.uuid === currentUser.uuid
                      ? "You"
                      : debt.to.username}
                  </span>{" "}
                  <span className="text-green-400">
                    ${debt.amount.toFixed(2)}
                  </span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between gap-4">
        <Link
          href={`/?group_id=${groupId}`}
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-center flex-1"
        >
          Cancel
        </Link>
        <button
          onClick={handleSettleUp}
          disabled={
            isSubmitting ||
            debts.length === 0 ||
            Object.values(selectedDebts).filter(Boolean).length === 0
          }
          className={`px-4 py-3 rounded-md text-white text-center flex-1 ${
            isSubmitting ||
            debts.length === 0 ||
            Object.values(selectedDebts).filter(Boolean).length === 0
              ? "bg-green-500 opacity-50 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isSubmitting ? "Settling..." : "Settle Selected Debts"}
        </button>
      </div>
    </main>
  );
}
