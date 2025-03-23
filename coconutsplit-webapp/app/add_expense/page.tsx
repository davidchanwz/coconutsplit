"use client";

import { useEffect, useState } from "react";
import { parseQueryParams, getTelegramUserId, sendNotificationToBot } from "../../lib/utils";
import { SupabaseService, User } from "../../lib/supabase";
import { init, backButton, mainButton } from "@telegram-apps/sdk";
import Link from "next/link";

interface ExpenseSplit {
  user_id: string;
  amount: number;
}

export default function AddExpense() {
  const params = parseQueryParams();
  const groupId = params.group_id;

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [paidBy, setPaidBy] = useState<string>(""); // New state to track who paid
  const [splits, setSplits] = useState<{ [key: string]: string }>({});
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Telegram SDK only on client-side
    const initTelegramBackButton = async () => {
      try {
        init();
        backButton.mount();
        mainButton.mount();

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
        setPaidBy(userData.uuid); // Set the current user as the default payer

        // Load group members
        const membersData = await SupabaseService.getGroupMembers(groupId);

        // Verify the user is a member of this group
        const isMember = membersData.some(
          (member) => member.uuid === userData.uuid
        );
        if (!isMember) {
          setError("You are not a member of this group.");
          setLoading(false);
          return;
        }

        setMembers(membersData);

        // Initialize equal splits
        if (membersData.length > 0) {
          const initialSplits: { [key: string]: string } = {};
          membersData.forEach((member) => {
            initialSplits[member.uuid] = "";
          });
          setSplits(initialSplits);
        }
      } catch (err) {
        setError("Failed to load group data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [groupId]);

  // Update splits when amount or split mode changes
  useEffect(() => {
    if (splitMode === "equal" && amount && members.length > 0) {
      const amountValue = parseFloat(amount);
      if (!isNaN(amountValue)) {
        const newSplits: { [key: string]: string } = {};
        
        // Calculate fair individual amount
        const fairAmount = amountValue / members.length;
        
        // Convert to cents to avoid floating point issues
        const totalCents = Math.round(amountValue * 100);
        const fairCents = Math.floor(fairAmount * 100);
        const baseCentsPerPerson = fairCents;
        
        // Calculate how many cents to distribute
        const allocatedCents = baseCentsPerPerson * members.length;
        const remainingCents = totalCents - allocatedCents;
        
        // First give everyone the base amount
        members.forEach(member => {
          newSplits[member.uuid] = (baseCentsPerPerson / 100).toFixed(2);
        });
        
        // Distribute remaining cents randomly
        if (remainingCents > 0) {
          // Create array of indices and shuffle it
          const indices = Array.from({ length: members.length }, (_, i) => i);
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          
          // Distribute each remaining cent
          for (let i = 0; i < remainingCents; i++) {
            const memberIdx = indices[i % indices.length];
            const member = members[memberIdx];
            const currentCents = parseFloat(newSplits[member.uuid]) * 100;
            newSplits[member.uuid] = ((currentCents + 1) / 100).toFixed(2);
          }
        }
        
        setSplits(newSplits);
      }
    }
  }, [amount, members.length, splitMode]);

  const handleSplitModeChange = (mode: "equal" | "custom") => {
    setSplitMode(mode);

    // If switching to equal, recalculate splits
    if (mode === "equal" && amount && members.length > 0) {
      const amountValue = parseFloat(amount);
      if (!isNaN(amountValue)) {
        const newSplits: { [key: string]: string } = {};
        
        // Calculate fair individual amount
        const fairAmount = amountValue / members.length;
        
        // Convert to cents to avoid floating point issues
        const totalCents = Math.round(amountValue * 100);
        const fairCents = Math.floor(fairAmount * 100);
        const baseCentsPerPerson = fairCents;
        
        // Calculate how many cents to distribute
        const allocatedCents = baseCentsPerPerson * members.length;
        const remainingCents = totalCents - allocatedCents;
        
        // First give everyone the base amount
        members.forEach(member => {
          newSplits[member.uuid] = (baseCentsPerPerson / 100).toFixed(2);
        });
        
        // Distribute remaining cents randomly
        if (remainingCents > 0) {
          // Create array of indices and shuffle it
          const indices = Array.from({ length: members.length }, (_, i) => i);
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          
          // Distribute each remaining cent
          for (let i = 0; i < remainingCents; i++) {
            const memberIdx = indices[i % indices.length];
            const member = members[memberIdx];
            const currentCents = parseFloat(newSplits[member.uuid]) * 100;
            newSplits[member.uuid] = ((currentCents + 1) / 100).toFixed(2);
          }
        }
        
        setSplits(newSplits);
      }
    }
    // If switching to custom, initialize all splits to 0.00
    else if (mode === "custom") {
      const newSplits: { [key: string]: string } = {};
      members.forEach((member) => {
        newSplits[member.uuid] = "0.00";
      });
      setSplits(newSplits);
    }
  };

  const handleSplitChange = (userId: string, value: string) => {
    setSplits((prev) => ({
      ...prev,
      [userId]: value,
    }));
  };

  const calculateSplitTotal = (): number => {
    return Object.values(splits).reduce((sum, value) => {
      const num = parseFloat(value || "0");
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
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

    // Validate splits total matches expense amount - improved precision check
    const splitsTotal = calculateSplitTotal();
    if (Math.abs(splitsTotal - amountValue) > 0.01) {
      setError(
        `Split total (${splitsTotal.toFixed(
          2
        )}) doesn't match expense amount (${amountValue.toFixed(2)})`
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
      const expenseSplits: ExpenseSplit[] = [];
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
        
        const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || '';
        const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY || '';
        
        try {
          // Make direct API call with POST method
          const response = await fetch(`${apiUrl}/api/notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify(notificationData),
            mode: 'cors',
            credentials: 'omit'
          });
          
          if (!response.ok) {
            console.warn('Notification failed, but expense was saved');
          }
        } catch (notifyErr) {
          // Continue even if notification fails
          console.warn('Failed to send notification, but expense was saved');
        }
      }
      
      // Redirect regardless of notification success
      window.location.href = `/?group_id=${groupId}`;
    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
      setError(err.message || "Failed to add expense");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  if (error && !submitting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
        <div className="text-red-400 mb-6">{error}</div>
        <Link
          href={groupId ? `/?group_id=${groupId}` : "/"}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const splitsTotal = calculateSplitTotal();
  const amountValue = parseFloat(amount || "0");
  const splitsDiff = Math.abs(splitsTotal - amountValue);
  // Improved floating-point comparison with appropriate tolerance (1 cent)
  const splitsMatch = splitsDiff <= 0.01;
  // Determine if we need to add or subtract the difference
  const needsMoreAmount = splitsTotal < amountValue;

  return (
    <main className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-white">Add Expense</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="description" className="block text-gray-300 mb-2">
              Description
            </label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
              placeholder="What was this expense for?"
              required
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-gray-300 mb-2">
              Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-400">$</span>
              </div>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 pl-8 bg-gray-800 border border-gray-700 rounded text-white"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="paidBy" className="block text-gray-300 mb-2">
              Paid by
            </label>
            <select
              id="paidBy"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
              required
            >
              {members.map((member) => (
                <option key={member.uuid} value={member.uuid}>
                  {member.username}
                  {member.uuid === currentUser?.uuid ? " (You)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl text-white">Split Expense</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSplitModeChange("equal")}
                className={`px-3 py-1 rounded text-sm ${
                  splitMode === "equal"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Equal
              </button>
              <button
                type="button"
                onClick={() => handleSplitModeChange("custom")}
                className={`px-3 py-1 rounded text-sm ${
                  splitMode === "custom"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Custom
              </button>
            </div>

          </div>

          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.uuid}
                className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded"
              >
                <span className="text-white">{member.username}</span>
                <div className="flex items-center gap-2">
                  {!splitsMatch && splitMode === "custom" && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentAmount = parseFloat(
                          splits[member.uuid] || "0"
                        );
                        const newAmount = needsMoreAmount
                          ? currentAmount + splitsDiff
                          : Math.max(0, currentAmount - splitsDiff);
                        handleSplitChange(member.uuid, newAmount.toFixed(2));
                      }}
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {needsMoreAmount ? "Add" : "Reduce"} $
                      {splitsDiff.toFixed(2)}
                    </button>
                  )}
                  <div className="relative w-32">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-gray-400">$</span>
                    </div>
                    <input
                      type="number"
                      value={splits[member.uuid] || ""}
                      onChange={(e) =>
                        handleSplitChange(member.uuid, e.target.value)
                      }
                      className="w-full p-2 pl-8 bg-gray-700 border border-gray-600 rounded text-white text-right"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      disabled={splitMode === "equal"}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-800 border border-gray-700 rounded flex justify-between">
            <span className="text-white">Total split</span>
            <span
              className={`font-semibold ${
                splitsMatch ? "text-green-400" : "text-red-400"
              }`}
            >
              ${splitsTotal.toFixed(2)}
            </span>
          </div>

          {!splitsMatch && (
            <div className="mt-2 text-red-400 text-sm">
              {splitsTotal > amountValue
                ? `The split amount is ${splitsDiff.toFixed(
                    2
                  )} more than the expense total`
                : `The split amount is ${splitsDiff.toFixed(
                    2
                  )} less than the expense total`}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-4 pt-4">
          <Link
            href={groupId ? `/?group_id=${groupId}` : "/"}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-center flex-1"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !splitsMatch}
            className={`px-4 py-3 rounded-md text-white text-center flex-1 ${
              submitting || !splitsMatch
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
