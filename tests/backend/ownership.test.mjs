/**
 * Ownership / IDOR regression tests — Express backend + frontend data layer.
 *
 * These assert the *shape* of the authorization guards by reading the source:
 * that the vulnerable lookup and its guard are both present, in the right
 * order, and that the guard fails closed. That is deliberately not a substitute
 * for runtime tests against a live database, but it does catch the specific
 * regression where someone reintroduces a role-only check without the
 * class-ownership check — which is how H2 and M2 happened in the first place.
 *
 * Runtime coverage that needs a seeded database lives in
 * tests/integration/. See tests/README.md.
 *
 *   node --test tests/backend/
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const read = (...parts) => readFileSync(join(REPO, ...parts), 'utf8');

const ATTENDANCE = read('server--backend', 'src', 'controllers', 'attendanceController.ts');
const LEAVE = read('server--backend', 'src', 'controllers', 'leaveController.ts');
const AUTH = read('server--backend', 'src', 'controllers', 'authController.ts');
const API = read('src--frontend', 'lib', 'api.ts');
const GEO = read('src--frontend', 'lib', 'geolocation.ts');

/** Source of a single exported arrow-function controller. */
function fnBody(src, name) {
  const start = src.indexOf(`export const ${name} =`);
  assert.notEqual(start, -1, `controller ${name} not found`);
  const next = src.indexOf('\nexport const ', start + 1);
  return src.slice(start, next === -1 ? src.length : next);
}

/** Source of a single method inside an exported service object. */
function methodBody(src, signature) {
  const start = src.indexOf(signature);
  assert.notEqual(start, -1, `method ${signature} not found`);
  const next = src.indexOf('\n  },', start);
  return src.slice(start, next === -1 ? src.length : next + 5);
}

// ── H2 — attendance IDOR ────────────────────────────────────────────────

test('H2: face mark rejects an unauthenticated caller', () => {
  const body = fnBody(ATTENDANCE, 'markAttendanceWithFace');
  assert.match(body, /Authentication required/);
});

test('H2: face mark permits the student themself', () => {
  const body = fnBody(ATTENDANCE, 'markAttendanceWithFace');
  assert.match(body, /student\.user_id === req\.user\.id/);
});

test('H2: face mark verifies class ownership, not just role', () => {
  const body = fnBody(ATTENDANCE, 'markAttendanceWithFace');
  assert.match(body, /teachesClass/);
  assert.match(body, /incharge_id/);
  // The role check must not stand alone.
  assert.match(body, /if \(!teachesClass\)/);
});

test('H2: face mark fails closed when the caller has no faculty row', () => {
  const body = fnBody(ATTENDANCE, 'markAttendanceWithFace');
  // The class lookup must be guarded by the faculty lookup so a miss yields
  // null and the guard below turns that into a 403.
  assert.match(body, /const teachesClass = faculty\s*\n/);
  assert.match(body, /: null;/);
  assert.match(body, /if \(!teachesClass\)/);
});

test('H2: manual mark verifies class ownership', () => {
  const body = fnBody(ATTENDANCE, 'markAttendanceManual');
  assert.match(body, /teachesClass/);
  assert.match(body, /if \(!teachesClass\)/);
});

test('H2: bulk mark verifies class ownership', () => {
  const body = fnBody(ATTENDANCE, 'markBulkAttendance');
  assert.match(body, /teachesClass/);
  assert.match(body, /if \(!teachesClass\)/);
});

// ── M2 — broken owner checks ─────────────────────────────────────────────

test('M2: registerFace compares students-row id, not the auth id', () => {
  const body = fnBody(ATTENDANCE, 'registerFace');
  // Regression: req.user.id (auth namespace) was compared against studentId
  // (students-table namespace), so the check never fired.
  assert.match(body, /where: \{ user_id: req\.user\.id \}/);
  assert.match(body, /student\.id !== studentId/);
});

test('M2: getLeaveStats lets a student read only their own stats', () => {
  const body = fnBody(LEAVE, 'getLeaveStats');
  assert.match(body, /Access denied/);
  assert.match(body, /where: \{ user_id: req\.user\.id \}/);
});

test('M2: leave approval verifies class ownership', () => {
  const body = fnBody(LEAVE, 'approveLeaveRequest');
  assert.match(body, /ownsClass/);
  assert.match(body, /incharge_id/);
  assert.match(body, /if \(!ownsClass\)/);
});

test('M2: leave approval fails closed without a faculty row', () => {
  const body = fnBody(LEAVE, 'approveLeaveRequest');
  assert.match(body, /ownsClass = faculty\n/);
  assert.match(body, /: null;/);
});

test('M2: leave cancel is scoped to the caller own student id', () => {
  const body = fnBody(LEAVE, 'cancelLeaveRequest');
  assert.match(body, /where: \{ id, student_id: student\.id \}/);
});

// ── M1 — user enumeration ────────────────────────────────────────────────

test('M1: getRoleByEmail is scoped to the caller own profile', () => {
  const body = fnBody(AUTH, 'getRoleByEmail');
  assert.match(body, /where: \{ user_id: req\.user!\.id \}/);
  assert.doesNotMatch(body, /where: \{ email \}/);
});

test('M1: a foreign email is indistinguishable from an unknown one', () => {
  const body = fnBody(AUTH, 'getRoleByEmail');
  assert.match(body, /exists: false/);
  // Exactly one disclosure path: the self match.
  assert.equal((body.match(/role: self\.role/g) || []).length, 1);
});

// ── H3 — client-side direct-table bypasses ───────────────────────────────

test('H3: attendanceService.mark has no direct-table insert fallback', () => {
  const body = methodBody(API, 'async mark(attendance:');
  assert.doesNotMatch(body, /\.from\('attendance'\)\s*\n\s*\.insert/);
});

test('H3: attendanceService.mark fails loudly when the edge function is down', () => {
  const body = methodBody(API, 'async mark(attendance:');
  assert.match(body, /service is unavailable/);
});

test('H3: attendanceService.markBulk routes through the backend', () => {
  const body = methodBody(API, 'async markBulk(');
  assert.match(body, /BACKEND_URL}\/api\/attendance\/bulk/);
  assert.doesNotMatch(body, /\.from\('attendance'\)/);
});

test('H3: attendanceService.update routes through the edge function', () => {
  const body = methodBody(API, 'async update(id: string, updates: Partial<Attendance>');
  assert.match(body, /callEdgeFunction<Attendance>\('attendance'/);
  assert.doesNotMatch(body, /\.from\('attendance'\)/);
});

for (const name of ['approve', 'reject', 'cancel']) {
  test(`H3: leaveService.${name} routes through the backend`, () => {
    const body = methodBody(API, `async ${name}(`);
    assert.match(body, /BACKEND_URL}\/api\/leaves\//);
    assert.doesNotMatch(body, /\.from\('leave_requests'\)/);
  });
}

test('H3: leaveService.getPending routes through the backend', () => {
  const body = methodBody(API, 'async getPending(');
  assert.match(body, /BACKEND_URL}\/api\/leaves\/pending/);
  assert.doesNotMatch(body, /\.from\('leave_requests'\)\s*\n\s*\.select/);
});

test('H3: profileService.update rejects cross-user writes', () => {
  const body = methodBody(API, 'async update(userId: string, updates: Partial<Profile>');
  assert.match(body, /user\.id !== userId/);
});

test('H3: profileService.update writes with the session id', () => {
  const body = methodBody(API, 'async update(userId: string, updates: Partial<Profile>');
  assert.match(body, /\.eq\('user_id', user\.id\)/);
});

test('H3: role and email stay out of the profile write allowlist', () => {
  const body = methodBody(API, 'async update(userId: string, updates: Partial<Profile>');
  assert.doesNotMatch(body, /dbUpdates\.role\b/);
  assert.doesNotMatch(body, /dbUpdates\.email\b/);
  assert.doesNotMatch(body, /dbUpdates\.is_active\b/);
});

test('M3: uploadAvatar rejects cross-user uploads', () => {
  const body = methodBody(API, 'async uploadAvatar(');
  assert.match(body, /user\.id !== userId/);
});

test('M3: uploadAvatar has a MIME allowlist', () => {
  const body = methodBody(API, 'async uploadAvatar(');
  assert.match(body, /AVATAR_TYPES/);
  assert.match(body, /image\/jpeg/);
  assert.match(body, /image\/png/);
});

test('M3: uploadAvatar derives the extension from the type, not the filename', () => {
  const body = methodBody(API, 'async uploadAvatar(');
  assert.doesNotMatch(body, /file\.name/);
  assert.match(body, /avatar\.\$\{ext\}/);
});

// ── geolocation IDOR ─────────────────────────────────────────────────────

test('geo: the attendance row is bound to the session user', () => {
  assert.match(GEO, /Cannot record attendance for another user/);
});

test('geo: the field_tracking row is bound to the session user', () => {
  assert.match(GEO, /Cannot record tracking for another user/);
});

test('geo: both writers use the resolved session id, not the argument', () => {
  const writes = GEO.match(/user_id: user\.id/g) || [];
  assert.equal(writes.length, 2, 'expected attendance + field_tracking writes');
});
