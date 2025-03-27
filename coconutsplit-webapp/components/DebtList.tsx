import { DebtListProps } from "../lib/types";
import { DebtItem } from "./DebtItem";

export const DebtList = ({ debts, selectedDebts, currentUser, onToggleDebt }: DebtListProps) => (
    <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-white">Your Debts</h2>
        {!debts || debts.length === 0 ? (
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-md text-gray-300">
                You don't have any outstanding debts.
            </div>
        ) : (
            <div className="space-y-4">
                {debts.map((debt, index) => (
                    <DebtItem
                        key={`debt-${index}`}
                        debt={debt}
                        index={index}
                        isSelected={selectedDebts[`debt-${index}`] || false}
                        onToggle={onToggleDebt}
                        currentUser={currentUser}
                    />
                ))}
            </div>
        )}
    </div>
);
