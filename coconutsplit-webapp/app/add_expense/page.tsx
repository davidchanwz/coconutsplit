'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface GroupMember {
  uuid: string;
  username: string;
}

interface Expense {
  expense_id: string;
}

export default function AddExpense() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get('group_id');
  const userId = searchParams.get('user_id');
  
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchMembers() {
      if (!groupId) return;
      
      try {
        const { data, error } = await supabase
          .rpc('get_group_members', { group_id_param: groupId });
        
        if (error) throw error;
        
        setMembers(data || []);
        // Initialize selected members with empty amounts
        const initialSelected: { [key: string]: string } = {};
        data?.forEach((member: GroupMember) => {
          if (member.uuid !== userId) {
            initialSelected[member.uuid] = '';
          }
        });
        setSelectedMembers(initialSelected);
      } catch (err) {
        setError('Failed to load group members');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchMembers();
  }, [groupId, userId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!groupId || !userId) return;
    
    setLoading(true);
    setError('');

    try {
      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: userId,
          amount: parseFloat(amount),
          description
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Create splits
      const splits = Object.entries(selectedMembers)
        .filter(([_, amount]) => amount !== '')
        .map(([memberId, amount]) => ({
          expense_id: expense.expense_id,
          user_id: memberId,
          amount: parseFloat(amount)
        }));

      if (splits.length > 0) {
        const { error: splitsError } = await supabase
          .from('expense_splits')
          .insert(splits);

        if (splitsError) throw splitsError;
      }

      // Update debts
      const debtUpdates = splits.map(split => ({
        group_id: groupId,
        user_id: split.user_id,
        opp_user_id: userId,
        increment_value: split.amount
      }));

      if (debtUpdates.length > 0) {
        const { error: debtError } = await supabase
          .rpc('bulk_update_debts', { debt_updates: debtUpdates });

        if (debtError) throw debtError;
      }

      // Close the Mini App
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.close();
      }
    } catch (err) {
      setError('Failed to create expense');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!groupId || !userId) {
    return <div className="p-4 text-red-500">Missing required parameters</div>;
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Add New Expense</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 border rounded"
            step="0.01"
            min="0"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Split With</label>
          {members.map((member) => (
            member.uuid !== userId && (
              <div key={member.uuid} className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  value={selectedMembers[member.uuid]}
                  onChange={(e) => setSelectedMembers({
                    ...selectedMembers,
                    [member.uuid]: e.target.value
                  })}
                  className="w-24 p-2 border rounded"
                  step="0.01"
                  min="0"
                  placeholder="Amount"
                />
                <span>{member.username}</span>
              </div>
            )
          ))}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Expense'}
        </button>
      </form>
    </div>
  );
} 