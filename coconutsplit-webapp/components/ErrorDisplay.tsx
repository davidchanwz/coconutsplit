import { ErrorDisplayProps } from 'lib/types';

export const ErrorDisplay = ({ message }: ErrorDisplayProps) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400">{message}</div>
    </div>
);
