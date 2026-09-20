// P10-SI-11/12: the finite import plan for ONE operator-prepared package. Planning is read-only:
// it checks the external package pin before parsing, binds the package to the independently verified
// bootstrap, and classifies each predeclared record as append or reuse against the opened root. An
// equal rerun reuses every fact; a changed immutable input refuses before any history write. The
// append itself is an automated critical install stage: it runs only under Seven's current bounded
// step supervisor, which is not landed at this baseline, so the consumer refuses by its named hold.
import type { BoundaryContext, DecodeContext, Json, Result } from '../index.js';
import { hashBytes, secretShape } from '../facts/index.js';
import type { FactContext } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { isVerifiedProductionBootstrap } from './production-installation-loader.js';
import type { InstallationImmutableIO, VerifiedProductionBootstrap } from './production-installation-loader.js';
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
}
const issued = new WeakSet<object>();
const absolute = (path: string) => path.startsWith('/') && path !== '/'
  && path.slice(1).split('/').every(part => part.length > 0 && part !== '.' && part !== '..');

export function planInstallationImport(input: Readonly<{ bootstrap: VerifiedProductionBootstrap; root: string; packageLocator: string;
  expectedPackageDigest: string; facts: FactContext; limits: Readonly<{ maxSteps: number; maxBytes: number }>; recoveryOwner: string }>,
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
    const seen = new Set<string>();
    const steps = prepared.records.map((raw, index): InstallationImportStep => {
      const record = raw as Readonly<Record<string, Json>>;
      ensure(record && typeof record === 'object' && !Array.isArray(record) && typeof record.type === 'string'
        && Object.hasOwn(recordKinds, record.type) && record.schemaVersion === 1, `import: record ${index} is not an approved installation body`);
      const type = record.type as ImportRecordType, { id, ...fields } = record;
      ensure(typeof id === 'string' && id === encoded(fields).hash, `import: record ${index} immutable digest differs`);
      ensure(record.installation === prepared.installation && record.generation === prepared.generation
        && (record.scope === undefined || record.scope === prepared.scope), `import: record ${index} is outside the package installation, scope or generation`);
      ensure(!seen.has(id), `import: duplicate record ${id}`); seen.add(id);
      const kind = recordKinds[type];
      const stored = input.facts.facts.filter(fact => fact.kind === kind)
        .map(fact => ({ fact, body: (fact.body as { record?: Readonly<Record<string, Json>> }).record }));
      const equal = stored.filter(row => row.body && encoded(row.body).bytes === encoded(record).bytes);
      const conflicting = stored.filter(row => row.body && encoded(row.body).bytes !== encoded(record).bytes
        && sameKeyFields[type].every(field => row.body![field] === record[field]));
      ensure(conflicting.length === 0, `import: changed immutable input conflicts with recorded configuration: record ${index}`);
      ensure(equal.length <= 1, `import: duplicate recorded identity inhibits scope: record ${index}`);
      return { index, type, kind, record: id, action: equal.length ? 'reuse' : 'append', existing: equal[0]?.fact.id ?? null };
    });
    const plan = freeze({ type: 'InstallationImportPlan' as const, schemaVersion: 1 as const, installation: prepared.installation,
      scope: prepared.scope, generation: prepared.generation, packageDigest: input.expectedPackageDigest,
      bootstrapDigest: input.bootstrap.digest, steps, expectedWrites: steps.filter(step => step.action === 'append').length,
      limits: { maxSteps: input.limits.maxSteps, maxBytes: input.limits.maxBytes },
      stop: 'first-refusal-leaves-remaining-steps-unwritten' as const, recoveryOwner: input.recoveryOwner,
      supervisorHold: installationSupervisorHold }) as unknown as InstallationImportPlan;
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
