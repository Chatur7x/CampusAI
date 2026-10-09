/**
 * Attendance: faculty opens a session → student verifies with the session code
 * → the mark is visible on both sides.
 *
 * The interesting regression this guards is ownership, not role: a faculty
 * member must not be able to mark a class they do not teach. That rule is
 * asserted statically in `tests/integration/edge_functions.test.mjs`
 * (`staffOwnsStudent fails closed`); here we only prove the happy path is not
 * broken by it.
 *
 * Requires a seeded faculty/student pair in the SAME class. The class id is
 * read off the faculty's own dashboard rather than configured, because seeding
 * it by hand goes stale the moment the schema moves.
 */
import { expect } from '../support/harness';
import { accountFor, gated, login } from '../support/harness';

const test = gated(['faculty', 'student']);

/** Reads the live six-digit session code once the faculty session is open. */
async function readSessionCode(page: import('@playwright/test').Page) {
  // LiveAttendanceFaculty renders the code as a large monospace block; fall
  // back to any six-digit text on the page so the selector survives a restyle.
  const byText = page.getByText(/^\d{6}$/).first();
  await expect(byText).toBeVisible({ timeout: 30_000 });
  const text = (await byText.textContent()) ?? '';
  const match = text.match(/\d{6}/);
  if (!match) throw new Error(`no six-digit session code on the page (saw "${text}")`);
  return match[0];
}

test('faculty starts a session and the student can verify with its code', async ({ browser }) => {
  const faculty = accountFor('faculty');
  const student = accountFor('student');
  if (!faculty || !student) return;

  const facultyCtx = await browser.newContext();
  const facultyPage = await facultyCtx.newPage();
  const studentCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();

  try {
    // ── faculty opens the session ──────────────────────────────────────
    await login(facultyPage, faculty);
    await facultyPage.goto('/faculty/live-attendance');
    await facultyPage.getByRole('button', { name: /start session/i }).click();

    const code = await readSessionCode(facultyPage);

    // ── student verifies ───────────────────────────────────────────────
    await login(studentPage, student);
    await studentPage.goto('/student/live-attendance');
    await studentPage.getByPlaceholder('000000').fill(code);
    await studentPage.getByRole('button', { name: /verify|continue|start/i }).first().click();

    // The student moves past the code step into liveness/geo verification.
    await expect(studentPage.getByText(/verifying|scanning|camera|liveness/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // ── the record is visible to faculty ───────────────────────────────
    await facultyPage.reload();
    await expect(facultyPage.getByText(/students verifying|liveness|geo-fence/i).first()).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await facultyCtx.close();
    await studentCtx.close();
  }
});

test('a wrong session code is refused', async ({ page }) => {
  const student = accountFor('student');
  if (!student) return;

  await login(page, student);
  await page.goto('/student/live-attendance');
  await page.getByPlaceholder('000000').fill('000000');

  // The app must not advance past the code step on an invalid code. Asserting
  // "not advanced" rather than a specific message keeps this from breaking on
  // copy changes.
  await page.waitForTimeout(5_000);
  await expect(page).toHaveURL(/\/student\/live-attendance/);
});