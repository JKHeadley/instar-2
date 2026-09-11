import type { BoundaryContext, Hash, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { boundary, ensure, freeze } from './boundary.js';
import { parseUnambiguousJson } from './json.js';

export interface LegacyScheduledImportPlan {
  readonly slug: string;
  readonly sourceBytes: string;
  readonly sourceDigest: Hash;
  readonly model: string;
  readonly placement: 'global-once' | 'every-eligible-machine';
  readonly postCompletionLearning: 'off' | 'required';
  readonly activation: 'eligible' | 'inhibited';
  readonly residue: readonly string[];
}

/** One-way 1.x policy conversion. It never creates an active timer or a second scheduling authority. */
export function importLegacyScheduledJob(sourceBytes: unknown, context: BoundaryContext): Result<LegacyScheduledImportPlan> {
  return boundary('LegacyScheduledJobImport', sourceBytes, context, () => {
    ensure(typeof sourceBytes === 'string' && sourceBytes.length > 0, 'legacy job source must be nonempty JSON text');
    const raw = parseUnambiguousJson(sourceBytes);
    ensure(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'legacy job source must be an object');
    const value = raw as Record<string, unknown>;
    const required = ['slug', 'executionMode', 'livingSkills', 'serverComposition', 'perMachineIndependent', 'machineLocalEffects'];
    const optional = ['model', 'integrationGate'];
    ensure(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key)),
      'legacy job source has missing or unexpected fields');
    ensure(typeof value.slug === 'string' && value.slug.length > 0, 'legacy slug must be nonempty text');
    ensure(value.executionMode === 'script' || value.executionMode === 'model-session', 'legacy execution mode is unknown');
    ensure(value.serverComposition === 'default-with-integration-gate' || value.serverComposition === 'model-session-without-integration-gate',
      'legacy server composition is unknown');
    ensure(typeof value.perMachineIndependent === 'boolean' && typeof value.machineLocalEffects === 'boolean', 'legacy placement flags must be boolean');
    const living = value.livingSkills;
    ensure(living !== null && typeof living === 'object' && !Array.isArray(living)
      && Object.keys(living).length === 1 && typeof (living as Record<string, unknown>).enabled === 'boolean', 'legacy livingSkills must contain only enabled');
    ensure(value.integrationGate === undefined || typeof value.integrationGate === 'boolean', 'legacy integrationGate must be boolean when supplied');
    ensure(value.model === undefined || typeof value.model === 'string' && value.model.length > 0, 'legacy model must be nonempty text when supplied');

    const residue: string[] = [];
    let postCompletionLearning: LegacyScheduledImportPlan['postCompletionLearning'] = 'off';
    if (value.executionMode === 'model-session') {
      if (value.serverComposition === 'model-session-without-integration-gate') residue.push('explicit post-completion learning choice required');
      else if ((living as Record<string, boolean>).enabled && value.integrationGate !== false) postCompletionLearning = 'required';
    }
    if (value.perMachineIndependent && !value.machineLocalEffects) residue.push('per-machine work is not proven machine-local');
    return freeze({ slug: value.slug, sourceBytes, sourceDigest: hashBytes(sourceBytes),
      model: value.model ?? 'sonnet', placement: value.perMachineIndependent && value.machineLocalEffects ? 'every-eligible-machine' : 'global-once',
      postCompletionLearning, activation: residue.length ? 'inhibited' : 'eligible', residue: freeze(residue) } as LegacyScheduledImportPlan);
  });
}
