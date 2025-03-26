"use client";

import { useState, useEffect } from "react";
import { SupabaseService } from "../../lib/supabase";
import {
  parseQueryParams,
  sendNotificationToBot,
  formatNumber,
} from "../../lib/utils";
import Link from "next/link";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorDisplay } from "../../components/ErrorDisplay";
import { DebtList } from "../../components/DebtList";
import { backButton } from '@telegram-apps/sdk-react';
import { useGroupData } from "../../hooks/useGroupData";

export default function SettleUp() {
  const params = parseQueryParams();
  const groupId = params.group_id;
  const [selectedDebts, setSelectedDebts] = useState<{
    [key: string]: boolean;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    loading,
    error: groupError,
    currentUser,
    simplifiedDebts: debts,
  } = useGroupData(groupId);

  useEffect(() => {
    try {
      if (backButton.show.isAvailable()) {
        backButton.show();
        backButton.onClick(() => {
          window.location.href = `/?group_id=${groupId}`;
          backButton.hide();
        });
      }
    } catch (error) {
      console.error("Failed to initialize Telegram SDK:", error);
    }
  }, [groupId]);
  const toggleDebtSelection = (debtId: string) => {
    setSelectedDebts((prev) => ({
      ...prev,
      [debtId]: !prev[debtId],
    }));
  };

  const handleSettleUp = async () => {
    if (!groupId || isSubmitting) return;
    setIsSubmitting(true);
    setLocalError(null);

    try {
      const debtsToSettle = debts.filter(
        (debt, index) => selectedDebts[`debt-${index}`]
      );

      if (debtsToSettle.length === 0) {
        setLocalError("Please select at least one debt to settle");
        return;
      }

      await SupabaseService.settleDebts(groupId, debtsToSettle);
      const chatId = await SupabaseService.getGroupChatId(groupId);

      if (chatId) {
        const notificationData = {
          chat_id: chatId,
          action: "settle_up",
          settlements: debtsToSettle.map((debt) => ({
            from: debt.from.username,
            to: debt.to.username,
            amount: formatNumber(debt.amount),
          })),
        };

        await sendNotificationToBot(notificationData).catch(console.warn);
      }

      window.location.href = `/?group_id=${groupId}`;
    } catch (err) {
      console.error("Error in handleSettleUp:", err);
      setLocalError("Failed to settle debts");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (groupError) {
    return <ErrorDisplay message={groupError} />;
  }

  return (
    <main className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-white">Settle Up</h1>
      <div className="text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base mb-8">
        Select the debts you want to settle
      </div>

      {localError && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded">
          {localError}
        </div>
      )}

      <DebtList
        debts={debts}
        selectedDebts={selectedDebts}
        currentUser={currentUser}
        onToggleDebt={toggleDebtSelection}
      />

      <div className="flex justify-between gap-4">
        <Link
          href={`/?group_id=${groupId}`}
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-center flex-1"
        >
          Cancel
        </Link>
        <button
          onClick={handleSettleUp}
          disabled={
            isSubmitting ||
            debts.length === 0 ||
            Object.values(selectedDebts).filter(Boolean).length === 0
          }
          className={`px-4 py-3 rounded-md text-white text-center flex-1 ${
            isSubmitting ||
            debts.length === 0 ||
            Object.values(selectedDebts).filter(Boolean).length === 0
              ? "bg-green-500 opacity-50 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isSubmitting ? "Settling..." : "Settle up"}
        </button>
      </div>
    </main>
  );
}
