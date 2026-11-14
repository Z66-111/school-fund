import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "changeme");
  await page.click('button:has-text("Нэвтрэх")');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("teacher posts an announcement, the parent sees it moving in the banner, clearing removes it", async ({ page, browser }) => {
  const text = "Баасан гарагт 18:00 цагт эцэг эхийн хурал болно";
  await login(page, "teacher@school.local");
  await page.waitForURL(/attendance/);
  const url = page.url().replace(/\/attendance.*$/, "/announcement");
  await page.goto(url);
  await page.fill('textarea[name="text"]', text);
  await page.click('button:has-text("Зарлал хадгалах")');
  await expect(page.getByRole("status")).toContainText("Зарлал хадгалагдлаа");

  const parentCtx = await browser.newContext();
  const parent = await parentCtx.newPage();
  await login(parent, "parent@school.local");
  const banner = parent.getByRole("complementary", { name: "Зарлал" });
  await expect(banner).toContainText(text);
  const track = banner.locator(".marquee-track");
  const x = async () => (await track.boundingBox())!.x;
  const before = await x();
  await parent.waitForTimeout(600);
  expect(await x()).toBeLessThan(before);
  if (process.env.SHOT_DIR) await parent.screenshot({ path: `${process.env.SHOT_DIR}/parent-banner.png` });

  await page.goto(url);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/teacher-announcement.png` });
  // React puts a textarea's server-rendered text back when it hydrates, so an edit made before
  // that (a slow CI runner gets there first) is lost. Retry until the cleared value is what is saved.
  await expect(async () => {
    await page.fill('textarea[name="text"]', "");
    await page.click('button:has-text("Зарлал хадгалах")');
    await expect(page.getByRole("status")).toContainText("Зарлал арилгалаа", { timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await parent.reload();
  await expect(parent.getByRole("complementary", { name: "Зарлал" })).toHaveCount(0);
  await parentCtx.close();
});
