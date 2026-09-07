// The completeness half of the split kill schedule (astra CI addendum). It runs NO
// executions: the per-profile files assert every LIVE row byte-equals its pinned row,
// so the pinned table IS the live output, and completeness over the pin holds over
// live too. This file asserts the pinned table covers exactly every adjacent pair of
// every profile plus every recovery cut pair, cuts every boundary, and shows the
// full/judgment divergence — every assertion the whole-file check made, relocated.
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { adjacentPairs } from '../slice/acceptance.js';
import { PROFILE_BOUNDARIES, RECOVERY_BOUNDARIES, RECOVERY_CUT_PAIRS, SCHEDULE_HEADER, renderScheduleRecord } from '../slice/boundaries.js';

const EXPECTED = readFileSync('tests/slice/expected-schedule.md', 'utf8').trim();
const dataRows = EXPECTED.split('\n').slice(SCHEDULE_HEADER.split('\n').length);
const columns = (row: string) => row.split('|').slice(1, -1).map(c => c.trim());
const pairOf = (row: string) => { const c = columns(row); return { profile: c[0]!, a: c[1]!.replace(/`/g, ''), b: c[2]!.replace(/`/g, ''), fired: c[4]! }; };

it('P11-NF-44 P11-NF-45 the pinned schedule covers every adjacent pair and every recovery cut, in order, and skips none', () => {
  expect(EXPECTED.startsWith(SCHEDULE_HEADER)).toBe(true);
  // Round-trips: the data rows plus the canonical header reproduce the pinned file.
  expect(renderScheduleRecord(dataRows)).toBe(EXPECTED);
  // Exactly every control adjacent pair, then every recovery cut pair, in order.
  const expected = [
    ...Object.entries(PROFILE_BOUNDARIES).flatMap(([profile, boundaries]) =>
      adjacentPairs(boundaries).map(p => `${profile}:${p.join('+')}`)),
    ...Object.entries(RECOVERY_CUT_PAIRS).flatMap(([profile, pairs]) =>
      pairs.map(p => `${profile}:${p.join('+')}`)),
  ];
  expect(dataRows.map(r => { const p = pairOf(r); return `${p.profile}:${p.a}+${p.b}`; })).toEqual(expected);
});

it('P11-NF-44 every declared control boundary is cut at least once, and the recovery boundary is both reached and cut', () => {
  const cut = new Set(dataRows.flatMap(r => pairOf(r).fired.split(',').map(s => s.trim()).filter(s => s && s !== 'none')));
  for (const [profile, boundaries] of Object.entries(PROFILE_BOUNDARIES))
    for (const boundary of boundaries) expect(cut, `${profile} ${boundary}`).toContain(boundary);
  // A recovery-only boundary is not uncuttable: the recovery pairs cut it (astra R2).
  for (const boundary of Object.keys(RECOVERY_BOUNDARIES)) expect(cut, boundary).toContain(boundary);
  // Every recovery cut pair really fired BOTH cuts and reports the reconstructed close.
  for (const [profile, pairs] of Object.entries(RECOVERY_CUT_PAIRS))
    for (const pair of pairs) {
      const row = dataRows.find(r => r.startsWith(`| ${profile} | \`${pair[0]}\` | \`${pair[1]}\``))!;
      expect(row, `${profile} ${pair.join('+')}`).toBeDefined();
      expect(pairOf(row).fired.split(',').map(s => s.trim())).toEqual([...pair]);
      expect(row).toContain(':closed/resolved');
    }
});

it('P11-NF-44 the full and judgment profiles diverge where the single chain closes a model operation the control leaves prepared', () => {
  const rowFor = (profile: string, first: string) => dataRows.find(r => r.startsWith(`| ${profile} | \`${first}\``))!;
  expect(rowFor('full', 'judgment-reservation')).toContain('model-judgment:closed/resolved');
  expect(rowFor('judgment', 'judgment-reservation')).toContain('model-judgment:prepared');
  expect(rowFor('full', 'judgment-reservation')).not.toBe(rowFor('judgment', 'judgment-reservation'));
  // ...and the reply profile's record shows six's settlement application resolving it.
  expect(rowFor('reply', 'settlement')).toContain('outbound-reply:consumed/resolved');
});
