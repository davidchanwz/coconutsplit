export interface ExpenseSplit {
    user_id: string;
    amount: number;
}

export interface LoadingErrorProps {
    loading: boolean;
    error: string | null;
    submitting: boolean;
    groupId?: string;
}

export interface Group {
  group_id: string;
  group_name: string;
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

export interface ExpenseSplitNoExpenseID {
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

export interface SimplifiedDebt {
  from: User;
  to: User;
  amount: number;
}

export interface TimelineItem {
    type: 'expense' | 'settlement' | 'date-separator';
    data: Expense | Settlement | string;
    created_at: string;
}


export interface Settlement {
    settlement_id: string;
    from_user: string;
    to_user: string;
    amount: number;
    created_at: string;
    group_id: string;
}

export interface TimelineItem {
    type: "expense" | "settlement" | "date-separator";
    data: Expense | Settlement | string;
    created_at: string;
}

export interface ExpenseHistoryProps {
    timelineItems: TimelineItem[];
    members: User[];
    expenseSplits: {
        [expenseId: string]: { splits: ExpenseSplit[]; loading: boolean };
    };
    onAccordionChange: (value: string, expenseId: string) => void;
    onDeleteExpense: (expenseId: string) => void;
    isDeleting: string | null;
}
