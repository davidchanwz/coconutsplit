import { SettlementItemProps } from "../lib/types";
import { formatNumber } from "../lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SettlementItem({ settlement, members, isDeleting, onDeleteSettlement }: SettlementItemProps) {
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
                    <div className="flex justify-between w-full">
                        <div>
                            <h3 className="font-medium text-sm sm:text-base text-white text-left">Settlement</h3>
                            <p className="text-xs sm:text-sm text-gray-300">
                                <span className="font-medium">{fromUser?.username || "Unknown"}</span> paid{" "}
                                <span className="font-medium">{toUser?.username || "Unknown"}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {new Date(settlement.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-green-400 font-bold text-sm sm:text-base">
                                ${formatNumber(settlement.amount)}
                            </span>
                            <div className="mr-4">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button
                                            disabled={isDeleting === settlement.settlement_id}
                                            className={`p-1 rounded-full text-red-400 hover:text-red-300 hover:bg-gray-700 focus:outline-none transition-colors ${isDeleting === settlement.settlement_id ? "opacity-50 cursor-wait" : ""
                                                }`}
                                            title="Delete settlement"
                                        >
                                            {isDeleting === settlement.settlement_id ? (
                                                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-t-red-400"></span>
                                            ) : (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="w-[95vw] max-w-[425px] rounded-lg p-4 md:w-full bg-gray-800 border border-gray-700">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-white">Delete Settlement</AlertDialogTitle>
                                            <AlertDialogDescription className="text-gray-300">
                                                Are you sure you want to delete this settlement?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="bg-gray-700 text-gray-200 hover:bg-gray-600 border-gray-600">
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => onDeleteSettlement(settlement.settlement_id)}
                                                className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
