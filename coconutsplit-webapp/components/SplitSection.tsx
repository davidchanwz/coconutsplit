import { User } from "../lib/types";

interface SplitSectionProps {
    members: User[];
    splits: { [key: string]: string };
    splitMode: "equal" | "custom";
    setSplitMode: (mode: "equal" | "custom") => void;
    handleSplitChange: (userId: string, value: string) => void;
    splitsTotal: number;
    amountValue: number;
}

export function SplitSection({
    members,
    splits,
    splitMode,
    setSplitMode,
    handleSplitChange,
    splitsTotal,
    amountValue
}: SplitSectionProps) {
    const splitsDiff = Math.abs(splitsTotal - amountValue);
    const splitsMatch = splitsDiff <= 0.01;
    const needsMoreAmount = splitsTotal < amountValue;

    return (
        <div className="pt-4">
            <div className="flex justify-between mb-4">
                <h2 className="text-xl text-white">Split Expense</h2>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setSplitMode("equal")}
                        className={`px-3 py-1 rounded text-sm ${splitMode === "equal"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300"
                            }`}
                    >
                        Equal
                    </button>
                    <button
                        type="button"
                        onClick={() => setSplitMode("custom")}
                        className={`px-3 py-1 rounded text-sm ${splitMode === "custom"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300"
                            }`}
                    >
                        Custom
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {members.map((member) => (
                    <div key={member.uuid} className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded">
                        <span className="text-white">{member.username}</span>
                        <div className="flex items-center gap-2">
                            {!splitsMatch && splitMode === "custom" && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentAmount = parseFloat(splits[member.uuid] || "0");
                                        const newAmount = needsMoreAmount
                                            ? currentAmount + splitsDiff
                                            : Math.max(0, currentAmount - splitsDiff);
                                        handleSplitChange(member.uuid, newAmount.toFixed(2));
                                    }}
                                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    {needsMoreAmount ? "Add" : "Reduce"} ${splitsDiff.toFixed(2)}
                                </button>
                            )}
                            <div className="relative w-32">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <span className="text-gray-400">$</span>
                                </div>
                                <input
                                    type="number"
                                    value={splits[member.uuid] || ""}
                                    onChange={(e) => handleSplitChange(member.uuid, e.target.value)}
                                    className="w-full p-2 pl-8 bg-gray-700 border border-gray-600 rounded text-white text-right"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    inputMode="decimal"
                                    disabled={splitMode === "equal"}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 p-3 bg-gray-800 border border-gray-700 rounded flex justify-between">
                <span className="text-white">Total split</span>
                <span className={`font-semibold ${splitsMatch ? "text-green-400" : "text-red-400"}`}>
                    ${splitsTotal.toFixed(2)}
                </span>
            </div>

            {!splitsMatch && (
                <div className="mt-2 text-red-400 text-sm">
                    {splitsTotal > amountValue
                        ? `The split amount is ${splitsDiff.toFixed(2)} more than the expense total`
                        : `The split amount is ${splitsDiff.toFixed(2)} less than the expense total`}
                </div>
            )}
        </div>
    );
}
