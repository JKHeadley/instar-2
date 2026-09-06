// Test-only source/catalog producer. P3 does not ship intake declarations.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hash } from './fixtures.js';

export const intakeRecords = `export function intakeDedupDefinition() { return definition; }
export function intakeWorkRegistration() { return registration; }
export function intakeStopRegistration() { return stopRegistration; }`;
export const intakePort = `import { constructGoverned, readEnforcedRecord } from '../register/index.js';
import { decode } from '../index.js';
import { createFactStore, prepareSnapshot, authorAndAppend } from '../facts/index.js';
import { foldProjection, readProjection } from '../projections/index.js';
import { intakeDedupDefinition, intakeWorkRegistration } from './index.js';
function context() { const work = intakeWorkRegistration(); return { ...base, ownedBodies: [work] }; }
function read() { return createFactStore(context(), storage).read(); }
export function dedup() {
 constructGoverned('blocking sites', 'intake.dedup', register, ctx);
 readEnforcedRecord('intake.dedup', 'intake.contract', 'readProjection', register, ctx);
 const definition = intakeDedupDefinition();
 const snapshot = prepareSnapshot(read(), ctx);
 const view = foldProjection(definition, snapshot, ctx);
 readProjection(view, definition, now, ctx);
}
export function admission() {
 constructGoverned('blocking sites', 'intake.admission', register, ctx);
 readEnforcedRecord('intake.admission', 'intake.contract', 'authorAndAppend', register, ctx);
 const c = context(); authorAndAppend(input, c, createFactStore(c, storage), key);
}
export function receiver() {
 constructGoverned('blocking sites', 'intake.receiver', register, ctx);
 readEnforcedRecord('intake.receiver', 'intake.contract', 'createFactStore.append', register, ctx);
 const store = createFactStore(context(), storage); store.append(input);
}
export function authentication() {
 constructGoverned('blocking sites', 'intake.authentication', register, ctx);
 readEnforcedRecord('intake.authentication', 'intake.contract', 'decode:Provenance', register, ctx);
 decode('Provenance', input, ctx);
}
export function resolution() {
 constructGoverned('blocking sites', 'intake.resolution', register, ctx);
 readEnforcedRecord('intake.resolution', 'intake.contract', 'decode:VerifiedPrincipal', register, ctx);
 decode('VerifiedPrincipal', input, ctx);
}
export function contract() { constructGoverned('governed documents', 'intake.contract', register, ctx); }`;
export function installIntakeOwnerFixture(root: string) {
 const write = (path: string, body: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); };
 write('src/intake/records.ts', intakeRecords);
 write('src/intake/index.ts', "export { intakeDedupDefinition, intakeWorkRegistration, intakeStopRegistration } from './records.js';");
 write('src/intake/port.ts', intakePort);
 const declaration = (id: string, kind: string, requiredFacts: object, extra = {}) => ({ type: 'Declaration', schemaVersion: 1, id, kind, status: 'live', requiredFacts, standards: [], holds: [], ...extra });
 const profile = { type: 'Profile', schemaVersion: 1, consequence: 'none', reversibility: 'reversible', reach: 'internal', surface: 'none', repeats: { kind: 'no' } };
 write('src/intake/port.declarations.json', JSON.stringify([
  declaration('intake.contract', 'governed documents', { location: 'docs/08-the-intake.md', changelog: 'git-history:docs/08-the-intake.md' }),
  ...Object.entries({ dedup: 'readProjection', admission: 'authorAndAppend', receiver: 'createFactStore.append', authentication: 'decode:Provenance', resolution: 'decode:VerifiedPrincipal' }).map(([gate, decoder]) => declaration('intake.' + gate, 'blocking sites', {
   authority: 'block', decidesAlone: 'governed-state', criticality: 'Standing and admission', failDirection: 'closed', preservesInput: 'part-two:intake-receipt', inspectedBy: 'P4-NF-06', enforces: { record: 'intake.contract', decoder },
  }, { profile })),
 ]));
 write('tests/intake/governance.test.ts', '// Test-only pinned inspection artifact P4-NF-06\n');
 write('tests/intake/scope.test.ts', '// Test-only pinned CI workload P4-NF-29\n');
 const artifact = (path: string) => ({ path, hash: hash(readFileSync(join(root, path), 'utf8')) });
 write('register-source/owner-references/part-four.json', JSON.stringify({ schemaVersion: 1, owner: 'part-four',
  fixtures: [{ id: 'P4-NF-06', stage: 'build', artifact: artifact('tests/intake/governance.test.ts') }],
  probes: [{ id: 'P4-NF-29', cadence: 1000, execution: 'ci', artifact: artifact('tests/intake/scope.test.ts') }],
  decoders: [
   ...['intakeDedupDefinition', 'intakeWorkRegistration'].map(id => ({ id, module: artifact('src/intake/index.ts'), artifact: artifact('src/intake/records.ts') })),
   { id: 'readProjection', module: artifact('src/projections/index.ts'), artifact: artifact('src/projections/fold.ts') },
   ...['authorAndAppend', 'createFactStore.append'].map(id => ({ id, module: artifact('src/facts/index.ts'), artifact: artifact('src/facts/store.ts') })),
   ...['decode:Provenance', 'decode:VerifiedPrincipal'].map(id => ({ id, module: artifact('src/index.ts'), artifact: artifact('src/decode/decode.ts') })),
  ], documents: [{ id: 'intake.contract', artifact: artifact('docs/08-the-intake.md') }],
 }));
}
