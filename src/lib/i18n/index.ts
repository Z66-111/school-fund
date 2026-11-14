import { mn } from "@/lib/i18n/mn";
import { ru } from "@/lib/i18n/ru";

export type Locale = "mn" | "ru";
export const LOCALES: Locale[] = ["mn", "ru"];
export const DEFAULT_LOCALE: Locale = "mn";
export const LOCALE_COOKIE = "lang";

type Widen<T> = T extends string ? string : T extends readonly string[] ? readonly string[] : { readonly [K in keyof T]: Widen<T[K]> };
/** The shape every language provides; Mongolian (`mn`) is the source of the keys. */
export type Dict = Widen<typeof mn>;

export const dictionaries: Record<Locale, Dict> = { mn, ru };

export const isLocale = (v: unknown): v is Locale => v === "mn" || v === "ru";

// Services and actions build their messages from the Mongolian dictionary (they have no request
// to read a language from). Whatever they return is turned into the viewer's language on the way
// out, by finding the Mongolian text in the dictionary and reading the same key in the other one.
const reverse = new Map<Locale, Map<string, string>>();
function reverseFor(locale: Locale): Map<string, string> {
  let map = reverse.get(locale);
  if (map) return map;
  map = new Map();
  const walk = (a: unknown, b: unknown) => {
    if (typeof a === "string") {
      if (typeof b === "string" && !map!.has(a)) map!.set(a, b);
    } else if (a && typeof a === "object") {
      for (const k of Object.keys(a)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown> | undefined)?.[k]);
    }
  };
  walk(mn.errors, dictionaries[locale].errors); // error texts win when two keys share a Mongolian string
  walk(mn, dictionaries[locale]);
  reverse.set(locale, map);
  return map;
}

/** A message produced in Mongolian, in `locale`. Also handles "<known text> <value>", e.g. a note followed by a password. */
export function translateMessage(message: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return message;
  const map = reverseFor(locale);
  const exact = map.get(message);
  if (exact !== undefined) return exact;
  let best = "";
  for (const text of map.keys()) {
    if (text.length > best.length && text.length >= 10 && message.startsWith(`${text} `)) best = text;
  }
  return best ? map.get(best)! + message.slice(best.length) : message;
}
