// Slice A maps every P15 negative fixture to executed evidence or the exact
// granted-but-unlanded owner boundary. No stand-in promotes a held arm.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const executable = {
  1: 'Architecture test proves Part Fifteen introduces no duplicate core type and imports every consumed owner through its public index.',
  2: 'Governance test inventories every governed Rule and all 52 distinct fixture identifiers; this checker binds the inventory to the actual run.',
  3: 'Package admission delegates active-history selection plus complete archive and dependency validation to public Part Ten owner paths.',
  7: 'Arbitrary resource ids and paths preserve byte-identical decisions after public Part Ten archive validation; pinned-calendar replacement remains held.',
  8: 'Closed manifest decoding, required-field omission, duplicate identity, canonical bytes, dependency checks and complete Part Ten archive binding execute at all three tiers.',
  9: 'The local cron-v1 grammar and normalization arm executes; pinned zone/calendar expansion remains held at its named adapter seam.',
  10: 'The executable package-validation arm surfaces invalid manifests, inconsistent dependencies and duplicate scheduled resources while independent valid signed package resources remain usable; it does not claim job execution or minimal-plane service liveness.',
  11: 'All authority, bounds, supervision and proof groups are mandatory closed fields and bind the immutable body digest.',
  14: 'The absolute one-shot due/cutoff arm executes; missed-group disposition remains held at the named calendar and loop seams.',
  16: 'Part Ten current-package resolution refuses missing or half-staged authority; scheduled Run boundary behavior remains held at Four.',
  17: 'Part Ten decoding, signed namespace/source selection and selected-package retirement re-resolution execute; inactive competitor classification remains owner-held.',
  18: 'Local every-machine instance identity expansion executes; authenticated cross-epoch admission and long-history arms remain held.',
  19: 'Part Ten archive validation distinguishes support from a competing manifest and active-package resolution refuses a conflicting active definition; inactive/unresolved activity and calendar expansion remain held.',
  27: 'The future one-shot boundary executes; full outage coverage remains held at the named loop and calendar seams.',
  29: 'Closed percent range, explicit-action-clock freshness and unknown-evidence refusal execute through Part One; resource allocation remains separately held.',
  31: 'Local capacity evidence range, freshness and unknown-evidence classification executes; an actual capacity-inhibited launch remains held.',
  34: 'Local unobservable-evidence classification executes; finite-exposure allocation and route policy remain held.',
  39: 'The closed manifest keeps priority separate from authority and budget; real resource admission remains held at Part Six.',
  51: 'One-way source preservation, omitted-model default, execution-mode learning and unwitnessed-locality inhibition execute; launch remains held.',
};

const held = {
  3: 'NON-EXECUTABLE-UNTIL-seam-response-operator-followup.md-row-69-and-Part-Ten-production-wiring',
  4: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-intake-followup.md-row-49',
  5: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-intake-followup.md-row-49-and-seam-response-loop-followup.md-row-36',
  6: 'NON-EXECUTABLE-UNTIL-row-83-run-admission-production',
  7: 'NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  9: 'NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  10: 'NON-EXECUTABLE-UNTIL-impl-part-eleven-and-Part-Ten-production-minimal-plane-wiring; NON-EXECUTABLE-UNTIL-row-83-run-admission-production',
  12: 'NON-EXECUTABLE-UNTIL-seam-response-assembly-followup.md-confined-production-driver',
  13: 'NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  14: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  15: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-intake-followup.md-row-49-and-seam-response-operator-followup.md-row-69',
  16: 'NON-EXECUTABLE-UNTIL-seam-response-intake-followup.md-row-49',
  17: 'NON-EXECUTABLE-UNTIL-P15-P10-package-resource-and-activity-v1',
  18: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-facts-followup.md-row-47-and-seam-response-rungraph-followup.md-row-48-and-seam-response-intake-followup.md-row-49',
  19: 'NON-EXECUTABLE-UNTIL-seam-response-intake-followup.md-row-49-and-P15-P10-package-resource-and-activity-v1; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  20: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  21: 'NON-EXECUTABLE-UNTIL-seam-response-intake-scheduled.md-and-seam-response-facts-followup.md-row-47-and-seam-response-rungraph-followup.md-row-48-and-seam-response-intake-followup.md-row-49',
  22: 'NON-EXECUTABLE-UNTIL-row-83-run-admission-production',
  23: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-loop-followup.md-and-seam-response-judgment.md-row-32',
  24: 'NON-EXECUTABLE-UNTIL-seam-response-facts-followup.md-and-seam-response-loop-followup.md-row-37; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  25: 'NON-EXECUTABLE-UNTIL-seam-response-facts-followup.md-and-seam-response-loop-followup.md-row-37; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  26: 'NON-EXECUTABLE-UNTIL-SEAM-LEDGER.md-rows-37-44-47-48-49-54-66-67-68; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  27: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  28: 'NON-EXECUTABLE-UNTIL-seam-response-intake-followup.md-row-49; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter',
  29: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-resource-allocation-and-launch-arm',
  30: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  31: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  32: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27',
  33: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36',
  34: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27',
  35: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-loop-followup.md-and-seam-response-judgment.md-rows-27-32',
  36: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27-and-seam-response-intake-followup.md-row-49',
  37: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-rows-36-37-and-seam-response-facts-followup.md-row-37',
  38: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-effects-followup.md-and-seam-response-assembly-followup.md-shutdown-driver; NON-EXECUTABLE-UNTIL-row-83-run-admission-production',
  39: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-resource-admission-arm',
  40: 'NON-EXECUTABLE-UNTIL-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md',
  41: 'NON-EXECUTABLE-UNTIL-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md',
  42: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-judgment.md-row-23',
  43: 'NON-EXECUTABLE-UNTIL-seam-response-judgment.md-row-27-and-seam-response-assembly-followup.md-row-30',
  44: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-judgment.md-row-23',
  45: 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md-and-seam-response-assembly-followup.md-shutdown-driver-and-seam-response-judgment.md-row-23; NON-EXECUTABLE-UNTIL-row-83-run-admission-production',
  46: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33',
  47: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33',
  48: 'NON-EXECUTABLE-UNTIL-seam-response-loop-breaker.md-and-seam-response-loop-followup.md-row-33-and-seam-response-operator-followup.md-row-69',
  49: 'NON-EXECUTABLE-UNTIL-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md',
  50: 'NON-EXECUTABLE-UNTIL-seam-response-operator-followup.md-row-69-and-Part-Ten-production-wiring',
  51: 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md-row-36-and-seam-response-judgment.md-row-27-and-seam-response-intake-followup.md-row-49',
  52: 'NON-EXECUTABLE-UNTIL-SEAM-LEDGER.md-rows-23-27-37-44-47-48-49-54-66-67-68-69-and-Part-Ten-production-wiring; NON-EXECUTABLE-UNTIL-row-84-calendar-adapter; measured-or-benchmark-supported-route-arm-also-requires-SEAM-LEDGER.md-row-30',
};

const round12Case = {
  file: 'tests/integration/scheduled-round12.test.ts',
  title: 'P15-NF-08 P15-NF-10 round-twelve full-port malformed-resource validation',
};
const round13Case = {
  file: 'tests/integration/scheduled-round13.test.ts',
  title: 'P15-NF-51 round-thirteen full-port legacy import preserves enabled and disabled activation semantics',
};
const requiredExecutableCases = new Map([[8, [round12Case]], [10, [{
  file: 'tests/scheduled/review-round11.test.ts',
  title: 'P15-NF-10 package validation remains usable without claiming service continuation',
}]], [51, [round13Case]]]);

export function p15Dispositions(design = readFileSync('docs/19-scheduled-work/09-negative-contract-fixtures.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P15-NF-(\d+)) \|/gm)].map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || new Set(ids.map(row => row.id)).size !== 52) throw new Error(`expected 52 distinct P15 checks, found ${ids.length}`);
  return ids.map(row => {
    const local = executable[row.number]; const dependency = held[row.number];
    if (!local && !dependency) throw new Error(`${row.id}: missing disposition`);
    return { ...row, status: local ? dependency ? `EXECUTABLE-ARMS; ${dependency}` : 'EXECUTABLE' : dependency,
      reason: local ?? dependency, executable: Boolean(local), held: dependency || undefined };
  });
}

const proofFiles = [
  { file: 'tests/scheduled/review-round3.test.ts', tokens: ['exerciseP15Round3Proof()', 'expect('] },
  { file: 'tests/integration/scheduled-round3.test.ts', tokens: ['exerciseP15Round3Proof()', 'expect('] },
  { file: 'tests/e2e/scheduled-round3.test.ts', tokens: ['spawnSync(', 'SIGKILL', 'expect('] },
  { file: 'tests/scheduled/review-round8.test.ts', tokens: ['exerciseP15Round8Proof()', 'expect('] },
  { file: 'tests/integration/scheduled-round8.test.ts', tokens: ['exerciseP15Round8Proof()', 'expect('] },
  { file: 'tests/e2e/scheduled-round8.test.ts', tokens: ['spawnSync(', 'SIGKILL', 'expect('] },
  { file: 'tests/scheduled/review-round9.test.ts', tokens: ['exerciseP15Round9Proof()', 'expect('] },
  { file: 'tests/integration/scheduled-round9.test.ts', tokens: ['exerciseP15Round9Proof()', 'expect('] },
  { file: 'tests/e2e/scheduled-round9.test.ts', tokens: ['spawnSync(', 'SIGKILL', 'expect('] },
  { file: 'tests/scheduled/review-round10.test.ts', tokens: ['exerciseP15Round10Proof()', 'expect('] },
  { file: 'tests/integration/scheduled-round10.test.ts', tokens: ['exerciseP15Round10Proof()', 'expect('] },
  { file: 'tests/e2e/scheduled-round10.test.ts', tokens: ['spawnSync(', 'SIGKILL', 'expect('] },
  { file: 'tests/scheduled/review-round12.test.ts', tokens: ['exerciseP15Round12Proof()', 'expect('] },
  { file: 'tests/integration/scheduled-round12.test.ts', tokens: ['exerciseP15Round12Proof()', 'expect('] },
  { file: 'tests/e2e/scheduled-round12.test.ts', tokens: ['spawnSync(', 'SIGKILL', 'expect('] },
  { file: 'tests/scheduled/review-round13.test.ts', tokens: ['readFileSync(', 'expect('] },
  { file: 'tests/integration/scheduled-round13.test.ts', tokens: ['importLegacyScheduledJob(', 'expect('] },
  { file: 'tests/e2e/scheduled-round13.test.ts', tokens: ['spawnSync(', 'SIGKILL', 'expect('] },
];
const laneDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.instar/lanes');
const calendarRequest = 'design-19-scheduled-work-seam-request-calendar-adapter.md';
const runAdmissionRequest = 'design-19-scheduled-work-seam-request-run-admission-production.md';
const packageResourceRequest = 'design-19-scheduled-work-seam-request-package-resource-and-activity.md';
const dependencyFiles = value => value.match(/(?:SEAM-LEDGER|seam-response-[a-z0-9-]+|design-19-[a-z0-9-]+)\.md/g) ?? [];
const namedConditionalGrants = new Map([['P15-P10-package-resource-and-activity-v1', {
  request: packageResourceRequest, response: 'seam-response-assembly-followup.md', row: '80',
}]]);
const exactConditionalRowGrants = new Map([
  ['NON-EXECUTABLE-UNTIL-row-83-run-admission-production', {
    row: '83', request: runAdmissionRequest, grantId: 'P15-P6-run-admission-production-v1',
    responses: ['seam-response-loop-followup.md', 'seam-response-assembly-followup.md'],
  }],
  ['NON-EXECUTABLE-UNTIL-row-84-calendar-adapter', {
    row: '84', request: calendarRequest, grantId: 'P15-P10-calendar-adapter',
    responses: ['seam-response-assembly-followup.md'],
  }],
]);
const dependencyGrantIds = value => value.match(/P\d+-P\d+-[a-z0-9-]+-v\d+/g) ?? [];
const ungrantedRequestFiles = new Set([calendarRequest, runAdmissionRequest]);
const isRequestOnlyDisposition = row => {
  if (!row.held || row.executable) return false;
  const files = dependencyFiles(row.held);
  return files.length > 0 && files.every(file => ungrantedRequestFiles.has(file))
    && dependencyGrantIds(row.held).length === 0 && !/row(?:s)?-[0-9]/.test(row.held);
};

function expectedDisposition(number) {
  const local = executable[number]; const dependency = held[number];
  if (!local && !dependency) throw new Error(`P15-NF-${String(number).padStart(2, '0')}: unknown check number`);
  return {
    id: `P15-NF-${String(number).padStart(2, '0')}`,
    status: local ? dependency ? `EXECUTABLE-ARMS; ${dependency}` : 'EXECUTABLE' : dependency,
    reason: local ?? dependency,
    executable: Boolean(local),
    held: dependency || undefined,
  };
}

function validateDispositionIdentity(row) {
  if (!Number.isInteger(row.number) || row.number < 1 || row.number > 52)
    throw new Error(`${row.id}: unknown P15 check number ${row.number}`);
  const expected = expectedDisposition(row.number);
  if (row.id !== expected.id)
    throw new Error(`${row.id}: check identity must be ${expected.id} for number ${row.number}`);
  if (row.status !== expected.status || row.reason !== expected.reason
    || row.executable !== expected.executable || row.held !== expected.held)
    throw new Error(`${row.id}: status, reason, executable and held fields must describe one consistent disposition`);
}

function requiredP15CheckIds(
  design = readFileSync('docs/19-scheduled-work/08-non-functional-checks-and-activation.md', 'utf8'),
) {
  const range = /P15-NF-(\d+)\s+through\s+P15-NF-(\d+)\s+are distinct\s+contract checks\./.exec(design);
  if (!range) throw new Error('P15 check inventory: section 8 does not declare the required check range');
  const first = Number(range[1]); const last = Number(range[2]);
  if (first !== 1 || last !== 52) throw new Error(`P15 check inventory: unsupported design range ${first} through ${last}`);
  return Array.from({ length: last - first + 1 }, (_, index) =>
    `P15-NF-${String(first + index).padStart(2, '0')}`);
}

function validateDispositionInventory(dispositions) {
  const required = requiredP15CheckIds();
  const ids = dispositions.map(row => row?.id);
  const distinct = new Set(ids);
  const missing = required.filter(id => !distinct.has(id));
  const extra = [...distinct].filter(id => !required.includes(id));
  const duplicates = [...distinct].filter(id => ids.filter(candidate => candidate === id).length > 1);
  if (dispositions.length !== required.length || distinct.size !== required.length || missing.length || extra.length) {
    throw new Error(`P15 check inventory must contain exactly ${required.length} distinct design identities; `
      + `found ${dispositions.length} rows/${distinct.size} distinct; missing=${missing.join(',') || 'none'}; `
      + `extra=${extra.join(',') || 'none'}; duplicate=${duplicates.join(',') || 'none'}`);
  }
}

export function checkP15RequestedDependencies(dispositions = p15Dispositions().filter(isRequestOnlyDisposition)) {
  for (const row of dispositions) {
    validateDispositionIdentity(row);
    if (row.held !== held[row.number] || !isRequestOnlyDisposition(row))
      throw new Error(`${row.id}: request-only disposition does not match its exact unmet owner dependency`);
    for (const file of dependencyFiles(row.held)) {
      const source = readFileSync(resolve(laneDirectory, file), 'utf8');
      if (!row.held.includes(`UNGRANTED-REQUEST-${file}`) || !/^Status: REQUESTED/m.test(source))
        throw new Error(`${row.id}: ${file} is not an exact ungranted request`);
    }
  }
  return dispositions.map(row => ({ id: row.id, held: row.held }));
}

export function auditP15ArchitectureRows(dispositions) {
  for (const row of dispositions) {
    validateDispositionIdentity(row);
  }
  for (const proof of proofFiles) {
    const { file } = proof;
    if (!existsSync(file)) throw new Error(`missing required P15 proof file: ${file}`);
    const source = readFileSync(file, 'utf8');
    if (proof.tokens.some(token => !source.includes(token)))
      throw new Error(`${file}: required proof is missing an executable assertion or process boundary`);
  }
  const proofSource = readFileSync('tests/scheduled/round3-proof.ts', 'utf8');
  for (const token of ['runtime.record(', 'inspectCurrent(', 'decodeScheduledCapacityMeasurement(',
    'importLegacyScheduledJob(']) {
    if (!proofSource.includes(token)) throw new Error(`round-three proof is missing real owner operation ${token}`);
  }
  const ownerProofSource = readFileSync('tests/scheduled/owner-ports.integration.test.ts', 'utf8');
  if (/\bcompletedRun\b/.test(ownerProofSource))
    throw new Error('P15-NF-06 must not count the permissive completedRun fixture as Part Nine validation');
  for (const token of ['closeUnreachable(', 'readScheduledBusinessDisposition(', 'graph.readExit(']) {
    if (!ownerProofSource.includes(token)) throw new Error(`owner-port proof is missing ${token}`);
  }
  if (/P15-NF-(?:06|22|38|45)\b/.test(ownerProofSource))
    throw new Error('isolated Part Five fixtures must not be attributed as independently witnessed P15 owner-composition positives');
  const packageSource = readFileSync('src/scheduled/package.ts', 'utf8');
  for (const token of ['stageLocalCapability(', 'input.archive', 'staged.entries']) {
    if (!packageSource.includes(token)) throw new Error(`scheduled package admission is missing public Part Ten archive validation ${token}`);
  }
  if (proofSource.includes('const durable: unknown[]') || proofSource.includes('const admissions = new Set<string>()'))
    throw new Error('round-three proof must not present retained process-local arrays or admission sets as restart evidence');
  const ledgerPath = resolve(laneDirectory, 'SEAM-LEDGER.md');
  if (!existsSync(ledgerPath)) throw new Error(`missing authoritative seam ledger: ${ledgerPath}`);
  const ledger = readFileSync(ledgerPath, 'utf8');
  const allowed = new Set([...Object.values(held).flatMap(dependencyFiles)]);
  for (const row of dispositions) {
    if (!row.held) continue;
    if (isRequestOnlyDisposition(row))
      throw new Error(`${row.id}: REQUESTED dependency is not granted check-map evidence: ${row.held}`);
    const files = dependencyFiles(row.held);
    const grantIds = dependencyGrantIds(row.held);
    const conditionalRowGrants = [...exactConditionalRowGrants.entries()]
      .filter(([name]) => row.held.includes(name));
    if (!files.length && !grantIds.length && !conditionalRowGrants.length)
      throw new Error(`${row.id}: held disposition has no existing grant evidence`);
    for (const [name, grant] of conditionalRowGrants) {
      const request = readFileSync(resolve(laneDirectory, grant.request), 'utf8');
      const ledgerRow = ledger.split('\n').find(line => line.startsWith(`| ${grant.row} |`));
      if (!/^Status: GRANTED CONDITIONAL\b/m.test(request)
        || !ledgerRow?.includes(grant.request) || !/\| GRANTED CONDITIONAL\b/.test(ledgerRow))
        throw new Error(`${row.id}: ${name} is not granted by ledger row ${grant.row}`);
      for (const responseFile of grant.responses) {
        const response = readFileSync(resolve(laneDirectory, responseFile), 'utf8');
        if (!response.includes(`row ${grant.row}`) || !response.includes('GRANTED CONDITIONAL')
          || !response.includes(grant.grantId))
          throw new Error(`${row.id}: ${name} is missing its exact ${responseFile} grant addendum`);
      }
    }
    for (const file of files) {
      if (!allowed.has(file)) throw new Error(`${row.id}: unrecognized held disposition ${file}`);
      const path = resolve(laneDirectory, file);
      if (!existsSync(path)) throw new Error(`${row.id}: held disposition names nonexistent ${file}`);
      const source = readFileSync(path, 'utf8');
      if (file === calendarRequest || file === runAdmissionRequest) {
        if (!row.held.includes(`UNGRANTED-REQUEST-${file}`) || !/^Status: REQUESTED/m.test(source))
          throw new Error(`${row.id}: ${file} must be labelled as an UNGRANTED REQUEST`);
        if (file === runAdmissionRequest && !/RunAdmissionPort/.test(source))
          throw new Error(`${row.id}: run-admission request does not name the missing owner contract`);
      } else if (file !== 'SEAM-LEDGER.md' && !/GRANTED/i.test(source.slice(0, 2500))) {
        throw new Error(`${row.id}: ${file} does not establish a granted dependency`);
      }
    }
    for (const grantId of grantIds) {
      const grant = namedConditionalGrants.get(grantId);
      if (!grant) throw new Error(`${row.id}: unrecognized conditional grant ${grantId}`);
      const request = readFileSync(resolve(laneDirectory, grant.request), 'utf8');
      const response = readFileSync(resolve(laneDirectory, grant.response), 'utf8');
      const ledgerRow = ledger.split('\n').find(line => line.startsWith(`| ${grant.row} |`));
      if (!request.includes(`Request id: \`${grantId}\``)
        || !ledgerRow?.includes(grant.request) || !/\| GRANTED CONDITIONAL\b/.test(ledgerRow)
        || !response.includes(`row ${grant.row} GRANTED CONDITIONAL: ${grantId}`))
        throw new Error(`${row.id}: ${grantId} is not the exact conditional grant recorded in its request, ledger and addendum`);
    }
    for (const match of row.held.matchAll(/row(?:s)?-([0-9-]+)/g)) for (const number of match[1].split('-').filter(Boolean)) {
      const ledgerRow = ledger.split('\n').find(line => line.startsWith(`| ${number} |`));
      if (!ledgerRow || !/\| (?:GRANTED|ALREADY GRANTED)/.test(ledgerRow))
        throw new Error(`${row.id}: ledger row ${number} is absent or not granted`);
    }
  }
  return { proofFiles: proofFiles.map(proof => proof.file) };
}

export function checkP15Architecture(dispositions = p15Dispositions()) {
  validateDispositionInventory(dispositions);
  return auditP15ArchitectureRows(dispositions);
}

function validateReportedTest(fileName, title) {
  const path = realpathSync(fileName);
  const testsRoot = `${realpathSync(resolve(process.cwd(), 'tests'))}/`;
  if (!path.startsWith(testsRoot)) throw new Error(`${title}: evidence is not a real test file`);
  const source = readFileSync(path, 'utf8'); const offset = source.indexOf(title);
  if (offset < 0) throw new Error(`${title}: reported test title is absent from ${relative(process.cwd(), path)}`);
  const body = source.slice(offset, offset + 6000);
  if (!/(?:expect\(|assert\.|exerciseP15Round3Proof\()/.test(body))
    throw new Error(`${title}: test body does not validate an outcome`);
  return relative(process.cwd(), path);
}

export function auditP15CoverageRows(report, dispositions) {
  if (!report.success) throw new Error('P15 mapping requires a successful actual test run');
  for (const row of dispositions) validateDispositionIdentity(row);
  const requestOnly = dispositions.filter(isRequestOnlyDisposition);
  checkP15RequestedDependencies(requestOnly);
  const mapped = dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults.filter(test => (test.title.match(/\bP15-NF-\d+\b/g) ?? []).includes(row.id))
      .map(test => ({ file: validateReportedTest(file.name, test.title), title: test.title, status: test.status })));
    if (row.executable) {
      if (!tests.length || tests.some(test => test.status !== 'passed')) throw new Error(`${row.id}: EXECUTABLE without exclusively passing real tests`);
      for (const required of requiredExecutableCases.get(row.number) ?? []) {
        if (!tests.some(test => test.file === required.file && test.title === required.title && test.status === 'passed'))
          throw new Error(`${row.id}: incomplete executable evidence; missing ${required.file} :: ${required.title}`);
      }
    } else if (tests.length) throw new Error(`${row.id}: held owner arm is falsely labelled by a local passing test`);
    return { ...row, tests };
  });
  auditP15ArchitectureRows(dispositions);
  return mapped;
}

export function checkP15Coverage(report, dispositions = p15Dispositions()) {
  validateDispositionInventory(dispositions);
  return auditP15CoverageRows(report, dispositions);
}

if (process.argv[1]?.endsWith('check-p15-contract-map.mjs')) {
  const rows = checkP15Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Passing test files |'); console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.filter(row => row.executable).length} checks have executable arms and ${rows.filter(row => !row.executable).length} remain wholly NON-EXECUTABLE-UNTIL named owner grants.`);
}
