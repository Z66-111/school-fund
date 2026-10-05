import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("starts with BOM, quotes commas/quotes/newlines, uses CRLF", () => {
    const out = toCsv([["Нэр", "Дүн"], ["Бат, Б", 3000], ['He said "hi"', 'a\nb']]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1)).toBe('Нэр,Дүн\r\n"Бат, Б",3000\r\n"He said ""hi""","a\nb"');
  });
});
