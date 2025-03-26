import { createClient } from '@supabase/supabase-js';
import { Expense, ExpenseSplit, Group, Settlement, User, DebtUpdate, SimplifiedDebt } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SupabaseService {
  /**
   * Get detailed information about a group
   * @param groupId UUID of the group
   * @returns Group details or null if not found
   * @throws Error if throwErrors is true and an error occurs
   */
  static async getGroupDetails(groupId: string, throwErrors: boolean = false): Promise<Group | null> {
    try {
      console.log('Fetching group details for:', groupId);
      
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('group_id', groupId)
        .single();
        
      if (error) {
        console.error('Error fetching group details:', error);
        if (throwErrors) throw error;
        return null;
      }
      
      if (!data) {
        console.error('No group found with ID:', groupId);
        return null;
      }
      
      return data as Group;
    } catch (error) {
      console.error('Exception in getGroupDetails:', error);
      if (throwErrors) throw error;
      return null;
    }
  }

  static async getGroupMembers(groupId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('group_members')
      .select('user:users(*)')
      .eq('group_id', groupId);

    if (error) throw error;
    return data.map(item => item.user as unknown as User);
  }

  static async getExpenses(groupId: string): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getExpenseSplits(expenseId: string): Promise<ExpenseSplit[]> {
    const { data, error } = await supabase
      .from('expense_splits')
      .select('*')
      .eq('expense_id', expenseId);

    if (error) throw error;
    return data;
  }

  static async getSettlements(groupId: string): Promise<Settlement[]> {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async addExpense(expense: Omit<Expense, 'expense_id' | 'created_at'>, splits: Omit<ExpenseSplit, 'expense_id'>[]): Promise<void> {
    // Validate expense amount
    if (expense.amount >= 10**8) {
      throw new Error(`Expense amount must be less than ${10**8}.`);
    }
    
    // Validate that all split amounts are valid
    for (const split of splits) {
      if (split.amount >= 10**8) {
        throw new Error(`Split amount must be less than ${10**8}.`);
      }
    }
    
    // Ensure splits total equals expense amount
    const splitsTotal = splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(splitsTotal - expense.amount) > 0.01) {
      throw new Error(`Total of splits (${splitsTotal.toFixed(2)}) doesn't match expense amount (${expense.amount.toFixed(2)})`);
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert([expense])
      .select()
      .single();

    if (expenseError) throw expenseError;
    
    // Filter out splits where the payer is also the one being charged
    const validSplits = splits.filter(split => split.user_id !== expense.paid_by);
    const splitsWithExpenseId = validSplits.map(split => ({
      ...split,
      expense_id: expenseData.expense_id
    }));

    // Only insert if there are valid splits
    if (splitsWithExpenseId.length > 0) {
      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsWithExpenseId);

      if (splitsError) throw splitsError;
    }

    // Create debt records for each split
    const debtUpdates: DebtUpdate[] = [];
    for (const split of splits) {
      // Skip creating debt records if the payer is also the one being charged
      if (split.user_id === expense.paid_by) continue;
      
      // User owes the payer
      debtUpdates.push({
        group_id: expense.group_id,
        user_id: split.user_id,
        opp_user_id: expense.paid_by,
        increment_value: split.amount
      });
      
      // Reverse entry: payer is owed by the user
      debtUpdates.push({
        group_id: expense.group_id,
        user_id: expense.paid_by,
        opp_user_id: split.user_id,
        increment_value: -split.amount
      });
    }

    // Use the bulk_update_debts RPC function to update debts
    if (debtUpdates.length > 0) {
      const { error: debtsError } = await supabase
        .rpc("bulk_update_debts", { debt_updates: debtUpdates });
      
      if (debtsError) throw debtsError;
    }
  }

  static async deleteExpense(expenseId: string, groupId: string): Promise<void> {
    // First, get the expense and its splits to recalculate the debts properly
    const { data: expense, error: fetchExpenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('expense_id', expenseId)
      .eq('group_id', groupId)
      .single();
    
    if (fetchExpenseError) throw fetchExpenseError;
    if (!expense) throw new Error('Expense not found');
    
    // Get the splits for this expense
    const { data: splits, error: fetchSplitsError } = await supabase
      .from('expense_splits')
      .select('*')
      .eq('expense_id', expenseId);
    
    if (fetchSplitsError) throw fetchSplitsError;
    
    // Delete the expense (this will cascade to delete the expense_splits due to foreign key constraints)
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('expense_id', expenseId);
    
    if (deleteError) throw deleteError;
    
    // Update the debt records by negating the original debt amounts
    const debtUpdates: DebtUpdate[] = [];
    for (const split of splits) {
      // Skip if there was a split where user is paying themselves
      if (split.user_id === expense.paid_by) continue;
      
      // Reverse the debt: negate the original increment_value
      debtUpdates.push({
        group_id: groupId,
        user_id: split.user_id,
        opp_user_id: expense.paid_by,
        increment_value: -split.amount // Negative amount to reverse the debt
      });
      
      // Reverse the opposing entry
      debtUpdates.push({
        group_id: groupId,
        user_id: expense.paid_by,
        opp_user_id: split.user_id,
        increment_value: split.amount // Positive amount to reverse the negative debt
      });
    }
    
    // Only update if there are debt records to update
    if (debtUpdates.length > 0) {
      const { error: debtsError } = await supabase
        .rpc("bulk_update_debts", { debt_updates: debtUpdates });
      
      if (debtsError) throw debtsError;
    }
  }

  static async deleteSettlement(settlementId: string, groupId: string): Promise<void> {
    // First, get the settlement details before deleting
    const { data: settlement, error: fetchError } = await supabase
      .from('settlements')
      .select('*')
      .eq('settlement_id', settlementId)
      .eq('group_id', groupId)
      .single();

    if (fetchError) throw fetchError;
    if (!settlement) throw new Error('Settlement not found');

    // Delete the settlement
    const { error: deleteError } = await supabase
      .from('settlements')
      .delete()
      .eq('settlement_id', settlementId);
    
    if (deleteError) throw deleteError;

    // Update the debts
    const { error: debtsError } = await supabase
      .rpc("bulk_update_debts", {
        debt_updates: [
          {
            group_id: groupId,
            user_id: settlement.from_user,
            opp_user_id: settlement.to_user,
            increment_value: settlement.amount
          },
          {
            group_id: groupId,
            user_id: settlement.to_user,
            opp_user_id: settlement.from_user,
            increment_value: -settlement.amount
          }
        ]
      });
    
    if (debtsError) throw debtsError;
  }

  static async getUser(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uuid', userId)
      .single();

    if (error) throw error;
    return data;
  }

  static async getUserByTelegramId(telegramId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', telegramId)  // Changed from 'telegram_id' to 'user_id' to match the Python code
      .single();

    if (error) {
      console.error("Error fetching user by Telegram ID:", error);
      return null;
    }
    
    return data;
  }

  static async getGroupDebts(groupId: string): Promise<SimplifiedDebt[]> {
    // Get all debts for the group
    const { data: debts, error: debtsError } = await supabase
      .from('debts')
      .select('user_id, opp_user_id, amount_owed')
      .eq('group_id', groupId)
      .gt('amount_owed', 0); // Only get positive debts (amount_owed > 0)
    
    if (debtsError) throw debtsError;
    if (!debts || debts.length === 0) return [];
    
    // Get all members of this group for user details
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select('user:users(*)')
      .eq('group_id', groupId);
    
    if (membersError) throw membersError;
    
    const members = membersData.map(item => item.user as unknown as User);
    const userMap = new Map<string, User>();
    members.forEach(member => userMap.set(member.uuid, member));
    
    // Convert to simplified debts format
    const simplifiedDebts: SimplifiedDebt[] = debts
      .filter(debt => userMap.has(debt.user_id) && userMap.has(debt.opp_user_id))
      .map(debt => ({
        from: userMap.get(debt.user_id)!,
        to: userMap.get(debt.opp_user_id)!,
        amount: debt.amount_owed
      }));
    
    return simplifiedDebts;
  }

  static async settleDebts(groupId: string, debts: SimplifiedDebt[]): Promise<void> {
    const debtUpdates: DebtUpdate[] = [];
    const settlements = [];
    
    for (const debt of debts) {
      // Create settlement record
      settlements.push({
        group_id: groupId,
        from_user: debt.from.uuid,
        to_user: debt.to.uuid,
        amount: debt.amount
      });
      
      // Update debt records
      debtUpdates.push({
        group_id: groupId,
        user_id: debt.from.uuid,
        opp_user_id: debt.to.uuid,
        increment_value: -debt.amount // Negative to reduce the debt
      });
      
      debtUpdates.push({
        group_id: groupId,
        user_id: debt.to.uuid,
        opp_user_id: debt.from.uuid,
        increment_value: debt.amount // Positive to reduce the negative debt
      });
    }
    
    // Create settlement records
    if (settlements.length > 0) {
      const { error: settlementsError } = await supabase
        .from('settlements')
        .insert(settlements);
      
      if (settlementsError) throw settlementsError;
    }
    
    // Update debt records
    if (debtUpdates.length > 0) {
      const { error: debtsError } = await supabase
        .rpc("bulk_update_debts", { debt_updates: debtUpdates });
      
      if (debtsError) throw debtsError;
    }
  }

  /**
   * Get the chat ID for a specific group
   * @param groupId UUID of the group
   * @returns Chat ID or null if not found
   */
  static async getGroupChatId(groupId: string): Promise<number | null> {
    try {      
      const { data, error } = await supabase
        .from('groups')
        .select('chat_id')
        .eq('group_id', groupId)
        .single();
        
      if (error) {
        return null;
      }
      
      if (!data || !data.chat_id) {
        return null;
      }
      
      return data.chat_id;
    } catch (error) {
      return null;
    }
  }
}