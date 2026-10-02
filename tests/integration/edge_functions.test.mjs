/**
 * Cross-service contract tests.
 *
 * These check the seams between the three runtimes — Express route table, the
 * Supabase edge functions, and the AI server's request models — rather than any
 * one of them in isolation. Most are static contract checks; the live probes are
 * skipped unless a token is supplied.
 *
 * Env:
 *   SUPABASE_URL           default https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY      required for live probes
 *   STUDENT_JWT            a real student access token
 *   FACULTY_JWT            a faculty token that does NOT own the target class
 *   AI_BASE_URL            default http://127.0.0.1:8011
 *
 *   node --test tests/integration/
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');

const ENV = process.env;
const SUPABASE_URL = ENV.SUPABASE_URL ?? '';
const ANON_KEY = ENV.SUPABASE_ANON_KEY ?? '';
const STUDENT_JWT = ENV.STUDENT_JWT ?? '';
const FACULTY_JWT = ENV.FACULTY_JWT ?? '';
const AI_BASE_URL = ENV.AI_BASE_URL ?? 'http://127.0.0.1:8011';

const hasLiveSupabase = Boolean(SUPABASE_URL && ANON_KEY && STUDENT_JWT);

// ── attendance edge function ─────────────────────────────────────────────

const ATTENDANCE_FN = read('supabase', 'functions', 'attendance', 'index.ts');

test('attendance edge function verifies a JWT before anything else', () => {
  assert.match(ATTENDANCE_FN, /auth\.getUser\(jwt\)/);
  assert.match(ATTENDANCE_FN, /status_code=401|json\(\{ success: false, message: 'Unauthorized' \}, 401\)|401\)/);
});

test('attendance edge function pins the status enum', () => {
  assert.match(ATTENDANCE_FN, /ALLOWED_STATUSES/);
  assert.match(ATTENDANCE_FN, /PRESENT.*ABSENT.*LATE/s);
});

test('attendance edge function checks class ownership, not just role', () => {
  assert.match(ATTENDANCE_FN, /staffOwnsStudent/);
  assert.match(ATTENDANCE_FN, /Not authorized to mark attendance/);
});

test('staffOwnsStudent fails closed when there is no faculty row', () => {
  const start = ATTENDANCE_FN.indexOf('async function staffOwnsStudent');
  assert.notEqual(start, -1, 'staffOwnsStudent not found');
  const body = ATTENDANCE_FN.slice(start, ATTENDANCE_FN.indexOf('\nasync function', start + 10));
  assert.match(body, /if \(!facultyId\) return false/);
  assert.match(body, /return !error && !!data/);
});

test('attendance edge function never returns a raw PostgREST error', () => {
  // PostgREST messages name columns, constraints and relation paths.
  assert.doesNotMatch(ATTENDANCE_FN, /message: error\.message/);
});

test('notices edge function never returns a raw PostgREST error', () => {
  assert.doesNotMatch(NOTICES_FN, /message: error\.message/);
});

test('timetable edge function never returns a raw PostgREST error', () => {
  assert.doesNotMatch(TIMETABLE_FN, /message: (error|fallback\.error)\.message/);
});

test('the PUT handler scopes the update to a record the caller may amend', () => {
  const start = ATTENDANCE_FN.indexOf("req.method === 'PUT'");
  assert.notEqual(start, -1, 'PUT handler not found');
  const body = ATTENDANCE_FN.slice(start, start + 1600);
  assert.match(body, /staffOwnsStudent/);
  assert.match(body, /Not authorized to modify/);
});

// ── notices edge function ────────────────────────────────────────────────

const NOTICES_FN = read('supabase', 'functions', 'notices', 'index.ts');

test('notices edge function scopes role and faculty lookups to the caller', () => {
  // Regression: getRole/getFacultyId queried without .eq('user_id'), so they
  // returned the first row in the table — any authenticated user could inherit
  // someone else's role.
  assert.match(NOTICES_FN, /\.eq\('user_id'/);
});

test('notices edge function allows only named fields on update', () => {
  assert.match(NOTICES_FN, /PUTTABLE_COLUMNS/);
  const start = NOTICES_FN.indexOf("req.method === 'PUT'");
  assert.notEqual(start, -1, 'PUT handler not found');
  const body = NOTICES_FN.slice(start, start + 1800);
  // Iterate the allowlist, never spread the raw body.
  assert.match(body, /Object\.entries\(body\)/);
  assert.match(body, /PUTTABLE_COLUMNS\[key\]/);
  assert.doesNotMatch(body, /\.update\(body\)/);
});

test('timetable edge function allows only named columns on write', () => {
  assert.match(TIMETABLE_FN, /WRITABLE_COLUMNS/);
  assert.match(TIMETABLE_FN, /function pickWritable/);
  // Neither handler may hand the raw body to supabase.
  assert.doesNotMatch(TIMETABLE_FN, /from\('timetable'\)\.insert\(body\)/);
  assert.doesNotMatch(TIMETABLE_FN, /from\('timetable'\)\.update\(body\)/);
});

test('notices edge function requires authentication', () => {
  assert.match(NOTICES_FN, /getUser\(/);
});

// ── timetable edge function ──────────────────────────────────────────────

const TIMETABLE_FN = read('supabase', 'functions', 'timetable', 'index.ts');

test('timetable edge function scopes role and faculty lookups to the caller', () => {
  assert.match(TIMETABLE_FN, /\.eq\('user_id'/);
});

test('timetable edge function requires authentication', () => {
  assert.match(TIMETABLE_FN, /getUser\(/);
});

// ── Express ↔ frontend agreement ─────────────────────────────────────────

const ROUTES = read('server--backend', 'src', 'routes', 'index.ts');
const API = read('src--frontend', 'lib', 'api.ts');

/**
 * Every backend call the frontend makes, with the HTTP verb.
 *
 * The verb is either explicit (`method: 'PUT'`) or implied by the fetch
 * default of GET.
 */
function frontendCalls() {
  const out = [];
  // Each call: find the fetch block, read its method, capture the URL.
  const re = /fetch\(\s*`\$\{BACKEND_URL\}([^`]+)`\s*,\s*\{([\s\S]{0,400}?)\}\s*\)/g;
  let m;
  while ((m = re.exec(API)) !== null) {
    const call = m[1];
    const body = m[2] ?? '';
    const explicit = body.match(/method:\s*'(\w+)'/);
    const method = (explicit?.[1] ?? 'GET').toUpperCase();
    const path = call.split('?')[0].replace(/\$\{[^}]*\}/g, ':param');
    out.push({ method, path, call });
  }
  return out;
}

/** Path-only view, for the shape check. */
function frontendBackendCalls() {
  return frontendCalls().map((c) => c.call);
}

/** Registered routes as "METHOD /path". */
function registeredRoutes() {
  const out = [];
  const re = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(ROUTES)) !== null) out.push({ method: m[1].toUpperCase(), path: m[2] });
  return out;
}

/**
 * A frontend call matches a registered route when the path segments line up,
 * treating `${...}` in the frontend as a `:param` in the route table.
 *
 * The router is mounted at `/api`, so that prefix is stripped from the frontend
 * path before comparison.
 */
function matches(callPath, routePath) {
  const a = callPath.replace(/^\/api/, '').split('/').filter(Boolean);
  const b = routePath.split('/').filter(Boolean);
  if (a.length !== b.length) return false;
  return a.every((seg, i) => b[i].startsWith(':') || b[i] === seg);
}

test('every frontend backend call maps to a registered route', () => {
  const registered = registeredRoutes();
  const orphans = [];

  for (const call of frontendBackendCalls()) {
    // "/api/leaves/${leaveId}/approve" -> "/api/leaves/:param/approve"
    const path = call
      .split('?')[0]
      .replace(/\$\{[^}]*\}/g, ':param');
    const found = registered.some((r) => matches(path, r.path));
    if (!found) orphans.push(call);
  }

  assert.deepEqual(orphans, [], 'frontend calls with no matching backend route');
});

test('the verb used by each frontend call exists on the backend', () => {
  const registered = registeredRoutes();
  const orphans = [];

  for (const { method, path, call } of frontendCalls()) {
    const found = registered.some((r) => r.method === method && matches(path, r.path));
    if (!found) orphans.push(`${method} ${path}  (from ${call})`);
  }

  assert.deepEqual(orphans, [], 'frontend calls whose (method, path) pair is not registered');
});

test('the frontend parser actually found the calls', () => {
  // Guards the two tests above: if the regex ever stops matching, they would
  // pass vacuously.
  const calls = frontendCalls();
  assert.ok(calls.length >= 15, `only found ${calls.length} backend calls`);
  assert.ok(calls.some((c) => c.method === 'PUT'), 'expected at least one PUT');
  assert.ok(calls.some((c) => c.method === 'DELETE'), 'expected at least one DELETE');
});

test('the leave routes the frontend depends on all exist', () => {
  for (const [method, path] of [
    ['GET', '/leaves/my'],
    ['GET', '/leaves/pending'],
    ['POST', '/leaves'],
    ['PUT', '/leaves/:id/cancel'],
    ['PUT', '/leaves/:id/approve'],
    ['POST', '/attendance/bulk'],
  ]) {
    assert.match(ROUTES, new RegExp(`router\\.${method.toLowerCase()}\\('${path}'`), `${method} ${path} missing`);
  }
});

// ── AI server request contract ───────────────────────────────────────────

const FACE_ROUTE = read('ai-server', 'routes', 'face.py');
const SESSION_ROUTE = read('ai-server', 'routes', 'session.py');
const ATTENDANCE_ROUTE = read('ai-server', 'routes', 'attendance.py');

test('face schemas bound the image payload', () => {
  assert.match(FACE_ROUTE, /image: str = _IMAGE/);
  assert.match(FACE_ROUTE, /max_length=8 \* 1024 \* 1024/);
});

test('face schemas bound the geofence coordinates', () => {
  assert.match(FACE_ROUTE, /latitude: Optional\[float\] = Field\(default=None, ge=-90\.0, le=90\.0/);
  assert.match(FACE_ROUTE, /longitude: Optional\[float\] = Field\(default=None, ge=-180\.0, le=180\.0/);
});

test('session codes are pinned to six digits', () => {
  assert.match(SESSION_ROUTE, /pattern=r"\^\\d\{6\}\$"/);
});

test('session radius and duration are bounded', () => {
  assert.match(SESSION_ROUTE, /radius_meters: int = Field\(default=100, ge=10, le=2000\)/);
  assert.match(SESSION_ROUTE, /duration_mins: int = Field\(default=5, ge=1, le=180\)/);
});

test('the geo validator rejects out-of-range coordinates', () => {
  assert.match(ATTENDANCE_ROUTE, /latitude: float = Field\(ge=-90\.0, le=90\.0/);
  assert.match(ATTENDANCE_ROUTE, /longitude: float = Field\(ge=-180\.0, le=180\.0/);
});

test('every AI router mounts an auth dependency', () => {
  const main = read('ai-server', 'main.py');
  const routers = [...main.matchAll(/app\.include_router\(([\s\S]*?)\n\)/g)];
  assert.ok(routers.length >= 4, `expected 4 routers, found ${routers.length}`);
  for (const [block] of routers) {
    assert.match(block, /require_user/, 'a router is mounted without require_user');
  }
});

test('the face and attendance routers also carry a rate limit', () => {
  const main = read('ai-server', 'main.py');
  assert.match(main, /face_rate_limit/);
  assert.match(main, /analytics_rate_limit/);
  assert.match(main, /session_rate_limit/);
});

// ── live probes (skipped without credentials) ────────────────────────────

async function callFunction(name, { method = 'POST', body = {}, token }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

test('live: a tampered token is rejected by the attendance function', { skip: !STUDENT_JWT && 'set STUDENT_JWT to run' }, async () => {
  const { status } = await callFunction('attendance', {
    body: { studentId: 'x', status: 'PRESENT' },
    token: 'not.a.real.token',
  });
  assert.equal(status, 401);
});

test('live: a student cannot mark attendance through the edge function', { skip: !hasLiveSupabase && 'set SUPABASE_URL + ANON_KEY + STUDENT_JWT' }, async () => {
  const { status } = await callFunction('attendance', {
    body: { studentId: 'some-other-student', status: 'PRESENT' },
    token: STUDENT_JWT,
  });
  // STUDENT is not in ALLOWED_MARK_ROLES, so this must be refused outright.
  assert.ok(status === 403 || status === 401, `expected a refusal, got ${status}`);
});

test('live: faculty from another class cannot mark attendance', { skip: !(hasLiveSupabase && FACULTY_JWT) && 'set FACULTY_JWT to run' }, async () => {
  const { status } = await callFunction('attendance', {
    body: { studentId: 'a-student-in-a-different-class', status: 'PRESENT' },
    token: FACULTY_JWT,
  });
  assert.ok(status === 403 || status === 404, `expected a refusal, got ${status}`);
});

test('live: the AI server refuses an unauthenticated face verify', { skip: !ENV.AI_BASE_URL && 'set AI_BASE_URL' }, async () => {
  const res = await fetch(`${AI_BASE_URL}/api/face/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 'x', image: 'x', class_id: 'x' }),
  });
  assert.equal(res.status, 401);
});
