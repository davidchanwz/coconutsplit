import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Expense, ExpenseSplit, User } from "../lib/types";

// Define Settlement interface for the component
interface Settlement {
  settlement_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  created_at: string;
  group_id: string;
}

// Interface for combined timeline items
interface TimelineItem {
  type: "expense" | "settlement" | "date-separator";
  data: Expense | Settlement | string;
  created_at: string;
}

interface ExpenseHistoryProps {
  timelineItems: TimelineItem[];
  members: User[];
  expenseSplits: {
    [expenseId: string]: { splits: ExpenseSplit[]; loading: boolean };
  };
  onAccordionChange: (value: string, expenseId: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  isDeleting: string | null;
}

export function ExpenseHistory({
  timelineItems,
  members,
  expenseSplits,
  onAccordionChange,
  onDeleteExpense,
  isDeleting,
}: ExpenseHistoryProps) {
  if (timelineItems.length === 0) {
    return (
      <div className="text-center text-gray-400 mt-4 sm:mt-8 mb-16">
        No expenses or settlements recorded yet.
      </div>
    );
  }

  return (
    <>
      {/* Divider */}
      <div className="flex items-center justify-center my-3">
        <span className="text-stone-200 text-2xl margin-auto font-medium">
          EXPENSE HISTORY
        </span>
      </div>
      <div className="grid gap-3 sm:gap-6 mb-15">
        {timelineItems.map((item, index) => {
          if (item.type === "date-separator") {
            return (
              <div
                key={`date-${index}`}
                className="flex items-center my-2 sm:my-4 first:mt-0"
              >
                <div className="flex-grow border-t border-gray-700 mr-2 sm:mr-4"></div>
                <span className="text-gray-400 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 bg-gray-800 rounded-full">
                  {item.data as string}
                </span>
                <div className="flex-grow border-t border-gray-700 ml-2 sm:ml-4"></div>
              </div>
            );
          } else if (item.type === "expense") {
            const expense = item.data as Expense;
            const paidBy = members.find((m) => m.uuid === expense.paid_by);
            return (
              <div
                key={`expense-${expense.expense_id}`}
                className="bg-gray-800 border border-gray-700 p-3 sm:p-6 rounded-lg shadow"
              >
                <Accordion
                  type="single"
                  collapsible
                  onValueChange={(value) =>
                    onAccordionChange(value, expense.expense_id)
                  }
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
                              {new Date(
                                expense.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteExpense(expense.expense_id);
                          }}
                          disabled={isDeleting === expense.expense_id}
                          className={`p-1 sm:p-2 rounded-full text-red-400 hover:text-red-300 hover:bg-gray-700 focus:outline-none transition-colors ${
                            isDeleting === expense.expense_id
                              ? "opacity-50 cursor-wait"
                              : ""
                          }`}
                          title="Delete expense"
                        >
                          {isDeleting === expense.expense_id ? (
                            <span className="block h-4 sm:h-5 w-4 sm:w-5 animate-spin rounded-full border-2 border-t-red-400"></span>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 sm:h-5 w-4 sm:w-5"
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
                      </AccordionTrigger>
                    </div>
                    <AccordionContent>
                      <div className="pt-2 sm:pt-4 pb-1 sm:pb-2 text-gray-300 text-sm sm:text-base">
                        <h3 className="text-base sm:text-lg font-semibold mb-2 text-white">
                          Expense Breakdown
                        </h3>
                        {expenseSplits[expense.expense_id]?.loading ? (
                          <div className="flex justify-center py-3 sm:py-4">
                            <div className="animate-spin rounded-full h-4 sm:h-5 w-4 sm:w-5 border-t-2 border-b-2 border-blue-400"></div>
                          </div>
                        ) : expenseSplits[expense.expense_id]?.splits.length ? (
                          <div className="space-y-1 sm:space-y-2">
                            {/* Display other users' splits first */}
                            {expenseSplits[expense.expense_id].splits.map(
                              (split) => {
                                const user = members.find(
                                  (m) => m.uuid === split.user_id
                                );
                                return (
                                  <div
                                    key={`${split.expense_id}-${split.user_id}`}
                                    className="flex justify-between py-1 border-b border-gray-700"
                                  >
                                    <span>
                                      {user?.username || "Unknown User"}
                                    </span>
                                    <span className="font-medium">
                                      ${split.amount.toFixed(2)}
                                    </span>
                                  </div>
                                );
                              }
                            )}

                            {/* Calculate and display payer's share */}
                            {(() => {
                              // Calculate the sum of all splits
                              const splitsTotal = expenseSplits[
                                expense.expense_id
                              ].splits.reduce(
                                (sum, split) => sum + split.amount,
                                0
                              );

                              // Calculate how much the payer contributed (total - sum of splits)
                              const payerAmount = Math.max(
                                0,
                                +(expense.amount - splitsTotal).toFixed(2)
                              );

                              // Only show the payer's row if they contributed something or if they're not in the splits
                              if (
                                payerAmount > 0 ||
                                !expenseSplits[expense.expense_id].splits.some(
                                  (s) => s.user_id === expense.paid_by
                                )
                              ) {
                                return (
                                  <div className="flex justify-between py-1 border-b border-gray-700">
                                    <span className="font-medium text-blue-400">
                                      {paidBy?.username || "Unknown User"}{" "}
                                      (payer)
                                    </span>
                                    <span className="font-medium">
                                      ${payerAmount.toFixed(2)}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Display total row */}
                            <div className="flex justify-between py-1 sm:py-2 border-t border-gray-600 mt-1 sm:mt-2 font-bold">
                              <span>Total</span>
                              <span>${expense.amount.toFixed(2)}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-400">
                            No split information available.
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            );
          } else {
            // This is a settlement
            const settlement = item.data as Settlement;
            const fromUser = members.find(
              (m) => m.uuid === settlement.from_user
            );
            const toUser = members.find((m) => m.uuid === settlement.to_user);

            return (
              <div
                key={`settlement-${settlement.settlement_id}`}
                className="bg-gray-800 border-l-4 border-green-500 p-3 sm:p-4 rounded-lg shadow"
              >
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
                      <h3 className="font-medium text-sm sm:text-base text-white">
                        Settlement
                      </h3>
                      <span className="text-green-400 font-bold text-sm sm:text-base">
                        ${settlement.amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-300">
                      <span className="font-medium">
                        {fromUser?.username || "Unknown"}
                      </span>{" "}
                      paid{" "}
                      <span className="font-medium">
                        {toUser?.username || "Unknown"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(settlement.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          }
        })}
      </div>
    </>
  );
}
