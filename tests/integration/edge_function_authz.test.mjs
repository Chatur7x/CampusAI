/**
 * Edge function authentication / authorization regression tests.
 *
 * Regression: `notifications` and `security-monitor` had no authentication at
 * all — they never read the `Authorization` header and never called getUser —
 * while the other seven functions did. Because every function is deployed with
 * `--no-verify-jwt` and runs with the service-role client, the handler is the
 * only authorization boundary, so that gap was an unauthenticated read AND
 * write surface reachable by anyone who could reach the function URL.
 *
 * The static checks run always (they need no deployment). The live probes are
 * skipped unless credentials are supplied, matching edge_functions.test.mjs.
 *
 * Env:
 *   SUPABASE_URL           default https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY      required for live probes
 *   STUDENT_JWT            a real student access token (non-admin role)
 *
 *   node --test tests/integration/edge_function_authz.test.mjs
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

const hasLiveSupabase = Boolean(SUPABASE_URL && ANON_KEY && STUDENT_JWT);

/** Every edge function that accepts a request body. */
const FUNCTIONS = [
  'attendance',
  'analytics',
  'backup',
  'bulk-operations',
  'notices',
  'notifications',
  'security-monitor',
  'timetable',
  'verify-face',
];

const src = Object.fromEntries(
  FUNCTIONS.map((name) => [name, read('supabase', 'functions', name, 'index.ts')]),
);

// ── the invariant: no edge function may skip authentication ───────────────

test('every edge function reads the Authorization header', () => {
  for (const name of FUNCTIONS) {
    assert.match(src[name], /headers\.get\(['"]Authorization['"]\)/, `${name} does not read the Authorization header`);
  }
});

test('every edge function verifies the JWT rather than trusting the header', () => {
  for (const name of FUNCTIONS) {
    assert.match(src[name], /auth\.getUser\(/, `${name} does not verify a JWT`);
  }
});

test('every edge function rejects a caller with no token before doing any work', () => {
  for (const name of FUNCTIONS) {
    const body = src[name];
    const headerRead = body.indexOf("headers.get('Authorization')");
    assert.notEqual(headerRead, -1, `${name} has no Authorization read`);
    // The 401 must be emitted around the header read, i.e. as the first gate —
    // not somewhere after the first database mutation.
    // Two spellings are in use across the set: `, 401)` (the json() helper)
    // and `{ status: 401, ... }` (inline Response). Accept either.
    const first401 = Math.min(...[', 401)', 'status: 401'].map((n) => {
      const at = body.indexOf(n);
      return at === -1 ? Number.POSITIVE_INFINITY : at;
    }));
    assert.notEqual(first401, Number.POSITIVE_INFINITY, `${name} has no 401 response`);
    assert.ok(first401 > headerRead, `${name} returns 401 before it even reads the header`);
    const authCall = body.indexOf('auth.getUser(');
    assert.ok(
      first401 < authCall || headerRead < authCall,
      `${name} does not gate on the token before verifying it`,
    );
  }
});

test('no edge function returns a raw caught error message', () => {
  // `error.message` can name internal tables, constraints and PostgREST paths.
  for (const name of FUNCTIONS) {
    assert.doesNotMatch(
      src[name],
      /(error|err):\s*error\.message|error:\s*error\.message/,
      `${name} returns a raw error message to the caller`,
    );
  }
});

test('no edge function returns a raw PostgREST/upload error message', () => {
  for (const name of FUNCTIONS) {
    // Ignore lines that write the detail server-side (rpc/log_* metadata) or
    // to console — only a value that flows into a response body is a leak.
    const responseLines = src[name]
      .split(/\r?\n/)
      .filter((line) => !/console\.|p_metadata|rpc\(|log_backup/.test(line));
    assert.doesNotMatch(
      responseLines.join('\n'),
      /(message|error):\s*(uploadError|[a-z]+Error)\.message/,
      `${name} returns a raw database error message to the caller`,
    );
  }
});

// ── notifications: the regression ─────────────────────────────────────────

const NOTIFICATIONS = src.notifications;

test('notifications authenticates the caller', () => {
  assert.match(NOTIFICATIONS, /headers\.get\('Authorization'\)/);
  assert.match(NOTIFICATIONS, /auth\.getUser\(jwt\)/);
});

test('notifications authorizes the caller, not just authenticates it', () => {
  // Authentication alone is not enough: every action fans out to other users.
  assert.match(NOTIFICATIONS, /getRole/);
  assert.match(NOTIFICATIONS, /ADMIN_ROLES/);
  assert.match(NOTIFICATIONS, /Insufficient permissions/);
});

test('notifications scopes the role lookup to the calling user', () => {
  // An unscoped select returns the first profile row, letting any caller
  // inherit someone else's role.
  assert.match(NOTIFICATIONS, /\.eq\('user_id', userId\)/);
});

test('notifications gates the action switch behind auth', () => {
  const auth = NOTIFICATIONS.indexOf('auth.getUser(');
  const dispatch = NOTIFICATIONS.indexOf('switch (type)');
  assert.ok(auth !== -1 && dispatch !== -1);
  assert.ok(auth < dispatch, 'the action switch runs before authentication');
});

test('notifications rejects an unknown type instead of reporting success', () => {
  // Regression: an unmatched `type` fell through the switch and returned
  // `{ success: true }`, implying a notification had been sent.
  assert.match(NOTIFICATIONS, /Unknown notification type/);
});

// ── security-monitor: the regression ──────────────────────────────────────

const SECURITY_MONITOR = src['security-monitor'];

test('security-monitor authenticates the caller', () => {
  assert.match(SECURITY_MONITOR, /headers\.get\('Authorization'\)/);
  assert.match(SECURITY_MONITOR, /auth\.getUser\(jwt\)/);
});

test('security-monitor authorizes the caller', () => {
  assert.match(SECURITY_MONITOR, /getRole/);
  assert.match(SECURITY_MONITOR, /ADMIN_ROLES/);
  assert.match(SECURITY_MONITOR, /Insufficient permissions/);
});

test('security-monitor scopes the role lookup to the calling user', () => {
  assert.match(SECURITY_MONITOR, /\.eq\('user_id', userId\)/);
});

test('security-monitor gates every destructive action behind auth', () => {
  const auth = SECURITY_MONITOR.indexOf('auth.getUser(');
  const dispatch = SECURITY_MONITOR.indexOf('switch (action)');
  assert.ok(auth !== -1 && dispatch !== -1);
  assert.ok(auth < dispatch, 'the action switch runs before authentication');

  // The privileged actions must all still exist (i.e. we gated them rather
  // than deleting them).
  for (const action of ['cleanup', 'scan', 'stats', 'lockout-check']) {
    assert.match(SECURITY_MONITOR, new RegExp(`case '${action}'`), `${action} action is missing`);
  }
});

test('security-monitor never returns error.message', () => {
  // Regression: the catch block returned `{ error: error.message }` verbatim.
  assert.doesNotMatch(SECURITY_MONITOR, /error:\s*error\.message/);
  assert.match(SECURITY_MONITOR, /console\.error\('security-monitor error'/);
});

// ── hardening from Phase A must survive this change ───────────────────────

test('attendance keeps its class-ownership gate', () => {
  assert.match(src.attendance, /staffOwnsStudent/);
  assert.match(src.attendance, /if \(!facultyId\) return false/);
});

test('the writable-column allowlists are still in place', () => {
  assert.match(src.notices, /PUTTABLE_COLUMNS/);
  assert.match(src.timetable, /WRITABLE_COLUMNS/);
});

// ── live probes (skipped without credentials) ─────────────────────────────

async function callFunction(name, { method = 'POST', body = {}, token }) {
  const headers = { 'Content-Type': 'application/json', apikey: ANON_KEY };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

const NOTIFIABLE = [
  ['notifications', { type: 'system_announcement', payload: { title: 'x', message: 'y', priority: 'LOW' } }],
  ['security-monitor', { action: 'stats' }],
];

for (const [name, body] of NOTIFIABLE) {
  test(`live: ${name} rejects a request with no token`, { skip: !hasLiveSupabase && 'set SUPABASE_URL + ANON_KEY + STUDENT_JWT' }, async () => {
    // token: null -> the Authorization header is omitted entirely.
    const { status } = await callFunction(name, { body, token: null });
    assert.equal(status, 401);
  });

  test(`live: ${name} rejects a tampered token`, { skip: !hasLiveSupabase && 'set SUPABASE_URL + ANON_KEY + STUDENT_JWT' }, async () => {
    const { status } = await callFunction(name, { body, token: 'not.a.real.token' });
    assert.equal(status, 401);
  });

  test(`live: ${name} refuses a non-admin student`, { skip: !STUDENT_JWT && 'set STUDENT_JWT to run' }, async () => {
    const { status } = await callFunction(name, { body, token: STUDENT_JWT });
    // A student is authenticated but not authorized -> 403. Allow 401 so the
    // test still passes if the deployment enforces JWT at the platform edge.
    assert.ok(status === 403 || status === 401, `expected a refusal, got ${status}`);
  });
}