import { test, expect } from "@playwright/test";

test("a new child is enrolled in daycare by default; teacher moves the start date, marks a skipped day, and the month is charged in full", async ({ page }) => {
  const name = "Өнжих Тэмүүлэн";
  const now = new Date(Date.now() + 8 * 3600_000);
  const first = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const shot = async (file: string) => { if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${file}`, fullPage: true }); };

  await page.goto("/login");
  await page.fill('input[name="email"]', "teacher@school.local");
  await page.fill('input[name="password"]', "changeme");
  await page.click('button:has-text("Нэвтрэх")');
  await page.waitForURL(/attendance/);
  const base = page.url().replace(/\/attendance.*$/, "");

  // A fresh student, so other tests working on the seeded children are not affected.
  await page.goto(`${base}/students`);
  await page.locator('form:has(input[name="name"]):not(:has(input[name="email"]))').locator('input[name="name"]').fill(name);
  await page.locator('form:has(input[name="name"]):not(:has(input[name="email"])) button').click();
  const row = page.locator("tbody tr", { hasText: name });
  await expect(row).toContainText(now.toISOString().slice(0, 10)); // enrolled from today by default
  await row.locator("summary", { hasText: "Өдөр өнжүүлэхийн бүртгэл" }).click();
  await row.locator('input[name="from"]').fill(first);
  await row.locator('form:has(input[name="from"]) button').click();
  await expect(row.getByRole("status")).toContainText("хадгалагдлаа");
  await expect(row).toContainText(first);
  await shot("daycare-students.png");

  // Only enrolled children are on the daycare grid, every school day pre-filled as stayed.
  await page.goto(`${base}/attendance?mode=daycare`);
  const grid = page.locator("tbody tr", { hasText: name });
  await expect(grid).toHaveCount(1);
  await expect(page.locator("tbody tr", { hasText: "Сарнай" })).toHaveCount(0); // seeded children are not enrolled
  const cells = grid.locator("button:not([disabled])");
  if ((await cells.count()) > 0) { // none on the 1st of a month that starts on a weekend
    await expect(cells.first()).toHaveText("✓");
    await cells.first().click();
    await expect(cells.first()).toHaveText("–");
    await page.click('button:has-text("Хадгалах")');
    await expect(page.locator("text=Хадгалагдлаа")).toBeVisible();
    await page.reload();
    await expect(grid.locator("button").first()).toHaveText("–");
    await expect(grid.locator("td").last()).toHaveText("1");
  }
  await shot("daycare-grid.png");

  // The whole month is owed already; this month's skipped day does not reduce it.
  await page.goto(`${base}/report`);
  const report = page.locator("section", { hasText: "Сарын өдөр өнжүүлэхийн тайлан" }).last();
  await expect(report.locator("thead")).toContainText("Төлбөрт өдөр");
  const line = report.locator("tbody tr", { hasText: name });
  const days = Number(await line.locator("td").nth(1).innerText());
  expect(days).toBeGreaterThan(15);
  await expect(line.locator("td").nth(2)).toHaveText("");
  expect((await line.locator("td").nth(3).innerText()).replace(/[^\d]/g, "")).toBe(String(days * 27000));
  await shot("daycare-report.png");
});
