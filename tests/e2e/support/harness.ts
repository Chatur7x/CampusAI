/**
 * Shared gating for the e2e suite.
 *
 * The pattern mirrors the one the rest of the repo already uses:
 *
 *   - `tests/ai/conftest.py` exposes a `live_server` fixture that calls
 *     `pytest.skip(...)` when nothing answers on `AI_BASE_URL`, so the suite
 *     stays green on a machine that has not started the server.
 *   - `tests/integration/edge_functions.test.mjs` passes
 *     `{ skip: !STUDENT_JWT && 'set STUDENT_JWT to run' }` to each live test,
 *     naming the missing variable in the skip reason.
 *
 * We do the same thing here: nothing in `specs/` asserts anything unless the
 * operator has opted in with `E2E=1` and supplied real credentials. Each spec
 * calls `skipUnless(...)` from a `test.beforeEach`, so a missing prerequisite
 * reports as a skip, not a red run.
 */
import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

/** The four landing areas the app routes to, keyed by account type. */
export type Role = 'admin' | 'faculty' | 'student' | 'company';

export interface Account {
  email: string;
  password: string;
  /** Path the app's `dashboardPath()` resolves for this role. */
  landing: string;
}

/**
 * Paths come straight from `src--frontend/App.tsx` (`dashboardPath`). They are
 * duplicated here rather than imported because the e2e suite must be runnable
 * without the app's toolchain installed.
 */
const LANDING: Record<Role, string> = {
  admin: '/admin',
  faculty: '/faculty',
  student: '/student',
  company: '/company',
};

const ENV_KEYS: Record<Role, [email: string, password: string]> = {
  admin: ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'],
  faculty: ['E2E_FACULTY_EMAIL', 'E2E_FACULTY_PASSWORD'],
  student: ['E2E_STUDENT_EMAIL', 'E2E_STUDENT_PASSWORD'],
  company: ['E2E_COMPANY_EMAIL', 'E2E_COMPANY_PASSWORD'],
};

/** Human-readable role names, used in skip reasons and test titles. */
const LABEL: Record<Role, string> = {
  admin: 'admin',
  faculty: 'faculty',
  student: 'student',
  company: 'company/HR',
};

/** Reads a role's credentials, or null when they are not fully configured. */
export function accountFor(role: Role): Account | null {
  const [emailKey, passwordKey] = ENV_KEYS[role];
  const email = process.env[emailKey];
  const password = process.env[passwordKey];
  if (!email || !password) return null;
  return { email, password, landing: LANDING[role] };
}

/**
 * The reason to skip, or null when the suite should actually run.
 *
 * Two gates, in order: the explicit opt-in, then the credentials. Keeping the
 * opt-in separate means nobody can accidentally start writing to a real
 * database just by exporting a JWT that happens to be in their shell.
 */
export function skipReason(roles: Role[]): string | null {
  if (process.env.E2E !== '1') {
    return 'E2E is not set to 1 — set E2E=1 to run the browser suite';
  }
  const missing = roles
    .filter((r) => !accountFor(r))
    .map((r) => `${ENV_KEYS[r][0]} + ${ENV_KEYS[r][1]} (${LABEL[r]})`);
  if (missing.length > 0) {
    return `No seeded ${missing.join(', ')} — run \`node seed_users.mjs\` first`;
  }
  return null;
}

/**
 * Builds a `test` whose every case skips cleanly when `roles` are unavailable.
 *
 * Usage: `const test = gated(['admin']);` then write cases normally.
 */
export function gated(roles: Role[]) {
  const test = base;

  test.beforeEach(async ({ baseURL }) => {
    const reason = skipReason(roles);
    if (reason) test.skip(true, reason);

    // A credential can be set while the app is not running. Probing here keeps
    // that a skip rather than a connection-refused error, which is the same
    // courtesy `live_server` extends to the pytest suite.
    if (baseURL) {
      const res = await fetch(baseURL, { signal: AbortSignal.timeout(5_000) }).catch(
        () => null,
      );
      if (!res || !res.ok) {
        test.skip(
          true,
          `${baseURL} is not serving (run \`npm run dev\`, or set E2E_BASE_URL to a deployed preview)`,
        );
      }
    }
  });

  return test;
}

/** Re-exported so specs import everything from one place. */
export { expect };

/**
 * Signs in through the real login form.
 *
 * Deliberately drives the UI rather than seeding storage state: the point of
 * the login specs is that the form, the Supabase session and the role-to-
 * dashboard redirect all line up. Selectors match `pages/LoginPage.tsx`.
 */
export async function login(page: Page, account: Account) {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(account.email);
  await page.getByPlaceholder('Password').fill(account.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // The login card is replaced by the dashboard only once the session lands.
  await expect(page.getByPlaceholder('Email address')).toBeHidden({ timeout: 30_000 });
}

/** Logs out by clearing the Supabase session, then returns to /login. */
export async function logout(page: Page) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/login');
}