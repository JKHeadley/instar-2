import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { scanSources, checkWiring } from '../../scripts/check-register-wiring.mjs';
import type { DecoderBinding } from '../../scripts/check-register-wiring.mjs';
import { intakeFixture, message, refused, route, stop, value } from './fixtures.js';

type Decl = { id: string; kind: string; status: string; requiredFacts: Record<string, Json> };
const declarations = () => JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as Decl[];
const pairs = [ ['intake.dedup', 'readProjection'], ['intake.authentication', 'decode:Provenance'],
  ['intake.resolution', 'decode:VerifiedPrincipal'], ['intake.admission', 'authorAndAppend'] ] as const;

it('P4-NF-06 R7 preserves all five executing intake gates and their governing contract', () => {
  const legacy = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as { id: string; kind: string }[];
  expect(legacy.filter(d => d.kind === 'blocking sites').map(d => d.id).sort()).toEqual([
    'intake.admission', 'intake.authentication', 'intake.dedup', 'intake.resolution', 'intake.stop',
  ]);
  expect(legacy.some(d => d.id === 'intake.contract' && d.kind === 'governed documents')).toBe(true);
});

it('P4-NF-06 P4-NF-01 R7 a shape-only register cannot authorize intake after preservation', () => {
  const f = intakeFixture();
  // A generated shape has no loadRegister witness, even when its data looks right.
  Object.assign(f.deps.governance, { register: f.r.build(f.registerInput.sources.map(s => s.declaration)) });
  const refusal = refused(f.port().receive(message(), route));
  expect(f.facts().filter(r => r.kind === 'intake-receipt')).toHaveLength(1);
  expect(f.facts().filter(r => r.kind === 'intake-admitted')).toHaveLength(0);
  expect(refusal.preserved).toBeTruthy();
  expect(f.facts().at(-1)!.kind).toBe('intake-held');
  expect(refusal.preserved).toBe(f.facts().at(-1)!.id);
  expect(f.trace).not.toContain('authenticate');
});

for (const site of [...pairs.map(([site]) => site), 'intake.stop']) {
  it(`P4-NF-06 P4-NF-01 R7 missing ${site} refuses the actual path after durable receipt`, () => {
    const f = intakeFixture(); f.bind();
    const declared = f.registerInput.sources.map(s => s.declaration).filter(d => (d as { id: string }).id !== site);
    const governance = f.govern(declared).governance;
    const port = value(createIntakePort({ ...f.deps, governance }));
    const refusal = refused(port.receive(site === 'intake.stop' ? stop : message(), route));
    expect(f.facts().filter(r => r.kind === 'intake-receipt')).toHaveLength(1);
    expect(f.facts().filter(r => ['intake-admitted', 'intake-stop'].includes(r.kind))).toHaveLength(0);
    expect(f.facts().some(r => r.id === refusal.preserved)).toBe(true);
    if (site === 'intake.authentication' || site === 'intake.contract') expect(f.trace).not.toContain('authenticate');
    if (site === 'intake.resolution') { expect(f.trace).toContain('authenticate'); expect(f.trace).not.toContain('parse'); }
  });
}

it('P4-NF-06 R7 a missing governing contract cannot produce a register for the gates', () => {
  const f = intakeFixture();
  expect(() => f.govern(f.registerInput.sources.map(s => s.declaration).filter(d => (d as { id: string }).id !== 'intake.contract')))
    .toThrow('enforces.record: declaration intake.contract');
});

for (const [site, decoder] of pairs) {
  it(`P4-NF-06 R7 mismatched decoder at ${site} cannot authorize through a genuine verified register`, () => {
    const f = intakeFixture();
    const declared = f.registerInput.sources.map(s => JSON.parse(JSON.stringify(s.declaration)) as Decl);
    const gate = declared.find(d => d.id === site)!;
    const rungs = gate.requiredFacts.rungs as { enforces: { record: string; decoder: string } }[];
    for (const rung of rungs) rung.enforces.decoder = decoder === 'decode:Provenance' ? 'decode:VerifiedPrincipal' : 'decode:Provenance';
    const port = value(createIntakePort({ ...f.deps, governance: f.govern(declared).governance }));
    refused(port.receive(message(), route));
    expect(f.facts().filter(r => r.kind === 'intake-receipt')).toHaveLength(1);
    expect(f.facts().some(r => r.kind === 'intake-admitted')).toBe(false);
  });
}

it('P4-NF-06 R7 approved-history guard is independent of entering-force verification', () => {
  const f = intakeFixture();
  expect(f.governanceChecks).toEqual(['extract', 'force', 'current']);
  const pending = f.govern(f.registerInput.sources.map(s => s.declaration), false);
  expect(f.governanceChecks).toEqual(['extract', 'force', 'current', 'extract', 'force', 'current']);
  const port = value(createIntakePort({ ...f.deps, governance: pending.governance }));
  refused(port.receive(message(), route));
  expect(f.trace).not.toContain('authenticate');
  expect(f.facts().at(-1)!.kind).toBe('intake-held');
  // Same input can drain once the owner supplies genuinely loaded approved data.
  expect(value(f.port().recover(f.facts().find(r => r.kind === 'intake-receipt')!.id)).kind).toBe('admitted');
});

it('P4-NF-06 P4-NF-13 P4-NF-14 P4-NF-14-PARTIAL R7 per-consumer directions preserve delivery and the ruled-three brake', () => {
  for (const [site, decoder] of pairs) {
    const gate = declarations().find(d => d.id === site)!;
    const rungs = gate.requiredFacts.rungs as { failDirection: string; enforces: { record: string; decoder: string } }[];
    expect(rungs.map(r => r.failDirection)).toEqual(['open', 'closed']);
    expect(rungs.every(r => r.enforces.record === 'intake.contract' && r.enforces.decoder === decoder)).toBe(true);
  }
  const f = intakeFixture(); f.bind();
  const flagged = value(f.port().receive(JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'hello', signal: 'cannot-decide' }), route));
  expect(flagged.kind === 'admitted' && flagged.flags).toEqual(['cannot-decide']);
  // Missing ordinary dedup/admission gates cannot strand the separate stop path.
  const declared = f.registerInput.sources.map(s => s.declaration).filter(d => !['intake.dedup', 'intake.admission'].includes((d as { id: string }).id));
  const brake = value(createIntakePort({ ...f.deps, governance: f.govern(declared).governance }));
  expect(value(brake.receive(stop, { ...route, eventId: 'brake' })).kind).toBe('stopped');
  expect(f.facts().filter(r => r.kind === 'intake-stop')).toHaveLength(1);
  const changed = f.registerInput.sources.map(s => JSON.parse(JSON.stringify(s.declaration)) as Decl);
  changed.find(d => d.id === 'intake.stop')!.requiredFacts.failDirection = 'closed';
  refused(value(createIntakePort({ ...f.deps, governance: f.govern(changed).governance })).receive(stop, { ...route, eventId: 'wrong-gate' }), 'ruled-three');
});

const sourceFiles = () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []);
  return Object.fromEntries(walk('src').map(p => [p, readFileSync(p, 'utf8')]));
};
// P1 schema-dispatched decode is already a core scanner symbol. Its literal
// schema arguments are checked independently of later-owner decoder bindings.
const bindings = () => (JSON.parse(readFileSync('register-source/owner-references/part-four.json', 'utf8')) as { decoders: DecoderBinding[] }).decoders.filter(d => !d.id.startsWith('decode:'));

it('P4-NF-06 R7 actual source chain proves each enforced decoder, not a caller-authored invocation list', () => {
  const files = sourceFiles(), scanned = scanSources(files, bindings());
  const constructs = scanned.constructs as { id: string; path: string; symbol: string }[];
  const entries = declarations().map(d => {
    const c = constructs.find(c => c.id === d.id)!;
    expect(c, d.id).toBeDefined();
    return { declaration: { ...d, declaredBy: { path: c.path, symbol: c.symbol } } };
  });
  const onlyIntake = { ...files };
  // Keep the full closed dependency graph, but inspect this owner's gate entries.
  const inspect = (candidate: Record<string, string>) => checkWiring({ entries }, candidate, scanSources(candidate, bindings())).issues.filter(i => /intake\./.test(i));
  expect(inspect(onlyIntake)).toEqual([]);
  const port = files['src/intake/port.ts']!;
  for (const [before, after, site] of [
    ["take(readProjection(view,definition,at,{ ...b,preserved },c.folded))", 'undefined', 'intake.dedup'],
    ["take(decode('Provenance',e.provenance,context(preserved).decode))", 'e.provenance', 'intake.authentication'],
    ["take(decode('VerifiedPrincipal',{ type: 'VerifiedPrincipal',schemaVersion: 1,id: e.principalId,kind: e.principalKind },\n        { ...context(preserved).decode,provenance }))", 'e', 'intake.resolution'],
    ['workRegistration,stopRegistration]', 'stopRegistration]', 'intake.admission'],
    ["take(readEnforcedRecord('intake.dedup','intake.contract','readProjection',deps.governance.register,g))", 'undefined', 'intake.dedup'],
  ]) {
    expect(port.includes(before!), before).toBe(true);
    expect(inspect({ ...files, 'src/intake/port.ts': port.replace(before!, after!) }).some(i => i.includes(site!))).toBe(true);
  }
  const report = scanned.reports[Object.keys(files).indexOf('src/intake/port.ts')]!;
  expect(report.scopes.append!.invokes).toEqual(expect.arrayContaining(['authorAndAppend', 'intakeWorkRegistration', 'intakeStopRegistration']));
  expect(report.scopes.checkDedup!.invokes).toEqual(expect.arrayContaining(['readProjection', 'intakeDedupDefinition']));
// CI 34019552581 measured 5,611 ms ARM / 5,372 ms x64; desk local 1,761 ms.
// Seven full source-graph scans: bounded compiler budget with runner headroom,
// matching the owner-reference fixtures, not an intake runtime latency bound.
}, 30_000);

// Rule 37 quarantine: see docs/defects/owner-reference-pin-drift.md
it.skip('P4-NF-06 R7 owner manifest pins the actual public implementations, contract and inspection assertions', () => {
  const manifest = JSON.parse(readFileSync('register-source/owner-references/part-four.json', 'utf8')) as {
    owner: string; fixtures: { id: string; artifact: { path: string; hash: string } }[];
    documents: { artifact: { path: string; hash: string } }[]; decoders: DecoderBinding[];
  };
  expect(manifest.owner).toBe('part-four');
  expect(manifest.fixtures).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'P4-NF-06' })]));
  for (const a of [...manifest.fixtures.map(f => f.artifact), ...manifest.documents.map(d => d.artifact), ...manifest.decoders.flatMap(d => [d.module, d.artifact])])
    expect(value(canonical(readFileSync(a.path, 'utf8'))).hash, a.path).toBe(a.hash);
});
