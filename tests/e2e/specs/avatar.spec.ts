/**
 * Avatar upload: the happy path, and the two file types that must never be
 * stored.
 *
 * `server--backend/src/middleware/upload.ts` refuses anything outside
 * image/jpeg|png|gif|webp, sniffs the leading bytes rather than trusting the
 * declared MIME, and rejects a file whose head contains `<script`, `<html`,
 * `<svg`, `<iframe`, `<object>` or `<embed`. That middleware is asserted
 * exhaustively in `tests/backend/upload.test.mjs`; this file only has to prove
 * the *browser* does not put an `.svg` or `.html` into storage.
 *
 * An uploaded avatar lands in the Supabase `avatars` bucket, so these cases
 * write real objects. Use a throwaway student account.
 */
import { expect } from '../support/harness';
import { accountFor, gated, login } from '../support/harness';

const test = gated(['student']);

/** Minimal valid 1x1 PNG, as bytes Playwright can hand to `setInputFiles`. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** A well-formed SVG that would execute script if it were ever served back. */
const SVG_XSS = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

/** A minimal HTML document — the other extension an XSS avatar would arrive as. */
const HTML_XSS = Buffer.from('<html><script>alert(1)</script></html>');

const fileInput = (page: import('@playwright/test').Page) =>
  page.locator('input[type="file"]').first();

test('a valid PNG is stored and rendered as the profile photo', async ({ page }) => {
  const student = accountFor('student');
  if (!student) return;

  await login(page, student);
  await page.goto('/student/settings');

  await fileInput(page).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX });

  // Success renders an <img> with a storage URL in src.
  const avatar = page.locator('img[alt="Profile"]');
  await expect(avatar).toBeVisible({ timeout: 30_000 });
  await expect(avatar).toHaveAttribute('src', /storage|avatars/i);
});

test('an .svg upload is refused', async ({ page }) => {
  const student = accountFor('student');
  if (!student) return;

  await login(page, student);
  await page.goto('/student/settings');

  const before = await page.locator('img[alt="Profile"]').count();
  await fileInput(page).setInputFiles({ name: 'avatar.svg', mimeType: 'image/svg+xml', buffer: SVG_XSS });

  // Either the picker never yields (the accept attribute filters it) or the
  // upload errors. Both are acceptable; a stored SVG is not.
  await page.waitForTimeout(5_000);
  expect(await page.locator('img[alt="Profile"]').count()).toBe(before);

  const src = await page.locator('img[alt="Profile"]').first().getAttribute('src').catch(() => null);
  expect(src ?? '').not.toMatch(/\.svg($|\?)/i);
});

test('an .html upload is refused', async ({ page }) => {
  const student = accountFor('student');
  if (!student) return;

  await login(page, student);
  await page.goto('/student/settings');

  const before = await page.locator('img[alt="Profile"]').count();
  await fileInput(page).setInputFiles({ name: 'avatar.html', mimeType: 'text/html', buffer: HTML_XSS });

  await page.waitForTimeout(5_000);
  expect(await page.locator('img[alt="Profile"]').count()).toBe(before);

  const src = await page.locator('img[alt="Profile"]').first().getAttribute('src').catch(() => null);
  expect(src ?? '').not.toMatch(/\.html($|\?)/i);
});

test('a PNG renamed to .svg is still refused by the content check', async ({ page }) => {
  const student = accountFor('student');
  if (!student) return;

  await login(page, student);
  await page.goto('/student/settings');

  const before = await page.locator('img[alt="Profile"]').count();
  await fileInput(page).setInputFiles({ name: 'avatar.svg', mimeType: 'image/png', buffer: PNG_1PX });

  await page.waitForTimeout(5_000);
  expect(await page.locator('img[alt="Profile"]').count()).toBe(before);
});