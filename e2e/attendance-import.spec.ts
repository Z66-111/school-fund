import { test, expect } from "@playwright/test";
import path from "node:path";

test("teacher uploads an Excel workbook and attendance is registered from its month sheets", async ({ page }) => {
  const name = "Импорт Сурагч"; // the only class member named in the fixture
  await page.goto("/login");
  await page.fill('input[name="email"]', "teacher@school.local");
  await page.fill('input[name="password"]', "changeme");
  await page.click('button:has-text("Нэвтрэх")');
  await page.waitForURL(/attendance/);
  const base = page.url().replace(/\/attendance.*$/, "");

  await page.goto(`${base}/students`);
  await page.locator('form:has(input[name="name"]):not(:has(input[name="email"]))').locator('input[name="name"]').fill(name);
  await page.locator('form:has(input[name="name"]):not(:has(input[name="email"])) button').click();
  await expect(page.locator("tbody tr", { hasText: name })).toHaveCount(1);

  await page.goto(`${base}/attendance`);
  await page.locator("summary", { hasText: "Excel файлаас ирц оруулах" }).click();
  await page.setInputFiles('input[name="file"]', path.join(__dirname, "fixtures", "attendance.xlsx"));
  await page.click('button:has-text("Файлаас оруулах")');

  const result = page.getByRole("status").filter({ hasText: "Оруулсан дүн" });
  await expect(result).toBeVisible();
  const now = new Date(Date.now() + 8 * 3600_000);
  const monthLabel = `${now.getUTCFullYear()} ${now.getUTCMonth() + 1}-р сар`;
  const thisMonth = result.locator("li", { hasText: monthLabel });
  await expect(thisMonth).toContainText("Нэр нь таараагүй тул оруулаагүй: Байхгүй Хүүхэд");
  await expect(thisMonth).toContainText("Файлд байхгүй сурагч"); // the seeded children
  await expect(result.locator("li", { hasText: "«июль»" })).toContainText("Хичээлийн жилд хамаарахгүй сар");
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/attendance-import.png`, fullPage: true });

  // The grid now shows the marks from the sheet: present on odd days, absent on even ones.
  const cells = page.locator("tbody tr", { hasText: name }).locator("button:not([disabled])");
  for (let i = 0; i < (await cells.count()); i++) {
    const day = Number((await cells.nth(i).getAttribute("aria-label"))!.slice(-2));
    await expect(cells.nth(i)).toHaveText(day % 2 === 0 ? "Т" : "И");
  }
});
