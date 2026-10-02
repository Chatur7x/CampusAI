/**
 * Authentication and session tests for the Express backend.
 *
 * The guards in `middleware/auth.ts` sit in front of every route, so a
 * regression here is a regression everywhere. These assert the shape of the
 * guard and the properties the JWT helpers must hold.
 *
 *   node --test tests/backend/
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');

const AUTH_MW = read('server--backend', 'src', 'middleware', 'auth.ts');
const JWT = read('server--backend', 'src', 'utils', 'jwt.ts');
const SECURITY_MW = read('server--backend', 'src', 'middleware', 'security.ts');
const INDEX = read('server--backend', 'src', 'index.ts');
const UPLOAD = read('server--backend', 'src', 'middleware', 'upload.ts');

// ── authenticate ─────────────────────────────────────────────────────────

test('authenticate requires a Bearer header', () => {
  assert.match(AUTH_MW, /startsWith\('Bearer '\)/);
  assert.match(AUTH_MW, /Authentication required/);
});

test('authenticate rejects blacklisted tokens before verifying them', () => {
  assert.match(AUTH_MW, /isTokenBlacklisted/);
  assert.match(AUTH_MW, /Token has been revoked/);
});

test('authenticate re-reads the role from the database on every request', () => {
  // Reading the role from the token would let a demoted user keep their
  // privileges until the token expired.
  const start = AUTH_MW.indexOf('export const authenticate');
  const body = AUTH_MW.slice(start, AUTH_MW.indexOf('\nexport const requireRole'));
  assert.match(body, /prisma\.profile\.findUnique/);
  assert.match(body, /role: true/);
  assert.match(body, /req\.user = \{/);
});

test('authenticate rejects deactivated accounts', () => {
  const start = AUTH_MW.indexOf('export const authenticate');
  const body = AUTH_MW.slice(start, AUTH_MW.indexOf('\nexport const requireRole'));
  assert.match(body, /if \(!profile\.is_active\)/);
  assert.match(body, /Account is deactivated/);
});

test('authenticate never leaks the underlying error to the client', () => {
  const start = AUTH_MW.indexOf('export const authenticate');
  const body = AUTH_MW.slice(start, AUTH_MW.indexOf('\nexport const requireRole'));
  assert.match(body, /message: 'Invalid token'/);
  assert.doesNotMatch(body, /message: error\.message/);
});

// ── requireRole ──────────────────────────────────────────────────────────

test('requireRole fails closed when there is no user', () => {
  const start = AUTH_MW.indexOf('export const requireRole =');
  const body = AUTH_MW.slice(start, AUTH_MW.indexOf('\nexport const requireOwnershipOrRole'));
  assert.match(body, /if \(!req\.user\)/);
  assert.match(body, /status\(401\)/);
});

test('requireRole compares against an explicit allowlist', () => {
  const start = AUTH_MW.indexOf('export const requireRole =');
  const body = AUTH_MW.slice(start, AUTH_MW.indexOf('\nexport const requireOwnershipOrRole'));
  assert.match(body, /allowedRoles\.includes\(req\.user\.role\)/);
});

// ── requireOwnershipOrRole ───────────────────────────────────────────────

test('requireOwnershipOrRole is exported but never mounted', () => {
  // It compares a route param against req.user.id, which are different
  // namespaces for most routes — the same class of bug as the registerFace
  // fix. Unused means it cannot bite; a test will catch it if someone wires
  // it up without checking the param is an auth id.
  const routes = read('server--backend', 'src', 'routes', 'index.ts');
  assert.doesNotMatch(routes, /requireOwnershipOrRole/);
});

// ── JWT helpers ──────────────────────────────────────────────────────────

test('signing and verification both pin the algorithm', () => {
  assert.match(JWT, /algorithm: ALG/);
  assert.match(JWT, /algorithms: \[ALG\]/);
});

test('access and refresh tokens use different secrets', () => {
  assert.match(JWT, /const ALG = 'HS256' as const/);
  assert.match(JWT, /jwt\.sign\(payload, JWT_SECRET/);
  assert.match(JWT, /jwt\.sign\(payload, JWT_REFRESH_SECRET/);
  assert.match(JWT, /jwt\.verify\(token, JWT_SECRET/);
  assert.match(JWT, /jwt\.verify\(token, JWT_REFRESH_SECRET/);
});

test('a short JWT secret is rejected at startup', () => {
  assert.match(JWT, /JWT_SECRET\.length < 32/);
  assert.match(JWT, /JWT_REFRESH_SECRET\.length < 32/);
});

// ── server-wide error handling ───────────────────────────────────────────

test('the global error handler does not echo the error', () => {
  const start = INDEX.indexOf('// Global error handler');
  const body = INDEX.slice(start);
  assert.match(body, /message: 'Internal server error'/);
  assert.doesNotMatch(body, /message: err\.message/);
  assert.doesNotMatch(body, /err\.stack/);
});

test('the 404 handler does not echo the path', () => {
  const start = INDEX.indexOf('// 404 handler');
  const body = INDEX.slice(start, start + 200);
  assert.match(body, /Endpoint not found/);
  assert.doesNotMatch(body, /message: req\.(url|path|originalUrl)/);
});

test('helmet and the extra security headers are both mounted', () => {
  assert.match(INDEX, /app\.use\(helmet\(\)\)/);
  assert.match(INDEX, /extraSecurityHeaders/);
  assert.match(INDEX, /trust proxy/);
});

test('security headers include nosniff and frame denial', () => {
  assert.match(SECURITY_MW, /X-Content-Type-Options', 'nosniff'/);
  assert.match(SECURITY_MW, /X-Frame-Options', 'DENY'/);
});

// ── CSRF ─────────────────────────────────────────────────────────────────

test('CSRF middleware is defined but not mounted', () => {
  // Auth is Bearer-header only and refresh tokens travel in the request body,
  // so there is no ambient credential for a cross-origin request to ride on and
  // CSRF protection is not applicable. Recording that it is unmounted means a
  // future cookie-based auth change has to revisit this deliberately.
  assert.match(SECURITY_MW, /export function csrfProtection/);
  assert.doesNotMatch(INDEX, /csrfProtection/);
});

test('no controller sets an auth cookie', () => {
  const routes = read('server--backend', 'src', 'routes', 'index.ts');
  assert.doesNotMatch(routes, /res\.cookie/);
});

// ── upload directory containment ─────────────────────────────────────────

test('the upload root is resolved once and used for containment checks', () => {
  const count = (UPLOAD.match(/uploadDir \+ path\.sep/g) || []).length;
  assert.ok(count >= 2, `expected the containment check in both verifyUpload and sendUploadSafely, found ${count}`);
});
