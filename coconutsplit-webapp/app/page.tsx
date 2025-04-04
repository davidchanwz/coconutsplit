"use client";

import { useState, useEffect } from "react";
import { SupabaseService } from "../lib/supabase";
import { parseQueryParams } from "../lib/utils";
import { OutstandingDebts } from "@/components/OutstandingDebts";
import { ExpenseHistory } from "@/components/ExpenseHistory";
import { useGroupData } from "@/hooks/useGroupData";
import { createTimelineItems } from "@/lib/timeline";
import { ExpenseSplit, TimelineItem } from "@/lib/types";
import { init, backButton } from '@telegram-apps/sdk-react';
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Home() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [expenseSplits, setExpenseSplits] = useState<{
    [expenseId: string]: { splits: ExpenseSplit[]; loading: boolean };
  }>({});

  const {
    expenses,
    setExpenses,
    settlements,
    setSettlements,
    members,
    loading,
    error,
    currentUser,
    groupName,
    simplifiedDebts,
    isDeleting,
    setIsDeleting,
  } = useGroupData(groupId);

  useEffect(() => {
    try {
      init();
      backButton.mount();
    } catch (error) {
      console.error("Failed to initialize Telegram SDK:", error);
    }
  }, []);

  useEffect(() => {
    setTimelineItems(createTimelineItems(expenses, settlements));
  }, [expenses, settlements]);

  const handleDeleteSettlement = async (settlementId: string) => {
    if (!groupId || isDeleting) return;

    try {
      setIsDeleting(settlementId);

      // Find the settlement that's being deleted to include in notification
      const settlementToDelete = settlements.find(
        (settlement) => settlement.settlement_id === settlementId
      );

      await SupabaseService.deleteSettlement(settlementId, groupId);

      // Update the settlements list after deletion
      setSettlements((prev) =>
        prev.filter((settlement) => settlement.settlement_id !== settlementId)
      );

      // Send notification to the bot about the deleted settlement
      if (settlementToDelete) {
        try {
          // Get the chat ID from the group ID
          const chatId = await SupabaseService.getGroupChatId(groupId);

          if (chatId) {
            // Find the involved users' usernames
            const fromUser = members.find(
              (m) => m.uuid === settlementToDelete.from_user
            );
            const toUser = members.find(
              (m) => m.uuid === settlementToDelete.to_user
            );

            // Send notification to the bot server API
            const notificationData = {
              chat_id: chatId,
              action: "delete_settlement",
              amount: settlementToDelete.amount.toFixed(2),
              from_user: fromUser?.username || "Unknown",
              to_user: toUser?.username || "Unknown",
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
      setDeleteError("Failed to delete settlement");
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

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
      setDeleteError("Failed to delete expense");
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleAccordionChange = async (value: string, expenseId: string) => {
    // Only load splits when accordion is opened and we don't have the data yet
    if (
      value &&
      (!expenseSplits[expenseId] || !expenseSplits[expenseId].splits.length)
    ) {
      try {
        // Mark as loading
        setExpenseSplits((prev) => ({
          ...prev,
          [expenseId]: { splits: [], loading: true },
        }));

        // Fetch the expense splits
        const splits = await SupabaseService.getExpenseSplits(expenseId);

        // Store the fetched splits
        setExpenseSplits((prev) => ({
          ...prev,
          [expenseId]: { splits, loading: false },
        }));
      } catch (err) {
        console.error("Failed to load expense splits:", err);
        setExpenseSplits((prev) => ({
          ...prev,
          [expenseId]: { splits: [], loading: false },
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
    <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 bg-gray-900 min-h-screen">
      <div className="mb-4 sm:mb-8 pl-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Group: {groupName}
        </h1>
        {currentUser && (
          <div className="text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base">
            Hello, {currentUser.username}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-900 border border-red-700 text-red-200 rounded text-sm sm:text-base">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">

        <h2 className="text-lg sm:text-xl font-semibold text-white pl-4">Outstanding Debts</h2>

        <Dialog>
          <DialogTrigger asChild>
            <button className="rounded-full w-6 h-6 bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center text-sm">
              ?
            </button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 text-gray-200">
            <DialogHeader>
              <DialogTitle className="text-gray-100">How Simplified Debts Work</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Our system simplifies group debts to minimise the number of transactions needed to settle up.
              </p>
              <p>
                Instead of tracking individual transactions between each pair of people, we:
              </p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Calculate the net balance for each person</li>
                <li>Identify who owes money (negative balance) and who should receive money (positive balance)</li>
                <li>Create the minimum number of transactions to settle all debts</li>
              </ol>
              <p>
                This means you might end up paying someone you didn't directly share expenses with, but the total amount you pay or receive will always be correct.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Use the OutstandingDebts component */}
      <OutstandingDebts debts={simplifiedDebts} />

      {/* Use the ExpenseHistory component */}
      <ExpenseHistory
        timelineItems={timelineItems}
        members={members}
        expenseSplits={expenseSplits}
        onAccordionChange={handleAccordionChange}
        onDeleteExpense={handleDeleteExpense}
        onDeleteSettlement={handleDeleteSettlement}
        isDeleting={isDeleting}
      />

      {/* Action buttons at the bottom of the page */}
      <div className="fixed bottom-0 left-0 right-0 pb-5 bg-gray-800/80">
        <div className=" backdrop-blur-sm shadow-lg py-3 sm:py-4 px-2 sm:px-4">
          <div className="max-w-screen-lg mx-auto flex gap-2 sm:gap-4">
            <Link
              href={
                groupId ? `/add_expense?group_id=${groupId}` : "/add_expense"
              }
              className="flex-1 px-2 sm:px-4 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md transition-colors text-center font-medium text-sm sm:text-base"
            >
              Add Expense
            </Link>
            <Link
              href={groupId ? `/settle_up?group_id=${groupId}` : "/settle_up"}
              className="flex-1 px-2 sm:px-4 py-2 sm:py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-md transition-colors text-center font-medium text-sm sm:text-base"
            >
              Settle Up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
