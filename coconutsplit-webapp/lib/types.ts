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
