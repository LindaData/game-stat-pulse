import { expect, test, devices } from "@playwright/test";

test.use({ ...devices["iPhone 14"] });

test("mobile review workspace renders and persists notes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("http://127.0.0.1:4173/game-stat-pulse/", {
    waitUntil: "networkidle",
  });

  await expect(page.getByText("Game Stat Pulse", { exact: true })).toBeVisible();
  const notesButton = page.getByRole("button", { name: /open review notebook/i });
  await expect(notesButton).toBeVisible();

  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });

  await notesButton.click();
  await expect(page.getByRole("complementary", { name: /review notebook/i })).toBeVisible();

  const pageNote = page.getByRole("textbox", { name: /page note/i });
  await pageNote.fill("Mobile visual smoke test");

  await page.getByRole("link", { name: /catalog/i }).last().click();
  await expect(page.getByText("Game Stat Pulse", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /open review notebook/i })).toBeVisible();

  await page.goto("http://127.0.0.1:4173/game-stat-pulse/", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: /open review notebook/i }).click();
  await expect(page.getByRole("textbox", { name: /page note/i })).toHaveValue(
    "Mobile visual smoke test",
  );

  await page.screenshot({
    path: "test-results/mobile-notebook.png",
    fullPage: true,
  });

  expect(pageErrors).toEqual([]);
});
