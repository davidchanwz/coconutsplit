import { User } from "../lib/types";

interface DebtItemProps {
    debt: {
        from: User;
        to: User;
        amount: number;
    };
    index: number;
    isSelected: boolean;
    onToggle: (debtId: string) => void;
    currentUser: User | null;
}

export const DebtItem = ({ debt, index, isSelected, onToggle, currentUser }: DebtItemProps) => (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-md flex items-center">
        <input
            type="checkbox"
            id={`debt-${index}`}
            className="mr-4 h-5 w-5 accent-blue-500"
            checked={isSelected}
            onChange={() => onToggle(`debt-${index}`)}
        />
        <label htmlFor={`debt-${index}`} className="flex-1 text-white">
            <span className="font-semibold">
                {currentUser && debt.from.uuid === currentUser.uuid ? "You" : debt.from.username}
            </span>{" "}
            owes{" "}
            <span className="font-semibold">
                {currentUser && debt.to.uuid === currentUser.uuid ? "You" : debt.to.username}
            </span>{" "}
            <span className="text-green-400">${debt.amount.toFixed(2)}</span>
        </label>
    </div>
);
