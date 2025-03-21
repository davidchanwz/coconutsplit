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
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert([expense])
      .select()
      .single();

    if (expenseError) throw expenseError;

    const splitsWithExpenseId = splits.map(split => ({
      ...split,
      expense_id: expenseData.expense_id
    }));

    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitsWithExpenseId);

    if (splitsError) throw splitsError;
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