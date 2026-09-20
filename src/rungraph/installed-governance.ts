import { decode, grantLiveness, historicalGrantLiveness, scopeIncludes } from '../index.js';
import type { Json, Result, Scope } from '../index.js';
import { authorAndAppend, causalCone, causalStanding, decodeEnvelope, decodeHistoricalBody, prepareSnapshot, registerOwnedBody } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, OwnedBodyContext, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { intakeVerifiedActRegistration } from '../intake/index.js';
import { decodeGenerationRecord, generationOf, readRegisterEntry } from '../register/index.js';
import type { RegisterContext, VerifiedRegister } from '../register/index.js';
import type { InstallationRecordAdmission, InstallationRecordWriter } from '../assembly/index.js';
import { boundary, encoded, freeze, json, need, take } from './boundary.js';
import { runGraphConstruct } from './rungraph.js';
import type { RunGovernance } from './types.js';

export interface InstalledRunGovernanceReference {
  readonly type: 'InstalledRunGovernanceReference'; readonly schemaVersion: 1; readonly id: string;
  readonly installation: string; readonly scope: string; readonly generation: string;
  readonly contract: string; readonly feature: string; readonly bound: string;
  readonly gates: readonly Readonly<{ id: string; decoder: string }>[];
  readonly capture: string;
  readonly groundingPolicy: Readonly<{ entry: string; threshold: number; maxAge: number; briefingClasses: readonly string[] }>;
}
const text: OwnedShape = { kind: 'text', maxLength: 4096 };
const shape = { kind: 'object', fields: {
  type: text, schemaVersion: { kind: 'integer' }, id: text, installation: text, scope: text, generation: text,
  contract: text, feature: text, bound: text, capture: text,
  gates: { kind: 'array', maxLength: 6, items: { kind: 'object', fields: { id: text, decoder: text } } },
  groundingPolicy: { kind: 'object', fields: { entry: text, threshold: { kind: 'integer' }, maxAge: { kind: 'integer' },
    briefingClasses: { kind: 'array', maxLength: 64, items: text } } },
} } satisfies OwnedShape;
const gates = Object.freeze([
  ['rungraph.admit', 'decodeRun'], ['rungraph.exit', 'decodeRunExit'], ['rungraph.grounding', 'decodeSessionGrounding'],
  ['rungraph.step', 'decodeRunStep'], ['rungraph.stop', 'decodeRunTransition'], ['rungraph.transition', 'decodeRunTransition'],
].map(([id, decoder]) => Object.freeze({ id: id!, decoder: decoder! })));
const active = new WeakMap<InstallationRecordAdmission, string>();
function closed(input: unknown): InstalledRunGovernanceReference {
  const record = JSON.parse(encoded(input).bytes) as InstalledRunGovernanceReference;
  need(record && typeof record === 'object' && !Array.isArray(record)
    && Object.keys(record).sort().join(',') === Object.keys(shape.fields).sort().join(','), 'governance: closed data record required');
  need(record.type === 'InstalledRunGovernanceReference' && record.schemaVersion === 1, 'governance: type/version');
  for (const field of ['id', 'installation', 'scope', 'generation', 'contract', 'feature', 'bound', 'capture'] as const)
    need(typeof record[field] === 'string' && record[field].length > 0 && record[field].length <= 4096, `governance: invalid ${field}`);
  need(record.contract === 'rungraph.contract' && record.feature === 'rungraph-core' && record.bound === 'rungraph.bound'
    && encoded(record.gates).bytes === encoded(gates).bytes, 'governance: missing gate or wrong decoder');
  const policy = record.groundingPolicy;
  need(policy && Object.keys(policy).sort().join(',') === 'briefingClasses,entry,maxAge,threshold'
    && typeof policy.entry === 'string' && policy.entry.length > 0 && policy.entry.length <= 4096
    && Number.isSafeInteger(policy.threshold) && policy.threshold >= 0 && Number.isSafeInteger(policy.maxAge) && policy.maxAge > 0,
  'governance: fixed finite grounding policy required');
  need(Array.isArray(policy.briefingClasses) && policy.briefingClasses.length > 0 && policy.briefingClasses.length <= 64
    && policy.briefingClasses.every(value => typeof value === 'string' && value.length > 0 && value.length <= 4096)
    && encoded(policy.briefingClasses).bytes === encoded([...new Set(policy.briefingClasses)].sort()).bytes,
  'governance: sorted exact briefing classes required');
  const { id, ...fields } = record;
  need(id === encoded(fields).hash, 'governance: immutable policy digest differs');
  return freeze(record);
}

function installationRecordBasis(record: Readonly<{ installation: string; generation: string; machine?: string }>,
  admission: InstallationRecordAdmission, facts: FactContext, origin?: FactEnvelope) {
  if (origin) take(decodeEnvelope(origin, facts, 'replication'));
  const all = origin ? causalCone(origin, facts.facts) : facts.facts;
  const pinned = { ...facts, facts: all };
  const snapshot = take(prepareSnapshot(all, pinned));
  const fact = (id: string, kind: string) => {
    const matches = snapshot.entries.filter(row => row.fact.id === id);
    need(matches.length === 1 && matches[0]!.fact.kind === kind && !matches[0]!.taint.length && !matches[0]!.conflicts.length,
      `installation reference missing, wrong kind, tainted or conflicted: ${id}:${kind}`);
    return matches[0]!.fact;
  };
  const installed = fact(admission.installationFact, 'assembly-ProductionInstallation');
  const installation = take(decodeHistoricalBody(installed, pinned, causalStanding(installed, pinned, false).decode)).fields.record as unknown as
    { id: string; generation: string; machineIdentity: string };
  need(installation?.id === record.installation && installation.generation === record.generation
    && (!record.machine || installation.machineIdentity === record.machine), 'installation: exact owner identity differs');
  const generationFact = fact(admission.generationFact, 'generation-record');
  const generation = take(decodeGenerationRecord((generationFact.body as { record?: Json }).record ?? generationFact.body, admission.generation.context));
  need(generation.generation.id === record.generation
    && take(generationOf(admission.generation.register, admission.generation.context)).id === record.generation,
  'installation: entering-force generation differs');
  // readRegisterEntry checks Three's runtime identity, not a caller register cast.
  take(readRegisterEntry('rungraph.contract', admission.generation.register, admission.generation.context));
  const approval = fact(admission.approvalFact, 'intake-verified-act');
  const schema = pinned.schemas.find(row => row.kind === approval.kind && row.version === approval.schemaVersion);
  need(schema?.fields.record?.kind === 'owned' && schema.fields.record.owner === 'part-four'
    && schema.fields.record.name === 'VerifiedActDisposition', 'installation: Four-owned approval required');
  // Invoke Four's public validator even if a host supplied a lookalike registry.
  const approvalContext = { ...pinned, ownedBodies: [
    ...(pinned.ownedBodies ?? []).filter(row => row.owner !== 'part-four' || row.name !== 'VerifiedActDisposition'),
    take(intakeVerifiedActRegistration(admission.boundary, approval.principal.id,
      { owner: 'part-three', name: 'RegisterGeneration', id: record.generation })),
  ] };
  const disposition = take(decodeHistoricalBody(approval, approvalContext, causalStanding(approval, approvalContext, false).decode)).fields.record as
    Readonly<Record<string, Json>>;
  const packageDigest = encoded({ installation: record.installation, scope: admission.scopeId,
    generation: record.generation, records: admission.packageRecords }).hash;
  need(disposition.disposition === 'approved' && disposition.decision === 'approve'
    && disposition.generation === record.generation && disposition.base === record.installation
    && disposition.artifact === packageDigest && disposition.scope === encoded(admission.scope).bytes,
  'installation: independently approved exact package and scope required');
  const required = [installed.id, generationFact.id, approval.id];
  if (origin) {
    const declared = take(readRegisterEntry(origin.kind, admission.generation.register, admission.generation.context));
    need(declared.declaration.kind === 'protected artifacts' && declared.declaration.status === 'live'
      && !('state' in declared.approvedIn) && declared.declaration.requiredFacts.pattern === 'src/rungraph/installed-governance.ts',
    'governance: exact approved body declaration required');
  }
  if (origin) {
    need(required.every(id => origin.predecessors.required.includes(id)), 'installation: missing required approval/install/generation predecessor');
    if (origin.principal.kind === 'person') {
      need(origin.principal.id === disposition.operator && origin.principal.id !== disposition.requestedBy,
        'installation: historical author differs from approving operator');
    } else {
      need(origin.principal.kind === 'system', 'installation: requester cannot author configuration');
      const action = `installation-import:${encoded([origin.kind, record.installation, admission.scopeId, packageDigest]).hash}`;
      const standing = causalStanding(origin, facts, false);
      const refs = new Set(origin.predecessors.required);
      const rawGrant = facts.grants.some(row => refs.has(row.factId) && row.grant.grantee.id === origin.principal.id
        && row.grant.actions?.includes(action) && scopeIncludes(row.grant.scope, admission.scope)
        && grantLiveness(row.grant, standing.decode.revocations ?? [], standing.now) === 'live');
      const oldGrant = facts.historicalGrants?.some(row => refs.has(row.factId)
        && row.grant.view.grantee.id === origin.principal.id && row.grant.view.actions?.includes(action)
        && scopeIncludes(take(decode('Scope', row.grant.view.scope, facts.decode)), admission.scope)
        && take(historicalGrantLiveness(row.grant, facts.historicalRevocations?.filter(rev => all.some(fact => fact.id === rev.factId)).map(rev => rev.revocation) ?? [],
          standing.now, facts.preserved)) === 'live');
      need(rawGrant || oldGrant, 'installation: original exact package import grant required');
    }
  }
  return { installation, fact, snapshot, packageDigest, disposition, required, facts: pinned };
}
function installationRecordAuthor(kind: string, record: Readonly<{ installation: string }>,
  writer: InstallationRecordWriter, basis: ReturnType<typeof installationRecordBasis>): void {
  const author = take(decode('VerifiedPrincipal', json(writer.principal), { ...writer.context.decode, provenance: writer.principal.provenance }));
  if (author.kind === 'person') {
    need(author.id === basis.disposition.operator && author.id !== basis.disposition.requestedBy,
      'installation: author must be the independently verified approving operator');
  } else {
    need(author.kind === 'system', 'installation: requester-only metadata confers no import standing');
    const action = `installation-import:${encoded([kind, record.installation, writer.admission.scopeId, basis.packageDigest]).hash}`;
    need(writer.context.grants.some(row => row.grant.grantee.id === author.id
      && row.grant.actions?.includes(action) && scopeIncludes(row.grant.scope, writer.admission.scope)
      && grantLiveness(row.grant, writer.context.revocations.map(r => r.revocation), writer.at) === 'live'),
    'installation: exact current import grant required');
  }
}

function validate(input: unknown, context: OwnedBodyContext, admission: InstallationRecordAdmission): InstalledRunGovernanceReference {
  const record = closed(input);
  need(context.origin.kind === 'rungraph-installed-governance-reference' && record.scope === admission.scopeId,
    'governance: wrong kind or scope');
  installationRecordBasis(record, admission, context.facts, context.origin);
  need(admission.packageRecords.some(candidate => encoded(candidate).bytes === encoded(record).bytes),
    'governance: policy differs from independently approved package');
  for (const id of [record.contract, record.feature, record.bound, ...record.gates.map(gate => gate.id), record.capture, record.groundingPolicy.entry]) {
    const entry = take(readRegisterEntry(id, admission.generation.register, admission.generation.context));
    need(entry.declaration.status === 'live' && !('state' in entry.approvedIn), `governance: unapproved declaration ${id}`);
    const owner = id === record.capture ? 'facts' : 'rungraph';
    need(entry.declaration.declaredBy.path.startsWith(`src/${owner}/`), `governance: wrong declaration owner ${id}`);
  }
  for (const gate of record.gates) {
    const entry = take(readRegisterEntry(gate.id, admission.generation.register, admission.generation.context));
    const stop = gate.id === 'rungraph.stop', facts = entry.declaration.requiredFacts;
    need(entry.declaration.kind === 'blocking sites' && facts.authority === 'block'
      && facts.inspectedBy === 'P5-NF-54' && facts.preservesInput === 'part-two:run-input'
      && facts.failDirection === (stop ? 'open' : 'closed')
      && facts.decidesAlone === (stop ? 'ruled-three' : 'governed-state')
      && (stop || encoded(facts.enforces).bytes === encoded({ record: record.contract, decoder: gate.decoder }).bytes),
    'governance: gate differs from Five consumer');
  }
  if (context.mode === 'origin') {
    need(active.get(admission) === encoded(record).hash, 'governance: active owner admission guard required');
    need(record.generation === context.facts.decode.register.generation.id, 'governance: stale generation');
  }
  return record;
}
export function decodeInstalledRunGovernanceReferenceAtOrigin(input: unknown, context: OwnedBodyContext,
  admission: InstallationRecordAdmission): Result<InstalledRunGovernanceReference> {
  return boundary('InstalledRunGovernanceReferenceOrigin', input, admission.boundary, () => {
    need(context.mode === 'origin', 'governance: origin mode required'); return validate(input, context, admission);
  });
}
export function decodeHistoricalInstalledRunGovernanceReference(input: unknown, context: OwnedBodyContext,
  admission: InstallationRecordAdmission): Result<InstalledRunGovernanceReference> {
  return boundary('InstalledRunGovernanceReferenceHistorical', input, admission.boundary, () => {
    need(context.mode === 'historical', 'governance: historical mode required'); return validate(input, context, admission);
  });
}
export function installedRunGovernanceSchemas(scope: Scope): readonly FactSchema[] {
  return [{ kind: 'rungraph-installed-governance-reference', version: 1,
    fields: { record: { kind: 'owned', owner: 'part-five', name: 'InstalledRunGovernanceReference' } },
    machineScope: 'shared', standing: 'delegate', action: 'work', scope, causallyBound: true, requiredReferences: [], authority: 'none' }];
}
export function registerInstalledRunGovernanceBody(admission: InstallationRecordAdmission): Result<OwnedBodyRegistration> {
  return registerOwnedBody({ name: 'InstalledRunGovernanceReference', owner: 'part-five', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {}, decodeCurrent: (value, context) => {
      try { return { ok: true, value: take((context.mode === 'origin' ? decodeInstalledRunGovernanceReferenceAtOrigin
        : decodeHistoricalInstalledRunGovernanceReference)(value, context, admission)) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'governance reference refused' }; }
    } }, shape, admission.boundary);
}
export function recordInstalledRunGovernanceReference(input: unknown, writer: InstallationRecordWriter): Result<FactEnvelope> {
  return boundary('RecordInstalledRunGovernanceReference', input, writer.admission.boundary, () => {
    const record = closed(input), facts = { ...writer.context, facts: take(writer.store.read()) };
    const basis = installationRecordBasis(record, writer.admission, facts);
    need(record.generation === writer.context.decode.register.generation.id,
      'installation: stale current generation');
    need(writer.admission.packageRecords.some(candidate => encoded(candidate).bytes === encoded(record).bytes),
      'installation: record outside approved package');
    installationRecordAuthor('rungraph-installed-governance-reference', record, writer, basis);
    const rows = basis.snapshot.entries.filter(row => row.fact.kind === 'rungraph-installed-governance-reference').filter(row => {
      const prior = (row.fact.body as { record?: InstalledRunGovernanceReference }).record;
      return prior?.id === record.id || prior?.installation === record.installation && prior.scope === record.scope
        && prior.generation === record.generation;
    });
    need(rows.length <= 1 && rows.every(row => !row.taint.length && !row.conflicts.length
      && encoded(row.fact.body).bytes === encoded({ record }).bytes), 'governance: immutable same-key conflict inhibits scope');
    if (rows[0]) return rows[0].fact;
    active.set(writer.admission, encoded(record).hash);
    try { return take(authorAndAppend({ kind: 'rungraph-installed-governance-reference', schemaVersion: 1,
      machine: basis.installation.machineIdentity, principal: json(writer.principal), provenance: json(writer.principal.provenance),
      at: json(writer.at), body: json({ record }), required: [...basis.required, ...writer.context.grants.filter(row => row.grant.grantee.id === writer.principal.id).map(row => row.factId)] }, writer.context, writer.store, writer.privateKey)).fact; }
    finally { active.delete(writer.admission); }
  });
}
/** Five supplies runtime callbacks from owner ports only after re-resolving the
 * immutable record at the current generation. Nothing callable is serialized. */
export function loadInstalledRunGovernance(input: unknown, register: VerifiedRegister, context: RegisterContext,
  capture: RunGovernance['capture'], owner: Readonly<{ fact: FactEnvelope; facts: FactContext; admission: InstallationRecordAdmission }>): Result<RunGovernance> {
  return boundary('LoadInstalledRunGovernance', input, owner.admission.boundary, () => {
    const record = closed(input);
    need(owner.facts.decode.register.generation.id === record.generation
      && take(generationOf(register, context)).id === record.generation, 'governance: stale generation');
    need(encoded(owner.fact.body).bytes === encoded({ record }).bytes, 'governance: exact stored reference required');
    const basis = installationRecordBasis(record, owner.admission, owner.facts);
    const candidates = basis.snapshot.entries.filter(row => {
      const other = (row.fact.body as { record?: InstalledRunGovernanceReference }).record;
      return row.fact.kind === 'rungraph-installed-governance-reference' && other?.installation === record.installation
        && other.scope === record.scope && other.generation === record.generation;
    });
    need(candidates.length === 1 && candidates[0]!.fact.id === owner.fact.id
      && !candidates[0]!.taint.length && !candidates[0]!.conflicts.length,
    'governance: missing, tainted or conflicting current installed record');
    take(decodeHistoricalInstalledRunGovernanceReference(record, { ...owner.admission.boundary, origin: owner.fact,
      mode: 'historical', facts: owner.facts }, owner.admission));
    need(capture.owner === 'part-two' && typeof capture.preserve === 'function', 'governance: Two preservation port required');
    const governance = { register, context, capture };
    runGraphConstruct(governance);
    return governance;
  });
}
