import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", locale: "mn-MN" },
  webServer: {
    command:
      "rm -f prisma/e2e.db prisma/e2e.db-journal && DATABASE_URL=file:./e2e.db npx prisma db push --skip-generate && DATABASE_URL=file:./e2e.db npm run db:seed && DATABASE_URL=file:./e2e.db npx next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
