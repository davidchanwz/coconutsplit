import { Expense } from "./types";
import { formatDateForGrouping, formatDateForDisplay } from "./date-utils";
import { Settlement, TimelineItem } from "./types";

export function createTimelineItems(expenses: Expense[], settlements: Settlement[]): TimelineItem[] {
    if (!expenses.length && !settlements.length) return [];

    const regularItems: TimelineItem[] = [
        ...expenses.map(expense => ({
            type: 'expense' as const,
            data: expense,
            created_at: expense.created_at
        })),
        ...settlements.map(settlement => ({
            type: 'settlement' as const,
            data: settlement,
            created_at: settlement.created_at
        }))
    ];

    regularItems.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const processedDates = new Set<string>();
    const items: TimelineItem[] = [];

    regularItems.forEach(item => {
        const dateGroup = formatDateForGrouping(item.created_at);

        if (!processedDates.has(dateGroup)) {
            processedDates.add(dateGroup);
            items.push({
                type: 'date-separator',
                data: formatDateForDisplay(item.created_at),
                created_at: item.created_at
            });
        }

        items.push(item);
    });

    return items;
}
