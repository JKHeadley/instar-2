// The part-eleven kill-schedule RECORD: every adjacent pair of the enumerated durable
// boundaries, which cut ACTUALLY fired, and the terminal state.
//
// The row format lives HERE and nowhere else. The acceptance suite renders its own
// rows with `scheduleRow`/`renderScheduleRecord` from its real executions and compares
// them against the pinned `tests/slice/expected-schedule.md`, so the table in the DONE
// note is an assertion rather than prose. Running this file regenerates that pin.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROFILE_BOUNDARIES } from './slice-assembly.mjs';

export const SCHEDULE_HEADER = [
  '| Profile | Cut after | then after | Boots | Cuts that fired | External applications | Six operations | Terminal disposition |',
  '|---|---|---|---|---|---|---|---|',
].join('\n');

/** Every adjacent pair of a profile's executed boundaries. */
export function adjacentPairs(boundaries) {
  const pairs = [];
  for (let i = 0; i + 1 < boundaries.length; i++) pairs.push([boundaries[i], boundaries[i + 1]]);
  return pairs;
}

/**
 * One row of the record, derived from an execution's own report.
 *
 * The `Six operations` column carries each six-owned operation's ROLE, its terminal
 * state and whether SIX resolved it — an applied settlement or a conditional close.
 * Without it the record could not distinguish a wedged prepared operation from one
 * six closed, since neither is an `owned-` obligation state.
 */
export function scheduleRow(profile, pair, boots, fired, report) {
  const settlement = report.settlement ? `settled ${report.settlement.outcome}` : 'no settlement';
  const owned = [...new Set(report.obligations.filter(o => o.state.startsWith('owned-')).map(o => o.state))];
  const six = (report.sixOperations ?? []).map(o => `${o.role}:${o.state}${o.resolved ? '/resolved' : ''}`);
  return `| ${profile} | \`${pair[0]}\` | \`${pair[1]}\` | ${boots} | ${fired.join(', ') || 'none'} `
    + `| ${report.externalApplications.length} | ${six.join(', ') || 'none'} `
    + `| ${settlement}${owned.length ? `; ${owned.join(', ')}` : ''} |`;
}

export function renderScheduleRecord(rows) { return [SCHEDULE_HEADER, ...rows].join('\n'); }

function execute(profile, cuts) {
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
}

if (process.argv[1] && process.argv[1].endsWith('slice-schedule-record.mjs')) {
  const rows = [];
  for (const [profile, boundaries] of Object.entries(PROFILE_BOUNDARIES))
    for (const pair of adjacentPairs(boundaries)) {
      const { boots, fired, report } = execute(profile, pair);
      rows.push(scheduleRow(profile, pair, boots, fired, report));
    }
  process.stdout.write(`${renderScheduleRecord(rows)}\n`);
}
