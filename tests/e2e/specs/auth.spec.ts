/**
 * Role logins → landing pages.
 *
 * `dashboardPath()` in `src--frontend/App.tsx` is the contract under test: a
 * student must not land on `/admin`, and each of the four account types must
 * reach its own dashboard. Skip gate: see `support/harness.ts`.
 */
import { accountFor, gated, login, logout } from '../support/harness';

const test = gated(['admin', 'faculty', 'student', 'company']);

for (const role of ['admin', 'faculty', 'student', 'company'] as const) {
  test(`${role} signs in and lands on its own dashboard`, async ({ page }) => {
    const account = accountFor(role);
    if (!account) return; // unreachable; the gate already skipped

    await login(page, account);

    await page.waitForURL(new RegExp(`^${account.landing}(/|$)`), { timeout: 30_000 });
    await expect(page.getByRole('navigation')).toBeVisible();

    // A login that lands on the right path but renders another role's chrome
    // is still a failure, so assert the shell is the one we expect.
    const wrongArea = await page
      .locator(`a[href^="${account.landing === '/student' ? '/admin' : '/student'}"]`)
      .count();
    expect(wrongArea).toBe(0);
  });
}

test('an unauthenticated visit to a protected route is sent to /login', async ({ page }) => {
  // No account needed: ProtectedRoute redirects before anything role-specific
  // happens, so this case runs whenever E2E=1 and the app is up.
  await page.goto('/admin');
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
});

test('signing out returns the session to /login', async ({ page }) => {
  const account = accountFor('student');
  if (!account) return;

  await login(page, account);
  await logout(page);

  await page.goto('/student');
  await page.waitForURL(/\/login/, { timeout: 30_000 });
});