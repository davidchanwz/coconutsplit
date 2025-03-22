import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Group {
  group_id: string;
  name: string;
  created_at: string;
}

export interface User {
  uuid: string;
  username: string;
  telegram_id: string;
  created_at: string;
}

export interface Expense {
  expense_id: string;
  group_id: string;
  paid_by: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface ExpenseSplit {
  expense_id: string;
  user_id: string;
  amount: number;
}

export interface Settlement {
  settlement_id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  created_at: string;
}

export interface DebtUpdate {
  group_id: string;
  user_id: string;
  opp_user_id: string;
  increment_value: number;
}

export class SupabaseService {
  static async getGroup(groupId: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (error) throw error;
    return data;
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

  static async getUser(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uuid', userId)
      .single();

    if (error) throw error;
    return data;
  }
}