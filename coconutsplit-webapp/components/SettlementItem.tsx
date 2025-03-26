import { SettlementItemProps } from "../lib/types";

export function SettlementItem({ settlement, members }: SettlementItemProps) {
    const fromUser = members.find((m) => m.uuid === settlement.from_user);
    const toUser = members.find((m) => m.uuid === settlement.to_user);

    return (
        <div className="bg-gray-800 border-l-4 border-green-500 p-3 sm:p-4 rounded-lg shadow">
            <div className="flex items-center">
                <div className="bg-green-500/20 p-1 sm:p-2 rounded-full mr-2 sm:mr-4">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 sm:h-6 w-4 sm:w-6 text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>
                <div className="flex-grow">
                    <div className="flex justify-between">
                        <h3 className="font-medium text-sm sm:text-base text-white">Settlement</h3>
                        <span className="text-green-400 font-bold text-sm sm:text-base">
                            ${settlement.amount.toFixed(2)}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300">
                        <span className="font-medium">{fromUser?.username || "Unknown"}</span> paid{" "}
                        <span className="font-medium">{toUser?.username || "Unknown"}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {new Date(settlement.created_at).toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    );
}
