import { canonical, consumeResult } from '../../src/index.js';
import type { BoundaryContext, Hash, Result } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { decodeLocalCapabilityPackage } from '../../src/assembly/index.js';
import type { ScheduledWorkManifest } from '../../src/scheduled/index.js';
import { fixture as coreFixture } from '../fixtures.js';

export function value<T>(result: Result<T>): T {
  return consumeResult(result, { Success: item => item, Refused: refusal => { throw new Error(refusal.detail); } });
}
export function clone<T>(input: T): T { return JSON.parse(JSON.stringify(input)) as T; }
const h = (character: string) => `sha256:${character.repeat(64)}` as Hash;

export function scheduledFixture() {
  const core = coreFixture();
  const context: BoundaryContext = { preserved: 'capture:scheduled-manifest', site: 'types.decode',
    register: { generation: core.ctx.register.generation, sites: core.ctx.register.sites, entries: core.ctx.register.entries } };
  const manifest: ScheduledWorkManifest = {
    type: 'ScheduledWorkManifest', schemaVersion: 2,
    identity: { jobId: 'job:maintenance', displayName: 'Maintenance', accountableOwner: 'alice', packageVersion: '1.0.0', contentDigest: h('a') },
    schedule: { kind: 'one-shot', at: '2027-01-01T00:00:00Z', activationInstant: '2026-12-01T00:00:00Z',
      timeZoneDataVersion: 'tzdb:2027a', calendarPolicyVersion: 'calendar:earlier-v1', currentLatenessCutoffMs: 300_000 },
    work: { entryPoint: 'maintenance', bodyDigest: h('b'), resultDestination: 'result:maintenance', groundingContract: 'grounding:maintenance', predecessors: [] },
    authority: { systemPrincipal: 'principal:scheduler', standingGrant: 'grant:scheduler', scope: 'scope:installation', operationClasses: ['observe'], authorizations: [] },
    bounds: { runBudget: 'budget:maintenance', exitTest: 'exit:maintenance', durationMs: 60_000, attempts: 1, concurrency: 1, tokens: 0, money: 0, bytes: 4096, notifications: 1 },
    admission: { priority: 'maintenance', eligibleAssemblies: ['assembly:darwin'], eligibleMachines: ['machine-a', 'machine-b'], requiredCapabilities: ['filesystem:read'], capacityEvidencePolicy: 'capacity:unknown-bounded', placement: 'global-once', catchUp: 'latest',
      classWeights: { low: 1, maintenance: 20, medium: 20, high: 30, critical: 30 }, creditCap: 100, promotionAfterMs: 60_000, minimumMaintenanceShare: 0.2, maxHighPriorityEligibilityToAdmissionMs: 60_000 },
    intelligence: { route: 'route:none', floor: 'floor:programmatic', profile: 'profile:maintenance', supervision: 'tier0', businessSteps: ['inspect'], capturePolicy: 'capture:exact', gradingPolicy: 'grade:typed', failureDirection: 'closed', postCompletionLearning: 'off' },
    effectsAndProof: { operations: [], operationIdentityPolicy: 'operation:stable', verificationPlan: 'verification:maintenance', acceptedOutcomeEvidence: ['result:typed'], uncertaintyOwner: 'run:investigation' },
    recovery: { parentDuty: 'loop:maintenance', rollingBudget: 'budget:rolling', loopPolicy: 'loop:bounded', backoffPolicy: 'backoff:bounded', breakerOutcomeWindow: 'window:causal-cohort', recoveryPolicy: 'recovery:observe', maxOverdueAgeMs: 86_400_000, exhaustionDestination: 'result:exhausted' },
    presentation: { destination: 'surface:schedule', pushPolicy: 'pull-first', description: 'Runs bounded maintenance.' },
    activation: { requiredChecks: ['P15-NF-08', 'P15-NF-11'], semanticReview: 'review:scheduled', assemblyCompatibility: 'assembly:darwin', holderProof: 'holder:challenge', rollout: 'dark' },
  };
  const manifestBytes = value(canonical(manifest)).bytes;
  const packageInput = { type: 'LocalCapabilityPackage', schemaVersion: 1, id: 'package:scheduled', predecessors: [], dependencyFacts: [],
    namespace: 'alice.scheduled-maintenance', ownerPrincipal: 'alice', version: '1.0.0', contentDigest: h('a'), sourceDigest: h('c'), parent: '', upstream: '', priorPackage: '',
    portRequirements: [], dependencies: [], entrypoints: [{ id: 'manifest', path: 'scheduled/manifest.json', digest: hashBytes(manifestBytes) }, { id: 'maintenance', path: 'dist/maintenance.js', digest: h('b') }],
    declarationIds: ['job:maintenance'], dataScopes: ['installation'], custodyScopes: [], grants: ['grant:scheduler'], resources: [{ resource: 'cpu-ms', limit: 60_000 }], platforms: ['darwin-arm64'], modes: ['dark'], migrationCompatibility: ['none'], rollbackCompatibility: ['1.0.0'],
    checks: { unit: ['P15-NF-08'], integration: ['P15-NF-11'], lifecycle: ['P15-NF-08'] }, maturation: ['dark'], probes: ['probe:schedule'], awarenessSource: 'scheduled.maintenance',
  };
  const pkg = value(decodeLocalCapabilityPackage(packageInput, context));
  return { core, context, manifest, manifestBytes, package: pkg, h };
}
