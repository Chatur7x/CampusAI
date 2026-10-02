/**
 * Route-level authorization tests — `server--backend/src/routes/index.ts`.
 *
 * Every mutating route must sit behind `authenticate`, and the privileged ones
 * must additionally sit behind `requireRole`. This is the cheapest place to
 * catch a route that was added (or edited) without a guard, which is how the
 * M1 enumeration oracle shipped.
 *
 *   node --test tests/backend/
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(join(REPO, 'server--backend', 'src', 'routes', 'index.ts'), 'utf8');

/** Every `router.<method>('path', ...)` registration. */
function routes() {
  const out = [];
  const re = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'([\s\S]*?)\);\n/g;
  let m;
  while ((m = re.exec(SRC)) !== null) {
    out.push({ method: m[1].toUpperCase(), path: m[2], guards: m[3] });
  }
  return out;
}

const ALL = routes();
const byPath = (p) => ALL.find((r) => r.path === p);
/** Method-aware lookup — several paths are registered for GET and a verb. */
const route = (method, path) => {
  const found = ALL.find((r) => r.method === method && r.path === path);
  assert.ok(found, `${method} ${path} is not registered`);
  return found;
};

test('the router was parsed', () => {
  assert.ok(ALL.length > 50, `expected 50+ routes, parsed ${ALL.length}`);
});

/**
 * The credential endpoints are necessarily unauthenticated — that is what a
 * login endpoint is. Everything else must sit behind `authenticate`.
 */
const PUBLIC_ROUTES = new Set([
  'POST /auth/login',
  'POST /auth/verify-mfa',
  'POST /auth/register',
  'POST /auth/refresh-token',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
]);

test('every route except the credential endpoints requires authentication', () => {
  const open = ALL.filter(
    (r) => !/\bauthenticate\b/.test(r.guards) && !PUBLIC_ROUTES.has(`${r.method} ${r.path}`),
  );
  assert.deepEqual(
    open.map((r) => `${r.method} ${r.path}`),
    [],
    'these routes have no authenticate() guard',
  );
});

test('the public route list is not stale', () => {
  for (const key of PUBLIC_ROUTES) {
    assert.ok(byPath(key.split(' ')[1]), `public route no longer exists: ${key}`);
  }
});

test('no public route leaks a data read', () => {
  for (const r of ALL.filter((x) => PUBLIC_ROUTES.has(`${x.method} ${x.path}`))) {
    assert.equal(r.method, 'POST', `${r.path} must be POST-only`);
    assert.doesNotMatch(r.path, /\/(users|students|attendance|analytics|admin)/);
  }
});

/**
 * Routes that legitimately take no schema-validated body: they act on a path
 * param only, on the JWT, or on a multipart file (validated by the upload
 * middleware instead). Listing them explicitly is deliberate — a new
 * unvalidated write route has to be added here to pass, which is the point.
 */
const NO_BODY_WRITES = new Set([
  'POST /auth/verify-mfa',   // token from body, verified server-side
  'POST /auth/logout',       // no body
  'POST /auth/setup-mfa',    // token from body
  'POST /auth/refresh-token',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
  'PUT /leaves/:id/cancel',  // no body
  'DELETE /notices/:id',
  'DELETE /timetable/:id',
  'DELETE /admin/users/:id',
  'DELETE /admin/departments/:id',
  'PUT /chat/messages/read/:conversationId', // no body
  'DELETE /chat/messages/:messageId',
  'PUT /security/devices/:deviceId/trust',    // deviceId from path
  'DELETE /security/devices/:deviceId',
  'DELETE /security/sessions/:sessionId',
  'POST /security/cleanup-tokens',            // no body
  'PUT /security/events/:id/resolve',         // id from path, no body
  'POST /bulk/upload-students',               // multipart, validated by upload.ts
  'POST /bulk/upload-faculty',                // multipart, validated by upload.ts
  'POST /attendance/register-face',           // face payload, validated in controller
  'POST /chat/conversations/direct',          // receiverId validated in controller
]);

test('every mutating route either validates its body or is listed as body-less', () => {
  const writes = ALL.filter((r) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method));
  const unvalidated = writes.filter((r) => {
    const key = `${r.method} ${r.path}`;
    return !/Validation\b/.test(r.guards) && !NO_BODY_WRITES.has(key);
  });
  assert.deepEqual(
    unvalidated.map((r) => `${r.method} ${r.path}`),
    [],
    'these write routes have no validation middleware — add it, or justify the exemption above',
  );
});

test('the body-less exemption list is not stale', () => {
  for (const key of NO_BODY_WRITES) {
    assert.ok(byPath(key.split(' ')[1]), `exempted route no longer exists: ${key}`);
  }
});

// ── M1: the enumeration oracle must stay authenticated ───────────────────

test('M1: /auth/role requires authentication', () => {
  const route = byPath('/auth/role');
  assert.ok(route, '/auth/route missing');
  assert.match(route.guards, /\bauthenticate\b/);
});

test('M1: /auth/role is rate limited', () => {
  assert.match(byPath('/auth/role').guards, /authRateLimiter/);
});

test('M1: the auth routes are rate limited', () => {
  for (const p of ['/auth/login', '/auth/register', '/auth/verify-mfa']) {
    assert.match(byPath(p).guards, /authRateLimiter/, `${p} is not rate limited`);
  }
});

// ── attendance / leave privilege boundaries ──────────────────────────────

test('notice reads are open to any authenticated user, writes are admin-only', () => {
  assert.doesNotMatch(route('GET', '/notices/:id').guards, /requireRole/);
  assert.match(route('PUT', '/notices/:id').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
  assert.match(route('DELETE', '/notices/:id').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
});

test('only staff may mark attendance manually or in bulk', () => {
  for (const p of ['/attendance/manual', '/attendance/bulk']) {
    assert.match(
      byPath(p).guards,
      /requireRole\('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'\)/,
      `${p} has the wrong role gate`,
    );
  }
});

test('bulk attendance validates the correction payload', () => {
  assert.match(byPath('/attendance/bulk').guards, /bulkCorrectionValidation/);
});

test('every attendance write pins the status to a known enum', () => {
  for (const p of ['/attendance/face', '/attendance/manual']) {
    assert.match(byPath(p).guards, /attendanceStatusValidation/, `${p} does not pin status`);
  }
});

test('only students may create or cancel leave requests', () => {
  assert.match(byPath('/leaves').guards, /requireRole\('STUDENT'\)/);
  assert.match(byPath('/leaves/:id/cancel').guards, /requireRole\('STUDENT'\)/);
});

test('only staff may approve leave requests', () => {
  assert.match(
    byPath('/leaves/:id/approve').guards,
    /requireRole\('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN'\)/,
  );
});

test('leave approval validates the decision status', () => {
  assert.match(byPath('/leaves/:id/approve').guards, /leaveDecisionValidation/);
});

test('only students may read their own leave list', () => {
  assert.match(byPath('/leaves/my').guards, /requireRole\('STUDENT'\)/);
});

test('notices are writable by admin and faculty', () => {
  assert.match(byPath('/notices').guards, /requireRole\('ADMIN', 'SUPER_ADMIN', 'FACULTY'\)/);
});

test('department reads are open, mutations are admin-only', () => {
  assert.doesNotMatch(route('GET', '/admin/departments').guards, /requireRole/);
  assert.match(route('POST', '/admin/departments').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
  assert.match(route('PUT', '/admin/departments/:id').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
  assert.match(route('DELETE', '/admin/departments/:id').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
});

test('face registration validates its input', () => {
  assert.match(byPath('/attendance/register-face').guards, /validate\(/);
});

// ── admin surface ────────────────────────────────────────────────────────

test('user management is admin-only', () => {
  for (const p of ['/admin/users', '/admin/users/:id']) {
    assert.match(byPath(p).guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/, `${p} is not admin-only`);
  }
});

test('course and class mutations are admin-only', () => {
  assert.match(route('POST', '/admin/courses').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
  assert.match(route('POST', '/admin/classes').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
});

test('user and course writes validate their payloads', () => {
  assert.match(route('POST', '/admin/users').guards, /createUserValidation/);
  assert.match(route('PUT', '/admin/users/:id').guards, /updateUserValidation/);
  assert.match(route('POST', '/admin/courses').guards, /courseValidation/);
  assert.match(route('POST', '/admin/classes').guards, /classValidation/);
  assert.match(route('PUT', '/admin/settings/:key').guards, /settingValidation/);
});

test('the timetable is writable by admin only, and validates its times', () => {
  assert.match(route('POST', '/timetable').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
  assert.match(route('PUT', '/timetable/:id').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
  assert.match(route('POST', '/timetable/bulk').guards, /timetableBulkValidation/);
  assert.match(route('POST', '/timetable').guards, /timetableValidation/);
});

test('the user-management exemption list matches the real routes', () => {
  for (const p of ['/admin/users', '/admin/users/:id']) {
    assert.match(byPath(p).guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/, `${p} is not admin-only`);
  }
});

test('bulk CSV import is admin-only and rate limited', () => {
  for (const p of ['/bulk/upload-students', '/bulk/upload-faculty']) {
    const r = route('POST', p);
    assert.match(r.guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
    assert.match(r.guards, /uploadRateLimiter/);
  }
});

test('attendance export is gated', () => {
  assert.match(byPath('/bulk/export-attendance').guards, /requireRole\(/);
  assert.match(byPath('/bulk/export-students').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
});

test('the blockchain audit view is admin-only', () => {
  assert.match(byPath('/blockchain/audit').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
});

test('the security dashboard is admin-only', () => {
  assert.match(byPath('/security/dashboard').guards, /requireRole\('ADMIN', 'SUPER_ADMIN'\)/);
});

// ── self-service routes may stay open to any authenticated role ──────────

test('self-service security routes stay open to any authenticated user', () => {
  for (const p of ['/security/sessions', '/security/devices', '/security/login-history']) {
    const route = byPath(p);
    assert.ok(route, `${p} missing`);
    assert.match(route.guards, /\bauthenticate\b/);
    assert.doesNotMatch(route.guards, /requireRole/, `${p} should not be role-gated`);
  }
});
