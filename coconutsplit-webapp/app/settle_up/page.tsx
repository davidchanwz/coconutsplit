'use client';

import { useEffect, useState } from 'react';
import { SupabaseService, User } from '../../lib/supabase';
import { parseQueryParams } from '../../lib/utils';
import Link from 'next/link';
import { init, backButton } from "@telegram-apps/sdk";

interface SimplifiedDebt {
  from: User;
  to: User;
  amount: number;
}

interface UserBalance {
  [userId: string]: number;
}

export default function SettleUp() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const userId = params.user_id;
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [selectedDebts, setSelectedDebts] = useState<{[key: string]: boolean}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Initialize Telegram SDK only on client-side
    const initTelegramBackButton = async () => {
      try {
        init();
        backButton.mount();
        
        if (backButton.show.isAvailable()) {
          backButton.show();
          
          // Configure back button click handler to navigate to home page
          backButton.onClick(() => {
            window.location.href = `/?group_id=${groupId}`;
          });
        }
        
        return () => {
          backButton.hide();
        };
      } catch (error) {
        console.error("Failed to initialize Telegram SDK:", error);
      }
    };
    
    const cleanup = initTelegramBackButton();
    
    return () => {
      if (cleanup) {
        cleanup.then((cleanupFn) => {
          if (cleanupFn) cleanupFn();
        });
      }
    };
  }, [groupId]);

  // Helper function to calculate user balances from debts
  const calculateUserBalances = (debts: SimplifiedDebt[]): UserBalance => {
    const balances: UserBalance = {};
    
    for (const debt of debts) {
      // User who owes money (negative balance)
      if (!balances[debt.from.uuid]) {
        balances[debt.from.uuid] = 0;
      }
      balances[debt.from.uuid] -= debt.amount;
      
      // User who is owed money (positive balance)
      if (!balances[debt.to.uuid]) {
        balances[debt.to.uuid] = 0;
      }
      balances[debt.to.uuid] += debt.amount;
    }
    
    return balances;
  };

  // Helper function to simplify debts like in the Python code
  const simplifyDebts = (balances: UserBalance): SimplifiedDebt[] => {
    const creditors: [string, number][] = [];
    const debtors: [string, number][] = [];
    
    // Split users into creditors (positive balance) and debtors (negative balance)
    for (const [userId, balance] of Object.entries(balances)) {
      if (balance > 0) {
        creditors.push([userId, balance]); // Users who are owed money
      } else if (balance < 0) {
        debtors.push([userId, -balance]); // Users who owe money
      }
    }
    
    const simplified: SimplifiedDebt[] = [];
    const userMap = new Map<string, User>();
    members.forEach(member => userMap.set(member.uuid, member));
    
    while (creditors.length > 0 && debtors.length > 0) {
      const [creditorId, creditAmount] = creditors.pop()!;
      const [debtorId, debtAmount] = debtors.pop()!;
      
      // Calculate the minimum of what the debtor owes and what the creditor is owed
      const amount = Math.min(creditAmount, debtAmount);
      
      if (amount > 0 && userMap.has(debtorId) && userMap.has(creditorId)) {
        // Record this transaction if we have both users
        simplified.push({
          from: userMap.get(debtorId)!,
          to: userMap.get(creditorId)!,
          amount: amount
        });
      }
      
      // Adjust the remaining balances and push back if needed
      const remainingCredit = creditAmount - amount;
      const remainingDebt = debtAmount - amount;
      
      // If there's remaining debt, push the debtor back
      if (remainingDebt > 0) {
        debtors.push([debtorId, remainingDebt]);
      }
      
      // If there's remaining credit, push the creditor back
      if (remainingCredit > 0) {
        creditors.push([creditorId, remainingCredit]);
      }
    }
    
    return simplified;
  };

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;

      try {
        const membersData = await SupabaseService.getGroupMembers(groupId);
        setMembers(membersData);

        if (userId) {
          const userData = await SupabaseService.getUser(userId);
          setCurrentUser(userData);
        }

        // Fetch all debts for the group
        const debtsData = await SupabaseService.getGroupDebts(groupId);
        
        // Calculate balances and simplify debts
        const balances = calculateUserBalances(debtsData);
        const simplifiedDebts = simplifyDebts(balances);
        
        // Update state with simplified debts
        setDebts(simplifiedDebts);
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [groupId, userId]);

  const toggleDebtSelection = (debtId: string) => {
    setSelectedDebts(prev => ({
      ...prev,
      [debtId]: !prev[debtId]
    }));
  }

  const handleSettleUp = async () => {
    if (!groupId || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const debtsToSettle = debts.filter((debt, index) => selectedDebts[`debt-${index}`]);
      
      if (debtsToSettle.length === 0) {
        setError('Please select at least one debt to settle');
        setIsSubmitting(false);
        return;
      }
      
      // Call API to settle the selected debts
      await SupabaseService.settleDebts(groupId, debtsToSettle);
      
      // Redirect back to home page
      window.location.href = `/?group_id=${groupId}`;
    } catch (err) {
      setError('Failed to settle debts');
      console.error(err);
      setIsSubmitting(false);
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
      <h1 className="text-3xl font-bold mb-8 text-white">Settle Up</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-white">Outstanding Debts</h2>
        
        {debts.length === 0 ? (
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-md text-gray-300">
            No outstanding debts found.
          </div>
        ) : (
          <div className="space-y-4">
            {debts.map((debt, index) => (
              <div 
                key={`debt-${index}`} 
                className="p-4 bg-gray-800 border border-gray-700 rounded-md flex items-center"
              >
                <input
                  type="checkbox"
                  id={`debt-${index}`}
                  className="mr-4 h-5 w-5 accent-blue-500"
                  checked={selectedDebts[`debt-${index}`] || false}
                  onChange={() => toggleDebtSelection(`debt-${index}`)}
                />
                <label htmlFor={`debt-${index}`} className="flex-1 text-white">
                  <span className="font-semibold">{debt.from.username}</span> owes <span className="font-semibold">{debt.to.username}</span> <span className="text-green-400">${debt.amount.toFixed(2)}</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex justify-between gap-4">
        <Link
          href={`/?group_id=${groupId}`}
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-center flex-1"
        >
          Cancel
        </Link>
        <button
          onClick={handleSettleUp}
          disabled={isSubmitting || debts.length === 0 || Object.values(selectedDebts).filter(Boolean).length === 0}
          className={`px-4 py-3 rounded-md text-white text-center flex-1 ${
            isSubmitting || debts.length === 0 || Object.values(selectedDebts).filter(Boolean).length === 0
              ? 'bg-green-500 opacity-50 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isSubmitting ? 'Settling...' : 'Settle Selected Debts'}
        </button>
      </div>
    </main>
  );
}
