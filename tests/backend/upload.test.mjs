/**
 * Upload hardening tests (M3) — `server--backend/src/middleware/upload.ts`.
 *
 * The previous implementation trusted the client-supplied MIME type alone and
 * preserved the original extension, so an uploaded `.svg` or `.html` landed on
 * disk (and, for avatars, in a public bucket) with an executable extension —
 * stored XSS.
 *
 * These assert the guards exist and are ordered correctly. Behavioural tests
 * that exercise multer end-to-end need a running Express app; see
 * tests/integration/.
 *
 *   node --test tests/backend/
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(
  join(REPO, 'server--backend', 'src', 'middleware', 'upload.ts'),
  'utf8',
);

/** Body of one top-level `const RULES` entry. */
function ruleBlock(field) {
  const start = SRC.indexOf(`${field}: {`);
  assert.notEqual(start, -1, `rule ${field} not found`);
  const end = SRC.indexOf('\n  },', start);
  return SRC.slice(start, end === -1 ? SRC.length : end);
}

const FIELDS = ['avatar', 'faceData', 'documents', 'csv'];

test('every upload field declares an extension allowlist', () => {
  for (const field of FIELDS) {
    assert.match(ruleBlock(field), /extensions:\s*\[/, `${field} has no extensions`);
  }
});

test('no field allows an extension the browser can execute', () => {
  const executable = /\.(svg|html|htm|js|mjs|xml|xhtml)\b/;
  for (const field of FIELDS) {
    const block = ruleBlock(field);
    const extLine = block.match(/extensions:\s*\[([^\]]*)\]/)?.[1] ?? '';
    assert.doesNotMatch(extLine, executable, `${field} allows an executable extension`);
  }
});

test('the file filter checks the extension against the allowlist', () => {
  assert.match(SRC, /rule\.extensions\.includes\(ext\)/);
});

test('the file filter checks the MIME against the allowlist', () => {
  assert.match(SRC, /rule\.mimes\.includes\(file\.mimetype\)/);
});

test('the file filter rejects an unknown upload field', () => {
  assert.match(SRC, /if \(!rule\)/);
});

test('stored filenames never reuse the client filename', () => {
  assert.doesNotMatch(SRC, /cb\(null,[^)]*originalname/);
  assert.match(SRC, /crypto\.randomBytes\(16\)/);
});

test('the upload directory is resolved to an absolute path', () => {
  assert.match(SRC, /path\.resolve\(process\.env\.UPLOAD_PATH/);
});

test('file bytes are verified against a signature', () => {
  assert.match(SRC, /sniffFile/);
  assert.match(SRC, /rule\.magic\.some/);
});

test('PNG and JPEG signatures are in the allowlist', () => {
  assert.match(SRC, /0xff, 0xd8, 0xff/);
  assert.match(SRC, /0x89, 0x50, 0x4e, 0x47/);
});

test('markup content is rejected even when the extension is allowed', () => {
  assert.match(SRC, /containsMarkup/);
  assert.match(SRC, /\(script\|html\|svg\|iframe\|object\|embed\)/);
});

test('rejected files are deleted from disk', () => {
  const unlinks = SRC.match(/fs\.unlink\(file\.path/g) || [];
  assert.ok(unlinks.length >= 3, 'signature, markup and path failures must all clean up');
});

test('the temp path must stay inside the upload root', () => {
  assert.match(SRC, /startsWith\(uploadDir \+ path\.sep\)/);
});

test('file count is capped at one per request', () => {
  assert.match(SRC, /files:\s*1/);
});

test('serving uses attachment disposition so the browser never renders it', () => {
  assert.match(SRC, /'Content-Disposition',\s*'attachment'/);
});

test('serving sets nosniff and a sandboxing CSP', () => {
  assert.match(SRC, /'X-Content-Type-Options',\s*'nosniff'/);
  assert.match(SRC, /'Content-Security-Policy',\s*"default-src 'none'; sandbox"/);
});

test('serving refuses a path outside the upload root', () => {
  assert.match(SRC, /sendUploadSafely/);
});

test('the upload error handler does not echo the raw error text', () => {
  assert.doesNotMatch(SRC, /message:\s*err\.message/);
});

test('the reported size limit comes from config', () => {
  assert.match(SRC, /maxFileSize \/ 1024 \/ 1024/);
});

// ── wiring ───────────────────────────────────────────────────────────────

test('both bulk upload routes run verifyUpload and the upload rate limiter', () => {
  const routes = readFileSync(
    join(REPO, 'server--backend', 'src', 'routes', 'index.ts'),
    'utf8',
  );
  const uploads = routes.match(/router\.post\('\/bulk\/upload-\w+'[\s\S]*?\);/g) || [];
  assert.equal(uploads.length, 2, 'expected students + faculty upload routes');
  for (const route of uploads) {
    assert.match(route, /uploadRateLimiter/, 'upload route must be rate limited');
    assert.match(route, /verifyUpload/, 'upload route must verify file contents');
  }
});

// ── 6.9: a renamed zip/OLE2 must not pass as CSV ─────────────────────────

test('the csv upload rule denies zip/xlsx and ole2 magic even with a .csv extension', () => {
  const csvBlock = ruleBlock('csv');
  assert.match(csvBlock, /rejectMagic/, 'csv rule must declare a reject-magic deny-list');
  assert.match(csvBlock, /0x50,\s*0x4b,\s*0x03,\s*0x04/i, 'csv reject list must cover zip/xlsx (PK header)');
  assert.match(csvBlock, /0xd0,\s*0xcf,\s*0x11,\s*0xe0/i, 'csv reject list must cover OLE2 (old Office)');
});

test('sniffFile rejects a zip/ole2 renamed to .csv but accepts real CSV', () => {
  const out = execFileSync(
    process.execPath,
    [join(REPO, 'tests', 'backend', 'fixtures', 'run-sniff-probe.cjs')],
    { encoding: 'utf8' },
  );
  const line = out.split('\n').find((l) => l.startsWith('PROBE_JSON:'));
  assert.ok(line, `expected PROBE_JSON line, got:\n${out}`);
  const { cases } = JSON.parse(line.slice('PROBE_JSON:'.length));
  const byName = Object.fromEntries(cases.map((c) => [c.name, c.ok]));
  assert.equal(byName['renamed-xlsx.csv'], false, 'zip header renamed .csv must be rejected');
  assert.equal(byName['renamed-ole2.csv'], false, 'OLE2 header renamed .csv must be rejected');
  assert.equal(byName['plain.csv'], true, 'plain CSV bytes must be accepted');
  assert.equal(byName['empty.csv'], true, 'empty file must not crash sniffFile');
});
