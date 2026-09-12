import type { BoundaryContext, Hash, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { boundary, ensure, freeze } from './boundary.js';
import { parseCronV1 } from './cron.js';
import { parseUnambiguousJson } from './json.js';

const legacyModels = ['opus', 'sonnet', 'haiku'] as const;
const legacyPriorities = ['critical', 'high', 'medium', 'low'] as const;

export interface LegacyScheduledImportPlan {
  readonly slug: string;
  readonly sourceBytes: string;
  readonly sourceDigest: Hash;
  readonly sourceKind: 'legacy-job-declaration' | 'compatibility-policy-envelope';
  readonly schedule?: string;
  readonly priority?: typeof legacyPriorities[number];
  readonly expectedDurationMinutes?: number;
  readonly model: typeof legacyModels[number];
  readonly placement: 'global-once' | 'every-eligible-machine';
  readonly postCompletionLearning: 'off' | 'required';
  readonly livingSkills?: Readonly<{ readonly enabled: boolean }>;
  readonly integrationGate?: boolean;
  readonly activation: 'eligible' | 'inhibited';
  readonly residue: readonly string[];
}

function exact(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], label: string): void {
  ensure(required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key)),
  `${label} has missing or unexpected fields`);
}

function model(value: unknown): typeof legacyModels[number] {
  ensure(value === undefined || legacyModels.includes(value as typeof legacyModels[number]),
    'legacy model is outside the closed 1.x model set');
  return (value ?? 'sonnet') as typeof legacyModels[number];
}

function slug(value: unknown): string {
  ensure(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value), 'legacy slug is invalid');
  return value;
}

function actualDeclaration(value: Record<string, unknown>, sourceBytes: string): LegacyScheduledImportPlan {
  const required = ['slug', 'origin', 'schedule', 'priority', 'expectedDurationMinutes', 'enabled', 'execute'];
  const optional = ['model', 'tags', 'topicId', 'telegramNotify', 'machines', 'gate', 'unrestrictedTools', 'manifestVersion',
    'perMachineIndependent', 'mcpAccess', 'disabledAtBodyHash', 'livingSkills', 'integrationGate'];
  exact(value, required, optional, 'legacy job declaration');
  const id = slug(value.slug);
  ensure(value.origin === 'instar' || value.origin === 'user', 'legacy origin is unknown');
  ensure(typeof value.schedule === 'string' && value.schedule.length > 0, 'legacy schedule must be nonempty text');
  parseCronV1(value.schedule);
  ensure(legacyPriorities.includes(value.priority as typeof legacyPriorities[number]), 'legacy priority is unknown');
  ensure(typeof value.expectedDurationMinutes === 'number' && Number.isFinite(value.expectedDurationMinutes)
    && value.expectedDurationMinutes > 0, 'legacy expectedDurationMinutes must be positive and finite');
  ensure(typeof value.enabled === 'boolean', 'legacy enabled must be boolean');
  const execute = value.execute;
  ensure(execute !== null && typeof execute === 'object' && !Array.isArray(execute), 'legacy execute must be an object');
  const execution = execute as Record<string, unknown>;
  exact(execution, ['type'], ['value', 'args'], 'legacy execute');
  const executionType = execution.type;
  ensure(typeof executionType === 'string' && ['skill', 'prompt', 'script', 'agentmd'].includes(executionType),
    'legacy execute type is unknown');
  if (executionType === 'agentmd') ensure(execution.value === undefined, 'legacy agentmd execute value must be absent');
  else ensure(typeof execution.value === 'string' && execution.value.length > 0, 'legacy execute value must be nonempty text');
  ensure(execution.args === undefined || typeof execution.args === 'string', 'legacy execute args must be text');
  ensure(value.perMachineIndependent === undefined || typeof value.perMachineIndependent === 'boolean', 'legacy perMachineIndependent must be boolean');
  ensure(value.mcpAccess === undefined || value.mcpAccess === 'project' || value.mcpAccess === 'none', 'legacy mcpAccess is unknown');
  ensure(value.tags === undefined || Array.isArray(value.tags) && value.tags.every(item => typeof item === 'string'), 'legacy tags must be text');
  ensure(value.machines === undefined || Array.isArray(value.machines) && value.machines.every(item => typeof item === 'string'), 'legacy machines must be text');
  ensure(value.topicId === undefined || Number.isSafeInteger(value.topicId) && Number(value.topicId) >= 0, 'legacy topicId is invalid');
  ensure(value.telegramNotify === undefined || typeof value.telegramNotify === 'boolean' || value.telegramNotify === 'on-alert', 'legacy telegramNotify is invalid');
  ensure(value.gate === undefined || typeof value.gate === 'string', 'legacy gate must be text');
  ensure(value.unrestrictedTools === undefined || typeof value.unrestrictedTools === 'boolean', 'legacy unrestrictedTools must be boolean');
  ensure(value.manifestVersion === undefined || Number.isSafeInteger(value.manifestVersion) && Number(value.manifestVersion) >= 0, 'legacy manifestVersion is invalid');
  ensure(value.disabledAtBodyHash === undefined || typeof value.disabledAtBodyHash === 'string', 'legacy disabledAtBodyHash must be text');
  const living = value.livingSkills;
  ensure(living === undefined || living !== null && typeof living === 'object' && !Array.isArray(living)
    && Object.keys(living).length === 1 && typeof (living as Record<string, unknown>).enabled === 'boolean',
  'legacy livingSkills must contain only enabled');
  ensure(value.integrationGate === undefined || typeof value.integrationGate === 'boolean',
    'legacy integrationGate must be boolean when supplied');
  const importedModel = model(value.model);
  const residue: string[] = [];
  if (value.enabled === false) residue.push('legacy job is disabled; explicit package enable choice required');
  if (value.perMachineIndependent === true) residue.push('per-machine work is not proven machine-local');
  const script = executionType === 'script';
  const postCompletionLearning = !script && (living as { enabled?: boolean } | undefined)?.enabled === true
    && value.integrationGate !== false ? 'required' as const : 'off' as const;
  const plan: LegacyScheduledImportPlan = { slug: id, sourceBytes, sourceDigest: hashBytes(sourceBytes),
    sourceKind: 'legacy-job-declaration', schedule: value.schedule as string,
    priority: value.priority as typeof legacyPriorities[number], expectedDurationMinutes: value.expectedDurationMinutes as number,
    model: importedModel, placement: 'global-once', postCompletionLearning,
    ...(living === undefined ? {} : { livingSkills: freeze({ enabled: (living as { enabled: boolean }).enabled }) }),
    ...(value.integrationGate === undefined ? {} : { integrationGate: value.integrationGate as boolean }),
    activation: residue.length ? 'inhibited' : 'eligible', residue: freeze(residue) };
  return freeze(plan);
}

function compatibilityEnvelope(value: Record<string, unknown>, sourceBytes: string): LegacyScheduledImportPlan {
  const required = ['slug', 'executionMode', 'livingSkills', 'serverComposition', 'perMachineIndependent', 'machineLocalEffects'];
  const optional = ['model', 'integrationGate', 'schedule', 'priority', 'expectedDurationMinutes'];
  exact(value, required, optional, 'legacy compatibility policy envelope');
  const id = slug(value.slug);
  ensure(value.executionMode === 'script' || value.executionMode === 'model-session', 'legacy execution mode is unknown');
  ensure(value.serverComposition === 'default-with-integration-gate' || value.serverComposition === 'model-session-without-integration-gate',
    'legacy server composition is unknown');
  ensure(typeof value.perMachineIndependent === 'boolean' && typeof value.machineLocalEffects === 'boolean', 'legacy placement flags must be boolean');
  const living = value.livingSkills;
  ensure(living !== null && typeof living === 'object' && !Array.isArray(living)
    && Object.keys(living).length === 1 && typeof (living as Record<string, unknown>).enabled === 'boolean', 'legacy livingSkills must contain only enabled');
  ensure(value.integrationGate === undefined || typeof value.integrationGate === 'boolean', 'legacy integrationGate must be boolean when supplied');
  const importedModel = model(value.model);
  if (value.schedule !== undefined) {
    ensure(typeof value.schedule === 'string' && value.schedule.length > 0, 'legacy schedule must be nonempty text');
    parseCronV1(value.schedule);
  }
  ensure(value.priority === undefined || legacyPriorities.includes(value.priority as typeof legacyPriorities[number]), 'legacy priority is unknown');
  ensure(value.expectedDurationMinutes === undefined || typeof value.expectedDurationMinutes === 'number'
    && Number.isFinite(value.expectedDurationMinutes) && value.expectedDurationMinutes > 0,
  'legacy expectedDurationMinutes must be positive and finite');
  const residue: string[] = [];
  let postCompletionLearning: LegacyScheduledImportPlan['postCompletionLearning'] = 'off';
  if (value.executionMode === 'model-session') {
    if (value.serverComposition === 'model-session-without-integration-gate') residue.push('explicit post-completion learning choice required');
    else if ((living as Record<string, boolean>).enabled && value.integrationGate !== false) postCompletionLearning = 'required';
  }
  if (value.perMachineIndependent) residue.push('per-machine work is not proven machine-local by an owner witness');
  return freeze({ slug: id, sourceBytes, sourceDigest: hashBytes(sourceBytes), sourceKind: 'compatibility-policy-envelope',
    ...(value.schedule === undefined ? {} : { schedule: value.schedule as string }),
    ...(value.priority === undefined ? {} : { priority: value.priority as typeof legacyPriorities[number] }),
    ...(value.expectedDurationMinutes === undefined ? {} : { expectedDurationMinutes: value.expectedDurationMinutes as number }),
    model: importedModel, placement: 'global-once',
    livingSkills: freeze({ enabled: (living as { enabled: boolean }).enabled }),
    ...(value.integrationGate === undefined ? {} : { integrationGate: value.integrationGate as boolean }),
    postCompletionLearning, activation: residue.length ? 'inhibited' : 'eligible', residue: freeze(residue) } as LegacyScheduledImportPlan);
}

/** One-way 1.x conversion. It never creates an active timer or a second scheduling authority. */
export function importLegacyScheduledJob(sourceBytes: unknown, context: BoundaryContext): Result<LegacyScheduledImportPlan> {
  return boundary('LegacyScheduledJobImport', sourceBytes, context, () => {
    ensure(typeof sourceBytes === 'string' && sourceBytes.length > 0, 'legacy job source must be nonempty JSON text');
    const raw = parseUnambiguousJson(sourceBytes);
    ensure(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'legacy job source must be an object');
    const value = raw as Record<string, unknown>;
    return Object.hasOwn(value, 'execute') ? actualDeclaration(value, sourceBytes) : compatibilityEnvelope(value, sourceBytes);
  });
}
