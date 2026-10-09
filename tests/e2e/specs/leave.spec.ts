/**
 * Leave: student submits → class in-charge approves → the student sees the
 * updated status.
 *
 * The ownership guard on approval (only the owning faculty may approve) is
 * asserted statically in `tests/backend/ownership.test.mjs`; this file proves
 * the round trip actually works end to end, which no source-shape test can.
 */
import { expect } from '../support/harness';
import { accountFor, gated, login } from '../support/harness';

const test = gated(['student', 'faculty']);

/** A marker unique to this run, so the row can be found again on re-read. */
function reason() {
  return `e2e-${Date.now()}`;
}

test('a submitted leave is approved by faculty and reflected for the student', async ({ browser }) => {
  const student = accountFor('student');
  const faculty = accountFor('faculty');
  if (!student || !faculty) return;

  const marker = reason();
  const studentCtx = await browser.newContext();
  const facultyCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();
  const facultyPage = await facultyCtx.newPage();

  try {
    // ── submit ─────────────────────────────────────────────────────────
    await login(studentPage, student);
    await studentPage.goto('/student/leaves');
    await studentPage.getByRole('button', { name: /apply for leave/i }).click();

    await studentPage.getByRole('combobox').click();
    await studentPage.getByRole('option', { name: /personal leave/i }).click();

    const today = new Date().toISOString().slice(0, 10);
    const dates = studentPage.locator('input[type="date"]');
    await dates.nth(0).fill(today);
    await dates.nth(1).fill(today);

    await studentPage.getByPlaceholder(/explain your reason/i).fill(marker);
    await studentPage.getByRole('button', { name: /submit application/i }).click();

    // Back on the list, in PENDING.
    await expect(studentPage.getByText(marker)).toBeVisible({ timeout: 30_000 });
    await expect(studentPage.getByText(/pending/i).first()).toBeVisible();

    // ── approve ────────────────────────────────────────────────────────
    await login(facultyPage, faculty);
    await facultyPage.goto('/faculty/leaves');

    const row = facultyPage.getByText(marker).locator('xpath=ancestor::*[self::tr or @data-slot="card"][1]');
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: /^approve$/i }).click();

    // ── the student sees it ────────────────────────────────────────────
    await studentPage.reload();
    const updated = studentPage.getByText(marker).locator('xpath=ancestor::*[self::tr or @data-slot="card"][1]');
    await expect(updated).toBeVisible({ timeout: 30_000 });
    await expect(updated.getByText(/approved/i).first()).toBeVisible({ timeout: 30_000 });
  } finally {
    await studentCtx.close();
    await facultyCtx.close();
  }
});

test('the leave form refuses an empty submission', async ({ page }) => {
  const student = accountFor('student');
  if (!student) return;

  await login(page, student);
  await page.goto('/student/leaves');
  await page.getByRole('button', { name: /apply for leave/i }).click();
  await page.getByRole('button', { name: /submit application/i }).click();

  // The dialog stays open: nothing was written.
  await expect(page.getByText(/new leave application/i)).toBeVisible();
});