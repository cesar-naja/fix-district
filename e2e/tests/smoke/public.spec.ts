import { expect, test } from "../../fixtures";

test.describe("signed out", { tag: "@smoke" }, () => {
  test("the home page shows the primary navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  for (const route of ["/dashboard", "/customer", "/technician"]) {
    test(`${route} sends a signed-out visitor to sign in`, { tag: "@auth" }, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in/);
    });
  }
});
