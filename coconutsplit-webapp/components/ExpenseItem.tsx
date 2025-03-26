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
        <div className="bg-gray-800 border border-gray-700 p-3 sm:p-6 rounded-lg shadow">
            <Accordion
                type="single"
                collapsible
                onValueChange={(value) => onAccordionChange(value, expense.expense_id)}
            >
                <AccordionItem value="item-1" className="">
                    <div className="flex-1 items-start mb-2 sm:mb-4">
                        <AccordionTrigger className="flex-1 p-0 pr-2 sm:pr-4">
                            <div className="flex justify-between w-full items-start">
                                <div>
                                    <h2 className="text-base sm:text-xl font-semibold text-white">
                                        {expense.description}
                                    </h2>
                                    <p className="text-xs sm:text-sm text-gray-300">
                                        Paid by {paidBy?.username || "Unknown User"}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg sm:text-2xl font-bold text-white">
                                        ${expense.amount.toFixed(2)}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-400">
                                        {new Date(expense.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                disabled={isDeleting === expense.expense_id}
                                className={`p-2 rounded-full text-red-400 hover:text-red-300 hover:bg-gray-700 focus:outline-none transition-colors ${
                                  isDeleting === expense.expense_id
                                    ? "opacity-0 cursor-wait"
                                    : ""
                                }`}
                                title="Delete expense"
                              >
                                {isDeleting === expense.expense_id ? (
                                  <span className="block h-5 w-5 animate-spin rounded-full border-2 border-t-red-400"></span>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
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
                            <AlertDialogContent className="w-[95vw] max-w-[425px] rounded-lg p-4 md:w-full">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-black">Delete Expense</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this expense?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-white text-black hover:bg-gray-300 focus:ring-red-600">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteExpense(expense.expense_id);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </AccordionTrigger>
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
