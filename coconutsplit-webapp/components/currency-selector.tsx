"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";

type Currency = {
  code: string;
  name: string;
};

interface CurrencySelectorProps {
  currencies: Currency[];
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  heightClass?: string;
}

export function CurrencySelector({
  currencies,
  selectedCurrency,
  onCurrencyChange,
  isLoading = false,
  isReadOnly = false,
  heightClass = "",
}: CurrencySelectorProps) {
  const [open, setOpen] = React.useState(false);

  const selectedCurrencyObject = currencies.find(
    (c) => c.code === selectedCurrency
  );

  // If read-only, just display the currency without drawer functionality
  if (isReadOnly) {
    return (
      <Button
        variant="outline"
        className={`w-auto px-3 justify-between text-left bg-gray-800 border-gray-700 text-white ${heightClass}`}
        disabled={true}
      >
        {isLoading ? "..." : selectedCurrency}
      </Button>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={`w-full justify-between text-left bg-gray-800 border-gray-700 text-white hover:bg-gray-700 ${heightClass}`}
          disabled={isLoading}
        >
          {isLoading
            ? "Loading..."
            : selectedCurrencyObject
            ? `${selectedCurrencyObject.code.toUpperCase()}`
            : "Select currency"}
          <ChevronDown className="opacity-80 text-white" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[80vh] bg-gray-800 border-gray-700 text-white">
        <div className="mt-4 border-t border-gray-700">
          <div className="px-4 py-2">
            <h3 className="font-medium text-white">Select Currency</h3>
            <p className="text-sm text-gray-400">
              Choose the currency for your group
            </p>
          </div>
          <CurrencyList
            currencies={currencies}
            selectedCurrency={selectedCurrency}
            setOpen={setOpen}
            onCurrencyChange={onCurrencyChange}
            isLoading={isLoading}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function CurrencyList({
  currencies,
  selectedCurrency,
  setOpen,
  onCurrencyChange,
  isLoading,
}: {
  currencies: Currency[];
  selectedCurrency: string;
  setOpen: (open: boolean) => void;
  onCurrencyChange: (currency: string) => void;
  isLoading: boolean;
}) {
  return (
    <Command className="bg-gray-800 border-none rounded-none">
      <CommandInput
        placeholder="Search currency..."
        className="border-gray-700 focus:ring-blue-500 text-white bg-gray-800 placeholder-gray-300"
      />

      <CommandList className="text-white">
        {isLoading ? (
          <p className="p-2 text-center text-gray-400">Loading currencies...</p>
        ) : (
          <>
            <CommandEmpty className="py-6 text-center text-gray-400">
              No currency found.
            </CommandEmpty>
            <CommandGroup className="text-gray-200">
              {currencies.map((currency) => (
                <CommandItem
                  key={currency.code}
                  value={`${currency.code} ${currency.name}`}
                  onSelect={() => {
                    onCurrencyChange(currency.code);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between hover:bg-gray-700"
                >
                  <span>
                    {currency.code} - {currency.name}
                  </span>
                  {currency.code === selectedCurrency && (
                    <Check className="w-4 h-4 text-blue-500" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}
