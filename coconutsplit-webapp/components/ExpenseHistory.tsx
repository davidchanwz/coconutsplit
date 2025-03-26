import React from "react";
import { Expense, ExpenseHistoryProps, Settlement } from "@/lib/types";
import { DateSeparator } from "./DateSeparator";
import { ExpenseItem } from "./ExpenseItem";
import { SettlementItem } from "./SettlementItem";

export function ExpenseHistory({
  timelineItems,
  members,
  expenseSplits,
  onAccordionChange,
  onDeleteExpense,
  onDeleteSettlement,
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
      <div className="flex items-left my-3 pl-4">
        <span className="text-stone-200 text-2xl margin-auto font-medium">
          History
        </span>
      </div>
      <div className="grid gap-3 sm:gap-6 mb-15">
        {timelineItems.map((item, index) => {
          if (item.type === "date-separator") {
            return <DateSeparator key={`date-${index}`} date={item.data as string} />;
          } else if (item.type === "expense") {
            return (
              <ExpenseItem
                key={`expense-${(item.data as Expense).expense_id}`}
                expense={item.data as Expense}
                members={members}
                splits={expenseSplits[(item.data as Expense).expense_id]}
                onAccordionChange={onAccordionChange}
                onDeleteExpense={onDeleteExpense}
                isDeleting={isDeleting}
              />
            );
          } else {
            return (
              <SettlementItem
                key={`settlement-${(item.data as Settlement).settlement_id}`}
                settlement={item.data as Settlement}
                members={members}
                isDeleting={isDeleting}
                onDeleteSettlement={onDeleteSettlement}
              />
            );
          }
        })}
      </div>
    </>
  );
}
