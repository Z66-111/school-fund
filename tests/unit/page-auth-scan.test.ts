import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.resolve(__dirname, "../../src/app");
const EXCEPTIONS = new Set(["page.tsx", "login/page.tsx", "forbidden/page.tsx"]);

function findPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findPages(full));
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

describe("page-level auth", () => {
  const pages = findPages(APP_DIR).map((p) => path.relative(APP_DIR, p).split(path.sep).join("/"));

  it("finds the app pages", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it.each(pages.filter((p) => !EXCEPTIONS.has(p)))("%s calls requirePage/requireClassPage", (rel) => {
    const text = fs.readFileSync(path.join(APP_DIR, rel), "utf8");
    expect(text).toMatch(/require(Class)?Page\(/);
  });
});
