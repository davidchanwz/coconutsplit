"use client";

import { useState, useEffect } from 'react';
import { parseQueryParams, getTelegramUserId, getTelegramUsername, getTelegramChatId } from '@/lib/utils';
import { SupabaseService } from '@/lib/supabase';
import { getAllCurrencies } from '@/lib/financial-utils';
import { CurrencySelector } from '@/components/currency-selector';

export default function CreateGroup() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const chatId = params.chat_id; // Get the chat_id from URL params
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('SGD');
  const [currencies, setCurrencies] = useState<{code: string, name: string}[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);

  // Load currencies when component mounts
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const currencyList = await getAllCurrencies();
        setCurrencies(currencyList);
      } catch (error) {
        console.error('Failed to load currencies:', error);
      } finally {
        setLoadingCurrencies(false);
      }
    };

    loadCurrencies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const telegramUserId = getTelegramUserId();
      const username = getTelegramUsername();
      if (!telegramUserId || !username) {
        throw new Error("Missing required information");
      }

      // First ensure user exists/is created
      const userData = await SupabaseService.createOrUpdateUser({
        user_id: telegramUserId,
        username: username
      });

      if (!chatId) {
        throw new Error("Chat ID is required");
      }

      // Create the group
      const group = await SupabaseService.createGroup({
        group_id: groupId, 
        group_name: groupName,
        created_by: userData.uuid,
        chat_id: parseInt(chatId),
        ccy: selectedCurrency // Add the selected currency
      });

      // Notify bot about group creation
      const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "";
      const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY || "";

      try {
        const notificationData = {
          action: 'group_created',
          chat_id: parseInt(chatId),
          group_id: group.group_id,
          group_name: groupName,
          created_by: userData.username
        };

        const response = await fetch(`${apiUrl}/api/notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify(notificationData),
          mode: "cors",
          credentials: "omit",
        });

        if (!response.ok) {
          console.warn("Failed to notify bot about group creation");
        }
      } catch (notifyErr) {
        console.warn("Failed to send notification to bot", notifyErr);
      }

      // Redirect back to main page with new group ID
      window.location.href = `/`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-8">Create New Group</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="groupName" className="block text-sm font-medium text-gray-300">
            Group Name
          </label>
          <input
            type="text"
            id="groupName"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="mt-1 block w-full p-2 rounded-md bg-gray-800 border-gray-700 text-white"
            placeholder="Enter group name"
            required
          />
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-300 mb-1">
            Currency
          </label>
          <CurrencySelector 
            currencies={currencies}
            selectedCurrency={selectedCurrency}
            onCurrencyChange={setSelectedCurrency}
            isLoading={loadingCurrencies}
          />
        </div>

        {error && (
          <div className="text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || loadingCurrencies}
          className={`w-full py-2 px-4 rounded-md bg-blue-600 text-white ${
            (isLoading || loadingCurrencies) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </main>
  );
}