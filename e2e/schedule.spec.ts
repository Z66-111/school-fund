import { test, expect } from "@playwright/test";

test("schedule editor keeps other edits when one field is invalid, then saves", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "teacher@school.local");
  await page.fill('input[name="password"]', "changeme");
  await page.click('button:has-text("Нэвтрэх")');
  await page.waitForURL(/attendance/);
  await page.goto(page.url().replace(/\/attendance.*$/, "/schedule"));

  await page.fill('input[name="s-1-1"]', "Математик");
  await page.fill('input[name="start-1"]', "8:00");
  await page.fill('input[name="end-1"]', "07:00"); // ends before it starts
  await page.click('button:has-text("Хуваарь хадгалах")');
  await expect(page.getByRole("alert").filter({ hasText: "Дуусах" })).toContainText("Дуусах 1");
  await expect(page.locator('input[name="s-1-1"]')).toHaveValue("Математик");
  await expect(page.locator('input[name="start-1"]')).toHaveValue("8:00");

  await page.fill('input[name="end-1"]', "8:40");
  await page.click('button:has-text("Хуваарь хадгалах")');
  await expect(page.getByRole("status")).toContainText("Хуваарь хадгалагдлаа");
  await page.reload();
  await expect(page.locator('input[name="start-1"]')).toHaveValue("08:00");
  await expect(page.locator('input[name="s-1-1"]')).toHaveValue("Математик");
});
