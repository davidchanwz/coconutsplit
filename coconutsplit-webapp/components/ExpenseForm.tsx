import { User } from "../lib/types";

interface ExpenseFormProps {
    description: string;
    setDescription: (value: string) => void;
    amount: string;
    setAmount: (value: string) => void;
    paidBy: string;
    setPaidBy: (value: string) => void;
    members: User[];
    currentUser: User | null;
}

export function ExpenseForm({
    description,
    setDescription,
    amount,
    setAmount,
    paidBy,
    setPaidBy,
    members,
    currentUser
}: ExpenseFormProps) {
    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="description" className="block text-gray-300 mb-2">
                    Description
                </label>
                <input
                    type="text"
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
                    placeholder="What was this expense for?"
                    required
                />
            </div>

            <div>
                <label htmlFor="amount" className="block text-gray-300 mb-2">
                    Amount
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-gray-400">$</span>
                    </div>
                    <input
                        type="number"
                        id="amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full p-3 pl-8 bg-gray-800 border border-gray-700 rounded text-white"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        required
                    />
                </div>
            </div>

            <div>
                <label htmlFor="paidBy" className="block text-gray-300 mb-2">
                    Paid by
                </label>
                <select
                    id="paidBy"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
                    required
                >
                    {members.map((member) => (
                        <option key={member.uuid} value={member.uuid}>
                            {member.username}
                            {member.uuid === currentUser?.uuid ? " (You)" : ""}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
