import { boundary, ensure, freeze, take } from './boundary.js';
import { assemblyIdentity } from './records.js';
import type { AssemblyDecodeContext, GrowthEpisode, GrowthObservation, GrowthPolicy } from './contracts.js';

export function deriveGrowthEpisodes(policy: GrowthPolicy, observations: readonly GrowthObservation[], existing: readonly GrowthEpisode[], context: AssemblyDecodeContext) {
  return boundary('GrowthEpisodeDerivation', { policy, observations }, context, () => {
    const relevant = observations.filter(row => row.policy === policy.id);
    const scopes = [...new Set(relevant.map(row => row.subjectScope))].sort(); const result = [...existing];
    for (const scope of scopes) {
      const rows = relevant.filter(row => row.subjectScope === scope);
      const breached = rows.filter(row => row.completion === 'incomplete' || row.comparisons.some(item => {
        const declared = policy.subjects.find(subject => subject.subject === item.subject);
        return !declared || item.threshold !== declared.softThreshold || item.value > declared.softThreshold
          || item.result === 'soft-breach' || item.result === 'hard-breach' || item.result === 'unknown';
      }));
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
    let policy: GrowthPolicy | undefined;
    if (context.history) {
      const rows = take(context.history.current());
      const observed = rows.find(row => row.record.type === 'GrowthObservation'
        && assemblyIdentity(row.record).canonicalHash === assemblyIdentity(observation).canonicalHash);
      ensure(observed, 'growth observation absent from signed history');
      const verdict = take(context.history.resolve(observation));
      ensure(verdict.admitted && verdict.completeness === 'complete', verdict.conflicts[0]?.detail
        ?? `growth observation history is ${verdict.completeness}: ${verdict.missing[0] ?? 'unavailable dependency'}`);
      const policyRow = rows.find(row => (row.fact.id === observation.policy || row.record.id === observation.policy) && row.record.type === 'GrowthPolicy');
      ensure(policyRow?.record.type === 'GrowthPolicy' && policyRow.conflicts.length === 0 && policyRow.taint.length === 0, 'growth policy missing, unavailable, or conflicted');
      const policyVerdict = take(context.history.resolve(policyRow.record)); ensure(policyVerdict.admitted, 'growth policy history is not admitted');
      policy = policyRow.record;
    }
    ensure(observation.completion === 'complete' && observation.comparisons.length > 0
      && observation.comparisons.every(row => {
        if (row.kind !== 'measured' || row.result !== 'within' || row.value > row.threshold) return false;
        const subject = policy?.subjects.find(item => item.subject === row.subject);
        return !policy || !!subject && row.threshold === subject.softThreshold && row.value <= subject.softThreshold;
      }), 'growth episode requires measured exit workload within the signed policy threshold');
    return freeze({ ...episode, state: 'closed' as const, observations: [...new Set([...episode.observations, observation.id])] });
  });
}
