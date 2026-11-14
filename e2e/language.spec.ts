import { test, expect } from "@playwright/test";

test("the site switches between Mongolian and Russian and remembers the choice", async ({ page }) => {
  const shot = async (file: string) => { if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${file}` }); };
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "mn");
  await expect(page.getByRole("heading", { name: "Нэвтрэх" })).toBeVisible();

  await page.getByRole("button", { name: "Русский" }).click();
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page).toHaveTitle(/Школьный фонд/);

  // Messages that come back from the server are in Russian too.
  await page.fill('input[name="email"]', "teacher@school.local");
  await page.fill('input[name="password"]', "wrong-password");
  await page.click('button:has-text("Войти")');
  await expect(page.getByRole("alert").filter({ hasText: "Неверная эл. почта или пароль" })).toBeVisible();
  await shot("lang-login-ru.png");

  await page.fill('input[name="email"]', "teacher@school.local");
  await page.fill('input[name="password"]', "changeme");
  await page.click('button:has-text("Войти")');
  await page.waitForURL(/attendance/);
  await expect(page.getByRole("link", { name: "Ученики" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Закрыть месяц" })).toBeVisible(); // a client component
  await expect(page.getByText("Нажмите на ячейку, чтобы отметить")).toBeVisible();
  await shot("lang-teacher-ru.png");

  // A validation message raised inside a service, shown through a form.
  await page.goto(page.url().replace(/\/attendance.*$/, "/schedule"));
  await page.fill('input[name="start-1"]', "25:99");
  await page.click('button:has-text("Сохранить расписание")');
  await expect(page.getByRole("alert").filter({ hasText: "Неверное время (ЧЧ:ММ)" })).toBeVisible();

  // The choice survives a reload, and switching back restores Mongolian.
  await page.reload();
  await expect(page.getByRole("button", { name: "Сохранить расписание" })).toBeVisible();
  await page.getByRole("button", { name: "Монгол" }).click();
  await expect(page.getByRole("button", { name: "Хуваарь хадгалах" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "mn");
});
