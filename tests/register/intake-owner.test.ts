import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { scanSources, checkWiring } from '../../scripts/check-register-wiring.mjs';
import { loadOwnerReferences } from '../../scripts/register-owner-references.mjs';
import { installOwnerFixture } from './owner-fixture.js';
import { installIntakeOwnerFixture, intakeRecords, intakePort } from './intake-owner-fixture.js';

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []);
const sources = () => ({ ...Object.fromEntries(walk('src').map(p => [p, readFileSync(p, 'utf8')])),
 'src/intake/index.ts': "export * from './records.js';", 'src/intake/records.ts': intakeRecords, 'src/intake/port.ts': intakePort });
describe('P4 owner source consumption', () => {
 it.each(['dedup', 'admission', 'receiver'])('R1 executable %s helper replacement removes real input flow and source credit', scope => {
  for (const replacementForm of ['unchanged', 'direct', 'array', 'object', 'loop']) {
   const replaced = replacementForm !== 'unchanged';
   const input = sources();
   const name = scope === 'dedup' ? 'read' : 'context';
   const body = scope === 'dedup' ? '() => []' : '() => ({ ...base, ownedBodies: [] })';
   const helper = replacementForm === 'array' ? `[${name}] = [${body}];`
    : replacementForm === 'object' ? `({ ${name} } = { ${name}: ${body} });`
    : replacementForm === 'loop' ? `for (${name} of [${body}]) {}` : `${name} = ${body};`;
   const code = replaced ? intakePort.replace(`export function ${scope}()`, `${helper}\nexport function ${scope}()`) : intakePort;
   input['src/intake/port.ts'] = code;
   let reads = 0, registrations = 0; let admitted: unknown[] = [], snapshotFacts: unknown[] = [];
   const exports: Record<string, () => void> = {};
   // Execute exactly the scanned source. Instrumented ports measure input flow;
   // this does not assert that P2 accepts an unregistered fact.
   const require = (path: string) => path === '../register/index.js' ? { constructGoverned() {}, readEnforcedRecord() {} }
    : path === '../index.js' ? { decode() {} }
    : path === './index.js' ? { intakeDedupDefinition: () => ({}), intakeWorkRegistration: () => { registrations++; return { owner: 'part-four' }; } }
    : path === '../facts/index.js' ? {
      createFactStore: (c: { ownedBodies: unknown[] }) => ({ read: () => { reads++; return [{ id: 'real' }]; }, append: () => { admitted = c.ownedBodies; } }),
      prepareSnapshot: (facts: unknown[]) => { snapshotFacts = facts; return facts; }, authorAndAppend: (_x: unknown, c: { ownedBodies: unknown[] }) => { admitted = c.ownedBodies; },
     } : { foldProjection: (_d: unknown, facts: unknown[]) => facts, readProjection: (v: unknown) => v };
   new Function('require', 'exports', 'base', 'storage', 'register', 'ctx', 'input', 'key', 'now',
    ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, exports, {}, null, {}, {}, {}, null, 100);
   exports[scope]!();
   if (scope === 'dedup') { expect(reads).toBe(replaced ? 0 : 1); expect(snapshotFacts).toEqual(replaced ? [] : [{ id: 'real' }]); }
   else { expect(registrations).toBe(replaced ? 0 : 1); expect(admitted).toEqual(replaced ? [] : [{ owner: 'part-four' }]); }
   const decoder = scope === 'dedup' ? 'readProjection' : scope === 'admission' ? 'authorAndAppend' : 'createFactStore.append';
   const scanned = scanSources(input), observed = scanned.reports[Object.keys(input).indexOf('src/intake/port.ts')]!.scopes[scope];
   expect(observed?.invokes).toEqual(replaced ? [] : [decoder, scope === 'dedup' ? 'intakeDedupDefinition' : 'intakeWorkRegistration']);
   const declaration = { id: 'intake.' + scope, kind: 'blocking sites', declaredBy: { path: 'src/intake/port.ts', symbol: scope },
    requiredFacts: { decidesAlone: 'governed-state', criticality: 'standing', failDirection: 'closed', preservesInput: 'receipt', enforces: { record: 'intake.contract', decoder } } };
   const issues = checkWiring({ entries: [{ declaration }] }, input, scanned).issues.filter(i => i.startsWith('P3-NF-26'));
   expect(issues.length).toBe(replaced ? 1 : 0);
  }
 }, 30_000);
 it('accepts P4 and P5 independently and together without accepting another owner or an unpinned dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'p4-owner-'));
  try {
   // A merged P5 manifest pins its real test artifacts as well as source/docs.
   for (const p of ['src', 'docs', 'register-source', 'tests']) cpSync(p, join(root, p), { recursive: true });
   installOwnerFixture(root); installIntakeOwnerFixture(root);
   const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
   git('init', '-q'); git('add', '.'); git('commit', '-qm', 'owners');
   const commit = git('rev-parse', 'HEAD'), files = git('ls-tree', '-r', '--name-only', commit).split('\n');
   const p4 = 'register-source/owner-references/part-four.json', p5 = 'register-source/owner-references.json';
   const original = JSON.parse(readFileSync(join(root, p4), 'utf8'));
   const load = (m = original, extra: Record<string, string> = { [p5]: readFileSync(join(root, p5), 'utf8') }) => loadOwnerReferences(root, { commit, files, sources: { ...extra, [p4]: JSON.stringify(m) } });
   expect(load().documents.map(d => d.id)).toEqual(['rungraph.contract', 'intake.contract']);
   expect(load().decoders.find(d => d.id === 'createFactStore.append')).toMatchObject({ symbol: 'createFactStore' });
   expect(load(original, {}).documents[0]).toMatchObject({ id: 'intake.contract', declarationPath: 'src/intake/port.declarations.json' });
   expect(loadOwnerReferences(root, { commit, files, sources: { [p5]: JSON.stringify(original) } }).documents[0]?.id).toBe('intake.contract');
   for (const mutate of [
    (m: typeof original) => { m.owner = 'part-five'; },
    (m: typeof original) => { m.owner = 'part-seven'; },
    (m: typeof original) => { m.owner = ['part-four']; },
    (m: typeof original) => { m.fixtures[0].id = ['P4-NF-06']; },
    (m: typeof original) => { m.decoders[0].id = ['intakeDedupDefinition']; },
    (m: typeof original) => { m.documents[0].id = ['intake.contract']; },
    (m: typeof original) => { m.claims = []; },
    (m: typeof original) => { m.documents[0].id = 'rungraph.contract'; },
    (m: typeof original) => { m.decoders = m.decoders.filter((d: { id: string }) => d.id !== 'intakeWorkRegistration'); },
    (m: typeof original) => { m.decoders = m.decoders.filter((d: { id: string }) => d.id !== 'intakeDedupDefinition'); },
    (m: typeof original) => { m.decoders[0].id = 'decodeInvented'; },
    (m: typeof original) => { m.fixtures[0].id = 'P5-NF-54'; },
    (m: typeof original) => { m.probes[0].execution = 'production'; },
    (m: typeof original) => { m.probes[0].cadence = 0; },
    (m: typeof original) => { m.decoders[2].artifact.hash = 'sha256:wrong'; },
   ]) { const m = structuredClone(original); mutate(m); expect(() => load(m)).toThrow(); }
   expect(() => load(original, { [p5]: JSON.stringify(original) })).toThrow('duplicate owner');
  } finally { rmSync(root, { recursive: true, force: true }); }
 }, 30_000); // Committed artifact verification includes real git subprocesses.
 it('proves the real P2 chain and the registration used by each admission form', () => {
  const input = sources(), report = scanSources(input).reports[Object.keys(input).indexOf('src/intake/port.ts')]!;
  expect(report.scopes.dedup?.invokes).toEqual(['readProjection', 'intakeDedupDefinition']);
  expect(report.scopes.admission?.invokes).toEqual(['authorAndAppend', 'intakeWorkRegistration']);
  expect(report.scopes.receiver?.invokes).toEqual(['createFactStore.append', 'intakeWorkRegistration']);
  expect(report.scopes.authentication?.invokes).toContain('decode:Provenance');
  expect(report.scopes.resolution?.invokes).toContain('decode:VerifiedPrincipal');
  expect(report.scopes.dedup?.reads).toEqual(['intake.contract']);
 });
 it.each([
  ['dedup', 'const definition = intakeDedupDefinition();', 'const definition = fakeDefinition;'],
  ['dedup', 'prepareSnapshot(read(), ctx)', 'prepareSnapshot([], ctx)'],
  ['dedup', 'prepareSnapshot(read(), ctx)', 'prepareSnapshot((read(), []), ctx)'],
  ['dedup', 'foldProjection(definition, snapshot, ctx)', 'foldProjection(fakeDefinition, snapshot, ctx)'],
  ['dedup', 'readProjection(view, definition, now, ctx)', 'readProjection(view, fakeDefinition, now, ctx)'],
  ['dedup', 'const view = foldProjection', 'let view = foldProjection'],
  ['admission', 'ownedBodies: [work]', 'ownedBodies: []'],
  ['admission', 'ownedBodies: [work]', 'ownedBodies: [fakeRegistration]'],
  ['admission', 'ownedBodies: [work]', 'ownedBodies: [work], ...unknown'],
  ['admission', 'authorAndAppend(input, c,', 'authorAndAppend(input, otherContext,'],
  ['receiver', 'const store = createFactStore', 'let store = createFactStore'],
  ['receiver', 'store.append(input)', 'store.append = fake; store.append(input)'],
  ['receiver', 'store.append(input)', 'const alias = store; alias.append = fake; store.append(input)'],
  ['admission', 'const c = context();', 'const c = context(); c.ownedBodies = [];'],
  ['receiver', 'createFactStore(context(), storage); store.append', 'fakeStore; store.append'],
 ])('refuses a broken %s consumer chain (%s)', (scope, from, to) => {
  const input = sources(); input['src/intake/port.ts'] = intakePort.replace(from, to);
  const report = scanSources(input).reports[Object.keys(input).indexOf('src/intake/port.ts')]!;
  expect(report.scopes[scope]?.invokes).toEqual([]);
 });
 it.each([true, false])('recognizes the actual intake Map merge only when it retains fact values (%s)', preserves => {
  const input = sources();
  input['src/intake/port.ts'] = intakePort.replace('return createFactStore(context(), storage).read();',
   `return [...new Map([...prior, ...createFactStore(context(), storage).read()].map(f => [f.id, ${preserves ? 'f' : 'fake'}])).values()];`);
  const scope = scanSources(input).reports[Object.keys(input).indexOf('src/intake/port.ts')]!.scopes.dedup;
  expect(scope?.invokes).toEqual(preserves ? ['readProjection', 'intakeDedupDefinition'] : []);
 });
 it('gives no P1 decoder or P3 guard credit to reassigned namespace receivers', () => {
  const input = sources();
  input['src/intake/port.ts'] = `import * as core from '../index.js'; import * as register from '../register/index.js';
   function gate() { let ns = core; ns = { ...core, decode: () => true }; ns.decode('Provenance', x, c);
   let r = register; r = { ...register, readEnforcedRecord: () => true }; r.readEnforcedRecord('intake.dedup', 'intake.contract', 'readProjection', x, c); }`;
  const scope = scanSources(input).reports[Object.keys(input).indexOf('src/intake/port.ts')]!.scopes.gate;
  expect(scope?.invokes).toEqual([]); expect(scope?.reads).toEqual([]);
 });
 it('checks the guard site and exact declared pair, including multiple legitimate rungs', () => {
  const input = sources();
  const rung = (decoder: string) => ({ decidesAlone: 'governed-state', criticality: 'standing', failDirection: 'closed', preservesInput: 'receipt', enforces: { record: 'intake.contract', decoder } });
  const declaration = { id: 'intake.dedup', kind: 'blocking sites', declaredBy: { path: 'src/intake/port.ts', symbol: 'dedup' }, requiredFacts: rung('readProjection') };
  const register = { entries: [declaration, ...['admission', 'receiver', 'authentication', 'resolution', 'contract'].map(g => ({ id: 'intake.' + g, kind: g === 'contract' ? 'governed documents' : 'other' }))].map(declaration => ({ declaration })) };
  const issues = () => checkWiring(register, input).issues.filter(s => s.startsWith('P3-NF-26'));
  expect(issues()).toEqual([]);
  input['src/intake/port.ts'] = intakePort.replace("readEnforcedRecord('intake.dedup'", "readEnforcedRecord('intake.other'");
  expect(issues().join(' ')).toContain('does not read');
  input['src/intake/port.ts'] = intakePort.replace("'intake.contract', 'readProjection'", "'intake.contract', 'authorAndAppend'");
  expect(issues().join(' ')).toContain('different declared pair');
  input['src/intake/port.ts'] = intakePort.replace("const definition = intakeDedupDefinition();", "readEnforcedRecord('intake.dedup', 'intake.contract', 'intakeDedupDefinition', register, ctx); const definition = intakeDedupDefinition();");
  Object.assign(declaration, { requiredFacts: { rungs: [rung('readProjection'), rung('intakeDedupDefinition')] } });
  expect(issues()).toEqual([]);
 });
});
