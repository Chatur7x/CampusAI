/**
 * Behavioral tests for the Phase A security fixes.
 *
 * The other suites in this directory are source-shape (static) checks — they
 * read the TypeScript and assert on its text. They cannot prove the code
 * still behaves correctly after a refactor that preserves the strings. These
 * tests spawn `tests/backend/fixtures/behavior-probe.ts`, which drives the
 * real `validate()` middlewares and the real `verifyToken()` with mock
 * express objects, and assert on what actually happened.
 *
 * Hermetic by construction:
 *   - cwd is the fixtures directory, which has no `.env`, and every variable
 *     `config/env.ts` requires is injected explicitly below, so the probe
 *     never reads the developer's environment.
 *   - no network or database access: validation and JWT checks are pure.
 *
 *   node --test tests/backend/behavior.test.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
// CJS launcher that registers ts-node's require hook — see run-probe.cjs
// for why the ts-node CLI itself cannot be used here (root is type:module).
const LAUNCHER = join(FIXTURES, 'run-probe.cjs');

// Fake-but-well-formed secrets. The probe is hermetic (see above), so these
// never touch the real database or the real JWTs — they only need to satisfy
// the >=32 char startup check in utils/jwt.ts.
const PROBE_ENV = {
  ...process.env,
  DATABASE_URL: 'postgresql://probe:probe@localhost:5432/probe',
  JWT_SECRET: 'behavior-probe-jwt-secret-at-least-32-chars-long',
  JWT_REFRESH_SECRET: 'behavior-probe-refresh-secret-at-least-32-chars',
  SMTP_HOST: 'localhost',
  SMTP_USER: 'probe',
  SMTP_PASS: 'probe',
  FRONTEND_URL: 'http://localhost:5173',
};

// Compiler options live in run-probe.cjs (CJS require-hook registration).

const EXPECTED_CHECKS = [
  'createValidationRejectsSuperadmin',
  'updateValidationRejectsSuperadmin',
  'createValidationAcceptsEnumeratedRole',
  'createValidationRejectsMissingRequiredFields',
  'validationErrorsDoNotEchoSubmittedValue',
  'verifyTokenRejectsAlgNone',
  'verifyTokenRejectsWrongSecretHs256',
  'generateAndVerifyRoundTrip',
];

const runProbe = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [LAUNCHER], { cwd: FIXTURES, env: PROBE_ENV });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`probe timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 60_000);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const line = stdout.split(/\r?\n/).find((l) => l.startsWith('PROBE_JSON:'));
      if (!line) {
        reject(new Error(`probe exited ${code} without PROBE_JSON\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      let results;
      try {
        results = JSON.parse(line.slice('PROBE_JSON:'.length));
      } catch (err) {
        reject(new Error(`probe emitted unparseable JSON: ${err.message}\nline: ${line}`));
        return;
      }
      resolve({ results, code, stderr });
    });
  });

test('behavioral probe runs and reports every check', async () => {
  const { results, code } = await runProbe();
  assert.equal(code, 0, 'probe process must exit cleanly');
  for (const name of EXPECTED_CHECKS) {
    assert.ok(results[name], `probe did not report check "${name}" — got keys: ${Object.keys(results).join(', ')}`);
  }
});

test('create/update validation rejects an unenumerated role with 400', async () => {
  const { results } = await runProbe();
  for (const name of ['createValidationRejectsSuperadmin', 'updateValidationRejectsSuperadmin']) {
    const r = results[name];
    assert.equal(r.ok, true, `${name} failed: ${r.detail}`);
    assert.match(r.detail, /400/, `${name}: expected 400, got "${r.detail}"`);
    assert.match(r.detail, /role allowlist/i, `${name}: expected allowlist error, got "${r.detail}"`);
  }
});

test('validation positive controls: valid body passes, incomplete body fails', async () => {
  const { results } = await runProbe();
  const accept = results.createValidationAcceptsEnumeratedRole;
  assert.equal(accept.ok, true, `positive control failed: ${accept.detail}`);
  assert.match(accept.detail, /next\(\) called/, `expected next() call, got "${accept.detail}"`);

  const reject = results.createValidationRejectsMissingRequiredFields;
  assert.equal(reject.ok, true, `missing-field check failed: ${reject.detail}`);
  assert.match(reject.detail, /400/, `expected 400, got "${reject.detail}"`);
});

test('validation errors name the field but do not echo the submitted value', async () => {
  const { results } = await runProbe();
  const noEcho = results.validationErrorsDoNotEchoSubmittedValue;
  assert.equal(noEcho.ok, true, `no-echo check failed: ${noEcho.detail}`);
  assert.match(noEcho.detail, /field named/, `expected field naming, got "${noEcho.detail}"`);
  assert.match(noEcho.detail, /not echoed/, `expected no echo, got "${noEcho.detail}"`);
});

test('verifyToken rejects alg=none and wrong-secret tokens, accepts its own', async () => {
  const { results } = await runProbe();
  const algNone = results.verifyTokenRejectsAlgNone;
  assert.equal(algNone.ok, true, `alg=none check failed: ${algNone.detail}`);
  assert.match(algNone.detail, /rejected/, `expected rejection, got "${algNone.detail}"`);

  const wrongSecret = results.verifyTokenRejectsWrongSecretHs256;
  assert.equal(wrongSecret.ok, true, `wrong-secret check failed: ${wrongSecret.detail}`);
  assert.match(wrongSecret.detail, /rejected/, `expected rejection, got "${wrongSecret.detail}"`);

  const roundTrip = results.generateAndVerifyRoundTrip;
  assert.equal(roundTrip.ok, true, `round-trip control failed: ${roundTrip.detail}`);
  assert.match(roundTrip.detail, /round-trip/, `expected round-trip success, got "${roundTrip.detail}"`);
});
