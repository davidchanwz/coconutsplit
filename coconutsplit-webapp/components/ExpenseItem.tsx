import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExpenseItemProps } from "../lib/types";
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

export function ExpenseItem({ expense, members, splits = { splits: [], loading: false }, onAccordionChange, onDeleteExpense, isDeleting }: ExpenseItemProps) {
    const paidBy = members.find((m) => m.uuid === expense.paid_by);

    return (
        <div className="bg-gray-800 border-l-4 border-blue-500 p-3 sm:p-4 rounded-lg shadow">
            <Accordion
                type="single"
                collapsible
                onValueChange={(value) => onAccordionChange(value, expense.expense_id)}
            >
                <AccordionItem value="item-1" className="border-none">
                    <div className="flex items-center">
                        <div className="bg-blue-500/20 p-1 sm:p-2 rounded-full mr-2 sm:mr-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 sm:h-6 w-4 sm:w-6 text-blue-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                        </div>
                        <div className="flex-grow">
                            <AccordionTrigger className="p-0 hover:no-underline">
                                <div className="flex justify-between w-full">
                                    <div>
                                        <h3 className="font-medium text-sm sm:text-base text-white text-left">
                                            {expense.description}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-gray-300">
                                            Paid by {paidBy?.username || "Unknown User"}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(expense.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-bold text-sm sm:text-base">
                                            ${expense.amount.toFixed(2)}
                                        </span>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={isDeleting === expense.expense_id}
                                                    className={`p-1 rounded-full text-red-400 hover:text-red-300 hover:bg-gray-700 focus:outline-none transition-colors ${isDeleting === expense.expense_id ? "opacity-50 cursor-wait" : ""
                                                        }`}
                                                    title="Delete expense"
                                                >
                                                    {isDeleting === expense.expense_id ? (
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
                                                    <AlertDialogTitle className="text-white">Delete Expense</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-gray-300">
                                                        Are you sure you want to delete this expense?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="bg-gray-700 text-gray-200 hover:bg-gray-600 border-gray-600">
                                                        Cancel
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={(e: React.MouseEvent) => {
                                                            e.stopPropagation();
                                                            onDeleteExpense(expense.expense_id);
                                                        }}
                                                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </AccordionTrigger>
                        </div>
                    </div>
                    <AccordionContent>
                        <div className="pt-2 sm:pt-4 pb-1 sm:pb-2 text-gray-300 text-sm sm:text-base">
                            <h3 className="text-base sm:text-lg font-semibold mb-2 text-white">
                                Expense Breakdown
                            </h3>
                            {splits?.loading ? (
                                <div className="flex justify-center py-3 sm:py-4">
                                    <div className="animate-spin rounded-full h-4 sm:h-5 w-4 sm:w-5 border-t-2 border-b-2 border-blue-400"></div>
                                </div>
                            ) : splits?.splits?.length ? (
                                <div className="space-y-1 sm:space-y-2">
                                    {splits.splits.map((split) => {
                                        const user = members.find((m) => m.uuid === split.user_id);
                                        return (
                                            <div
                                                key={`${split.expense_id}-${split.user_id}`}
                                                className="flex justify-between py-1 border-b border-gray-700"
                                            >
                                                <span>{user?.username || "Unknown User"}</span>
                                                <span className="font-medium">${split.amount.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                    {(() => {
                                        const splitsTotal = splits.splits.reduce((sum, split) => sum + split.amount, 0);
                                        const payerAmount = Math.max(0, +(expense.amount - splitsTotal).toFixed(2));
                                        if (payerAmount > 0 || !splits.splits.some((s) => s.user_id === expense.paid_by)) {
                                            return (
                                                <div className="flex justify-between py-1 border-b border-gray-700">
                                                    <span className="font-medium text-blue-400">
                                                        {paidBy?.username || "Unknown User"} (payer)
                                                    </span>
                                                    <span className="font-medium">${payerAmount.toFixed(2)}</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <div className="flex justify-between py-1 sm:py-2 border-t border-gray-600 mt-1 sm:mt-2 font-bold">
                                        <span>Total</span>
                                        <span>${expense.amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400">No split information available.</p>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
