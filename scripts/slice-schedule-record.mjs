// Emits the part-eleven kill-schedule RECORD as markdown: every adjacent pair of the
// enumerated durable boundaries, which cut ACTUALLY fired, and the terminal state.
// It drives the same public worker the acceptance suite drives.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPLY = ['preservation', 'authentication', 'standing', 'run-creation', 'outbound-preparation',
  'outbound-reservation', 'outbound-claim', 'outbound-consume', 'external-send', 'delivery-evidence', 'settlement',
  'rebuild:minimal.intake-ledger', 'rebuild:minimal.principal-binding', 'rebuild:minimal.run-view',
  'rebuild:minimal.outbound-obligation', 'rebuild:minimal.authority-queue', 'rebuild:minimal.guard-repair'];
const JUDGMENT = ['preservation', 'authentication', 'standing', 'run-creation', 'judgment-request',
  'judgment-reservation', 'judgment-claim', 'judgment-dispatch', 'model-invocation', 'judgment-resolution',
  'outbound-preparation', 'rebuild:minimal.intake-ledger', 'rebuild:minimal.principal-binding',
  'rebuild:minimal.run-view', 'rebuild:minimal.outbound-obligation', 'rebuild:minimal.authority-queue', 'rebuild:minimal.guard-repair'];

const run = (profile, cuts) => {
  const home = mkdtempSync(join(tmpdir(), 'p11-record-'));
  let report, boots = 0;
  for (let i = 0; i < 12; i++) {
    boots++;
    const child = spawnSync(process.execPath, ['scripts/slice-worker.mjs', home, JSON.stringify({ profile, cuts })],
      { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (child.status === 0) { report = JSON.parse(child.stdout.trim().split('\n').pop()); break; }
    if (child.signal !== 'SIGKILL') throw new Error(`worker failed: ${child.stderr}`);
  }
  const cutFile = join(home, 'cuts.jsonl');
  const fired = existsSync(cutFile) ? readFileSync(cutFile, 'utf8').trim().split('\n').map(l => JSON.parse(l).boundary) : [];
  rmSync(home, { recursive: true, force: true });
  return { boots, fired, report };
};

console.log('| Profile | Cut after | then after | Boots | Cuts that fired | External applications | Terminal disposition |');
console.log('|---|---|---|---|---|---|---|');
for (const [profile, boundaries] of [['reply', REPLY], ['judgment', JUDGMENT]]) {
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const pair = [boundaries[i], boundaries[i + 1]];
    const { boots, fired, report } = run(profile, pair);
    const settlement = report.settlement ? `settled ${report.settlement.outcome}` : 'no settlement';
    const owned = report.obligations.filter(o => o.state.startsWith('owned-')).map(o => o.state);
    console.log(`| ${profile} | \`${pair[0]}\` | \`${pair[1]}\` | ${boots} | ${fired.join(', ') || 'none'} `
      + `| ${report.externalApplications.length} | ${settlement}${owned.length ? `; ${[...new Set(owned)].join(', ')}` : ''} |`);
  }
}
