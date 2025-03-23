'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SupabaseService, Expense, User } from '../lib/supabase';
import { parseQueryParams, getTelegramUserId } from '../lib/utils';
import Link from 'next/link';

export default function Home() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groupName, setGroupName] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;

      try {
        // Get the Telegram user ID using our utility function
        const telegramUserId = getTelegramUserId();
        
        if (!telegramUserId) {
          setError('Unable to identify user from Telegram');
          setLoading(false);
          return;
        }

        // Load user data
        const userData = await SupabaseService.getUserByTelegramId(telegramUserId);
        if (!userData) {
          setError('User not found. Please ensure you have joined the group.');
          setLoading(false);
          return;
        }
        setCurrentUser(userData);

        // Load group data
        const [expensesData, membersData, groupData] = await Promise.all([
          SupabaseService.getExpenses(groupId),
          SupabaseService.getGroupMembers(groupId),
          SupabaseService.getGroupDetails(groupId)
        ]);

        // Verify the user is a member of this group
        const isMember = membersData.some(member => member.uuid === userData.uuid);
        if (!isMember) {
          setError('You are not a member of this group.');
          setLoading(false);
          return;
        }

        setExpenses(expensesData);
        setMembers(membersData);
        setGroupName(groupData?.group_name || 'Group Expenses');
      } catch (err) {
        setError('Failed to load group data');
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
      const expenseToDelete = expenses.find(expense => expense.expense_id === expenseId);
      
      await SupabaseService.deleteExpense(expenseId, groupId);
      
      // Update the expenses list after deletion
      setExpenses(expenses.filter(expense => expense.expense_id !== expenseId));
      
      // Send notification to the bot about the deleted expense
      if (expenseToDelete) {
        try {
          // Get the chat ID from the group ID
          const chatId = await SupabaseService.getGroupChatId(groupId);
          
          if (chatId) {
            // Find the payer's username
            const payer = members.find((m) => m.uuid === expenseToDelete.paid_by);
            
            // Send notification to the bot server API
            const notificationData = {
              chat_id: chatId,
              action: "delete_expense",
              description: expenseToDelete.description,
              amount: expenseToDelete.amount.toFixed(2),
              payer: payer?.username || "Unknown",
            };
            
            const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || '';
            const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY || '';
            
            // Make direct API call with POST method
            await fetch(`${apiUrl}/api/notify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
              },
              body: JSON.stringify(notificationData),
              mode: 'cors',
              credentials: 'omit'
            });
          }
        } catch (notifyErr) {
          // Continue even if notification fails
          console.warn('Failed to send delete notification:', notifyErr);
        }
      }
    } catch (err) {
      setError('Failed to delete expense');
      console.error(err);
    } finally {
      setIsDeleting(null);
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
          <div className="text-gray-300 mt-2">Hello, {currentUser.username}</div>
        )}
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}
      
      <div className="grid gap-6 mb-8">
        {expenses.map((expense) => {
          const paidBy = members.find(m => m.uuid === expense.paid_by);
          return (
            <div key={expense.expense_id} className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{expense.description}</h2>
                  <p className="text-gray-300">
                    Paid by {paidBy?.username || 'Unknown User'}
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">${expense.amount.toFixed(2)}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(expense.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDeleteExpense(expense.expense_id)}
                    disabled={isDeleting === expense.expense_id}
                    className={`p-2 rounded-full text-red-400 hover:text-red-300 hover:bg-gray-700 focus:outline-none transition-colors ${
                      isDeleting === expense.expense_id ? 'opacity-50 cursor-wait' : ''
                    }`}
                    title="Delete expense"
                  >
                    {isDeleting === expense.expense_id ? (
                      <span className="block h-5 w-5 animate-spin rounded-full border-2 border-t-red-400"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
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
              href={groupId ? `/add_expense?group_id=${groupId}` : '/add_expense'} 
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-center font-medium"
            >
              Add Expense
            </Link>
            <Link 
              href={groupId ? `/settle_up?group_id=${groupId}` : '/settle_up'} 
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
