"use client";

import { createContext, useContext, ReactNode } from "react";
import { formatCurrency as formatCurrencyFn } from "@/lib/format";

export type Currency = "CRC" | "EUR";

interface AcademyCurrencyContextType {
  currency: Currency;
  formatCurrency: (amount: number) => string;
}

const AcademyCurrencyContext = createContext<AcademyCurrencyContextType | null>(null);

export function AcademyCurrencyProvider({
  children,
  currency,
}: {
  children: ReactNode;
  currency: Currency;
}) {
  const value: AcademyCurrencyContextType = {
    currency,
    formatCurrency: (amount: number) => formatCurrencyFn(amount, currency),
  };

  return (
    <AcademyCurrencyContext.Provider value={value}>
      {children}
    </AcademyCurrencyContext.Provider>
  );
}

export function useAcademyCurrency(): AcademyCurrencyContextType {
  const ctx = useContext(AcademyCurrencyContext);
  if (!ctx) {
    return {
      currency: "CRC",
      formatCurrency: (amount: number) => formatCurrencyFn(amount, "CRC"),
    };
  }
  return ctx;
}
