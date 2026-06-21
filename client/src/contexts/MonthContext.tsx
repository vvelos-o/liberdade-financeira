import React, { createContext, useContext, useState } from "react";

interface MonthContextValue {
  year: number;
  month: number;
  setYear: (y: number) => void;
  setMonth: (m: number) => void;
  setYearMonth: (y: number, m: number) => void;
  monthLabel: string;
}

const MonthContext = createContext<MonthContextValue | null>(null);

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const setYearMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <MonthContext.Provider value={{ year, month, setYear, setMonth, setYearMonth, monthLabel }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}

export const MONTH_NAMES_LIST = MONTH_NAMES;
