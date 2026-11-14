import "server-only";
import { cookies } from "next/headers";
import { dictionaries, isLocale, translateMessage, DEFAULT_LOCALE, LOCALE_COOKIE, type Dict, type Locale } from "@/lib/i18n";

/** The viewer's language, from the cookie the language switch sets. */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** The dictionary for this request. Server components call `const mn = await getT()`. */
export async function getT(): Promise<Dict> {
  return dictionaries[await getLocale()];
}

/** Translates the user-facing texts of an action result (`error`, `message`, field errors) into the viewer's language. */
export async function localizeResult<T extends { error?: string; message?: string; fieldErrors?: Record<string, string[]> }>(result: T): Promise<T> {
  const locale = await getLocale();
  if (locale === DEFAULT_LOCALE) return result;
  const out = { ...result };
  if (out.error) out.error = translateMessage(out.error, locale);
  if (out.message) out.message = translateMessage(out.message, locale);
  if (out.fieldErrors) out.fieldErrors = Object.fromEntries(Object.entries(out.fieldErrors).map(([k, v]) => [k, v.map((m) => translateMessage(m, locale))]));
  return out;
}
