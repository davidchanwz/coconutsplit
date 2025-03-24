"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SupabaseService, Expense, User, ExpenseSplit } from "../lib/supabase";
import { parseQueryParams, getTelegramUserId } from "../lib/utils";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Home() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groupName, setGroupName] = useState<string>("");
  const [expenseSplits, setExpenseSplits] = useState<{
    [expenseId: string]: { splits: ExpenseSplit[]; loading: boolean };
  }>({});

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

        // Load group data
        const [expensesData, membersData, groupData] = await Promise.all([
          SupabaseService.getExpenses(groupId),
          SupabaseService.getGroupMembers(groupId),
          SupabaseService.getGroupDetails(groupId),
        ]);

        // Verify the user is a member of this group
        const isMember = membersData.some(
          (member) => member.uuid === userData.uuid
        );
        if (!isMember) {
          setError("You are not a member of this group.");
          setLoading(false);
          return;
        }

        setExpenses(expensesData);
        setMembers(membersData);
        setGroupName(groupData?.group_name || "Group Expenses");
      } catch (err) {
        setError("Failed to load group data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [groupId]);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!groupId || isDeleting) return;

    try {
      setIsDeleting(expenseId);

      // Find the expense that's being deleted to include in notification
      const expenseToDelete = expenses.find(
        (expense) => expense.expense_id === expenseId
      );

      await SupabaseService.deleteExpense(expenseId, groupId);

      // Update the expenses list after deletion
      setExpenses(
        expenses.filter((expense) => expense.expense_id !== expenseId)
      );

      // Send notification to the bot about the deleted expense
      if (expenseToDelete) {
        try {
          // Get the chat ID from the group ID
          const chatId = await SupabaseService.getGroupChatId(groupId);

          if (chatId) {
            // Find the payer's username
            const payer = members.find(
              (m) => m.uuid === expenseToDelete.paid_by
            );

            // Send notification to the bot server API
            const notificationData = {
              chat_id: chatId,
              action: "delete_expense",
              description: expenseToDelete.description,
              amount: expenseToDelete.amount.toFixed(2),
              payer: payer?.username || "Unknown",
            };

            const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "";
            const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY || "";

            // Make direct API call with POST method
            await fetch(`${apiUrl}/api/notify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
              },
              body: JSON.stringify(notificationData),
              mode: "cors",
              credentials: "omit",
            });
          }
        } catch (notifyErr) {
          // Continue even if notification fails
          console.warn("Failed to send delete notification:", notifyErr);
        }
      }
    } catch (err) {
      setError("Failed to delete expense");
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleAccordionChange = async (value: string, expenseId: string) => {
    // Only load splits when accordion is opened and we don't have the data yet
    if (value && (!expenseSplits[expenseId] || !expenseSplits[expenseId].splits.length)) {
      try {
        // Mark as loading
        setExpenseSplits(prev => ({
          ...prev,
          [expenseId]: { splits: [], loading: true }
        }));
        
        // Fetch the expense splits
        const splits = await SupabaseService.getExpenseSplits(expenseId);
        
        // Store the fetched splits
        setExpenseSplits(prev => ({
          ...prev,
          [expenseId]: { splits, loading: false }
        }));
      } catch (err) {
        console.error("Failed to load expense splits:", err);
        setExpenseSplits(prev => ({
          ...prev,
          [expenseId]: { splits: [], loading: false }
        }));
      }
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{groupName}</h1>
        {currentUser && (
          <div className="text-gray-300 mt-2">
            Hello, {currentUser.username}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      <div className="grid gap-6 mb-8">
        {expenses.map((expense) => {
          const paidBy = members.find((m) => m.uuid === expense.paid_by);
          return (
            <div
              key={expense.expense_id}
              className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow"
            >
              <Accordion 
                type="single" 
                collapsible
                onValueChange={(value) => handleAccordionChange(value, expense.expense_id)}
              >
                <AccordionItem value="item-1" className="">
                  <div className="flex-1 items-start mb-4">
                    <AccordionTrigger className="flex-1 p-0 pr-4">
                      <div className="flex justify-between w-full items-start">
                        <div>
                          <h2 className="text-xl font-semibold text-white">
                            {expense.description}
                          </h2>
                          <p className="text-gray-300">
                            Paid by {paidBy?.username || "Unknown User"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">
                            ${expense.amount.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-400">
                            {new Date(expense.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteExpense(expense.expense_id);
                        }}
                        disabled={isDeleting === expense.expense_id}
                        className={`p-2 rounded-full text-red-400 hover:text-red-300 hover:bg-gray-700 focus:outline-none transition-colors ${
                          isDeleting === expense.expense_id
                            ? "opacity-50 cursor-wait"
                            : ""
                        }`}
                        title="Delete expense"
                      >
                        {isDeleting === expense.expense_id ? (
                          <span className="block h-5 w-5 animate-spin rounded-full border-2 border-t-red-400"></span>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </AccordionTrigger>
                  </div>
                  <AccordionContent>
                    <div className="pt-4 pb-2 text-gray-300">
                      <h3 className="text-lg font-semibold mb-2 text-white">Expense Breakdown</h3>
                      {expenseSplits[expense.expense_id]?.loading ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-400"></div>
                        </div>
                      ) : expenseSplits[expense.expense_id]?.splits.length ? (
                        <div className="space-y-2">
                          {/* Display other users' splits first */}
                          {expenseSplits[expense.expense_id].splits.map((split) => {
                            const user = members.find((m) => m.uuid === split.user_id);
                            return (
                              <div key={`${split.expense_id}-${split.user_id}`} className="flex justify-between py-1 border-b border-gray-700">
                                <span>{user?.username || "Unknown User"}</span>
                                <span className="font-medium">${split.amount.toFixed(2)}</span>
                              </div>
                            );
                          })}
                          
                          {/* Calculate and display payer's share */}
                          {(() => {
                            // Calculate the sum of all splits
                            const splitsTotal = expenseSplits[expense.expense_id].splits.reduce(
                              (sum, split) => sum + split.amount, 
                              0
                            );
                            
                            // Calculate how much the payer contributed (total - sum of splits)
                            const payerAmount = Math.max(0, +(expense.amount - splitsTotal).toFixed(2));
                            
                            // Only show the payer's row if they contributed something or if they're not in the splits
                            if (payerAmount > 0 || !expenseSplits[expense.expense_id].splits.some(s => s.user_id === expense.paid_by)) {
                              return (
                                <div className="flex justify-between py-1 border-b border-gray-700">
                                  <span className="font-medium text-blue-400">
                                    {paidBy?.username || "Unknown User"} (payer)
                                  </span>
                                  <span className="font-medium">${payerAmount.toFixed(2)}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* Display total row */}
                          <div className="flex justify-between py-2 border-t border-gray-600 mt-2 font-bold">
                            <span>Total</span>
                            <span>${expense.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-400">No split information available.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          );
        })}
      </div>

      {expenses.length === 0 && (
        <div className="text-center text-gray-400 mt-8 mb-16">
          No expenses recorded yet.
        </div>
      )}

      {/* Action buttons at the bottom of the page */}
      <div className="fixed bottom-0 left-0 right-0">
        <div className="bg-gray-800/80 backdrop-blur-sm shadow-lg py-4 px-4">
          <div className="max-w-screen-lg mx-auto flex gap-4">
            <Link
              href={
                groupId ? `/add_expense?group_id=${groupId}` : "/add_expense"
              }
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-center font-medium"
            >
              Add Expense
            </Link>
            <Link
              href={groupId ? `/settle_up?group_id=${groupId}` : "/settle_up"}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-center font-medium"
            >
              Settle Up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
