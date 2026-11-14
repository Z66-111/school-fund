"use client";
import { createContext, useContext } from "react";
import { dictionaries, DEFAULT_LOCALE, type Dict, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): Locale => useContext(LocaleContext);

/** The dictionary for the viewer's language. Client components call `const mn = useT()`. */
export const useT = (): Dict => dictionaries[useContext(LocaleContext)];
