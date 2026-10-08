/**
 * Checklist 6.9 probe — behavioural test of `sniffFile`.
 *
 * The csv rule declares `magic: []` (plain-text files have no fixed header),
 * so the ONLY thing standing between an attacker and an `.xlsx` renamed to
 * `.csv` (which downstream consumers open with Excel) is the `rejectMagic`
 * deny-list. This probe writes real files to a temp dir and runs the actual
 * middleware function against them.
 *
 *   run via run-sniff-probe.cjs -> prints PROBE_JSON:{...}
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sniffFile } from '../../../server--backend/src/middleware/upload';

/** Mirrors the `csv` entry of RULES in upload.ts. */
const CSV_RULE = {
  magic: [] as { mime: string; bytes: number[] }[],
  rejectMagic: [
    [0x50, 0x4b, 0x03, 0x04], // ZIP local file header (xlsx, docx, jar)
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // OLE2 (legacy .xls/.doc)
  ],
};

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'sniff-'));
  const cases: { name: string; ok: boolean }[] = [];

  const run = async (name: string, content: Buffer) => {
    const p = join(dir, name);
    writeFileSync(p, content);
    cases.push({ name, ok: await sniffFile(p, CSV_RULE as never) });
  };

  await run('plain.csv', Buffer.from('id,name\n1,Alice\n2,Bob\n'));
  await run('renamed-xlsx.csv', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]));
  await run('renamed-ole2.csv', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  await run('empty.csv', Buffer.alloc(0));

  console.log(`PROBE_JSON:${JSON.stringify({ cases })}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
