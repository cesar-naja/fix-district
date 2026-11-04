import { test, expect } from './fixtures';

// Seed test used by the Playwright planner/generator agents as the starting
// point for new tests. It only covers public, signed-out pages. Signed-in
// starting points: seed.customer.spec.ts and seed.technician.spec.ts.
test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });
});
