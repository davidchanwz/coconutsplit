'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SupabaseService, Expense, User } from '../lib/supabase';
import { parseQueryParams } from '../lib/utils';

export default function Home() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;

      try {
        const [expensesData, membersData] = await Promise.all([
          SupabaseService.getExpenses(groupId),
          SupabaseService.getGroupMembers(groupId)
        ]);

        setExpenses(expensesData);
        setMembers(membersData);
      } catch (err) {
        setError('Failed to load group data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Group Expenses</h1>
      
      <div className="grid gap-6">
        {expenses.map((expense) => {
          const paidBy = members.find(m => m.uuid === expense.paid_by);
          return (
            <div key={expense.expense_id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{expense.description}</h2>
                  <p className="text-gray-600">
                    Paid by {paidBy?.username || 'Unknown User'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${expense.amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(expense.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {expenses.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          No expenses recorded yet.
        </div>
      )}
    </main>
  );
}
