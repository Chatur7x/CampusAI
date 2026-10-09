import 'dotenv/config';

/**
 * Customer onboarding load test — 100 -> 1000 scale, direct INSERT path.
 *
 * Uses the verified working path: direct INSERT into auth.users via pooler
 * (bypasses broken admin API). Trigger auto-creates profile + student.
 *
 * Tags: auth users loadtest-<tag>-NNNN@example.com — identifiable, cleanable.
 *
 * Usage:
 *   node scripts/loadtest-customers.mjs --count 1000 --concurrency 5 --tag perf1
 *   node scripts/loadtest-customers.mjs --cleanup --tag perf1
 */

const { Pool } = await import('pg');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const raw = process.argv.slice(2);
const args = {};
for (let i = 0; i < raw.length; i++) {
  const m = raw[i].match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) continue;
  if (m[2] !== undefined) args[m[1]] = m[2];
  else if (raw[i + 1] && !raw[i + 1].startsWith('--')) args[m[1]] = raw[++i];
  else args[m[1]] = '1';
}

const COUNT = Math.min(Math.max(parseInt(args.count ?? '1000', 10) || 1000, 1), 5000);
const CONC = Math.min(Math.max(parseInt(args.concurrency ?? '5', 10) || 5, 1), 20);
const TAG = (args.tag ?? Date.now().toString(36)).replace(/[^a-z0-9-]/gi, '').slice(0, 12) || 't1';
const PREFIX = `loadtest-${TAG}`;
const POOL = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.akgjpqvpcugbmdenpxny',
  password: 'Chaaya@0607',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  max: CONC,
});

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); return s[Math.min(s.length-1, Math.floor((p/100)*s.length))]; };
const mean = (arr) => (arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function directInsert(email, n) {
  const t0 = performance.now();
  // Provide unique enrollment_id to avoid trigger's epoch-second collision
  const enrollmentId = `LT${String(n).padStart(6, '0')}${Date.now().toString(36)}`;
  const meta = JSON.stringify({ first_name: 'Load', last_name: 'Customer' + n, role: 'STUDENT', enrollment_id: enrollmentId });
  const sql = `
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      $1,
      crypt('Loadtest@12345', gen_salt('bf')),
      now(),
      $2::jsonb,
      now(), now()
    ) RETURNING id
  `;
  try {
    const r = await POOL.query(sql, [email, meta]);
    const ms = performance.now() - t0;
    return { ok: true, ms, id: r.rows[0]?.id ?? null };
  } catch (e) {
    const ms = performance.now() - t0;
    return { ok: false, ms, err: e.message.slice(0, 200) };
  }
}

async function cleanup() {
  console.log(`\nCleanup tag=${TAG} ...`);
  const r = await POOL.query(`DELETE FROM auth.users WHERE email LIKE $1`, [`${PREFIX}-%`]);
  console.log(`  deleted ${r.rowCount} auth users (profiles+students cascade)`);
  return r.rowCount;
}

async function restGet(path) {
  const t0 = performance.now();
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const ms = performance.now() - t0;
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, ms, data };
}

async function main() {
  if (args.cleanup) { process.exit((await cleanup()) >= 0 ? 0 : 1); }

  console.log(`\nCustomer onboarding load test: count=${COUNT} concurrency=${CONC} tag=${TAG}`);
  console.log('Path: direct INSERT → trigger → profile + student');
  console.log('='.repeat(64));

  // preflight
  const ping = await restGet('profiles?select=id&limit=1');
  if (!ping.ok) { console.error(`Preflight failed: ${ping.status}`); process.exit(1); }
  console.log('Preflight OK: profiles reachable');

  const lat = [];
  const ids = [];
  let fails = 0;
  let firstErr = null;
  const checkpoints = [];
  const tStart = performance.now();
  let done = 0;

  const emails = Array.from({ length: COUNT }, (_, i) => {
    const n = String(i + 1).padStart(4, '0');
    return `${PREFIX}-${n}@example.com`;
  });

  for (let i = 0; i < emails.length; i += CONC) {
    const chunk = emails.slice(i, i + CONC);
    const results = await Promise.all(chunk.map((e, k) => directInsert(e, i + k + 1)));
    for (const r of results) {
      done++;
      if (r.ok) { lat.push(r.ms); ids.push(r.id); }
      else { fails++; firstErr ??= r.err; }
    }
    if (done % 100 === 0 || done === COUNT) {
      const el = performance.now() - tStart;
      const rps = (done - fails) / (el / 1000);
      checkpoints.push({ users: done, ok: done - fails, elapsedMs: Math.round(el), perSec: +rps.toFixed(2) });
      console.log(`  checkpoint ${done}/${COUNT}: ${rps.toFixed(2)} users/s ok=${done - fails} fail=${fails}`);
    }
  }
  const writeMs = performance.now() - tStart;
  const okCount = COUNT - fails;

  // trigger verification
  console.log('\nTrigger verification (profile+student auto-created)...');
  await sleep(3000);
  const sampleIds = ids.filter((_, i) => i % Math.max(1, Math.floor(ids.length / 20)) === 0).slice(0, 20);
  let profOk = 0, studOk = 0;
  for (const uid of sampleIds) {
    const p = await restGet(`profiles?select=id&user_id=eq.${uid}`);
    if (p.ok && p.data?.length) profOk++;
    const s = await restGet(`students?select=id&user_id=eq.${uid}`);
    if (s.ok && s.data?.length) studOk++;
  }
  console.log(`  profiles: ${profOk}/${sampleIds.length}, students: ${studOk}/${sampleIds.length}`);

  // read probes
  console.log('\nRead probes ...');
  const reads = {};
  const probe = async (name, path, n = 5) => {
    const l = []; let ok = 0;
    for (let i = 0; i < n; i++) { const r = await restGet(path); l.push(r.ms); if (r.ok) ok++; }
    reads[name] = { ok: `${ok}/${n}`, p50Ms: +pct(l, 50).toFixed(1), p95Ms: +pct(l, 95).toFixed(1) };
    console.log(`  ${name}: ok=${ok}/${n} p50=${reads[name].p50Ms}ms p95=${reads[name].p95Ms}ms`);
  };
  await probe('profilesPage50', 'profiles?select=id,email,role&order=created_at.desc&limit=50');
  await probe('studentsPage50', 'students?select=id,enrollment_id&order=created_at.desc&limit=50');
  await probe('studentOverview', 'student_attendance_overview?select=*&limit=50');
  const t0 = performance.now();
  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_admin_dashboard_stats`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }});
  const rpcMs = performance.now() - t0;
  console.log(`  dashboardStats: status=${rpc.status} ms=${rpcMs.toFixed(0)}`);

  const perSec = okCount / (writeMs / 1000);
  const base = checkpoints[0]?.perSec ?? perSec;
  const lastCp = checkpoints[checkpoints.length - 1]?.perSec ?? perSec;
  const scalingEff = base ? lastCp / base : 1;

  const report = {
    tag: TAG, count: COUNT, concurrency: CONC,
    writes: {
      ok: okCount, fails, firstError: firstErr,
      elapsedMs: Math.round(writeMs), perSec: +perSec.toFixed(2),
      msPerUser: +(writeMs / Math.max(1, okCount)).toFixed(1),
      latMs: { p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1), max: +Math.max(0, ...lat).toFixed(1) },
      scalingEfficiency: +scalingEff.toFixed(3),
    },
    triggerFill: { sample: sampleIds.length, profiles: profOk, students: studOk },
    checkpoints, reads,
    dashboardStatsRpc: { status: rpc.status, ms: +rpcMs.toFixed(0) },
    verdict: fails === 0 && profOk === sampleIds.length ? 'PASS' : 'REVIEW',
  };

  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync('tmp', { recursive: true });
  writeFileSync(`tmp/loadtest-report-${TAG}.json`, JSON.stringify(report, null, 2));
  const md =
    `# Customer load test — ${TAG}\n\n` +
    `- Path: **direct INSERT → trigger → profile + student** (${COUNT} customers, concurrency ${CONC})\n` +
    `- Writes: **${okCount} ok / ${fails} failed** in ${(writeMs / 1000).toFixed(1)}s → **${perSec.toFixed(2)} users/s** (${(writeMs / Math.max(1, okCount)).toFixed(1)} ms/user)\n` +
    `- Signup latency: p50 ${report.writes.latMs.p50}ms, p95 ${report.writes.latMs.p95}ms, max ${report.writes.latMs.max}ms\n` +
    `- Trigger fill (sample ${sampleIds.length}): profiles ${profOk}, students ${studOk}\n` +
    `- Scaling efficiency (last-100 / first-100 throughput): **${(scalingEff * 100).toFixed(1)}%**\n` +
    `- Reads: profilesPage50 p50 ${reads.profilesPage50.p50Ms}ms/p95 ${reads.profilesPage50.p95Ms}ms; ` +
    `studentsPage50 p50 ${reads.studentsPage50.p50Ms}ms; overview p50 ${reads.studentOverview.p50Ms}ms/p95 ${reads.studentOverview.p95Ms}ms\n` +
    `- Dashboard RPC: status=${rpc.status} ms=${rpcMs.toFixed(0)}\n` +
    `- Verdict: **${report.verdict}**${firstErr ? ` (first error: ${firstErr})` : ''}\n\n` +
    `## Throughput checkpoints\n\n| users | users/s |\n|---|---|\n` +
    checkpoints.map((c) => `| ${c.users} | ${c.perSec} |\n`).join('') +
    `\nCleanup: \`node scripts/loadtest-customers.mjs --cleanup --tag ${TAG}\`\n`;
  writeFileSync(`tmp/loadtest-report-${TAG}.md`, md);

  console.log('\n' + '='.repeat(64));
  console.log(`Writes: ${okCount} ok / ${fails} fail, ${perSec.toFixed(2)} users/s`);
  console.log(`Scaling efficiency: ${(scalingEff * 100).toFixed(1)}%`);
  console.log(`Trigger fill: profiles ${profOk}/${sampleIds.length}, students ${studOk}/${sampleIds.length}`);
  console.log(`Verdict: ${report.verdict}`);
  await POOL.end();
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });