import { readFileSync } from 'node:fs';
import { authorizationRequestDigest, canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { FactEnvelope, FactSchema, OwnedShape } from '../../src/facts/index.js';
import { intakeVerifiedActRegistration } from '../../src/intake/index.js';
import { decodeGenerationRecord, generateRegister, generationOf, loadRegister } from '../../src/register/index.js';
import { recordProductionInstallation, registerProductionInstallationBody, productionInstallationSchemas } from '../../src/assembly/production-installation.js';
import { recordInstallationSelection, registerInstallationSelectionBody, installationSelectionSchemas, decodeInstallationSelectionAtOrigin, decodeHistoricalInstallationSelection,
  registerInstallationSelectionSetBody, installationSelectionSetSchemas } from '../../src/assembly/installation-selection.js';
import { reportInstallationHolds } from '../../src/assembly/production-installation-report.js';
import { replayInstallationProjections } from '../../src/assembly/production-installation-replay.js';
import { minimalPlaneProjections } from '../../src/operator/index.js';
import { productionMissingBindings } from '../../src/assembly/production-holds.js';
import type { InstallationRecordAdmission, InstallationRecordWriter } from '../../src/assembly/installation-selection.js';
import { intakeFixture, json, value } from '../intake/fixtures.js';
import { privateKey, refused } from '../facts/fixtures.js';

export const digest = (input: unknown) => value(canonical(input)).hash;
export interface FixedRecordOptions {
  /** Scope id carried by every selection and the approved package; defaults to the original fixture value. */
  readonly scopeId?: string;
  /** Additional fixture-approved declaration sources, keyed to the owner directory named in each path. */
  readonly extraSources?: (f: ReturnType<typeof intakeFixture>) => readonly { declaration: object; path: string; symbol: string }[];
  /** The consumer's actual owner store, supplied before any package writes. */
  readonly fixture?: ReturnType<typeof intakeFixture>;
  /** Exact installation the consumer will boot, when preparing its owner prefix. */
  readonly installation?: (generation: string) => import('../../src/assembly/production-installation.js').ProductionInstallation;
  readonly beforePackage?: (input: { fixture: ReturnType<typeof intakeFixture>;
    store: ReturnType<typeof createFactStore>; boundary: import('../../src/index.js').DecodeContext & import('../../src/index.js').BoundaryContext;
    generation: string; installationFact: FactEnvelope; generationFact: FactEnvelope }) => void;
}
export function fixedRecordFixture(chooseRecords?: (input: { generation: string; scopeId: string; boundary: import('../../src/index.js').DecodeContext & import('../../src/index.js').BoundaryContext; fixture: ReturnType<typeof intakeFixture> }) => Json[],
  options: FixedRecordOptions = {}) {
  const f = options.fixture ?? intakeFixture();
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
    .filter(declaration => ['assembly-InstallationSelection', 'assembly-InstallationSelectionSet', 'assembly-ProductionSignerReference'].includes(declaration.id))
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
  const preparedBodies = [registration, value(registerProductionInstallationBody(boundary)),
    value(intakeVerifiedActRegistration(boundary, f.deps.author.principal.id, generationRef))];
  Object.assign(f.context, { schemas: [...f.context.schemas, ...productionInstallationSchemas(f.f.scope), generationSchema],
    ownedBodies: [...(f.context.ownedBodies ?? []).filter(existing => !preparedBodies.some(prepared =>
      prepared.owner === existing.owner && prepared.name === existing.name)), ...preparedBodies] });
  const store = createFactStore(f.context, f.storage);
  const root = f.facts().find(fact => fact.kind === 'genesis-grant')!;
  const secret = (name: string) => ({ type: 'SecretRef', schemaVersion: 1, vault: 'vault', name });
  const installation = options.installation?.(generation.id) ?? { type: 'ProductionInstallation', schemaVersion: 1, id: 'host', generation: generation.id,
    botDeclaration: 'phone-surface', providerRoute: 'route', machineIdentity: 'machine-a', storageRoot: '/tmp/fixed-record-fixture',
    botCredential: secret('bot'), providerCredential: secret('provider'), storageCredential: secret('storage') };
  const installationFact = value(recordProductionInstallation({ record: installation, context: f.context, boundary,
    store, privateKey, principal: f.f.alice, at: f.f.now, required: [root.id] }));
  const generationFact = value(authorAndAppend({ kind: 'generation-record', schemaVersion: 1, machine: 'machine-a',
    principal: json(f.f.alice), provenance: json(f.f.alice.provenance), at: json(f.f.now),
    body: { record: json(generationRecord) }, required: [root.id] }, f.context, store, privateKey)).fact;
  options.beforePackage?.({ fixture: f, store, boundary, generation: generation.id, installationFact, generationFact });
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
  Object.assign(f.context, { schemas: [...f.context.schemas, ...installationSelectionSchemas(f.f.scope),
    ...installationSelectionSetSchemas(f.f.scope)],
    ownedBodies: [...f.context.ownedBodies!, value(registerInstallationSelectionBody(admission)),
      value(registerInstallationSelectionSetBody(admission))] });
  const writer: InstallationRecordWriter = { admission, context: f.context, store: createFactStore(f.context, f.storage),
    principal: f.f.alice, at: f.f.now, privateKey };
  return { f, record, records, writer, admission, installationFact, generationFact };
}

