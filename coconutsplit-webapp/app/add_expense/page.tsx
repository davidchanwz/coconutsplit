'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SupabaseService, User, Expense, ExpenseSplit } from '../../lib/supabase';
import { parseQueryParams } from '../../lib/utils';

export default function AddExpense() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const userId = params.user_id;
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    splits: [] as { userId: string; amount: string }[]
  });

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;

      try {
        const membersData = await SupabaseService.getGroupMembers(groupId);
        setMembers(membersData);

        if (userId) {
          const userData = await SupabaseService.getUser(userId);
          if (!userData) {
            setError('Invalid user ID');
            return;
          }
          setCurrentUser(userData);
        }
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [groupId, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !currentUser) return;

    try {
      const expense: Omit<Expense, 'expense_id' | 'created_at'> = {
        group_id: groupId,
        paid_by: currentUser.uuid,
        description: formData.description,
        amount: parseFloat(formData.amount)
      };

      const splits: Omit<ExpenseSplit, 'expense_id'>[] = formData.splits
        .filter(split => split.amount && parseFloat(split.amount) > 0)
        .map(split => ({
          user_id: split.userId,
          amount: parseFloat(split.amount)
        }));

      await SupabaseService.addExpense(expense, splits);
      window.location.href = `/?group_id=${groupId}`;
    } catch (err) {
      setError('Failed to add expense');
      console.error(err);
    }
  };

  const addSplit = () => {
    setFormData(prev => ({
      ...prev,
      splits: [...prev.splits, { userId: '', amount: '' }]
    }));
  };

  const updateSplit = (index: number, field: 'userId' | 'amount', value: string) => {
    setFormData(prev => ({
      ...prev,
      splits: prev.splits.map((split, i) => 
        i === index ? { ...split, [field]: value } : split
      )
    }));
  };

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
      <h1 className="text-3xl font-bold mb-8">Add New Expense</h1>
      
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <input
            type="text"
            required
            className="w-full px-3 py-2 border rounded-md"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border rounded-md"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
          />
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Splits</h2>
          {formData.splits.map((split, index) => (
            <div key={index} className="flex gap-4 mb-4">
              <select
                required
                className="flex-1 px-3 py-2 border rounded-md"
                value={split.userId}
                onChange={(e) => updateSplit(index, 'userId', e.target.value)}
              >
                <option value="">Select User</option>
                {members.map(member => (
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
                className="w-32 px-3 py-2 border rounded-md"
                placeholder="Amount"
                value={split.amount}
                onChange={(e) => updateSplit(index, 'amount', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addSplit}
            className="text-blue-500 hover:text-blue-700"
          >
            + Add Split
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
        >
          Add Expense
        </button>
      </form>
    </main>
  );
} 