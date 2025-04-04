import React from 'react';
import { SimplifiedDebt } from '../lib/types';
import { formatNumber } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

interface OutstandingDebtsProps {
  debts: SimplifiedDebt[];
}

export function OutstandingDebts({ debts }: OutstandingDebtsProps) {
  return (
    <div className="mb-8">
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden border-l-4 border-green-500">
        <div className="px-4 py-3 bg-gray-800/80 flex-row flex gap-x-2">
          <h2 className="text-sm font-semibold text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Outstanding Debts
          </h2>
          <Dialog>
            <DialogTrigger asChild>
              <button className="rounded-full w-6 h-6 bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center text-sm">
                ?
              </button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 text-gray-200">
              <DialogHeader>
                <DialogTitle className="text-gray-100">How Simplified Debts Work</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p>
                  Our system simplifies group debts to minimise the number of transactions needed to settle up.
                </p>
                <p>
                  Instead of tracking individual transactions between each pair of people, we:
                </p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Calculate the net balance for each person</li>
                  <li>Identify who owes money (negative balance) and who should receive money (positive balance)</li>
                  <li>Create the minimum number of transactions to settle all debts</li>
                </ol>
                <p>
                  This means you might end up paying someone you didn't directly share expenses with, but the total amount you pay or receive will always be correct.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {debts.length === 0 ? (
          <div className="px-4 py-2">
            <div className="text-gray-300 text-sm">
              There are no outstanding debts.
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 divide-y divide-gray-700/50">
            {debts.map((debt, index) => (
              <div key={`summary-debt-${index}`} className="flex justify-between text-xs py-1.5">
                <span className="text-gray-300">
                  <span className="font-medium">{debt.from.username}</span>{" "}
                  <span className="text-gray-500">owes</span>{" "}
                  <span className="font-medium">{debt.to.username}</span>
                </span>
                <span className="text-green-400 font-medium">${formatNumber(debt.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
