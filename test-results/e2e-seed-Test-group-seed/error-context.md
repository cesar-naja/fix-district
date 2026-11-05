# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\seed.spec.ts >> Test group >> seed
- Location: e2e\seed.spec.ts:7:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from './fixtures';
  2  | 
  3  | // Seed test used by the Playwright planner/generator agents as the starting
  4  | // point for new tests. It only covers public, signed-out pages. Signed-in
  5  | // starting points: seed.customer.spec.ts and seed.technician.spec.ts.
  6  | test.describe('Test group', () => {
  7  |   test('seed', async ({ page }) => {
> 8  |     await page.goto('/');
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  9  |     await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  10 |   });
  11 | });
  12 | 
```