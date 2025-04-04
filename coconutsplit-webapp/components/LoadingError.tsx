import Link from 'next/link';
import { LoadingErrorProps } from '../lib/types';
import { LoadingSpinner } from './LoadingSpinner';

export function LoadingError({ loading, error, submitting, groupId }: LoadingErrorProps) {
    if (loading) {
        return (
            <LoadingSpinner />
        );
    }

    if (error && !submitting) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
                <div className="text-red-400 mb-6">{error}</div>
                <Link
                    href={groupId ? `/?group_id=${groupId}` : "/"}
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                    Back to Home
                </Link>
            </div>
        );
    }

    return null;
}
