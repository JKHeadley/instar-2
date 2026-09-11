// Slice A maps every P15 negative fixture to executed evidence or the exact
// granted-but-unlanded owner boundary. No stand-in promotes a held arm.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const executable = {
  1: 'Architecture test proves Part Fifteen introduces no duplicate core type and imports every consumed owner through its public index.',
  2: 'Governance test inventories every governed Rule and all 52 distinct fixture identifiers; this checker binds the inventory to the actual run.',
  6: 'Full-port RunGraph evidence proves narrow control observations cannot replace the Part Five terminal business disposition.',
  8: 'Closed manifest decoding, required-field omission, duplicate identity, canonical bytes, Part Ten package/body pinning and cold reconstruction execute at all three tiers.',
  10: 'An invalid manifest is locally refused while an independent valid package and the minimal constitutional fixture remain usable.',
  11: 'All authority, bounds, supervision and proof groups are mandatory closed fields and bind the immutable body digest.',
  22: 'A forged mutable Run view cannot override the current state reconstructed through the landed public RunGraphPort.',
};

const held = {
  3: 'NON-EXECUTABLE-UNTIL-seam-response-operator-followup.md-row-69-and-Part-Ten-production-wiring',
  4: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-intake-followup.md-row-49',
  5: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-intake-followup.md-row-49-and-seam-response-loop-followup.md-row-36',
  7: 'NON-EXECUTABLE-UNTIL-design-19-scheduled-work-seam-request-calendar-adapter.md',
  9: 'NON-EXECUTABLE-UNTIL-design-19-scheduled-work-seam-request-calendar-adapter.md',
  12: 'NON-EXECUTABLE-UNTIL-seam-response-assembly-followup.md-confined-production-driver',
  13: 'NON-EXECUTABLE-UNTIL-design-19-scheduled-work-seam-request-calendar-adapter.md',
  14: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33-and-design-19-scheduled-work-seam-request-calendar-adapter.md',
  15: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-intake-followup.md-row-49-and-seam-response-operator-followup.md-row-69',
  16: 'NON-EXECUTABLE-UNTIL-seam-response-intake-followup.md-row-49',
  17: 'NON-EXECUTABLE-UNTIL-seam-response-operator-followup.md-row-69',
  18: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-facts-followup.md-row-47-and-seam-response-rungraph-followup.md-row-48-and-seam-response-intake-followup.md-row-49',
  19: 'NON-EXECUTABLE-UNTIL-seam-response-intake-followup.md-row-49-and-design-19-scheduled-work-seam-request-calendar-adapter.md',
  20: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33-and-design-19-scheduled-work-seam-request-calendar-adapter.md',
  21: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-facts-followup.md-row-47-and-seam-response-rungraph-followup.md-row-48-and-seam-response-intake-followup.md-row-49',
  23: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-loop-followup.md-and-seam-response-judgment.md-row-32',
  24: 'NON-EXECUTABLE-UNTIL-seam-response-facts-followup.md-and-seam-response-loop-followup.md-row-37-and-design-19-scheduled-work-seam-request-calendar-adapter.md',
  25: 'NON-EXECUTABLE-UNTIL-seam-response-facts-followup.md-and-seam-response-loop-followup.md-row-37-and-design-19-scheduled-work-seam-request-calendar-adapter.md',
  26: 'NON-EXECUTABLE-UNTIL-SEAM-LEDGER.md-rows-37-44-47-48-49-54-66-67-68',
  27: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33-and-design-19-scheduled-work-seam-request-calendar-adapter.md',
  28: 'NON-EXECUTABLE-UNTIL-seam-response-intake-followup.md-row-49-and-design-19-scheduled-work-seam-request-calendar-adapter.md',
  29: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  30: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  31: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  32: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27',
  33: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  34: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27',
  35: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-loop-followup.md-and-seam-response-judgment.md-rows-27-32',
  36: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27-and-seam-response-intake-followup.md-row-49',
  37: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-rows-36-37-and-seam-response-facts-followup.md-row-37',
  38: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-assembly-followup.md-shutdown-driver',
  39: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  40: 'NON-EXECUTABLE-UNTIL-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md',
  41: 'NON-EXECUTABLE-UNTIL-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md',
  42: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-judgment.md-row-23',
  43: 'NON-EXECUTABLE-UNTIL-seam-response-judgment.md-row-27-and-seam-response-assembly-followup.md-row-30',
  44: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-judgment.md-row-23',
  45: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-assembly-followup.md-shutdown-driver-and-seam-response-judgment.md-row-23',
  46: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33',
  47: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33',
  48: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33-and-seam-response-operator-followup.md-row-69',
  49: 'NON-EXECUTABLE-UNTIL-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md',
  50: 'NON-EXECUTABLE-UNTIL-seam-response-operator-followup.md-row-69-and-Part-Ten-production-wiring',
  51: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27-and-seam-response-intake-followup.md-row-49',
  52: 'NON-EXECUTABLE-UNTIL-SEAM-LEDGER.md-rows-23-27-30-37-44-47-48-49-54-66-67-68-69-and-Part-Ten-production-wiring',
};

export function p15Dispositions(design = readFileSync('docs/19-scheduled-work/09-negative-contract-fixtures.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P15-NF-(\d+)) \|/gm)].map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || new Set(ids.map(row => row.id)).size !== 52) throw new Error(`expected 52 distinct P15 checks, found ${ids.length}`);
  return ids.map(row => {
    const reason = executable[row.number] ?? held[row.number]; if (!reason) throw new Error(`${row.id}: missing disposition`);
    return { ...row, status: executable[row.number] ? 'EXECUTABLE' : reason, reason };
  });
}

export function checkP15Coverage(report, dispositions = p15Dispositions()) {
  if (!report.success) throw new Error('P15 mapping requires a successful actual test run');
  return dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults.filter(test => (test.fullName.match(/\bP15-NF-\d+\b/g) ?? []).includes(row.id))
      .map(test => ({ file: relative(process.cwd(), file.name), title: test.title, status: test.status })));
    if (row.status === 'EXECUTABLE') {
      if (!tests.length || tests.some(test => test.status !== 'passed')) throw new Error(`${row.id}: EXECUTABLE without exclusively passing real tests`);
    } else if (tests.length) throw new Error(`${row.id}: held owner arm is falsely labelled by a local passing test`);
    return { ...row, tests };
  });
}

if (process.argv[1]?.endsWith('check-p15-contract-map.mjs')) {
  const rows = checkP15Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Passing test files |'); console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.filter(row => row.status === 'EXECUTABLE').length} EXECUTABLE and ${rows.filter(row => row.status !== 'EXECUTABLE').length} exact NON-EXECUTABLE-UNTIL P15 checks mapped.`);
}
