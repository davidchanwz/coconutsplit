'use client';

import { useEffect, useState } from 'react';
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

        //Check if there's only one member in the group and it's the same as userId
        if (membersData.length === 1 && membersData[0].uuid === userId) {
          setError("You can't create an expense in a group with only yourself. Add more members to the group first.");
          setLoading(false);
          return;
        }

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

  const calculateSplitsTotal = (): number => {
    return formData.splits.reduce((total, split) => {
      return total + (parseFloat(split.amount) || 0);
    }, 0);
  };

  const distributeAmountEqually = (amount: number, splits: { userId: string; amount: string }[]) => {
    if (splits.length === 0 || amount <= 0) return splits;
    
    const equalAmount = (amount / splits.length).toFixed(2);
    return splits.map(split => ({
      ...split,
      amount: equalAmount
    }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    const numericAmount = parseFloat(newAmount) || 0;
    
    setFormData(prev => ({
      ...prev,
      amount: newAmount,
      splits: distributeAmountEqually(numericAmount, prev.splits)
    }));
  };

  const addSplit = () => {
    if (members.length === formData.splits.length) return;
    
    const expenseAmount = parseFloat(formData.amount) || 0;
    
    setFormData(prev => {
      const newSplits = [...prev.splits, { userId: '', amount: '0' }];
      return {
        ...prev,
        splits: distributeAmountEqually(expenseAmount, newSplits)
      };
    });
  };

  const updateSplit = (index: number, field: 'userId' | 'amount', value: string) => {
    setFormData(prev => {
      const newSplits = [...prev.splits];
      newSplits[index] = { ...newSplits[index], [field]: value };
      
      if (field === 'userId') {
        return { ...prev, splits: newSplits };
      }
      
      const totalExpense = parseFloat(prev.amount) || 0;
      const updatedSplitAmount = parseFloat(value) || 0;
      const currentSplitAmount = parseFloat(prev.splits[index].amount) || 0;
      const difference = updatedSplitAmount - currentSplitAmount;
      const remainingAmount = totalExpense - (calculateSplitsTotal() + difference);
      const adjustableSplits = newSplits.filter((_, i) => i !== index && newSplits[i].userId);
      
      if (adjustableSplits.length > 0 && remainingAmount >= 0) {
        const amountPerSplit = (remainingAmount / adjustableSplits.length).toFixed(2);
        
        newSplits.forEach((split, i) => {
          if (i !== index && split.userId) {
            newSplits[i] = { ...split, amount: amountPerSplit };
          }
        });
      }
      
      return { ...prev, splits: newSplits };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !currentUser) return;

    try {
      const expenseAmount = parseFloat(formData.amount);
      const splitsTotal = calculateSplitsTotal();
      
      if (Math.abs(splitsTotal - expenseAmount) > 0.01) {
        setError(`The sum of splits (${splitsTotal.toFixed(2)}) doesn't match the total expense amount (${expenseAmount.toFixed(2)})`);
        return;
      }
      
      if (expenseAmount >= 100000000) {
        setError('Expense amount is too large. Maximum value is 99,999,999.99.');
        return;
      }

      const expense: Omit<Expense, 'expense_id' | 'created_at'> = {
        group_id: groupId,
        paid_by: currentUser.uuid,
        description: formData.description,
        amount: expenseAmount
      };

      for (const split of formData.splits) {
        const splitAmount = parseFloat(split.amount);
        if (splitAmount >= 100000000) {
          setError(`Split amount for ${members.find(m => m.uuid === split.userId)?.username || 'user'} is too large. Maximum value is 99,999,999.99.`);
          return;
        }
      }

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
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
          <h2 className="text-xl font-semibold mb-4 text-white">Splits</h2>
          <div className="mb-2 text-sm text-gray-400">
            Total Split: {calculateSplitsTotal().toFixed(2)} / {formData.amount || '0.00'}
          </div>
          
          {formData.splits.map((split, index) => (
            <div key={index} className="flex gap-4 mb-4">
              <select
                required
                className="flex-1 px-3 py-2 border bg-gray-800 border-gray-700 text-white rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={split.userId}
                onChange={(e) => updateSplit(index, 'userId', e.target.value)}
              >
                <option value="">Select User</option>
                {members
                  .filter(member => 
                    member.uuid === split.userId || 
                    !formData.splits.some(s => s.userId === member.uuid)
                  )
                  .map(member => (
                    <option key={member.uuid} value={member.uuid}>
                      {member.username}
                    </option>
                  ))
                }
              </select>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                className="w-32 px-3 py-2 border bg-gray-800 border-gray-700 text-white rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Amount"
                value={split.amount}
                onChange={(e) => updateSplit(index, 'amount', e.target.value)}
              />
            </div>
          ))}
          
          <button
            type="button"
            onClick={addSplit}
            className={`text-blue-400 hover:text-blue-300 ${formData.splits.length >= members.length ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={formData.splits.length >= members.length}
          >
            + Add Split
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Add Expense
        </button>
      </form>
    </main>
  );
}