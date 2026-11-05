/** Nine's existing probe owner supplies the completion check consumed by Five.
 * A caller's result, pass string, or Evidence id alone cannot close a Run. */
import { canonical, readHistoricalEvidence } from '../index.js';
import type { Evidence } from '../index.js';
import { causalStanding, decodeHistoricalBody } from '../facts/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { RunGraphDependencies } from '../rungraph/index.js';
import type { VerificationHost, VerificationPlan, VerificationRuntimePort } from './contracts.js';
import { probeBoundToCurrentEvidence } from './runtime.js';
import { boundary, ensure, freeze, take } from './boundary.js';

export function createRunExitCheck(input: Readonly<{
  host: VerificationHost; runtime: VerificationRuntimePort; store: FactStorePort;
}>): RunGraphDependencies['exitCheck'] {
  return freeze({ owner: 'part-nine' as const,
    verify: (exit, run, at) => boundary('RunExitCheck', { exit, run: run.id }, input.host.boundary, () => {
      const current = input.host.current();
      const snapshot = take(input.store.readForProjection());
      const check = snapshot.entries.find(row => row.fact.id === exit.check.id);
      ensure(check && check.taint.length === 0 && check.conflicts.length === 0,
        'exit check: missing or conflicting recorded check');
      ensure(check.fact.predecessors.required.includes(run.opening.id)
        && check.fact.predecessors.required.includes(exit.result.fact.id),
      'exit check: exact Run opening and result must precede its check');
      const facts = { ...current.facts, facts: snapshot.entries.map(row => row.fact) };
      const decoded = take(decodeHistoricalBody(check.fact, facts, causalStanding(check.fact, facts, false).decode));
      const claims = decoded.records.filter(record => record.view.type === 'Evidence').map(record =>
        take(readHistoricalEvidence(record as import('../index.js').HistoricalRead<Evidence>, at, input.host.boundary.preserved)));
      ensure(exit.run === run.id && exit.exitTest.check === run.exitTest.check
        && exit.exitTest.version === run.exitTest.version
        && take(canonical(exit.exitTest)).bytes === take(canonical(run.exitTest)).bytes
        && claims.some(claim => claim.subject === run.exitTest.subject
          && claim.predicate === `exit:${run.exitTest.check}:${run.exitTest.version}`
          && claim.value === run.exitTest.acceptance), 'exit check: exact declared acceptance not witnessed');
      const records = take(input.runtime.inspectCurrent());
      const plans = records.filter(row => row.record.type === 'VerificationPlan'
        && row.record.schemaVersion === 1 && row.record.id === run.exitTest.check);
      ensure(plans.length === 1 && plans[0]!.taint.length === 0 && plans[0]!.conflicts.length === 0,
        'exit check: exact current Nine plan required');
      const plan = plans[0]!.record as VerificationPlan;
      ensure(plan.bar.version === run.exitTest.version && plan.bar.subjectDigest === run.exitTest.acceptance
        && plan.subject.governed === run.exitTest.subject && plan.subject.generation === run.generation.id
        && plan.bar.complete && plan.arms.some(arm => arm.required), 'exit check: plan differs from the Run bar');
      for (const arm of plan.arms.filter(item => item.required)) {
        const probes = records.filter(row => row.record.type === 'ProbeRecord'
          && row.record.plan === plan.id && row.record.planVersion === plan.bar.version
          && row.record.arm === arm.id && row.record.run === run.id
          && row.record.completedAt <= at.value);
        const latest = probes.sort((a, b) => (a.record as { completedAt: number }).completedAt
          - (b.record as { completedAt: number }).completedAt).at(-1);
        ensure(latest && latest.record.type === 'ProbeRecord' && latest.taint.length === 0
          && latest.conflicts.length === 0 && latest.record.disposition === 'passed'
          && latest.record.captureStatus === 'available' && latest.record.missingPhases.length === 0
          && latest.record.completedAt + Math.min(run.exitTest.freshFor, plan.bar.freshness) >= at.value
          && probeBoundToCurrentEvidence(plan, latest.record, at, current.evidence, current.decode, facts, input.host.boundary),
        'exit check: missing, stale, failed or unbound required probe');
      }
      return exit.check;
    }) });
}
