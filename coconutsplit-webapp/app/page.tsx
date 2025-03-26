"use client";

import { useEffect, useState } from "react";
import { init, backButton } from "@telegram-apps/sdk";
import { SupabaseService, Expense, User, ExpenseSplit, SimplifiedDebt } from "../lib/supabase";
import { parseQueryParams, getTelegramUserId } from "../lib/utils";
import { calculateUserBalances, simplifyDebtsWithMembers } from "../lib/financial-utils";
import { OutstandingDebts } from "@/components/OutstandingDebts";
import { ExpenseHistory } from "@/components/ExpenseHistory";

import Link from "next/link";

// Define Settlement interface within page
interface Settlement {
  settlement_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  created_at: string;
  group_id: string;
}

// Interface for combined timeline items
interface TimelineItem {
  type: 'expense' | 'settlement' | 'date-separator';
  data: Expense | Settlement | string;
  created_at: string;
}


export default function Home() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groupName, setGroupName] = useState<string>("");

  const [simplifiedDebts, setSimplifiedDebts] = useState<SimplifiedDebt[]>([]);
  const [expenseSplits, setExpenseSplits] = useState<{
    [expenseId: string]: { splits: ExpenseSplit[]; loading: boolean };
  }>({});

  // Format date for grouping in a timezone-safe way
  const formatDateForGrouping = (dateString: string): string => {
    // Parse the date without timezone bias
    const date = new Date(dateString);
    // Get year, month, day components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    // Return YYYY-MM-DD format
    return `${year}-${month}-${day}`;
  };

  // Format date for display in a timezone-safe way
  const formatDateForDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    
    // Compare only the date parts, ignoring time
    const isToday = 
      date.getFullYear() === today.getFullYear() && 
      date.getMonth() === today.getMonth() && 
      date.getDate() === today.getDate();
    
    // Create yesterday date
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const isYesterday = 
      date.getFullYear() === yesterday.getFullYear() && 
      date.getMonth() === yesterday.getMonth() && 
      date.getDate() === yesterday.getDate();
    
    // Return appropriate string based on comparison
    if (isToday) {
      return "Today";
    } else if (isYesterday) {
      return "Yesterday";
    } else {
      // Use more explicit formatting to avoid timezone issues
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      };
      return new Date(date).toLocaleDateString(undefined, options);
    }
  };

  // Combine expenses and settlements into a single timeline when either changes
  useEffect(() => {
    if (expenses.length || settlements.length) {
      // Debug log for troubleshooting
      console.log("Processing timeline items with expenses:", expenses.length, "settlements:", settlements.length);
      
      // First, create all regular timeline items (expenses and settlements)
      const regularItems: TimelineItem[] = [
        ...expenses.map(expense => ({
          type: 'expense' as const,
          data: expense,
          created_at: expense.created_at
        })),
        ...settlements.map(settlement => ({
          type: 'settlement' as const,
          data: settlement,
          created_at: settlement.created_at
        }))
      ];
      
      // Sort by created_at in descending order (newest first)
      regularItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Store already seen date strings to prevent duplicates
      const processedDates = new Set<string>();
      const items: TimelineItem[] = [];
      
      regularItems.forEach(item => {
        const dateGroup = formatDateForGrouping(item.created_at);
        
        // Only add date separator if we haven't seen this date yet
        if (!processedDates.has(dateGroup)) {
          processedDates.add(dateGroup);
          
          const displayDate = formatDateForDisplay(item.created_at);
          console.log(`Adding date separator for ${dateGroup} (displays as: ${displayDate})`);
          
          items.push({
            type: 'date-separator',
            data: displayDate,
            created_at: item.created_at
          });

        }
        
        // Always add the item itself
        items.push(item);
      });
      
      setTimelineItems(items);
    } else {
      setTimelineItems([]);
    }
  }, [expenses, settlements]);

  const fetchGroupData = async () => {
    if (!groupId) return;

    try {
      setLoading(true);

      // Get the Telegram user ID using our utility function
      const telegramUserId = getTelegramUserId();

      if (!telegramUserId) {
        setError("Unable to identify user from Telegram");
        setLoading(false);
        return;
      }

      // Load user data
      const userData = await SupabaseService.getUserByTelegramId(telegramUserId);
      if (!userData) {
        setError("User not found. Please ensure you have joined the group.");
        setLoading(false);
        return;
      }
      setCurrentUser(userData);

      // Load group data
      const [expensesData, membersData, groupData, rawDebtsData, settlementsData] = await Promise.all([
        SupabaseService.getExpenses(groupId),
        SupabaseService.getGroupMembers(groupId),
        SupabaseService.getGroupDetails(groupId),
        SupabaseService.getGroupDebts(groupId),
        SupabaseService.getSettlements(groupId)
      ]);

      // Verify the user is a member of this group
      const isMember = membersData.some((member) => member.uuid === userData.uuid);
      if (!isMember) {
        setError("You are not a member of this group.");
        setLoading(false);
        return;
      }

      // Calculate balances and simplify debts using the utility functions
      const balances = calculateUserBalances(rawDebtsData);
      const simplifiedDebtsData = simplifyDebtsWithMembers(balances, membersData);

      setExpenses(expensesData);
      setSettlements(settlementsData);
      setMembers(membersData);
      setGroupName(groupData?.group_name || "Group Expenses");
      setSimplifiedDebts(simplifiedDebtsData);
    } catch (err) {
      setError("Failed to load group data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
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
    <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 bg-gray-900 min-h-screen">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">{groupName}</h1>
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

      {/* Use the OutstandingDebts component */}
      <OutstandingDebts debts={simplifiedDebts} />

      {/* Use the ExpenseHistory component */}
      <ExpenseHistory 
        timelineItems={timelineItems}
        members={members}
        expenseSplits={expenseSplits}
        onAccordionChange={handleAccordionChange}
        onDeleteExpense={handleDeleteExpense}
        isDeleting={isDeleting}
      />

      {/* Action buttons at the bottom of the page */}
      <div className="fixed bottom-0 left-0 right-0">
        <div className="bg-gray-800/80 backdrop-blur-sm shadow-lg py-3 sm:py-4 px-2 sm:px-4">
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
