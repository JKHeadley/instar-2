import { boundary, ensure, freeze } from './boundary.js';
import type { AssemblyDecodeContext, GrowthEpisode, GrowthObservation, GrowthPolicy } from './contracts.js';

export function deriveGrowthEpisodes(policy: GrowthPolicy, observations: readonly GrowthObservation[], existing: readonly GrowthEpisode[], context: AssemblyDecodeContext) {
  return boundary('GrowthEpisodeDerivation', { policy, observations }, context, () => {
    const relevant = observations.filter(row => row.policy === policy.id);
    const scopes = [...new Set(relevant.map(row => row.subjectScope))].sort(); const result = [...existing];
    for (const scope of scopes) {
      const rows = relevant.filter(row => row.subjectScope === scope);
      const breached = rows.filter(row => row.completion === 'incomplete' || row.comparisons.some(item => item.result === 'soft-breach' || item.result === 'hard-breach' || item.result === 'unknown'));
      if (!breached.length) continue; const key = `growth:${policy.id}:${scope}`; const prior = result.find(row => row.key === key);
      if (!prior) result.push(freeze({ key, policy: policy.id, scope, state: 'open', ownerRun: policy.ownerRun, observations: breached.map(row => row.id) }));
      else if (prior.state === 'open') result[result.indexOf(prior)] = freeze({ ...prior, observations: [...new Set([...prior.observations, ...breached.map(row => row.id)])] });
    }
    ensure(new Set(result.map(row => row.key)).size === result.length, 'duplicate growth episode'); return freeze(result);
  });
}

export function closeGrowthEpisode(episode: GrowthEpisode, observation: GrowthObservation, context: AssemblyDecodeContext) {
  return boundary('GrowthEpisodeClosure', { episode, observation }, context, () => {
    ensure(episode.state === 'open' && observation.policy === episode.policy && observation.subjectScope === episode.scope, 'growth closure identity mismatch');
    ensure(observation.completion === 'complete' && observation.comparisons.length > 0
      && observation.comparisons.every(row => row.kind === 'measured' && row.result === 'within'), 'growth episode requires measured exit workload');
    return freeze({ ...episode, state: 'closed' as const, observations: [...new Set([...episode.observations, observation.id])] });
  });
}
