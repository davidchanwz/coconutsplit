'use client';

import { useEffect, useState, Suspense } from 'react';
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

function SuccessMessage() {
  return (
    <div className="p-4 max-w-md mx-auto text-center">
      <div className="mb-4">
        <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-xl font-bold mb-2">Expense Added Successfully!</h1>
      <p className="text-gray-600 mb-4">Your expense has been recorded and split with the group.</p>
      <button
        onClick={() => {
          if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.close();
          }
        }}
        className="w-full bg-blue-500 text-white p-3 rounded-lg text-base font-medium hover:bg-blue-600 active:bg-blue-700"
      >
        Close
      </button>
    </div>
  );
}

function AddExpenseForm() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get('group_id');
  const userId = searchParams.get('user_id');
  
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  // Recalculate splits when amount changes
  useEffect(() => {
    if (!amount) {
      setSelectedMembers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (updated[key] !== '') {
            updated[key] = '';
          }
        });
        return updated;
      });
      return;
    }

    const totalAmount = parseFloat(amount);
    const selectedCount = Object.values(selectedMembers).filter(val => val !== '').length + 1;
    
    if (selectedCount > 1) {
      const splitAmount = totalAmount / selectedCount;
      setSelectedMembers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (updated[key] !== '') {
            updated[key] = splitAmount.toFixed(2);
          }
        });
        return updated;
      });
    }
  }, [amount]);

  const handleMemberClick = (memberId: string) => {
    if (!amount) {
      setError('Please enter the total amount first');
      return;
    }

    const totalAmount = parseFloat(amount);
    const updatedSelected = { ...selectedMembers };
    
    // Toggle selection
    if (updatedSelected[memberId] !== '') {
      // Deselect the member
      updatedSelected[memberId] = '';
    } else {
      // Select the member
      updatedSelected[memberId] = '0'; // Temporary value to include in count
    }

    // Count selected members (including the payer)
    const selectedCount = Object.values(updatedSelected).filter(val => val !== '').length + 1;
    
    // Calculate new split amount
    const splitAmount = totalAmount / selectedCount;

    // Update all selected members with the new split amount
    Object.keys(updatedSelected).forEach(key => {
      if (updatedSelected[key] !== '') {
        updatedSelected[key] = splitAmount.toFixed(2);
      }
    });

    setSelectedMembers(updatedSelected);
  };

  const handleSplitAmountChange = (memberId: string, newAmount: string) => {
    if (!amount) return;

    const totalAmount = parseFloat(amount);
    const newSplitAmount = parseFloat(newAmount) || 0;
    const otherSplits = Object.entries(selectedMembers)
      .filter(([id, amt]) => id !== memberId && amt !== '')
      .reduce((sum, [_, amt]) => sum + (parseFloat(amt) || 0), 0);

    // If the new amount would exceed the total, set it to the remaining amount
    if (newSplitAmount + otherSplits > totalAmount) {
      setSelectedMembers(prev => ({
        ...prev,
        [memberId]: (totalAmount - otherSplits).toFixed(2)
      }));
    } else {
      setSelectedMembers(prev => ({
        ...prev,
        [memberId]: newAmount
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!groupId || !userId) return;
    
    setLoading(true);
    setError('');

    try {
      // Validate amount
      const expenseAmount = parseFloat(amount);
      if (expenseAmount <= 0) {
        throw new Error('Expense amount must be more than 0!');
      }
      if (expenseAmount >= 10**8) {
        throw new Error(`Expense amount must be less than ${10**8}.`);
      }

      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: userId,
          amount: expenseAmount,
          description
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Create splits and debt updates
      const splits = Object.entries(selectedMembers)
        .filter(([_, amount]) => amount !== '')
        .map(([memberId, amount]) => ({
          expense_id: expense.expense_id,
          user_id: memberId,
          amount: parseFloat(amount)
        }));

      if (splits.length > 0) {
        // Insert splits
        const { error: splitsError } = await supabase
          .from('expense_splits')
          .insert(splits);

        if (splitsError) throw splitsError;

        // Create debt updates including reverse entries
        const debtUpdates = splits.flatMap(split => [
          // Forward debt (member owes payer)
          {
            group_id: groupId,
            user_id: split.user_id,
            opp_user_id: userId,
            increment_value: split.amount
          },
          // Reverse debt (payer owes member)
          {
            group_id: groupId,
            user_id: userId,
            opp_user_id: split.user_id,
            increment_value: -split.amount
          }
        ]);

        // Update debts
        const { error: debtError } = await supabase
          .rpc('bulk_update_debts', { debt_updates: debtUpdates });

        if (debtError) throw debtError;
      }

      // Show success message
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense');
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

  if (success) {
    return <SuccessMessage />;
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Add New Expense</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border rounded-lg text-base"
            required
            placeholder="Enter expense description"
          />
        </div>
        
        <div>
          <label className="block mb-1 text-sm font-medium">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 border rounded-lg text-base"
            step="0.01"
            min="0"
            required
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Enter amount"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium">Split With</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {members.map((member) => (
              member.uuid !== userId && (
                <button
                  key={member.uuid}
                  type="button"
                  onClick={() => handleMemberClick(member.uuid)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedMembers[member.uuid] !== ''
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {member.username}
                </button>
              )
            ))}
          </div>
          {Object.entries(selectedMembers)
            .filter(([_, amount]) => amount !== '')
            .map(([memberId, amount]) => {
              const member = members.find(m => m.uuid === memberId);
              return member && (
                <div key={memberId} className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => handleSplitAmountChange(memberId, e.target.value)}
                    className="w-28 p-3 border rounded-lg text-base"
                    step="0.01"
                    min="0"
                    max={amount}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  <span className="text-sm font-medium">{member.username}</span>
                </div>
              );
            })}
          {amount && (
            <div className="mt-2 text-sm text-gray-600">
              Total: ${amount} | Split: ${Object.values(selectedMembers)
                .filter(val => val !== '')
                .reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
                .toFixed(2)}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-3 rounded-lg text-base font-medium hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !amount || Object.values(selectedMembers).filter(val => val !== '').length === 0}
        >
          {loading ? 'Creating...' : 'Create Expense'}
        </button>
      </form>
    </div>
  );
}

export default function AddExpense() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <AddExpenseForm />
    </Suspense>
  );
} 