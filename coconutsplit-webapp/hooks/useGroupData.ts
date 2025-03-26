import { useState, useEffect } from 'react';
import { SupabaseService, User, Expense, ExpenseSplit, SimplifiedDebt } from '../lib/supabase';
import { getTelegramUserId } from '../lib/utils';
import { calculateUserBalances, simplifyDebtsWithMembers } from '../lib/financial-utils';
import { Settlement } from '../lib/timeline';

export function useGroupData(groupId: string | undefined) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [members, setMembers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [groupName, setGroupName] = useState<string>("");
    const [simplifiedDebts, setSimplifiedDebts] = useState<SimplifiedDebt[]>([]);

    useEffect(() => {
        if (!groupId) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                const telegramUserId = getTelegramUserId();

                if (!telegramUserId) {
                    throw new Error("Unable to identify user from Telegram");
                }

                const userData = await SupabaseService.getUserByTelegramId(telegramUserId);
                if (!userData) {
                    throw new Error("User not found. Please ensure you have joined the group.");
                }
                setCurrentUser(userData);

                const [expensesData, membersData, groupData, rawDebtsData, settlementsData] = await Promise.all([
                    SupabaseService.getExpenses(groupId),
                    SupabaseService.getGroupMembers(groupId),
                    SupabaseService.getGroupDetails(groupId),
                    SupabaseService.getGroupDebts(groupId),
                    SupabaseService.getSettlements(groupId)
                ]);

                if (!membersData.some((member) => member.uuid === userData.uuid)) {
                    throw new Error("You are not a member of this group.");
                }

                const balances = calculateUserBalances(rawDebtsData);
                const simplifiedDebtsData = simplifyDebtsWithMembers(balances, membersData);

                setExpenses(expensesData);
                setSettlements(settlementsData);
                setMembers(membersData);
                setGroupName(groupData?.group_name || "Group Expenses");
                setSimplifiedDebts(simplifiedDebtsData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load group data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [groupId]);

    return {
        expenses,
        setExpenses,
        settlements,
        setSettlements,
        members,
        loading,
        error,
        currentUser,
        groupName,
        simplifiedDebts
    };
}
