"use client";

import { useEffect, useState } from "react";
import { ExpenseForm } from "../../components/ExpenseForm";
import { SplitSection } from "../../components/SplitSection";
import { LoadingError } from "../../components/LoadingError";
import { parseQueryParams, formatNumber, calculateSplitTotal } from "../../lib/utils";
import { SupabaseService } from "../../lib/supabase";
import { init, backButton } from "@telegram-apps/sdk";
import Link from "next/link";
import { useExpense } from "../../hooks/useExpense";
import { ExpenseSplitNoExpenseID } from "../../lib/types";
import { SelectParticipantsSection } from "../../components/SelectParticipantsSection";

export default function AddExpense() {
  const params = parseQueryParams();
  const groupId = params.group_id || '';

  const {
    description,
    setDescription,
    amount,
    setAmount,
    members,
    currentUser,
    paidBy,
    setPaidBy,
    splits,
    setSplits,
    splitMode,
    loading,
    submitting,
    error,
    setError,
    setSubmitting,
    handleSplitModeChange,
  } = useExpense(groupId);

  // Add state for selected participants
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // Initialize selected participants to all members when members load
  useEffect(() => {
    if (members.length > 0) {
      setSelectedParticipants(members.map(member => member.uuid));
    }
  }, [members]);

  useEffect(() => {
    const initTelegramBackButton = async () => {
      try {
        init();
        backButton.mount();
        if (backButton.show.isAvailable()) {
          backButton.show();
          backButton.onClick(() => {
            window.location.href = `/?group_id=${groupId}`;
          });
        }
        return () => {
          backButton.hide();
          backButton.unmount();
        };
      } catch (error) {
        console.error("Failed to initialize Telegram SDK:", error);
      }
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
    if (members.length > 0 && amount && splitMode === 'equal') {
      const amountValue = parseFloat(amount);
      if (!isNaN(amountValue)) {
        // Only split among selected participants
        const participantsCount = selectedParticipants.length || 1; // Avoid division by zero
        const equalShare = (amountValue / participantsCount).toFixed(2);
        // Handle rounding issues by giving the remainder to the last member
        const lastMemberExtra = (amountValue - (parseFloat(equalShare) * participantsCount)).toFixed(2);

        const newSplits = members.reduce((acc, member, index) => {
          if (!selectedParticipants.includes(member.uuid)) {
            acc[member.uuid] = "0.00";
          } else if (selectedParticipants.indexOf(member.uuid) === selectedParticipants.length - 1) {
            // Add any remainder to the last selected member's share
            acc[member.uuid] = (parseFloat(equalShare) + parseFloat(lastMemberExtra)).toFixed(2);
          } else {
            acc[member.uuid] = equalShare;
          }
          return acc;
        }, {} as Record<string, string>);

        setSplits(newSplits);
      }
    }
  }, [members, amount, splitMode, selectedParticipants]);

  const handleSplitChange = (userId: string, value: string) => {
    setSplits((prev) => ({
      ...prev,
      [userId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupId || !currentUser || submitting) return;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!description.trim()) {
      setError("Please enter a description");
      return;
    }

    // Validate splits total matches expense amount
    const splitsTotal = calculateSplitTotal(splits);
    if (Math.abs(splitsTotal - amountValue) > 0.01) {
      setError(
        `Split total (${formatNumber(splitsTotal)}) doesn't match expense amount (${formatNumber(amountValue)})`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create expense object
      const expense = {
        group_id: groupId,
        paid_by: paidBy,
        amount: amountValue,
        description,
      };

      // Create expense splits
      const expenseSplits: ExpenseSplitNoExpenseID[] = [];
      for (const [userId, amountStr] of Object.entries(splits)) {
        const splitAmount = parseFloat(amountStr || "0");
        if (!isNaN(splitAmount) && splitAmount > 0) {
          expenseSplits.push({
            user_id: userId,
            amount: splitAmount,
          });
        }
      }

      // Submit to database
      await SupabaseService.addExpense(expense, expenseSplits);

      // Find the payer's username
      const payer = members.find((m) => m.uuid === paidBy);

      // Get the chat ID from the group ID
      const chatId = await SupabaseService.getGroupChatId(groupId);

      if (chatId) {
        // Send notification to the bot server API
        const notificationData = {
          chat_id: chatId,
          action: "add_expense",
          description: description,
          amount: amountValue.toFixed(2),
          payer: payer?.username || "Unknown",
          splits: Object.entries(splits)
            .filter(([_, value]) => parseFloat(value) > 0)
            .map(([userId, value]) => {
              const user = members.find((m) => m.uuid === userId);
              return {
                username: user?.username || "Unknown",
                amount: parseFloat(value).toFixed(2),
              };
            }),
        };

        const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "";
        const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY || "";

        try {
          // Make direct API call with POST method
          const response = await fetch(`${apiUrl}/api/notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            body: JSON.stringify(notificationData),
            mode: "cors",
            credentials: "omit",
          });

          if (!response.ok) {
            console.warn("Notification failed, but expense was saved");
          }
        } catch (notifyErr) {
          // Continue even if notification fails
          console.warn("Failed to send notification, but expense was saved");
        }
      }

      // Redirect regardless of notification success
      window.location.href = `/?group_id=${groupId}`;
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      setError(err.message || "Failed to add expense");
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
      <LoadingError
        loading={loading}
        error={error}
        submitting={submitting}
        groupId={groupId}
      />

      <h1 className="text-2xl font-bold mb-6 text-white">Add Expense</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <ExpenseForm
          description={description}
          setDescription={setDescription}
          amount={amount}
          setAmount={setAmount}
          paidBy={paidBy}
          setPaidBy={setPaidBy}
          members={members}
          currentUser={currentUser}
        />

        <SelectParticipantsSection
          members={members}
          selectedParticipants={selectedParticipants}
          setSelectedParticipants={setSelectedParticipants}
        />

        <SplitSection
          members={members}
          splits={splits}
          splitMode={splitMode}
          setSplitMode={handleSplitModeChange}
          handleSplitChange={handleSplitChange}
          splitsTotal={calculateSplitTotal(splits)}
          amountValue={parseFloat(amount || "0")}
        />

        <div className="flex justify-between gap-4 pt-4">
          <Link
            href={groupId ? `/?group_id=${groupId}` : "/"}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-center flex-1"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || Math.abs(calculateSplitTotal(splits) - parseFloat(amount || "0")) > 0.01}
            className={`px-4 py-3 rounded-md text-white text-center flex-1 ${submitting || Math.abs(calculateSplitTotal(splits) - parseFloat(amount || "0")) > 0.01
              ? "bg-blue-500 opacity-50 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {submitting ? "Adding..." : "Add Expense"}
          </button>
        </div>
      </form>
    </main>
  );
}
