import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "changeme");
  await page.click('button:has-text("Нэвтрэх")');
}

async function logout(page: Page) {
  await page.click('button:has-text("Гарах")');
  await expect(page).toHaveURL(/\/login/);
}

test("teacher marks attendance and closes month; accountant pays; parent sees zero due", async ({ page }) => {
  // Use last month so "close month" is allowed regardless of today's date.
  const now = new Date(Date.now() + 8 * 3600_000);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth(); // 0-based previous month
  if (m === 0) { m = 12; y -= 1; }

  await login(page, "teacher@school.local");
  await expect(page).toHaveURL(/\/teacher\/class\//);
  await page.goto(page.url().split("?")[0] + `?year=${y}&month=${m}`);
  // Click the first enabled cell in the first student row.
  const cell = page.locator("tbody tr").first().locator("button:not([disabled])").first();
  await cell.click();
  await expect(cell).toHaveText("И");
  await page.click('button:has-text("Хадгалах")');
  await expect(page.locator("text=Хадгалагдлаа")).toBeVisible();
  await page.click('form button:has-text("Сар хаах")');
  await page.getByRole("dialog").getByRole("button", { name: "Сар хаах" }).click();
  await expect(page.locator("text=Хаагдсан")).toBeVisible();
  await logout(page);

  await login(page, "accountant@school.local");
  await expect(page).toHaveURL(/\/accountant/);
  const row = page.locator("tbody tr", { hasText: "Батбаяр" });
  const due = (await row.locator("td").nth(2).innerText()).replace(/[^\d]/g, "");
  await row.locator("a").click();
  await page.selectOption('select[name="kind"]', "FOOD");
  await page.fill('input[name="amount"]', due);
  await page.click('button:has-text("Төлбөр бүртгэх")');
  await expect(page.locator("div.border-l-2", { hasText: /^Хоолны мөнгө төлөх/ })).toHaveText(/^Хоолны мөнгө төлөх\s*0 ₮$/);
  await logout(page);

  await login(page, "parent@school.local");
  await expect(page).toHaveURL(/\/parent\/students\//);
  await expect(page.locator("div.border-l-2", { hasText: /^Хоолны мөнгө төлөх/ })).toHaveText(/^Хоолны мөнгө төлөх\s*0 ₮$/);
});
