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

    if (amount >= 0.01 && fromUser && toUser) {
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

/**
 * Fetches a list of all available currencies from the exchange API
 * @returns Promise resolving to an array of currency objects with code and name
 */
export const getAllCurrencies = async (): Promise<{ code: string, name: string }[]> => {
  try {
    // Primary API endpoint for currency data (jsDelivr CDN)
    const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch currencies from CDN: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Format the response into an array of currency objects
    return Object.entries(data).map(([code, name]) => ({
      code,
      name: typeof name === 'string' ? name : code
    }));
    
  } catch (error) {
    console.error('Error fetching currencies from primary source:', error);
    
    // Try Cloudflare fallback URL as recommended in the repository
    try {
      // Using latest data and USD as base currency
      const fallbackResponse = await fetch('https://latest.currency-api.pages.dev/v1/currencies.json');
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();

        return Object.entries(fallbackData).map(([code, name]) => ({
          code,
          name: typeof name === 'string' ? name : code
        }));
      }
      throw new Error('Cloudflare fallback failed');
    } catch (fallbackError) {
      console.error('Error fetching currencies from fallback source:', fallbackError);
      
      // Return a fallback list of common currencies
      return [
        { code: 'USD', name: 'US Dollar' },
        { code: 'EUR', name: 'Euro' },
        { code: 'JPY', name: 'Japanese Yen' },
        { code: 'GBP', name: 'British Pound' },
        { code: 'AUD', name: 'Australian Dollar' },
        { code: 'CAD', name: 'Canadian Dollar' },
        { code: 'CHF', name: 'Swiss Franc' },
        { code: 'CNY', name: 'Chinese Yuan' },
        { code: 'SGD', name: 'Singapore Dollar' },
        { code: 'INR', name: 'Indian Rupee' }
      ];
    }
  }
};

/**
 * Gets all exchange rates for a given base currency
 * @param baseCurrency Base currency code (e.g., 'SGD')
 * @returns Promise resolving to an object with all exchange rates or null if unavailable
 */
export const getExchangeRates = async (baseCurrency: string): Promise<Record<string, number> | null> => {
  try {
    // Standardize currency code to lowercase as used by the API
    const base = baseCurrency.toLowerCase();
    
    // Primary API endpoint using jsDelivr CDN
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates from CDN: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Return all exchange rates for the base currency
    if (data && data[base]) {
      return data[base];
    }
    
    throw new Error(`Exchange rates for ${baseCurrency} not found`);
    
  } catch (error) {
    console.error('Error fetching exchange rates from primary source:', error);
    
    // Try Cloudflare fallback URL
    try {
      const fallbackResponse = await fetch(
        `https://latest.currency-api.pages.dev/v1/currencies/${baseCurrency.toLowerCase()}.json`
      );
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData && fallbackData[baseCurrency.toLowerCase()]) {
          return fallbackData[baseCurrency.toLowerCase()];
        }
      }
      throw new Error(`Cloudflare fallback failed for ${baseCurrency} exchange rates`);
    } catch (fallbackError) {
      console.error('Error fetching exchange rates from fallback source:', fallbackError);
      return null;
    }
  }
};

/**
 * Convert amount from one currency to another using a provided exchange rate
 * @param amount Amount to convert
 * @param exchangeRate Exchange rate to use for conversion
 * @returns The converted amount with 2 decimal precision
 */
export const convertCurrency = (
  amount: number, 
  exchangeRate: number
): number => {
  // Calculate converted amount
  const convertedAmount = amount / exchangeRate;
  
  // Return with 2 decimal places for financial calculations
  return parseFloat(convertedAmount.toFixed(2));
};

/**
 * Format a number with appropriate currency symbol
 * @param value The numeric value to format
 * @param currencyCode The ISO currency code (e.g., 'USD', 'EUR')
 * @returns Formatted currency string with symbol
 */
export const formatCurrency = (value: number, currencyCode: string): string => {
  try {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(value);
  } catch (error) {
    // Fall back to simpler formatting if the currency code is invalid
    return `${value.toFixed(2)} ${currencyCode}`;
  }
};
