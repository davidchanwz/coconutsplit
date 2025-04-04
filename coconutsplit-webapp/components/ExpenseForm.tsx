import { ChangeEvent, useState, useEffect } from "react";
import { User } from "../lib/types";
import { CurrencySelector } from "./currency-selector";
import { getAllCurrencies, getExchangeRates, formatCurrency } from "@/lib/financial-utils";

interface ExpenseFormProps {
  description: string;
  setDescription: (description: string) => void;
  amount: string;
  setAmount: (amount: string) => void;
  paidBy: string;
  setPaidBy: (paidBy: string) => void;
  members: User[];
  currentUser: User | null;
  groupCurrency: string;
  currentCurrency: string;
  onCurrencyChange: (currency: string) => void;
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
}

export function ExpenseForm({
  description,
  setDescription,
  amount,
  setAmount,
  paidBy,
  setPaidBy,
  members,
  currentUser,
  groupCurrency,
  currentCurrency,
  onCurrencyChange,
  exchangeRate,
  setExchangeRate,
}: ExpenseFormProps) {
  const [currencies, setCurrencies] = useState<
    { code: string; name: string }[]
  >([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [loadingRate, setLoadingRate] = useState(false);

  // Load currencies when component mounts
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const currencyList = await getAllCurrencies();
        setCurrencies(currencyList);
      } catch (error) {
        console.error("Failed to load currencies:", error);
        // Set fallback currencies
        setCurrencies([
          { code: "USD", name: "US Dollar" },
          { code: "EUR", name: "Euro" },
          { code: "SGD", name: "Singapore Dollar" },
          { code: "GBP", name: "British Pound" },
        ]);
      } finally {
        setLoadingCurrencies(false);
      }
    };

    loadCurrencies();
  }, []);

  // Fetch conversion rate when currencies change
  useEffect(() => {
    async function fetchConversionRate() {
      if (currentCurrency === groupCurrency) {
        setExchangeRate(1.0);
        return;
      }

      setLoadingRate(true);
      try {
        const rates = await getExchangeRates(groupCurrency);
        if (rates && rates[currentCurrency.toLowerCase()]) {
          const rate = rates[currentCurrency.toLowerCase()];
          setExchangeRate(rate);
        } else {
          setExchangeRate(1.0);
        }
      } catch (error) {
        console.error("Failed to fetch conversion rate:", error);
        setExchangeRate(1.0);
      } finally {
        setLoadingRate(false);
      }
    }

    fetchConversionRate();
  }, [currentCurrency, groupCurrency, setExchangeRate]);

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimal point
    if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleConversionRateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimal point
    if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
      const parsedValue = value === "" ? 1.0 : parseFloat(value);
      setExchangeRate(parsedValue);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-300"
        >
          Description
        </label>
        <input
          type="text"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full p-3 rounded-md bg-gray-800 border-gray-700 text-white"
          placeholder="What's this expense for?"
          required
        />
      </div>

      <div>
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-gray-300"
        >
          Amount
        </label>
        <div className="mt-1 flex gap-2 items-center">
          <div className="w-auto">
            <CurrencySelector
              currencies={currencies}
              selectedCurrency={currentCurrency}
              onCurrencyChange={onCurrencyChange}
              isLoading={loadingCurrencies}
              heightClass="h-[46px]" // Match the height of the input (p-3 typically equals 12px padding, so 46px total height)
            />
          </div>
          <input
            type="text"
            id="amount"
            value={amount}
            onChange={handleAmountChange}
            className="block flex-1 p-3 rounded-md bg-gray-800 border-gray-700 text-white"
            placeholder="0.00"
            inputMode="decimal"
            required
          />
        </div>

        {/* Show conversion input when currencies differ */}
        {currentCurrency !== groupCurrency && (
          <div className="mt-2 p-3 bg-gray-800 border border-gray-700 rounded-md">
            <label
              htmlFor="conversionRate"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Conversion Rate (1 {groupCurrency} ={" "}
              {exchangeRate !== null
                ? exchangeRate.toFixed(4)
                : loadingRate
                ? "Loading..."
                : "Rate unavailable"}{" "}
              {currentCurrency})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="exchangeRate"
                value={exchangeRate !== null ? String(exchangeRate) : ""}
                onChange={handleConversionRateChange}
                className="block flex-1 p-2 rounded-md bg-gray-800 border-2 border-gray-700 focus:ring-opacity-50 text-white"
                placeholder={
                  loadingRate
                    ? "Loading..."
                    : "Enter conversion rate"
                }
                inputMode="decimal"
              />
            </div>

            {amount && exchangeRate && !isNaN(parseFloat(amount)) && (
              <div className="mt-2 text-sm text-gray-400">
                {formatCurrency(parseFloat(amount), currentCurrency)} ≈{" "}
                {formatCurrency(parseFloat(amount) / exchangeRate, groupCurrency)}
              </div>
            )}

            <div className="mt-2 text-xs text-gray-500">
              Exchange rates are updated daily. You can enter your own rate if
              needed.
            </div>
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="paidBy"
          className="block text-sm font-medium text-gray-300"
        >
          Paid by
        </label>
        <select
          id="paidBy"
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="mt-1 block w-full p-3 rounded-md bg-gray-800 border-gray-700 text-white"
          required
        >
          {members.map((member) => (
            <option key={member.uuid} value={member.uuid}>
              {member.username}{" "}
              {member.uuid === currentUser?.uuid ? "(You)" : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
