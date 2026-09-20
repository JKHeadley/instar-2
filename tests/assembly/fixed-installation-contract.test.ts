import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { authorizationRequestDigest, canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { FactEnvelope, FactSchema, OwnedShape } from '../../src/facts/index.js';
import { intakeVerifiedActRegistration } from '../../src/intake/index.js';
import { decodeGenerationRecord, generateRegister, generationOf, loadRegister } from '../../src/register/index.js';
import { recordProductionInstallation, registerProductionInstallationBody, productionInstallationSchemas } from '../../src/assembly/production-installation.js';
import { recordInstallationSelection, registerInstallationSelectionBody, installationSelectionSchemas, decodeInstallationSelectionAtOrigin, decodeHistoricalInstallationSelection } from '../../src/assembly/installation-selection.js';
import { reportInstallationHolds } from '../../src/assembly/production-installation-report.js';
import { productionMissingBindings } from '../../src/assembly/production-holds.js';
import type { InstallationRecordAdmission, InstallationRecordWriter } from '../../src/assembly/installation-selection.js';
import { intakeFixture, json, value } from '../intake/fixtures.js';
import { privateKey, refused } from '../facts/fixtures.js';

const digest = (input: unknown) => value(canonical(input)).hash;
export interface FixedRecordOptions {
  /** Scope id carried by every selection and the approved package; defaults to the original fixture value. */
  readonly scopeId?: string;
  /** Additional fixture-approved declaration sources, keyed to the owner directory named in each path. */
  readonly extraSources?: (f: ReturnType<typeof intakeFixture>) => readonly { declaration: object; path: string; symbol: string }[];
}
export function fixedRecordFixture(chooseRecords?: (input: { generation: string; scopeId: string; boundary: import('../../src/index.js').DecodeContext & import('../../src/index.js').BoundaryContext; fixture: ReturnType<typeof intakeFixture> }) => Json[],
  options: FixedRecordOptions = {}) {
  const f = intakeFixture();
  const scopeId = options.scopeId ?? 'project-a';
  const extra = [
    f.r.declaration('rungraph.contract', 'governed documents', { location: 'docs/09-the-run-graph.md', changelog: 'git-history:docs/09-the-run-graph.md' }),
    f.r.declaration('installation-replay-matrix', 'governed documents', { location: 'docs/14-the-assembly/16-the-fixed-single-machine-installation-contract.md', changelog: 'git-history:docs/14-the-assembly.changelog.md' }),
    f.r.declaration('installation-artifacts', 'protected artifacts', { pattern: 'src/assembly/**', why: 'fixture-admitted scope artifact class', surface: 'operator approval' }),
    f.r.declaration('installation-replay', 'governed documents', { location: 'docs/14-the-assembly/16-the-fixed-single-machine-installation-contract.md',
      changelog: 'git-history:docs/14-the-assembly.changelog.md' }),
  ];
  const runDeclarations = (JSON.parse(readFileSync('src/rungraph/rungraph.declarations.json', 'utf8')) as typeof extra).map(declaration => ({ ...declaration, status: 'live', requiredFacts: { ...declaration.requiredFacts, ...(declaration.kind === 'features' ? { liveProof: 'fixture-admitted:rungraph' } : {}) } }));
  Object.assign(f.r.context, { references: [...f.r.context.references!, { provider: 'record', id: 'fixture-admitted:rungraph', kind: 'e2e-run' }, { provider: 'fixture', id: 'P5-NF-54' }, { provider: 'probe', id: 'P5-NF-55' },
    ...['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit', 'decodeSessionGrounding'].map(id => ({ provider: 'decoder', id }))] });
  const bodyDeclarations = (JSON.parse(readFileSync('src/assembly/assembly.declarations.json', 'utf8')) as typeof extra)
    .filter(declaration => ['assembly-InstallationSelection', 'assembly-ProductionSignerReference'].includes(declaration.id))
    .map(declaration => ({ declaration: { ...declaration, status: 'live' }, path: 'src/assembly/assembly.declarations.json', symbol: declaration.id }));
  const sources = [...f.registerInput.sources, ...bodyDeclarations, ...runDeclarations.map(declaration => ({ declaration, path: 'src/rungraph/rungraph.ts', symbol: declaration.id })),
    { declaration: f.r.declaration('part-two:run-input'), path: 'src/facts/store.ts', symbol: 'preserve' },
    ...extra.filter(declaration => declaration.id !== 'rungraph.contract').map((declaration, i) => ({ declaration,
    path: 'src/assembly/production-installation-replay.ts', symbol: declaration.id })),
    ...(options.extraSources?.(f) ?? [])];
  const registerContext = { ...f.r.context, register: { ...f.r.context.types.register, ...f.r.context.register,
    entries: [...f.r.context.register.entries, ...sources.map(source => (source.declaration as { id: string }).id)] } };
  registerContext.types = { ...registerContext.types, register: registerContext.register };
  const extract = { ...f.r.extract, rows: sources.map(source => ({ id: (source.declaration as { id: string }).id,
    version: `fixture-version:${(source.declaration as { id: string }).id}`, status: 'live', since: 'fixture-commit', supersedes: [],
    approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: `fixture-approval:${(source.declaration as { id: string }).id}` },
    landedIn: 'fixture-commit', base: 'fixture-base', contentHash: digest(source.declaration) })) };
  const generated = value(generateRegister({ ...f.registerInput, sources, extract }, registerContext));
  const generation = value(generationOf(generated, registerContext));
  const generationRecord = value(decodeGenerationRecord({ type: 'GenerationRecord', schemaVersion: 1, generation, at: f.f.now }, registerContext));
  // The explicitly labelled landed register fixture supplies owner evidence;
  // source-only register bytes still pass Three's genuine runtime loader.
  const register = value(loadRegister(generated, generation, registerContext, { owner: 'part-two',
    verifyExtract: () => f.f.success({ owner: 'part-two', name: 'FactEnvelope', id: 'fixture-extract' }),
    enteringForce: () => f.f.success(generationRecord), isCurrent: () => f.f.success(true) }, f.f.now));
  const generationRef = { owner: 'part-three', name: 'RegisterGeneration', id: generation.id } as const;
  Object.assign(f.deps, { governance: { register, context: registerContext } });
  Object.assign(f.context, { decode: { ...f.context.decode, register: { ...f.context.decode.register,
    generation: generationRef, entries: [...f.context.decode.register.entries, 'installation-replay'] } } });
  const boundary = { ...f.context.decode, site: f.context.site, preserved: f.context.preserved, register: f.context.decode.register };
  f.bind();
  const text: OwnedShape = { kind: 'text', maxLength: 4096 }, integer: OwnedShape = { kind: 'integer' };
  const ref: OwnedShape = { kind: 'object', fields: { owner: text, name: text, id: text } };
  const generationShape: OwnedShape = { kind: 'object', fields: { type: text, schemaVersion: integer,
    generation: { kind: 'object', fields: { type: text, schemaVersion: integer, id: text, commit: text, vector: ref } },
    at: { kind: 'object', fields: { type: text, schemaVersion: integer,
      subject: { kind: 'object', fields: { kind: text, instance: text } }, value: integer, unit: text, at: integer, by: text } } } };
  const generationSchema: FactSchema = { kind: 'generation-record', version: 1,
    fields: { record: { kind: 'owned', owner: 'part-three', name: 'GenerationRecord' } }, machineScope: 'shared',
    standing: 'operator', action: 'work', scope: f.f.scope, causallyBound: true, requiredReferences: [], authority: 'none' };
  const registration = value(registerOwnedBody({ name: 'GenerationRecord', owner: 'part-three', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: input => ({ ok: true, value: value(decodeGenerationRecord(input, registerContext)) }) }, generationShape, boundary));
  Object.assign(f.context, { schemas: [...f.context.schemas, ...productionInstallationSchemas(f.f.scope), generationSchema],
    ownedBodies: [registration, value(registerProductionInstallationBody(boundary)),
      value(intakeVerifiedActRegistration(boundary, f.deps.author.principal.id, generationRef))] });
  const store = createFactStore(f.context, f.storage);
  const root = f.facts().find(fact => fact.kind === 'genesis-grant')!;
  const secret = (name: string) => ({ type: 'SecretRef', schemaVersion: 1, vault: 'vault', name });
  const installation = { type: 'ProductionInstallation', schemaVersion: 1, id: 'host', generation: generation.id,
    botDeclaration: 'phone-surface', providerRoute: 'route', machineIdentity: 'machine-a', storageRoot: '/tmp/fixed-record-fixture',
    botCredential: secret('bot'), providerCredential: secret('provider'), storageCredential: secret('storage') };
  const installationFact = value(recordProductionInstallation({ record: installation, context: f.context, boundary,
    store, privateKey, principal: f.f.alice, at: f.f.now, required: [root.id] }));
  const generationFact = value(authorAndAppend({ kind: 'generation-record', schemaVersion: 1, machine: 'machine-a',
    principal: json(f.f.alice), provenance: json(f.f.alice.provenance), at: json(f.f.now),
    body: { record: json(generationRecord) }, required: [root.id] }, f.context, store, privateKey)).fact;
  const fields = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a', scope: scopeId,
    role: 'minimal-plane-replay', instance: 'source-only', implementation: 'installation-replay', owner: 'part-ten',
    generation: generation.id, references: ['installation-replay', 'installation-replay-matrix'], validUntil: 'not-time-bound' };
  const record = { ...fields, id: digest(fields) };
  const records: Json[] = chooseRecords ? chooseRecords({ generation: generation.id, scopeId, boundary, fixture: f }) : [json(record)];
  const packageDigest = digest({ installation: 'host', scope: scopeId, generation: generation.id, records });
  f.f.capture(value(canonical({ installation: 'host', scope: scopeId, generation: generation.id, records })).bytes, packageDigest);
  f.syncCaptures();
  const requestDigest = authorizationRequestDigest({ approver: f.f.alice, action: { kind: 'work', scope: f.f.scope },
    artifact: packageDigest, base: 'host' });
  Object.assign(f.context, { decode: { ...f.context.decode, currentBase: 'host', artifact: packageDigest } });
  const priorGrants = [...f.context.grants];
  const act = f.verifiedAct({ request: { artifact: packageDigest, base: 'host', requestDigest }, generation: generationRef });
  Object.assign(f.context, { grants: [...priorGrants, ...f.context.grants] });
  const approved = value(f.port().admitVerifiedAct(act.input));
  const admission: InstallationRecordAdmission = { boundary, scope: f.f.scope, scopeId,
    installationFact: installationFact.id, generationFact: generationFact.id, approvalFact: approved.fact.id,
    packageRecords: records, generation: { register, context: registerContext } };
  Object.assign(f.context, { schemas: [...f.context.schemas, ...installationSelectionSchemas(f.f.scope)],
    ownedBodies: [...f.context.ownedBodies!, value(registerInstallationSelectionBody(admission))] });
  const writer: InstallationRecordWriter = { admission, context: f.context, store: createFactStore(f.context, f.storage),
    principal: f.f.alice, at: f.f.now, privateKey };
  return { f, record, records, writer, admission };
}

// The fixture above is shared with the production fixtures; register these cases only when this
// file is the collected test path so importers do not re-run them.
function collectedInThisFile(): boolean { try { return expect.getState().testPath?.endsWith('fixed-installation-contract.test.ts') ?? false; } catch { return false; } }
const collectedHere = collectedInThisFile();
const describeHere: typeof describe = collectedHere ? describe : (() => undefined) as unknown as typeof describe;
const itHere: typeof it = collectedHere ? it : (() => undefined) as unknown as typeof it;
describeHere('P10-SI-06/23 owner installation selection admission', () => {
  it('appends an independently approved selection once and reuses the exact durable fact', () => {
    const { f, record, writer } = fixedRecordFixture();
    const first = value(recordInstallationSelection(record, writer));
    const count = f.frames.length;
    expect(value(recordInstallationSelection(record, writer))).toEqual(first);
    expect(f.frames.length).toBe(count);
  });
  it.each(['wrong-owner', 'free-role', 'omitted-role', 'unequal-id', 'requester'])('refuses %s through the owner producer without appending', kind => {
    const { f, record, writer } = fixedRecordFixture(), input: Record<string, unknown> = { ...record };
    if (kind === 'wrong-owner') input.owner = 'part-nine';
    if (kind === 'free-role') input.role = 'made-up';
    if (kind === 'omitted-role') delete input.role;
    if (kind === 'unequal-id') input.instance = 'different';
    const count = f.frames.length;
    refused(recordInstallationSelection(input, kind === 'requester' ? { ...writer, principal: f.f.bob } : writer));
    expect(f.frames.length).toBe(count);
  });
});

// These fixtures carry real owner-produced envelopes but explicitly fixture-admitted
// register approvals. They never count as installed production evidence.
describeHere('P10-SI-23 historical and current configuration boundaries', () => {
  it('historical decoding needs the signed original and origin decoding needs the active guard', () => {
    const f = fixedRecordFixture(), origin = value(recordInstallationSelection(f.record, f.writer));
    const context = { ...f.admission.boundary, origin, mode: 'historical' as const, facts: { ...f.f.context, facts: f.f.facts() } };
    expect(value(decodeHistoricalInstallationSelection(f.record, context, f.admission))).toEqual(f.record);
    refused(decodeInstallationSelectionAtOrigin(f.record, { ...context, mode: 'origin' }, f.admission), 'active owner');
    refused(decodeHistoricalInstallationSelection(f.record, { ...context, origin: { ...origin, signature: '00' } }, f.admission));
    refused(decodeHistoricalInstallationSelection(f.record, context, { ...f.admission, approvalFact: f.admission.installationFact }));
  });
  it('a new immutable digest cannot replace the same role instance', () => {
    const f = fixedRecordFixture(); value(recordInstallationSelection(f.record, f.writer));
    const count = f.f.frames.length, { id: _id, ...fields } = f.record;
    const changed = { ...fields, validUntil: value(canonical(f.f.f.now)).bytes };
    refused(recordInstallationSelection({ ...changed, id: digest(changed) }, f.writer));
    expect(f.f.frames.length).toBe(count);
  });
  it.each(['protected', 'unprotected-permitted'])('admits only the exact approved %s scope selection', requirement => {
    const f = fixedRecordFixture(({ generation, scopeId }) => {
      const fields = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a', scope: scopeId,
        role: 'scope-protection', instance: requirement, implementation: 'installation-replay', owner: 'part-ten', generation,
        references: ['installation-artifacts', 'installation-replay'], validUntil: 'not-time-bound' };
      return [json({ ...fields, id: digest(fields) })];
    });
    const fact = value(recordInstallationSelection(f.records[0], f.writer));
    expect(fact.kind).toBe('assembly-InstallationSelection');
    const changed = { ...(f.records[0] as object), instance: 'anything-goes' };
    refused(recordInstallationSelection(changed, f.writer), 'unknown scope protection');
  });
  it('refuses omitted role-specific references and approval substituted by a config fact', () => {
    const f = fixedRecordFixture(); const { id: _id, ...fields } = f.record;
    const changed = { ...fields, references: ['installation-replay'] };
    refused(recordInstallationSelection({ ...changed, id: digest(changed) }, f.writer));
    refused(recordInstallationSelection(f.record, { ...f.writer, admission: { ...f.admission, approvalFact: f.admission.installationFact } }));
  });
});

itHere('P10-SI-23 admits a bounded system import only with its exact package action', () => {
  const f = fixedRecordFixture(), system = f.f.f.principal('host', 'system');
  f.f.syncCaptures();
  const count = f.f.frames.length;
  refused(recordInstallationSelection(f.record, { ...f.writer, principal: system }), 'exact current import grant');
  expect(f.f.frames.length).toBe(count);
  const packageDigest = digest({ installation: f.record.installation, scope: f.admission.scopeId,
    generation: f.record.generation, records: f.records });
  const action = `installation-import:${digest(['assembly-InstallationSelection', f.record.installation, f.admission.scopeId, packageDigest])}`;
  for (const context of [f.f.f.ctx.decode, f.f.context.decode]) Object.assign(context, { register: { ...context.register,
    actions: { ...context.register.actions, [action]: { protected: false, repository: false } } } });
  const grantInput = f.f.f.grantInput({ id: 'bounded-package-import', grantee: system, standing: 'delegate',
    actions: [action, 'work'], expiresAt: 400 });
  const grant = value(decode('StandingGrant', grantInput.input, { ...grantInput.context,
    register: { ...grantInput.context.register, actions: { ...grantInput.context.register.actions,
      [action]: { protected: false, repository: false } } } }));
  f.f.syncCaptures();
  const context = { ...f.f.context, decode: { ...f.f.context.decode, provenance: grant.source } };
  const fact = value(authorAndAppend({ kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a',
    principal: json(f.f.f.alice), provenance: json(grant.source), at: json(f.f.f.now), body: { grant: json(grant) }, required: [] },
  context, createFactStore(context, f.f.storage), privateKey)).fact;
  Object.assign(f.f.context, { grants: [...f.f.context.grants, { factId: fact.id, grant }] });
  const recorded = value(recordInstallationSelection(f.record, { ...f.writer, principal: system }));
  expect(recorded.principal.id).toBe(system.id);
  expect(recorded.predecessors.required).toContain(fact.id);
});

// GRANT M3-E: historical validation may reuse pure work only under the complete consumed inputs.
describeHere('P10-SI-23 M3-E historical reuse is keyed on every consumed input', () => {
  const cold = (f: ReturnType<typeof fixedRecordFixture>, _origin: FactEnvelope, context: Parameters<typeof decodeHistoricalInstallationSelection>[1]) => {
    // A fresh admission object is a fresh memo scope, so this decode cannot reuse any cached verdict.
    const admission = { ...f.admission };
    Object.assign(f.f.context, { ownedBodies: [...f.f.context.ownedBodies!.filter(row => row.owner !== 'part-ten' || row.name !== 'InstallationSelection'), value(registerInstallationSelectionBody(admission))] });
    return decodeHistoricalInstallationSelection(f.record, { ...context, facts: { ...context.facts, ownedBodies: f.f.context.ownedBodies! } }, admission);
  };
  it('reuses an unchanged historical validation and re-validates when same-size evidence changes', () => {
    const f = fixedRecordFixture(), origin = value(recordInstallationSelection(f.record, f.writer));
    const facts = { ...f.f.context, facts: f.f.facts() };
    const context = { ...f.admission.boundary, origin, mode: 'historical' as const, facts };
    expect(value(decodeHistoricalInstallationSelection(f.record, context, f.admission))).toEqual(f.record);
    // Same-size schema change: one schema gains a field; the collection length and generation label are unchanged.
    const schemas = facts.schemas.map((schema, i) => i === 0 ? { ...schema, fields: { ...schema.fields, extra: { kind: 'text' as const, maxLength: 1 } } } : schema);
    const changedSchemas = { ...context, facts: { ...facts, schemas } };
    const warm = decodeHistoricalInstallationSelection(f.record, changedSchemas, f.admission);
    const reference = cold(f, origin, changedSchemas);
    expect(warm.kind).toBe(reference.kind);
    // Same-size key change: the selected machine key's permitted range moves; the signed origin must no longer verify.
    const keys = facts.keys.map((key, i) => i === 0 ? { ...key, from: { ...key.from, position: key.from.position + 1 } } : key);
    const changedKeys = { ...context, facts: { ...facts, keys } };
    const warmKeys = decodeHistoricalInstallationSelection(f.record, changedKeys, f.admission);
    expect(warmKeys.kind).toBe(cold(f, origin, changedKeys).kind);
    // Changed admission data under the same object identity: a different approval fact must not reuse the verdict.
    const swapped = { ...f.admission, approvalFact: f.admission.installationFact };
    refused(decodeHistoricalInstallationSelection(f.record, context, swapped));
    // Changed package records at the same count: the verdict is not reused.
    const otherRecord = { ...f.record, references: [...f.record.references].reverse() };
    const repackaged = { ...f.admission, packageRecords: [json(otherRecord)] };
    refused(decodeHistoricalInstallationSelection(f.record, context, repackaged));
    // The unchanged context still reuses and still agrees with a cold decode.
    expect(value(decodeHistoricalInstallationSelection(f.record, context, f.admission))).toEqual(value(cold(f, origin, context)));
  });
  it('a warm historical success never makes an inactive or stale origin pass, and the genuine producer still succeeds', () => {
    const f = fixedRecordFixture(), origin = value(recordInstallationSelection(f.record, f.writer));
    const context = { ...f.admission.boundary, origin, mode: 'historical' as const, facts: { ...f.f.context, facts: f.f.facts() } };
    expect(value(decodeHistoricalInstallationSelection(f.record, context, f.admission))).toEqual(f.record);
    refused(decodeInstallationSelectionAtOrigin(f.record, { ...context, mode: 'origin' }, f.admission), 'active owner');
    const stale = { ...context, mode: 'origin' as const, facts: { ...context.facts, decode: { ...context.facts.decode,
      register: { ...context.facts.decode.register, generation: { ...context.facts.decode.register.generation, id: 'generation:stale' } } } } };
    refused(decodeInstallationSelectionAtOrigin(f.record, stale, f.admission));
    // The genuine producer path (which sets the active guard itself) still returns the exact durable fact.
    expect(value(recordInstallationSelection(f.record, f.writer))).toEqual(origin);
  });
});

itHere('REVIEW T1: equal-content unissued Three register cannot reuse a warm selection', () => {
  const f = fixedRecordFixture(), origin = value(recordInstallationSelection(f.record, f.writer));
  const context = { ...f.admission.boundary, origin, mode: 'historical' as const, facts: { ...f.f.context, facts: f.f.facts() } };
  value(decodeHistoricalInstallationSelection(f.record, context, f.admission));
  Object.assign(f.admission.generation, { register: { ...f.admission.generation.register } });
  const warm = decodeHistoricalInstallationSelection(f.record, context, f.admission);
  const cold = decodeHistoricalInstallationSelection(f.record, context, { ...f.admission });
  refused(cold);
  expect(warm.kind).toBe(cold.kind);
});
itHere('REVIEW T1: changed ancestor signature with unchanged contentHash cannot reuse a warm selection', () => {
  const f = fixedRecordFixture(), origin = value(recordInstallationSelection(f.record, f.writer));
  const context = { ...f.admission.boundary, origin, mode: 'historical' as const, facts: { ...f.f.context, facts: f.f.facts() } };
  value(decodeHistoricalInstallationSelection(f.record, context, f.admission));
  const changed = { ...context, facts: { ...context.facts, facts: context.facts.facts.map(fact => fact.id === f.admission.approvalFact ? { ...fact, signature: '00' } : fact) } };
  const warm = decodeHistoricalInstallationSelection(f.record, changed, f.admission);
  const cold = decodeHistoricalInstallationSelection(f.record, changed, { ...f.admission });
  refused(cold);
  expect(warm.kind).toBe(cold.kind);
});
// P10-SI-22: the per-hold report. Rows come from the landed hold list plus Seven's supervisor hold;
// prepared and admitted never merge, and selection metadata alone never reads admitted.
describeHere('P10-SI-22 the twenty-five hold report', () => {
  const facts = (rows: Record<string, { kind: string; owner: string; fixture?: boolean; current?: boolean }>) => ({ owner: 'part-ten' as const,
    lookup: (reference: string) => rows[reference] ? { fixture: false, current: true, ...rows[reference]! } : null });
  const base = (f: ReturnType<typeof fixedRecordFixture>) => ({ installation: 'host', scope: 'project-a', generation: f.record.generation, vector: 'vector:1' });
  it('reports every landed hold plus the supervisor hold exactly once, all held without owner verdicts, and never live', () => {
    const f = fixedRecordFixture();
    const report = value(reportInstallationHolds({ ...base(f), verdicts: [], facts: facts({}) }, f.admission.boundary));
    expect(report.rows.map(row => row.hold)).toEqual([...productionMissingBindings, 'seven-bounded-install-supervisor']);
    expect(report.rows).toHaveLength(25); expect(new Set(report.rows.map(row => row.hold)).size).toBe(25);
    expect(report.counts).toEqual({ held: 25, prepared: 0, 'fixture-admitted': 0, admitted: 0 }); expect(report.live).toBe(false);
  });
  it('keeps prepared and admitted apart: a real recorded selection prepares its hold but never admits it', () => {
    const f = fixedRecordFixture(), selection = value(recordInstallationSelection(f.record, f.writer));
    const rows = { [selection.id]: { kind: selection.kind, owner: 'part-ten' }, 'replay:evidence': { kind: 'assembly-GrowthObservation', owner: 'part-ten' },
      'replay:fixture': { kind: 'assembly-GrowthObservation', owner: 'part-ten', fixture: true }, 'replay:stale': { kind: 'assembly-GrowthObservation', owner: 'part-ten', current: false } };
    const verdict = (extra: object) => [{ hold: 'source-only-replay-admission', owner: 'part-ten', prepared: selection.id, ...extra }];
    const row = (extra: object) => value(reportInstallationHolds({ ...base(f), verdicts: verdict(extra), facts: facts(rows) }, f.admission.boundary))
      .rows.find(entry => entry.hold === 'source-only-replay-admission')!;
    expect(row({})).toMatchObject({ state: 'prepared', prepared: selection.id, evidence: null });
    expect(row({ evidence: 'replay:evidence' })).toMatchObject({ state: 'admitted', evidence: 'replay:evidence' });
    expect(row({ evidence: 'replay:fixture' })).toMatchObject({ state: 'fixture-admitted' });
    expect(row({ evidence: 'replay:stale' })).toMatchObject({ state: 'prepared', reason: 'owner evidence is stale' });
    // Selection metadata alone, in either position, never reads admitted.
    refused(reportInstallationHolds({ ...base(f), verdicts: verdict({ evidence: selection.id }), facts: facts(rows) }, f.admission.boundary), 'selection metadata');
  });
  it.each([
    ['unknown hold', [{ hold: 'made-up-hold', owner: 'part-ten' }], 'unknown hold'],
    ['duplicate verdict', [{ hold: 'conversation-driver', owner: 'part-twelve' }, { hold: 'conversation-driver', owner: 'part-twelve' }], 'duplicate verdict'],
    ['wrong owner verdict', [{ hold: 'independent-verification-clock', owner: 'part-ten' }], 'wrong owner'],
    ['evidence outside the opened root', [{ hold: 'run-governance-policy', owner: 'part-five', evidence: 'absent:fact' }], 'not in the opened root'],
    ['another owner\'s evidence', [{ hold: 'independent-challenge-verifier', owner: 'part-nine', evidence: 'ten:fact' }], 'not issued by part-nine'],
  ])('refuses %s', (_name, verdicts, detail) => {
    const f = fixedRecordFixture();
    refused(reportInstallationHolds({ ...base(f), verdicts, facts: facts({ 'ten:fact': { kind: 'assembly-GrowthObservation', owner: 'part-ten' } }) }, f.admission.boundary), detail);
  });
  it('refuses a caller that supplies no opened-root lookup', () => {
    const f = fixedRecordFixture();
    refused(reportInstallationHolds({ ...base(f), verdicts: [], facts: undefined as never }, f.admission.boundary), 'opened-root fact lookup');
  });
});
