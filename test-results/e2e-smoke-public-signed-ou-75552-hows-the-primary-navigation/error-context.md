# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\smoke\public.spec.ts >> signed out >> the home page shows the primary navigation
- Location: e2e\smoke\public.spec.ts:4:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from "../fixtures";
  2  | 
  3  | test.describe("signed out", () => {
  4  |   test("the home page shows the primary navigation", async ({ page }) => {
> 5  |     await page.goto("/");
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  6  |     await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  7  |   });
  8  | 
  9  |   for (const route of ["/dashboard", "/customer", "/technician"]) {
  10 |     test(`${route} sends a signed-out visitor to sign in`, async ({ page }) => {
  11 |       await page.goto(route);
  12 |       await expect(page).toHaveURL(/\/sign-in/);
  13 |     });
  14 |   }
  15 | });
  16 | 
```