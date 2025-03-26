import { User, SimplifiedDebt, UserBalance } from './types';

/**
 * Calculate user balances from a list of debts
 * @param debts List of simplified debts
 * @returns Object mapping user IDs to their balance (positive = owed, negative = owing)
 */
export const calculateUserBalances = (debts: SimplifiedDebt[]): UserBalance => {
  const balances: UserBalance = {};

  for (const debt of debts) {
    // User who owes money (negative balance)
    if (!balances[debt.from.uuid]) {
      balances[debt.from.uuid] = 0;
    }
    balances[debt.from.uuid] -= debt.amount;

    // User who is owed money (positive balance)
    if (!balances[debt.to.uuid]) {
      balances[debt.to.uuid] = 0;
    }
    balances[debt.to.uuid] += debt.amount;
  }

  return balances;
};

/**
 * Simplify debts using a debt reduction algorithm
 * @param balances User balance mapping
 * @param membersData Group members data
 * @returns Simplified list of debts
 */
export const simplifyDebtsWithMembers = (
  balances: UserBalance,
  membersData: User[]
): SimplifiedDebt[] => {
  if (!membersData || membersData.length === 0) {
    return [];
  }

  const userMap = new Map<string, User>();
  membersData.forEach((member) => userMap.set(member.uuid, member));

  // Split users into creditors (positive balance) and debtors (negative balance)
  const creditors: [string, number][] = [];
  const debtors: [string, number][] = [];

  for (const [userId, balance] of Object.entries(balances)) {
    if (balance > 0) {
      creditors.push([userId, balance]); // Users who are owed money
    } else if (balance < 0) {
      debtors.push([userId, -balance]); // Users who owe money (use positive amount)
    }
  }

  if (creditors.length === 0 || debtors.length === 0) {
    return [];
  }

  // Sort by amount (ascending) - so we can pop the largest values from the end
  creditors.sort((a, b) => a[1] - b[1]);
  debtors.sort((a, b) => a[1] - b[1]);

  const simplified: SimplifiedDebt[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    // Get the largest creditor and debtor
    const [creditorId, creditAmount] = creditors[creditors.length - 1];
    const [debtorId, debtAmount] = debtors[debtors.length - 1];

    // Calculate the minimum of what the debtor owes and what the creditor is owed
    const amount = Math.min(creditAmount, debtAmount);

    const fromUser = userMap.get(debtorId);
    const toUser = userMap.get(creditorId);

    if (amount > 0 && fromUser && toUser) {
      // Record this transaction if we have both users
      simplified.push({
        from: fromUser,
        to: toUser,
        amount: parseFloat(amount.toFixed(2)), // Ensure we have clean numbers
      });
    }

    // Adjust the remaining balances
    if (creditAmount === amount) {
      creditors.pop(); // Remove this creditor if fully paid
    } else {
      creditors[creditors.length - 1][1] -= amount; // Reduce the credit amount
    }

    if (debtAmount === amount) {
      debtors.pop(); // Remove this debtor if fully paid
    } else {
      debtors[debtors.length - 1][1] -= amount; // Reduce the debt amount
    }
  }

  return simplified;
};
