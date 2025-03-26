import React from 'react';
import { SimplifiedDebt } from '../lib/types';

interface OutstandingDebtsProps {
  debts: SimplifiedDebt[];
}

export function OutstandingDebts({ debts }: OutstandingDebtsProps) {
  if (debts.length === 0) {
    return null;
  }

  return (
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
          {debts.map((debt, index) => (
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
      
      
    </div>
  );
}
