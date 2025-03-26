"use client";

import { useEffect, useState, useRef } from "react";
import { init, backButton } from "@telegram-apps/sdk";
import { SupabaseService, Expense, User, ExpenseSplit, SimplifiedDebt } from "../lib/supabase";
import { parseQueryParams, getTelegramUserId } from "../lib/utils";
import { calculateUserBalances, simplifyDebtsWithMembers } from "../lib/financial-utils";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  const [shouldRefresh, setShouldRefresh] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);


  // useEffect(() => {
  //   try {
  //     init();
  //     backButton.mount();
  //     if (backButton.hide.isAvailable()) {
  //       backButton.hide();
  //     }
  //     backButton.unmount();
  //   } catch (error) {
  //     console.error("Failed to initialize Telegram SDK:", error);
  //   }
  // }, []);

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


  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setShouldRefresh(true);
      }
    };

    const handleFocus = () => {
      setShouldRefresh(true);
    };

    // Add event listeners for page visibility and focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Set up polling interval for data refresh (every 30 seconds)
    pollingIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setShouldRefresh(true);
      }
    }, 30000); // Check every 30 seconds

    return () => {
      // Clean up event listeners and interval
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (shouldRefresh) {
      fetchGroupData().then(() => {
        setShouldRefresh(false);
      });
    }
  }, [shouldRefresh]);

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


      {/* Debts summary section */}
      {simplifiedDebts.length > 0 && (
        <div className="mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden border-l-4 border-green-500">
            <div className="px-4 py-3 bg-gray-800/80">
              <h2 className="text-sm font-semibold text-white flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Outstanding Debts
              </h2>
            </div>
            <div className="px-4 py-2 divide-y divide-gray-700/50">
              {simplifiedDebts.map((debt, index) => (
                <div key={`summary-debt-${index}`} className="flex justify-between text-xs py-1.5">
                  <span className="text-gray-300">
                    <span className="font-medium">{debt.from.username}</span>{" "}
                    <span className="text-gray-500">owes</span>{" "}
                    <span className="font-medium">{debt.to.username}</span>
                  </span>
                  <span className="text-green-400 font-medium">${debt.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Divider */}
          <div className="flex items-center justify-center my-6">
            <span className="text-stone-200 text-2xl margin-auto font-medium">EXPENSE HISTORY</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 mb-8">
        {timelineItems.length > 0 ? (
          timelineItems.map((item, index) => {
            if (item.type === 'date-separator') {
              return (
                <div 
                  key={`date-${index}`} 
                  className="flex items-center my-4 first:mt-0"
                >
                  <div className="flex-grow border-t border-gray-700 mr-4"></div>
                  <span className="text-gray-400 text-sm font-medium px-3 py-1 bg-gray-800 rounded-full">
                    {item.data as string}
                  </span>
                  <div className="flex-grow border-t border-gray-700 ml-4"></div>
                </div>
              );
            } else if (item.type === 'expense') {
              const expense = item.data as Expense;
              const paidBy = members.find((m) => m.uuid === expense.paid_by);
              return (
                <div
                  key={`expense-${expense.expense_id}`}
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
            } else {
              // This is a settlement
              const settlement = item.data as Settlement;
              const fromUser = members.find((m) => m.uuid === settlement.from_user);
              const toUser = members.find((m) => m.uuid === settlement.to_user);
              
              return (
                <div
                  key={`settlement-${settlement.settlement_id}`}
                  className="bg-gray-800 border-l-4 border-green-500 p-4 rounded-lg shadow"
                >
                  <div className="flex items-center">
                    <div className="bg-green-500/20 p-2 rounded-full mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between">
                        <h3 className="font-medium text-white">Settlement</h3>
                        <span className="text-green-400 font-bold">${settlement.amount.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-gray-300">
                        <span className="font-medium">{fromUser?.username || "Unknown"}</span> paid{" "}
                        <span className="font-medium">{toUser?.username || "Unknown"}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(settlement.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
          })
        ) : (
          <div className="text-center text-gray-400 mt-8 mb-16">
            No expenses or settlements recorded yet.
          </div>
        )}
      </div>

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
