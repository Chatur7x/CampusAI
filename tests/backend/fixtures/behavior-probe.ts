/**
 * Behavioral probe for the two Phase A security fixes that source-shape
 * assertions cannot prove on their own:
 *
 *   1. `createUserValidation` / `updateUserValidation` must reject an
 *      unenumerated role (`superadmin`) with HTTP 400 before the body ever
 *      reaches Prisma.
 *   2. `verifyToken` must reject a token whose header claims `alg: none`,
 *      and any HS256 token not signed with our secret.
 *
 * This file imports the real middleware out of server--backend/src and drives
 * it with mock req/res/next objects, so a refactor that keeps the allowlist
 * strings in place but stops calling them (e.g. validate() always calling
 * next()) still fails here.
 *
 * Spawned by tests/backend/behavior.test.mjs with a hermetic environment
 * (hermetic cwd + explicit env vars), so it never touches a real database
 * or the developer's .env.
 */

import { createUserValidation, updateUserValidation } from '../../../server--backend/src/middleware/validation';
import { generateToken, verifyToken } from '../../../server--backend/src/utils/jwt';
import crypto from 'node:crypto';

interface Outcome {
  ok: boolean;
  detail: string;
}

interface MiddlewareCalls {
  statusCode: number | null;
  jsonBody: unknown;
  nextCalled: boolean;
}

const results: Record<string, Outcome> = {};

const record = (name: string, fn: () => string): void => {
  try {
    const detail = fn();
    results[name] = { ok: true, detail };
  } catch (err) {
    results[name] = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
};

const check = (cond: boolean, message: string): void => {
  if (!cond) throw new Error(message);
};

// Drive a validate() middleware with mock express objects and report what it
// did: status/json (rejected) vs next() (accepted).
const runMiddleware = (
  mw: (req: unknown, res: unknown, next: () => void) => void,
  body: unknown
): MiddlewareCalls => {
  const calls: MiddlewareCalls = { statusCode: null, jsonBody: null, nextCalled: false };
  const req = { body };
  const res = {
    status(code: number) {
      calls.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      calls.jsonBody = payload;
      return res;
    },
  };
  mw(req, res, () => {
    calls.nextCalled = true;
  });
  return calls;
};

const errorMessages = (call: MiddlewareCalls): string =>
  JSON.stringify((call.jsonBody as { errors?: { message: string }[] })?.errors ?? []);

// ── Validation: superadmin role ──────────────────────────────────────────

const validCreateBody = {
  email: 'probe@example.com',
  password: 'password123',
  first_name: 'Probe',
  last_name: 'User',
  role: 'STUDENT',
};

record('createValidationRejectsSuperadmin', () => {
  const call = runMiddleware(createUserValidation, { ...validCreateBody, role: 'superadmin' });
  check(call.statusCode === 400, `expected status 400, got ${call.statusCode}`);
  check(!call.nextCalled, 'next() must not be called for an unenumerated role');
  check(
    /role must be one of/i.test(errorMessages(call)),
    `expected role allowlist error, got ${errorMessages(call)}`
  );
  return '400 + role allowlist error, next() not called';
});

record('updateValidationRejectsSuperadmin', () => {
  const call = runMiddleware(updateUserValidation, { role: 'superadmin' });
  check(call.statusCode === 400, `expected status 400, got ${call.statusCode}`);
  check(!call.nextCalled, 'next() must not be called for an unenumerated role');
  check(
    /role must be one of/i.test(errorMessages(call)),
    `expected role allowlist error, got ${errorMessages(call)}`
  );
  return '400 + role allowlist error, next() not called';
});

record('createValidationAcceptsEnumeratedRole', () => {
  const call = runMiddleware(createUserValidation, validCreateBody);
  check(call.statusCode === null, `expected no status, got ${call.statusCode}`);
  check(call.nextCalled, 'next() must be called for a valid body');
  return 'next() called for a valid body (positive control)';
});

record('createValidationRejectsMissingRequiredFields', () => {
  const call = runMiddleware(createUserValidation, { email: 'probe@example.com' });
  check(call.statusCode === 400, `expected status 400, got ${call.statusCode}`);
  check(!call.nextCalled, 'next() must not be called when required fields are missing');
  return '400 for incomplete body';
});

record('validationErrorsDoNotEchoSubmittedValue', () => {
  // The offending field must be named; the submitted value must not be echoed
  // back. A validator that answers `invalid value "superadmin" for role`
  // reflects attacker input into logs, error trackers, and any UI that renders
  // the message.
  const call = runMiddleware(createUserValidation, {
    email: 'canary-email-value',
    password: 'canary-password-value',
    role: 'canary-role-value',
  });
  check(call.statusCode === 400, `expected status 400, got ${call.statusCode}`);
  const messages = errorMessages(call);
  check(!/canary/i.test(messages), `error text echoed a submitted value: ${messages}`);
  check(/role/i.test(messages), `expected the offending field named, got ${messages}`);
  return 'field named, submitted values not echoed';
});

// ── JWT: algorithm pinning ───────────────────────────────────────────────

const b64url = (input: string): string => Buffer.from(input).toString('base64url');

record('verifyTokenRejectsAlgNone', () => {
  const forged = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ userId: 'attacker', email: 'attacker@example.com', role: 'ADMIN' })
  )}.`;
  let threw = false;
  try {
    verifyToken(forged);
  } catch {
    threw = true;
  }
  check(threw, 'verifyToken must throw for a token claiming alg: none');
  return 'alg=none token rejected';
});

record('verifyTokenRejectsWrongSecretHs256', () => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      userId: 'attacker',
      email: 'attacker@example.com',
      role: 'ADMIN',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  const wrongSecret = crypto
    .createHash('sha256')
    .update('a-secret-that-is-not-the-server-secret')
    .digest('hex');
  const signature = crypto
    .createHmac('sha256', wrongSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  let threw = false;
  try {
    verifyToken(`${header}.${payload}.${signature}`);
  } catch {
    threw = true;
  }
  check(threw, 'verifyToken must throw for a correctly-shaped token signed with the wrong secret');
  return 'wrong-secret HS256 token rejected';
});

record('generateAndVerifyRoundTrip', () => {
  const token = generateToken({ userId: 'probe-user-123', email: 'probe@example.com', role: 'STUDENT' });
  const payload = verifyToken(token);
  check(payload.userId === 'probe-user-123', `userId mismatch: ${payload.userId}`);
  check(payload.role === 'STUDENT', `role mismatch: ${payload.role}`);
  return 'HS256 sign/verify round-trip (positive control)';
});

// Distinct marker line so the parent test can parse past any incidental
// stdout (dotenv banners, deprecation warnings).
console.log(`PROBE_JSON:${JSON.stringify(results)}`);
