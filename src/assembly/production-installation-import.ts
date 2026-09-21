// P10-SI-11/12: the finite import plan for ONE operator-prepared package. Planning is read-only:
// it checks the external package pin before parsing, binds the package to the independently verified
// bootstrap, and classifies each predeclared record as append or reuse against the opened root. An
// equal rerun reuses every fact; a changed immutable input refuses before any history write. The
// append itself is an automated critical install stage: it runs only under Seven's current bounded
// step supervisor, which is not landed at this baseline, so the consumer refuses by its named hold.
import type { BoundaryContext, DecodeContext, Json, Result } from '../index.js';
import { hashBytes, secretShape, prepareSnapshot } from '../facts/index.js';
import type { FactContext } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { isVerifiedProductionBootstrap } from './production-installation-loader.js';
import type { InstallationImmutableIO, VerifiedProductionBootstrap } from './production-installation-loader.js';
import { decode } from '../index.js';
import { decodeHistoricalInstalledRunGovernanceReference } from '../rungraph/index.js';
import { decodeHistoricalProductionSignerReference } from './production-signer-reference.js';
import { decodeHistoricalInstallationSelection, installationRecordBasis, installationRoleOwners } from './installation-selection.js';
import type { InstallationRecordAdmission } from './installation-selection.js';
import { installationSupervisorHold } from './production-installation-report.js';

const recordKinds = Object.freeze({ InstallationSelection: 'assembly-InstallationSelection',
  ProductionSignerReference: 'assembly-ProductionSignerReference',
  InstalledRunGovernanceReference: 'rungraph-installed-governance-reference' } as const);
type ImportRecordType = keyof typeof recordKinds;
/** Fields that identify "the same configuration slot"; an unequal record under the same key inhibits the scope. */
const sameKeyFields: Readonly<Record<ImportRecordType, readonly string[]>> = Object.freeze({
  InstallationSelection: ['installation', 'scope', 'generation', 'role', 'instance'],
  ProductionSignerReference: ['installation', 'machine', 'generation'],
  InstalledRunGovernanceReference: ['installation', 'generation'] });

export interface InstallationImportStep {
  readonly index: number; readonly type: ImportRecordType; readonly kind: string; readonly record: string;
  readonly action: 'append' | 'reuse'; readonly existing: string | null;
  /** Unappended bodies have no owner origin verdict; a structural preflight never supplies one. */
  readonly validation: 'owner-history-validated' | 'held-owner-origin-validation';
}
declare class PlanIdentity { private readonly issuedImportPlan: true }
export interface InstallationImportPlan extends PlanIdentity {
  readonly type: 'InstallationImportPlan'; readonly schemaVersion: 1;
  readonly installation: string; readonly scope: string; readonly generation: string;
  readonly packageDigest: string; readonly bootstrapDigest: string;
  readonly steps: readonly InstallationImportStep[]; readonly expectedWrites: number;
  readonly limits: Readonly<{ maxSteps: number; maxBytes: number }>;
  readonly stop: 'first-refusal-leaves-remaining-steps-unwritten'; readonly recoveryOwner: string;
  readonly supervisorHold: typeof installationSupervisorHold;
  readonly claim: 'held';
}
const issued = new WeakSet<object>();
const absolute = (path: string) => path.startsWith('/') && path !== '/'
  && path.slice(1).split('/').every(part => part.length > 0 && part !== '.' && part !== '..');

export function planInstallationImport(input: Readonly<{ bootstrap: VerifiedProductionBootstrap; root: string; packageLocator: string;
  expectedPackageDigest: string; facts: FactContext; admission: InstallationRecordAdmission; limits: Readonly<{ maxSteps: number; maxBytes: number }>; recoveryOwner: string }>,
io: InstallationImmutableIO, context: DecodeContext & BoundaryContext): Result<InstallationImportPlan> {
  return boundary('InstallationImportPlan', null, context, () => {
    ensure(isVerifiedProductionBootstrap(input.bootstrap), 'import: independently verified external bootstrap required');
    ensure(Number.isSafeInteger(input.limits?.maxSteps) && input.limits.maxSteps > 0 && input.limits.maxSteps <= 256
      && Number.isSafeInteger(input.limits.maxBytes) && input.limits.maxBytes > 0 && input.limits.maxBytes <= 1048576,
    'import: finite step and byte limits required');
    ensure(typeof input.recoveryOwner === 'string' && input.recoveryOwner.length > 0, 'import: recovery owner required');
    ensure(absolute(input.root) && absolute(input.packageLocator), 'import: canonical absolute locations required');
    const outside = (path: string) => absolute(path) && path !== input.root && !path.startsWith(`${input.root}/`);
    ensure(outside(input.packageLocator), 'import: package locator must be outside authenticated root');
    ensure(/^sha256:[a-f0-9]{64}$/.test(input.expectedPackageDigest), 'import: external package digest required');
    const loaded = take(io.read(input.packageLocator));
    ensure(outside(loaded.realPath), 'import: resolved package locator is inside authenticated root');
    ensure(loaded.bytes.length <= input.limits.maxBytes && hashBytes(loaded.bytes) === input.expectedPackageDigest,
      'import: externally pinned package digest differs');
    ensure(!secretShape(loaded.bytes), 'import: private credential bytes forbidden');
    // Digest verification precedes interpretation of every package field.
    const prepared = JSON.parse(loaded.bytes) as { installation: string; scope: string; generation: string; records: Json[] };
    ensure(prepared && typeof prepared === 'object' && !Array.isArray(prepared)
      && Object.keys(prepared).sort().join(',') === 'generation,installation,records,scope', 'import: closed prepared package required');
    ensure(prepared.installation === input.bootstrap.package.installation && prepared.generation === input.bootstrap.package.generation,
      'import: package installation or generation differs from the verified bootstrap');
    ensure(typeof prepared.scope === 'string' && prepared.scope.length > 0, 'import: package scope required');
    ensure(Array.isArray(prepared.records) && prepared.records.length > 0 && prepared.records.length <= input.limits.maxSteps,
      'import: a finite nonempty predeclared record list within the step limit is required');
    // These are the public bodies' inert required fields, not a substitute origin decoder.
    // Semantic checks that need an actual signed origin remain explicitly held on append steps.
    const fields: Record<ImportRecordType, readonly string[]> = {
      InstallationSelection: ['type', 'schemaVersion', 'id', 'installation', 'machine', 'scope', 'role', 'instance', 'implementation', 'owner', 'generation', 'references', 'validUntil'],
      ProductionSignerReference: ['type', 'schemaVersion', 'id', 'installation', 'machine', 'signer', 'keySet', 'generation', 'bootstrapDigest'],
      InstalledRunGovernanceReference: ['type', 'schemaVersion', 'id', 'installation', 'scope', 'generation', 'contract', 'feature', 'bound', 'gates', 'capture', 'groundingPolicy'],
    };
    const text = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 4096;
    const seen = new Set<string>(), packageKeys = new Map<string, string>();
    const records = prepared.records.map((raw, index) => {
      const record = raw as Readonly<Record<string, Json>>;
      ensure(record && typeof record === 'object' && !Array.isArray(record) && typeof record.type === 'string'
        && Object.hasOwn(recordKinds, record.type) && record.schemaVersion === 1, `import: record ${index} is not an approved installation body`);
      const type = record.type as ImportRecordType, { id, ...body } = record;
      ensure(Object.keys(record).sort().join(',') === [...fields[type]].sort().join(','), `import: record ${index} closed owner body required`);
      for (const field of fields[type].filter(field => !['schemaVersion', 'references', 'signer', 'gates', 'groundingPolicy'].includes(field)))
        ensure(text(record[field]), `import: record ${index} required owner field ${field}`);
      ensure(typeof id === 'string' && id === encoded(body).hash, `import: record ${index} immutable digest differs`);
      ensure(record.installation === prepared.installation && record.generation === prepared.generation
        && (record.scope === undefined || record.scope === prepared.scope), `import: record ${index} is outside the package installation, scope or generation`);
      if (type === 'InstallationSelection') {
        ensure(typeof record.role === 'string' && Object.hasOwn(installationRoleOwners, record.role)
          && record.owner === installationRoleOwners[record.role as keyof typeof installationRoleOwners], 'import: exact role owner required');
        ensure(Array.isArray(record.references) && record.references.length > 0 && record.references.length <= 128
          && record.references.every(text) && encoded(record.references).bytes === encoded([...new Set(record.references)].sort()).bytes
          && record.references.includes(record.implementation!), 'import: required selection references');
        if (record.validUntil !== 'not-time-bound') take(decode('Measurement', JSON.parse(record.validUntil as string), context));
      } else if (type === 'ProductionSignerReference') {
        const signer = take(decode('SecretRef', record.signer, context)), bootstrap = input.bootstrap.package;
        ensure(record.machine === bootstrap.machine && record.keySet === bootstrap.key.id && record.bootstrapDigest === input.bootstrap.digest
          && encoded(signer).bytes === encoded(bootstrap.signer).bytes, 'import: immutable external bootstrap binding differs');
      } else {
        ensure(Array.isArray(record.gates) && record.gates.length === 6 && record.gates.every(gate => gate && typeof gate === 'object'
          && !Array.isArray(gate) && Object.keys(gate).sort().join(',') === 'decoder,id' && text(gate.id) && text(gate.decoder)),
        'import: required governance gate fields');
        const policy = record.groundingPolicy as Readonly<Record<string, Json>>;
        ensure(policy && typeof policy === 'object' && !Array.isArray(policy)
          && Object.keys(policy).sort().join(',') === 'briefingClasses,entry,maxAge,threshold' && text(policy.entry)
          && Number.isSafeInteger(policy.threshold) && Number(policy.threshold) >= 0 && Number.isSafeInteger(policy.maxAge) && Number(policy.maxAge) > 0
          && Array.isArray(policy.briefingClasses) && policy.briefingClasses.length > 0 && policy.briefingClasses.length <= 64
          && policy.briefingClasses.every(text), 'import: required governance policy fields');
      }
      if (record.machine !== undefined) ensure(record.machine === input.bootstrap.package.machine, 'import: machine differs from bootstrap');
      const key = encoded([type, ...sameKeyFields[type].map(field => record[field])]).bytes;
      ensure(!packageKeys.has(key) || packageKeys.get(key) === id, `import: intra-package immutable key conflict: record ${index}`);
      packageKeys.set(key, id);
      ensure(!seen.has(id), `import: duplicate record ${id}`); seen.add(id);
      return { record, type, id, index };
    });
    const snapshot = take(prepareSnapshot(input.facts.facts, input.facts));
    // Classify only after the WHOLE package preflight, using actual owner history decoders for
    // every stored body of these kinds. Raw bytes or a host's generic registration cannot confer reuse.
    const stored = snapshot.entries.filter(row => Object.values(recordKinds).includes(row.fact.kind as typeof recordKinds[ImportRecordType]))
      .map(row => {
        ensure(!row.taint.length && !row.conflicts.length, 'import: owner history unavailable or conflicted');
        const body = (row.fact.body as { record?: unknown }).record;
        const ownerContext = { ...input.admission.boundary, origin: row.fact, mode: 'historical' as const, facts: input.facts };
        const decoded = row.fact.kind === recordKinds.InstallationSelection
          ? take(decodeHistoricalInstallationSelection(body, ownerContext, input.admission))
          : row.fact.kind === recordKinds.ProductionSignerReference
            ? take(decodeHistoricalProductionSignerReference(body, ownerContext, { ...input.admission, bootstrap: input.bootstrap }))
            : take(decodeHistoricalInstalledRunGovernanceReference(body, ownerContext, input.admission));
        return { fact: row.fact, body: decoded as unknown as Readonly<Record<string, Json>> };
      });
    const steps = records.map(({ record, type, id, index }): InstallationImportStep => {
      const kind = recordKinds[type], candidates = stored.filter(row => row.fact.kind === kind);
      const equal = candidates.filter(row => encoded(row.body).bytes === encoded(record).bytes);
      const conflicting = candidates.filter(row => encoded(row.body).bytes !== encoded(record).bytes
        && sameKeyFields[type].every(field => row.body[field] === record[field]));
      ensure(conflicting.length === 0, `import: changed immutable input conflicts with recorded configuration: record ${index}`);
      ensure(equal.length <= 1, `import: duplicate recorded identity inhibits scope: record ${index}`);
      return { index, type, kind, record: id, action: equal.length ? 'reuse' : 'append', existing: equal[0]?.fact.id ?? null,
        validation: equal.length ? 'owner-history-validated' : 'held-owner-origin-validation' };
    });
    ensure(input.admission.scopeId === prepared.scope && encoded(input.admission.packageRecords).bytes === encoded(prepared.records).bytes,
      'import: package differs from independently approved owner inputs');
    installationRecordBasis({ installation: prepared.installation, generation: prepared.generation, machine: input.bootstrap.package.machine },
      input.admission, input.facts);
    ensure(input.facts.genesis.hash === input.bootstrap.package.genesisHash
      && input.facts.keys.some(key => encoded(key).bytes === encoded(input.bootstrap.package.key).bytes), 'import: source trust pins differ from bootstrap');
    const plan = freeze({ type: 'InstallationImportPlan' as const, schemaVersion: 1 as const, installation: prepared.installation,
      scope: prepared.scope, generation: prepared.generation, packageDigest: input.expectedPackageDigest,
      bootstrapDigest: input.bootstrap.digest, steps, expectedWrites: steps.filter(step => step.action === 'append').length,
      limits: { maxSteps: input.limits.maxSteps, maxBytes: input.limits.maxBytes },
      stop: 'first-refusal-leaves-remaining-steps-unwritten' as const, recoveryOwner: input.recoveryOwner,
      supervisorHold: installationSupervisorHold, claim: 'held' as const }) as unknown as InstallationImportPlan;
    issued.add(plan); return plan;
  });
}
export function isIssuedInstallationImportPlan(plan: InstallationImportPlan): boolean { return issued.has(plan); }

/** P10-SI-12: the supervised append consumer. An import that validates and appends any package fact is an
 * automated critical install stage even when an operator starts it. Seven's bounded step supervisor has no
 * public issuance port at this baseline, so no supplied object can be verified as current: the consumer
 * refuses by its named hold and writes nothing. The later positive executes this same finite plan. */
export function importPreparedInstallationPackage(plan: InstallationImportPlan, supervisor: unknown,
  context: BoundaryContext): Result<never> {
  return boundary('InstallationImport', null, context, (): never => {
    ensure(issued.has(plan), 'import: plan was not issued by the read-only planner');
    void supervisor;
    throw new Error(`NON-EXECUTABLE-UNTIL-${installationSupervisorHold}: ${plan.expectedWrites} predeclared append(s) require Seven's current bounded step supervisor; no history was written`);
  });
}
