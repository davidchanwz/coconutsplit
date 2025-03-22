"use client";

import { useEffect, useState } from "react";
import {
  SupabaseService,
  User,
  Expense,
  ExpenseSplit,
} from "../../lib/supabase";
import { parseQueryParams } from "../../lib/utils";
import { init, backButton } from "@telegram-apps/sdk";

export default function AddExpense() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const userId = params.user_id;
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    splits: [] as { userId: string; amount: string }[],
  });
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
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
            // Navigate to the home page and pass along the group_id
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
      // Call the cleanup function if it exists
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
        const membersData = await SupabaseService.getGroupMembers(groupId);
        setMembers(membersData);

        //Check if there's only one member in the group and it's the same as userId
        if (membersData.length === 1 && membersData[0].uuid === userId) {
          setError(
            "You can't create an expense in a group with only yourself. Add more members to the group first."
          );
          setLoading(false);
          return;
        }

        if (userId) {
          const userData = await SupabaseService.getUser(userId);
          if (!userData) {
            setError("Invalid user ID");
            return;
          }
          setCurrentUser(userData);
        }
      } catch (err) {
        setError("Failed to load data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [groupId, userId]);

  const calculateSplitsTotal = (): number => {
    return formData.splits.reduce((total, split) => {
      return total + (parseFloat(split.amount) || 0);
    }, 0);
  };

  const distributeAmountEqually = (
    amount: number,
    splits: { userId: string; amount: string }[]
  ) => {
    if (splits.length === 0 || amount <= 0) return splits;

    const equalAmount = (amount / splits.length).toFixed(2);
    return splits.map((split) => ({
      ...split,
      amount: equalAmount,
    }));
  };

  const updateEqualSplits = (amount: number) => {
    if (members.length === 0) return [];

    const equalAmount = (amount / members.length).toFixed(2);
    return members.map((member) => ({
      userId: member.uuid,
      amount: equalAmount,
    }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    const numericAmount = parseFloat(newAmount) || 0;

    setFormData((prev) => {
      // If equal splits, generate them for all members
      if (splitType === "equal") {
        return {
          ...prev,
          amount: newAmount,
          splits: updateEqualSplits(numericAmount),
        };
      }

      // For custom splits, use existing logic
      return {
        ...prev,
        amount: newAmount,
        splits: distributeAmountEqually(numericAmount, prev.splits),
      };
    });
  };

  const addSplit = () => {
    if (members.length === formData.splits.length) return;

    const expenseAmount = parseFloat(formData.amount) || 0;

    setFormData((prev) => {
      const newSplits = [...prev.splits, { userId: "", amount: "0" }];
      return {
        ...prev,
        splits: distributeAmountEqually(expenseAmount, newSplits),
      };
    });
  };

  const updateSplit = (
    index: number,
    field: "userId" | "amount",
    value: string
  ) => {
    setFormData((prev) => {
      const newSplits = [...prev.splits];

      if (field === "userId") {
        newSplits[index] = { ...newSplits[index], userId: value };
      } else {
        // For amount changes, just update the value without auto-adjusting other splits
        newSplits[index] = { ...newSplits[index], amount: value };
      }

      return { ...prev, splits: newSplits };
    });
  };

  const removeSplit = (indexToRemove: number) => {
    setFormData((prev) => {
      const newSplits = prev.splits.filter(
        (_, index) => index !== indexToRemove
      );
      const expenseAmount = parseFloat(prev.amount) || 0;
      return {
        ...prev,
        splits: distributeAmountEqually(expenseAmount, newSplits),
      };
    });
  };

  const handleSplitTypeChange = (type: "equal" | "custom") => {
    setSplitType(type);

    // Update splits based on the new type
    const expenseAmount = parseFloat(formData.amount) || 0;
    if (type === "equal") {
      setFormData((prev) => ({
        ...prev,
        splits: updateEqualSplits(expenseAmount),
      }));
    } else if (formData.splits.length === 0) {
      // For switching to custom with no existing splits, add one empty split
      setFormData((prev) => ({
        ...prev,
        splits: [{ userId: "", amount: "0" }],
      }));
    }
  };

  const calculateRemainingToSplit = (): number => {
    const expenseAmount = parseFloat(formData.amount) || 0;
    const splitsTotal = calculateSplitsTotal();
    return expenseAmount - splitsTotal;
  };

  const addRemainingToUser = (userIndex: number) => {
    setFormData((prev) => {
      const newSplits = [...prev.splits];
      const remainingAmount = calculateRemainingToSplit();

      if (Math.abs(remainingAmount) <= 0.01) return prev; // No remaining amount to add

      const currentAmount = parseFloat(newSplits[userIndex].amount) || 0;
      const newAmount = currentAmount + remainingAmount;

      if (newAmount < 0) return prev; // Don't allow negative amounts

      newSplits[userIndex] = {
        ...newSplits[userIndex],
        amount: newAmount.toFixed(2),
      };

      return { ...prev, splits: newSplits };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !currentUser || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const expenseAmount = parseFloat(formData.amount);

      // Validate amount
      if (expenseAmount <= 0) {
        setError("Please enter a valid expense amount greater than 0.");
        return;
      }

      if (expenseAmount >= 100000000) {
        setError(
          "Expense amount is too large. Maximum value is 99,999,999.99."
        );
        return;
      }

      // For equal splits, make sure we have the latest equal splits generated
      let splitsToSubmit: Omit<ExpenseSplit, "expense_id">[];

      if (splitType === "equal") {
        const equalSplits = updateEqualSplits(expenseAmount);
        splitsToSubmit = equalSplits
          .filter((split) => split.userId && parseFloat(split.amount) > 0)
          .map((split) => ({
            user_id: split.userId,
            amount: parseFloat(split.amount),
          }));
      } else {
        // Validate custom splits
        const splitsTotal = calculateSplitsTotal();
        if (Math.abs(splitsTotal - expenseAmount) > 0.01) {
          setError(
            `The sum of splits (${splitsTotal.toFixed(
              2
            )}) doesn't match the total expense amount (${expenseAmount.toFixed(
              2
            )})`
          );
          return;
        }

        splitsToSubmit = formData.splits
          .filter((split) => split.userId && parseFloat(split.amount) > 0)
          .map((split) => ({
            user_id: split.userId,
            amount: parseFloat(split.amount),
          }));
      }

      // Validate we have at least one split
      if (splitsToSubmit.length === 0) {
        setError("Please create at least one split with a valid amount.");
        return;
      }

      // Create expense object
      const expense: Omit<Expense, "expense_id" | "created_at"> = {
        group_id: groupId,
        paid_by: currentUser.uuid,
        description: formData.description,
        amount: expenseAmount,
      };

      // Submit
      await SupabaseService.addExpense(expense, splitsToSubmit);
      window.location.href = `/?group_id=${groupId}`;
    } catch (err) {
      setError("Failed to add expense");
      console.error(err);
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
    <main className="container mx-auto px-4 py-8 bg-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-white">Add New Expense</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <input
            type="text"
            required
            className="w-full px-3 py-2 border bg-gray-800 border-gray-700 text-white rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border bg-gray-800 border-gray-700 text-white rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={formData.amount}
            onChange={handleAmountChange}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Split Type
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              className={`px-4 py-2 rounded-md ${
                splitType === "equal"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
              onClick={() => handleSplitTypeChange("equal")}
            >
              Equal Splits
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-md ${
                splitType === "custom"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
              onClick={() => handleSplitTypeChange("custom")}
            >
              Custom Splits
            </button>
          </div>
        </div>

        {splitType === "equal" ? (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Equal Splits
            </h2>
            <div className="p-4 bg-gray-800 rounded-md text-gray-300">
              Each member will pay{" "}
              {members.length
                ? ((parseFloat(formData.amount) || 0) / members.length).toFixed(
                    2
                  )
                : "0.00"}
              <ul className="mt-2 space-y-1">
                {members.map((member) => (
                  <li key={member.uuid}>• {member.username}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Custom Splits
            </h2>
            <div
              className={`mb-2 text-sm ${
                Math.abs(calculateRemainingToSplit()) > 0.01
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              {Math.abs(calculateRemainingToSplit()) > 0.01 ? (
                <>
                  <span className="inline-block mr-2">⚠️</span>
                  Remaining to split: ${calculateRemainingToSplit().toFixed(
                    2
                  )}{" "}
                  of ${formData.amount || "0.00"}
                </>
              ) : (
                <>
                  <span className="inline-block mr-2">✓</span>
                  Splits total matches expense amount: $
                  {formData.amount || "0.00"}
                </>
              )}
            </div>

            {formData.splits.map((split, index) => (
              <div key={index} className="flex gap-4 mb-4">
                <select
                  required
                  className="flex-1 px-3 py-2 border bg-gray-800 border-gray-700 text-white rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={split.userId}
                  onChange={(e) => updateSplit(index, "userId", e.target.value)}
                >
                  <option value="">Select User</option>
                  {members
                    .filter(
                      (member) =>
                        member.uuid === split.userId ||
                        !formData.splits.some((s) => s.userId === member.uuid)
                    )
                    .map((member) => (
                      <option key={member.uuid} value={member.uuid}>
                        {member.username}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  className="w-32 px-3 py-2 border bg-gray-800 border-gray-700 text-white rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Amount"
                  value={split.amount}
                  onChange={(e) => updateSplit(index, "amount", e.target.value)}
                />
                {split.userId &&
                  Math.abs(calculateRemainingToSplit()) > 0.01 && (
                    <button
                      type="button"
                      onClick={() => addRemainingToUser(index)}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 whitespace-nowrap font-medium transition-colors"
                      title="Add remaining amount to this user"
                    >
                      +${calculateRemainingToSplit().toFixed(2)}
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => removeSplit(index)}
                  className="px-2 py-1 text-red-400 hover:text-red-300 focus:outline-none"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addSplit}
              className={`text-blue-400 hover:text-blue-300 ${
                formData.splits.length >= members.length
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={formData.splits.length >= members.length}
            >
              + Add Split
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${
            isSubmitting
              ? "bg-blue-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          } text-white py-2 px-4 rounded-md transition-colors`}
        >
          {isSubmitting ? "Adding Expense..." : "Add Expense"}
        </button>
      </form>
    </main>
  );
}
