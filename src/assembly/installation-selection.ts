import { decode, grantLiveness, historicalGrantLiveness, scopeIncludes } from '../index.js';
import type { BoundaryContext, Clock, DecodeContext, Json, Result, Scope, VerifiedPrincipal } from '../index.js';
import { authorAndAppend, causalCone, causalStanding, decodeEnvelope, decodeHistoricalBody, prepareSnapshot, registerOwnedBody } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, FactSnapshot, FactStorePort, OwnedBodyContext, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { intakeVerifiedActRegistration } from '../intake/index.js';
import { decodeGenerationRecord, generationOf, readRegisterEntry } from '../register/index.js';
import type { RegisterContext, VerifiedRegister } from '../register/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';

/** Selection ownership is a closed map; a selection never supplies live evidence. */
export const installationRoleOwners = Object.freeze({
  'operator-surface': 'part-eleven', 'challenge-verifier': 'part-nine', 'verified-act-intake': 'part-four',
  'minimal-plane-fold': 'part-eleven', 'minimal-plane-replay': 'part-ten', 'minimal-responder': 'part-eleven',
  'prerequisite-cut': 'part-ten', 'prerequisite-recovery': 'part-ten', 'delivery-witness': 'part-nine',
  'fact-segment': 'part-two', 'verification-clock': 'part-nine', 'conversation-route': 'part-four',
  'delivery-evidence-service': 'part-nine', 'scope-protection': 'part-ten',
} as const);
export type InstallationRole = keyof typeof installationRoleOwners;
export interface InstallationSelection {
  readonly type: 'InstallationSelection'; readonly schemaVersion: 1; readonly id: string;
  readonly installation: string; readonly machine: string; readonly scope: string;
  readonly role: InstallationRole; readonly instance: string; readonly implementation: string;
  readonly owner: (typeof installationRoleOwners)[InstallationRole]; readonly generation: string;
  readonly references: readonly string[];
  /** Canonical One Clock bytes, or the explicit unbounded-time marker. */
  readonly validUntil: string;
}
export interface InstallationRecordGeneration {
  readonly register: VerifiedRegister; readonly context: RegisterContext;
}
/** Immutable package inputs are approved as one canonical artifact. Approval and
 * envelope references are outside that artifact, avoiding a self-referential pin. */
export interface InstallationRecordAdmission {
  readonly boundary: DecodeContext & BoundaryContext;
  readonly scope: Scope; readonly scopeId: string;
  readonly installationFact: string; readonly generationFact: string; readonly approvalFact: string;
  readonly packageRecords: readonly Json[];
  readonly generation: InstallationRecordGeneration;
}
export interface InstallationRecordWriter {
  readonly admission: InstallationRecordAdmission; readonly context: FactContext; readonly store: FactStorePort;
  readonly principal: VerifiedPrincipal; readonly at: Clock; readonly privateKey: string;
}
const text: OwnedShape = { kind: 'text', maxLength: 4096 };
const shape = { kind: 'object', fields: {
  type: text, schemaVersion: { kind: 'integer' }, id: text, installation: text, machine: text, scope: text,
  role: text, instance: text, implementation: text, owner: text, generation: text,
  references: { kind: 'array', maxLength: 128, items: text }, validUntil: text,
} } satisfies OwnedShape;
const active = new WeakMap<InstallationRecordAdmission, string>();
const ownerDirectories: Readonly<Record<string, string>> = {
  'part-two': 'facts', 'part-three': 'register', 'part-four': 'intake', 'part-five': 'rungraph',
  'part-six': 'transport', 'part-seven': 'judgment', 'part-eight': 'effects', 'part-nine': 'verification',
  'part-ten': 'assembly', 'part-eleven': 'operator', 'part-twelve': 'conversation',
};
function closed(input: unknown): InstallationSelection {
  const value = JSON.parse(encoded(input).bytes) as InstallationSelection;
  ensure(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === Object.keys(shape.fields).sort().join(','), 'selection: closed record required');
  ensure(value.type === 'InstallationSelection' && value.schemaVersion === 1, 'selection: type/version');
  for (const name of Object.keys(shape.fields).filter(key => key !== 'schemaVersion' && key !== 'references')) {
    const field = (value as unknown as Record<string, unknown>)[name];
    ensure(typeof field === 'string' && field.length > 0 && field.length <= 4096, `selection: bounded ${name}`);
  }
  ensure(Object.hasOwn(installationRoleOwners, value.role), 'selection: omitted or unknown role');
  ensure(value.owner === installationRoleOwners[value.role], 'selection: wrong role owner');
  if (value.role === 'scope-protection') ensure(['protected', 'unprotected-permitted'].includes(value.instance),
    'selection: unknown scope protection requirement');
  ensure(Array.isArray(value.references) && value.references.length > 0 && value.references.length <= 128
    && value.references.every(ref => typeof ref === 'string' && ref.length > 0 && ref.length <= 4096)
    && encoded(value.references).bytes === encoded([...new Set(value.references)].sort()).bytes,
  'selection: sorted nonempty unique references required');
  const { id, ...fields } = value;
  ensure(id === encoded(fields).hash, 'selection: immutable digest differs');
  return freeze(value);
}

/** Shared Ten admission checks used only by its two configuration producers. */
/** A signed origin's causal cone is immutable, so its prepared snapshot is memoized per admission.
 * Without this, decoding a history of n installation records re-prepares each earlier record's cone
 * through its own decoder (cones chain through in-segment predecessors), which is exponential in n. */
const coneSnapshots = new WeakMap<InstallationRecordAdmission, Map<string, FactSnapshot>>();
export interface InstallationRecordBasisResult {
  readonly installation: { id: string; generation: string; machineIdentity: string };
  readonly fact: (id: string, kind: string) => FactEnvelope;
  readonly snapshot: FactSnapshot; readonly packageDigest: string;
  readonly disposition: Readonly<Record<string, Json>>; readonly required: readonly string[]; readonly facts: FactContext;
}
const coneBases = new WeakMap<InstallationRecordAdmission, Map<string, InstallationRecordBasisResult>>();
export function installationRecordBasis(record: Readonly<{ installation: string; generation: string; machine?: string }>,
  admission: InstallationRecordAdmission, facts: FactContext, origin?: FactEnvelope): InstallationRecordBasisResult {
  if (!origin) return installationRecordBasisUncached(record, admission, facts, origin);
  // The whole basis of a signed origin is a pure function of its immutable cone and the admission.
  const key = `${encoded(origin).hash}|${encoded(record).hash}|${facts.facts.length}|${facts.schemas.length}|${facts.ownedBodies?.length ?? 0}`;
  const memo = coneBases.get(admission) ?? new Map<string, InstallationRecordBasisResult>();
  coneBases.set(admission, memo);
  const cached = memo.get(key); if (cached) return cached;
  const basis = installationRecordBasisUncached(record, admission, facts, origin); memo.set(key, basis); return basis;
}
function installationRecordBasisUncached(record: Readonly<{ installation: string; generation: string; machine?: string }>,
  admission: InstallationRecordAdmission, facts: FactContext, origin?: FactEnvelope): InstallationRecordBasisResult {
  if (origin) take(decodeEnvelope(origin, facts, 'replication'));
  const all = origin ? causalCone(origin, facts.facts) : facts.facts;
  const pinned = { ...facts, facts: all };
  const memoKey = origin ? `${encoded(origin).hash}|${all.length}|${facts.schemas.length}|${facts.ownedBodies?.length ?? 0}` : null;
  const memo = memoKey ? coneSnapshots.get(admission) ?? new Map<string, FactSnapshot>() : null;
  if (memo && memoKey) coneSnapshots.set(admission, memo);
  const remembered = memo && memoKey ? memo.get(memoKey) : undefined;
  const snapshot: FactSnapshot = remembered ?? take(prepareSnapshot(all, pinned));
  if (memo && memoKey && !remembered) memo.set(memoKey, snapshot);
  const fact = (id: string, kind: string) => {
    const matches = snapshot.entries.filter(row => row.fact.id === id);
    ensure(matches.length === 1 && matches[0]!.fact.kind === kind && !matches[0]!.taint.length && !matches[0]!.conflicts.length,
      `installation reference missing, wrong kind, tainted or conflicted: ${id}:${kind}`);
    return matches[0]!.fact;
  };
  const installed = fact(admission.installationFact, 'assembly-ProductionInstallation');
  const installation = take(decodeHistoricalBody(installed, pinned, causalStanding(installed, pinned, false).decode)).fields.record as unknown as
    { id: string; generation: string; machineIdentity: string };
  ensure(installation?.id === record.installation && installation.generation === record.generation
    && (!record.machine || installation.machineIdentity === record.machine), 'installation: exact owner identity differs');
  const generationFact = fact(admission.generationFact, 'generation-record');
  const generation = take(decodeGenerationRecord((generationFact.body as { record?: Json }).record ?? generationFact.body, admission.generation.context));
  ensure(generation.generation.id === record.generation
    && take(generationOf(admission.generation.register, admission.generation.context)).id === record.generation,
  'installation: entering-force generation differs');
  // readRegisterEntry checks Three's runtime identity, not a caller register cast.
  take(readRegisterEntry('rungraph.contract', admission.generation.register, admission.generation.context));
  const approval = fact(admission.approvalFact, 'intake-verified-act');
  const schema = pinned.schemas.find(row => row.kind === approval.kind && row.version === approval.schemaVersion);
  ensure(schema?.fields.record?.kind === 'owned' && schema.fields.record.owner === 'part-four'
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
  ensure(disposition.disposition === 'approved' && disposition.decision === 'approve'
    && disposition.generation === record.generation && disposition.base === record.installation
    && disposition.artifact === packageDigest && disposition.scope === encoded(admission.scope).bytes,
  'installation: independently approved exact package and scope required');
  const required = [installed.id, generationFact.id, approval.id];
  if (origin) {
    const paths: Readonly<Record<string, string>> = {
      'assembly-InstallationSelection': 'src/assembly/installation-selection.ts',
      'assembly-ProductionSignerReference': 'src/assembly/production-signer-reference.ts',
    };
    const declared = take(readRegisterEntry(origin.kind, admission.generation.register, admission.generation.context));
    ensure(declared.declaration.kind === 'protected artifacts' && declared.declaration.status === 'live'
      && !('state' in declared.approvedIn) && declared.declaration.requiredFacts.pattern === paths[origin.kind],
    'installation: exact approved body declaration required');
  }
  if (origin) {
    ensure(required.every(id => origin.predecessors.required.includes(id)), 'installation: missing required approval/install/generation predecessor');
    if (origin.principal.kind === 'person') {
      ensure(origin.principal.id === disposition.operator && origin.principal.id !== disposition.requestedBy,
        'installation: historical author differs from approving operator');
    } else {
      ensure(origin.principal.kind === 'system', 'installation: requester cannot author configuration');
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
      ensure(rawGrant || oldGrant, 'installation: original exact package import grant required');
    }
  }
  return { installation, fact, snapshot, packageDigest, disposition, required, facts: pinned };
}
export function installationRecordAuthor(kind: string, record: Readonly<{ installation: string }>,
  writer: InstallationRecordWriter, basis: ReturnType<typeof installationRecordBasis>): void {
  const author = take(decode('VerifiedPrincipal', json(writer.principal), { ...writer.context.decode, provenance: writer.principal.provenance }));
  if (author.kind === 'person') {
    ensure(author.id === basis.disposition.operator && author.id !== basis.disposition.requestedBy,
      'installation: author must be the independently verified approving operator');
  } else {
    ensure(author.kind === 'system', 'installation: requester-only metadata confers no import standing');
    const action = `installation-import:${encoded([kind, record.installation, writer.admission.scopeId, basis.packageDigest]).hash}`;
    ensure(writer.context.grants.some(row => row.grant.grantee.id === author.id
      && row.grant.actions?.includes(action) && scopeIncludes(row.grant.scope, writer.admission.scope)
      && grantLiveness(row.grant, writer.context.revocations.map(r => r.revocation), writer.at) === 'live'),
    'installation: exact current import grant required');
  }
}
function declaration(id: string, owner: string, admission: InstallationRecordAdmission): void {
  const entry = take(readRegisterEntry(id, admission.generation.register, admission.generation.context));
  ensure(entry.declaration.status === 'live' && !('state' in entry.approvedIn)
    && entry.declaration.declaredBy.path.startsWith(`src/${ownerDirectories[owner]}/`),
  `selection: reference declaration is unapproved or wrong-owner: ${id}`);
}
const historicalSelections = new WeakMap<InstallationRecordAdmission, Map<string, InstallationSelection>>();
function validate(input: unknown, context: OwnedBodyContext, admission: InstallationRecordAdmission): InstallationSelection {
  // Historical validation is a pure function of the signed origin bytes and its immutable cone;
  // origin-mode validation carries the active admission guard and is never memoized.
  if (context.mode !== 'historical') return validateUncached(input, context, admission);
  const key = `${encoded(context.origin).hash}|${encoded(input).hash}|${context.facts.schemas.length}|${context.facts.ownedBodies?.length ?? 0}`;
  const memo = historicalSelections.get(admission) ?? new Map<string, InstallationSelection>();
  historicalSelections.set(admission, memo);
  const cached = memo.get(key); if (cached) return cached;
  const record = validateUncached(input, context, admission); memo.set(key, record); return record;
}
function validateUncached(input: unknown, context: OwnedBodyContext, admission: InstallationRecordAdmission): InstallationSelection {
  const record = closed(input);
  ensure(context.origin.kind === 'assembly-InstallationSelection', 'selection: wrong fact kind');
  ensure(record.scope === admission.scopeId, 'selection: scope differs');
  const basis = installationRecordBasis(record, admission, context.facts, context.origin);
  ensure(admission.packageRecords.some(candidate => encoded(candidate).bytes === encoded(record).bytes),
    'selection: body not in approved package');
  declaration(record.implementation, record.owner, admission);
  const owners = new Set<string>();
  const factKinds = new Set<string>();
  const minimumReferences: Readonly<Record<InstallationRole, number>> = {
    'operator-surface': 1, 'challenge-verifier': 3, 'verified-act-intake': 1,
    'minimal-plane-fold': 2, 'minimal-plane-replay': 2, 'minimal-responder': 3,
    'prerequisite-cut': 2, 'prerequisite-recovery': 2, 'delivery-witness': 2,
    'fact-segment': 2, 'verification-clock': 2, 'conversation-route': 2,
    'delivery-evidence-service': 2, 'scope-protection': 2,
  };
  ensure(record.references.includes(record.implementation)
    && record.references.length >= minimumReferences[record.role], 'selection: role-specific references missing');
  for (const reference of record.references) {
    const row = basis.snapshot.entries.find(row => row.fact.id === reference);
    if (row) {
      ensure(!row.taint.length && !row.conflicts.length && context.origin.predecessors.required.includes(row.fact.id),
        'selection: unavailable owner reference or missing predecessor');
      const schema = context.facts.schemas.find(schema => schema.kind === row.fact.kind && schema.version === row.fact.schemaVersion);
      const field = schema?.fields.record;
      ensure(field?.kind === 'owned' || row.fact.kind === 'conversation-binding', 'selection: owner-decodable reference required');
      ensure(row.fact.machine === record.machine, 'selection: reference machine differs');
      const ownerBody = take(decodeHistoricalBody(row.fact, basis.facts, causalStanding(row.fact, basis.facts, false).decode)).fields.record;
      if (ownerBody && typeof ownerBody === 'object' && !Array.isArray(ownerBody)) {
        for (const [field, expected] of [['installation', record.installation], ['scope', record.scope],
          ['machine', record.machine], ['generation', record.generation]] as const) {
          const observed = (ownerBody as Readonly<Record<string, Json>>)[field];
          if (observed !== undefined) ensure(observed === expected || field === 'generation'
            && typeof observed === 'object' && observed !== null && !Array.isArray(observed) && (observed as Readonly<Record<string, Json>>).id === expected,
          `selection: owner reference ${field} differs`);
        }
      }
      owners.add(field?.kind === 'owned' ? field.owner : 'part-four'); factKinds.add(row.fact.kind);
    } else {
      const entry = take(readRegisterEntry(reference, admission.generation.register, admission.generation.context));
      const owner = Object.entries(ownerDirectories).find(([, path]) => entry.declaration.declaredBy.path.startsWith(`src/${path}/`))?.[0];
      ensure(owner, 'selection: declaration has no public owner'); declaration(reference, owner, admission); owners.add(owner);
    }
  }
  const requiredOwners: readonly string[] = record.role === 'minimal-plane-fold' ? ['part-eleven', 'part-two']
    : record.role === 'minimal-responder' ? ['part-eleven', 'part-five', 'part-six']
    : record.role === 'conversation-route' ? ['part-four', 'part-twelve']
    : ['delivery-witness', 'delivery-evidence-service'].includes(record.role) ? ['part-nine', 'part-twelve'] : [record.owner];
  ensure(requiredOwners.every(owner => owners.has(owner)), 'selection: role-specific owner references missing');
  if (record.role === 'minimal-responder') ensure(factKinds.has('transport-AdmissionReservation'),
    'selection: Six reservation fact required');
  if (record.role === 'conversation-route') ensure(factKinds.has('conversation-binding'),
    'selection: Four conversation binding fact required');
  if (record.role === 'scope-protection') {
    ensure(record.references.includes(record.implementation) && record.references.length > 1,
      'selection: scope policy and exact artifact classes required');
    for (const id of record.references.filter(id => id !== record.implementation)) {
      const artifact = take(readRegisterEntry(id, admission.generation.register, admission.generation.context));
      ensure(artifact.declaration.kind === 'protected artifacts', 'selection: exact declared artifact class required');
    }
  }
  if (record.validUntil !== 'not-time-bound') {
    const horizon = take(decode('Measurement', JSON.parse(record.validUntil), admission.boundary)) as Clock;
    ensure(horizon.subject.kind === 'clock' && horizon.subject.instance === context.origin.at.subject.instance
      && horizon.unit === context.origin.at.unit && horizon.value >= context.origin.at.value, 'selection: invalid owner-comparable horizon');
  }
  if (context.mode === 'origin') {
    ensure(active.get(admission) === encoded(record).hash, 'selection: active owner admission guard required');
    ensure(record.generation === context.facts.decode.register.generation.id, 'selection: stale generation');
  }
  return record;
}
export function decodeInstallationSelectionAtOrigin(input: unknown, context: OwnedBodyContext,
  admission: InstallationRecordAdmission): Result<InstallationSelection> {
  return boundary('InstallationSelectionOrigin', input, admission.boundary, () => {
    ensure(context.mode === 'origin', 'selection: origin mode required'); return validate(input, context, admission);
  });
}
export function decodeHistoricalInstallationSelection(input: unknown, context: OwnedBodyContext,
  admission: InstallationRecordAdmission): Result<InstallationSelection> {
  return boundary('InstallationSelectionHistorical', input, admission.boundary, () => {
    ensure(context.mode === 'historical', 'selection: historical mode required'); return validate(input, context, admission);
  });
}
export function installationSelectionSchemas(scope: Scope): readonly FactSchema[] {
  return [{ kind: 'assembly-InstallationSelection', version: 1, fields: { record: { kind: 'owned', owner: 'part-ten', name: 'InstallationSelection' } },
    machineScope: 'shared', standing: 'delegate', action: 'work', scope, causallyBound: true, requiredReferences: [], authority: 'none' }];
}
export function registerInstallationSelectionBody(admission: InstallationRecordAdmission): Result<OwnedBodyRegistration> {
  return registerOwnedBody({ name: 'InstallationSelection', owner: 'part-ten', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {}, decodeCurrent: (value, context) => {
      try { return { ok: true, value: take((context.mode === 'origin' ? decodeInstallationSelectionAtOrigin
        : decodeHistoricalInstallationSelection)(value, context, admission)) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'selection refused' }; }
    } }, shape, admission.boundary);
}
export function recordInstallationSelection(input: unknown, writer: InstallationRecordWriter): Result<FactEnvelope> {
  return boundary('RecordInstallationSelection', input, writer.admission.boundary, () => {
    const record = closed(input), facts = { ...writer.context, facts: take(writer.store.read()) };
    const basis = installationRecordBasis(record, writer.admission, facts);
    ensure(record.generation === writer.context.decode.register.generation.id,
      'installation: stale current generation');
    ensure(writer.admission.packageRecords.some(candidate => encoded(candidate).bytes === encoded(record).bytes),
      'installation: record outside approved package');
    installationRecordAuthor('assembly-InstallationSelection', record, writer, basis);
    const sameKey = basis.snapshot.entries.filter(row => row.fact.kind === 'assembly-InstallationSelection').filter(row => {
      const prior = (row.fact.body as { record?: InstallationSelection }).record;
      return prior?.id === record.id || prior?.installation === record.installation && prior.generation === record.generation
        && prior.scope === record.scope && prior.role === record.role && prior.instance === record.instance;
    });
    ensure(sameKey.every(row => !row.taint.length && !row.conflicts.length
      && encoded(row.fact.body).bytes === encoded({ record }).bytes), 'selection: immutable same-key conflict inhibits scope');
    ensure(sameKey.length <= 1, 'selection: duplicate identity inhibits scope');
    if (sameKey[0]) return sameKey[0].fact;
    const required = [...new Set([...basis.required, ...writer.context.grants.filter(row => row.grant.grantee.id === writer.principal.id).map(row => row.factId), ...record.references.filter(id => facts.facts.some(fact => fact.id === id))])].sort();
    active.set(writer.admission, encoded(record).hash);
    try { return take(authorAndAppend({ kind: 'assembly-InstallationSelection', schemaVersion: 1, machine: record.machine,
      principal: json(writer.principal), provenance: json(writer.principal.provenance), at: json(writer.at), body: json({ record }), required },
    writer.context, writer.store, writer.privateKey)).fact; }
    finally { active.delete(writer.admission); }
  });
}
