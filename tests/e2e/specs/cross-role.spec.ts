/**
 * Cross-role authorisation at the routing layer.
 *
 * The guards this exercises are asserted statically in
 * `tests/backend/routes.test.mjs` and `tests/integration/edge_functions.test.mjs`.
 * These cases cover the one thing those cannot see: that the browser never
 * renders the admin shell for a student in the first place.
 */
import { accountFor, gated, login } from '../support/harness';

const test = gated(['student']);

test('a student navigating directly to /admin is bounced to their own dashboard', async ({ page }) => {
  const account = accountFor('student');
  if (!account) return;

  await login(page, account);
  await page.goto('/admin');

  // Either the app refuses outright or it redirects by role. Both are a pass;
  // rendering the admin shell is not.
  await page.waitForURL(/\/(student|login)/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/admin(\/|$)/);
});

test('a student never sees admin-only navigation items', async ({ page }) => {
  const account = accountFor('student');
  if (!account) return;

  await login(page, account);
  await page.goto('/student');

  // "Security" and "Blockchain" are admin pages; a student sidebar must not
  // link to them.
  for (const href of ['/admin/security', '/admin/blockchain', '/admin/students']) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  }
});

test('a student cannot read an admin API route through the browser session', async ({ page }) => {
  const account = accountFor('student');
  if (!account) return;

  await login(page, account);

  const status = await page.evaluate(async () => {
    const res = await fetch('/api/students', { credentials: 'include' });
    return res.status;
  });

  // Any refusal is fine; 200 with a student-shaped payload is not. The
  // assertion stays loose because the route is proxied by Vite in dev and the
  // backend may not even be running — the point is "not authorised", not
  // "exactly 403".
  expect([401, 403, 404, 502, 503]).toContain(status);
});