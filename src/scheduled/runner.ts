import { consumeResult } from '../index.js';
import type { BoundaryContext, Clock, Result } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import type { IntakeDisposition, IntakePort, InboundRoute } from '../intake/index.js';
import { boundary, ensure, take } from './boundary.js';
import { nextCronInstant } from './next.js';
import { createScheduledWorkPackagePort } from './package.js';
import { shouldRunScheduledPriority } from './shedding.js';
import type { ScheduledUsageLevel } from './shedding.js';
import { parseRfc3339Offset } from './time.js';
import type { ScheduledOccurrencePlan } from './contracts.js';
import type { ScheduledSource } from './intake-adapter.js';

export interface ScheduledRunnerDependencies {
  readonly intake: IntakePort;
  readonly sources: () => readonly ScheduledSource[];
  readonly facts: () => Result<readonly FactEnvelope[]>;
  readonly clock: (now: number) => Clock;
  readonly usage: () => ScheduledUsageLevel;
  readonly stopped: () => boolean;
  readonly capacity: () => boolean;
  /** Existing durable Run owner: atomically dedupes by admission fact ID. */
  readonly startOnce: (admission: Extract<IntakeDisposition, { kind: 'admitted' }>) => Result<boolean>;
  readonly context: BoundaryContext;
}

const routeFor = (source: ScheduledSource, plan: ScheduledOccurrencePlan): InboundRoute => ({
  channel: `scheduled:${plan.jobInstanceId}`, sender: source.manifest.authority.systemPrincipal,
  identityEpoch: source.identityEpoch, eventId: plan.eventId });
const body = (fact: FactEnvelope): Record<string, unknown> => fact.body && typeof fact.body === 'object'
  && !Array.isArray(fact.body) ? fact.body as Record<string, unknown> : {};

export function createScheduledRunner(deps: ScheduledRunnerDependencies) {
  const planner = createScheduledWorkPackagePort();
  const extract = (result: Result<IntakeDisposition>) => consumeResult(result, {
    Success: disposition => disposition, Refused: refusal => {
      if (refusal.detail.includes('preserved hold')) return null;
      throw Error(refusal.detail);
    } });
  function tick(now: number): Result<number> {
    return boundary('ScheduledTick', { now }, deps.context, () => {
      ensure(Number.isSafeInteger(now) && now >= 0, 'scheduled tick needs a whole-millisecond clock');
      const at = deps.clock(now), facts = take(deps.facts());
      let started = 0;
      for (const source of deps.sources()) {
        if (source.manifest.activation.rollout !== 'active') continue;
        const schedule = source.manifest.schedule;
        const activation = parseRfc3339Offset(schedule.activationInstant);
        const first = schedule.kind === 'one-shot' ? schedule.at
          : nextCronInstant(schedule.expression, schedule.timeZone, activation, true);
        if (!first) continue;
        const firstPlan = take(planner.planOccurrence({ manifest: source.manifest,
          namespaceVersion: source.namespaceVersion, installationId: source.installationId,
          ...source.targetMachineId ? { targetMachineId: source.targetMachineId } : {},
          scheduledInstant: first, asOf: at }, deps.context));
        const channel = `scheduled:${firstPlan.jobInstanceId}`;
        const admitted = facts.filter(f => f.kind === 'intake-admitted'
          && body(f).adapter === 'scheduled-intake-v1'
          && body(f).channel === channel
          && body(f).sender === source.manifest.authority.systemPrincipal);
        // Admission is durable before Run. Replaying it is safe only through the
        // existing Run owner, which must dedupe on the admission fact ID.
        for (const fact of admitted) {
          const data = body(fact);
          const intent = data.intent as Extract<IntakeDisposition, { kind: 'admitted' }>['intent'];
          const disposition: Extract<IntakeDisposition, { kind: 'admitted' }> = {
            kind: 'admitted', logicalId: String(data.logicalId), lastInboundId: String(data.eventId),
            intent, fact: { owner: 'part-two', name: 'FactEnvelope', id: fact.id },
            owner: String((data.work as Record<string, unknown>).owner), blockedOn: 'run-admission',
            standing: 'requester', boundOperator: false, flags: [] };
          if (!deps.stopped() && deps.capacity() && shouldRunScheduledPriority(source.manifest.admission.priority, deps.usage())) {
            if (take(deps.startOnce(disposition))) started++;
          }
        }
        if (deps.stopped() || !deps.capacity()
          || !shouldRunScheduledPriority(source.manifest.admission.priority, deps.usage())) continue;
        // A crash after capture leaves a receipt without admission. Recover it
        // before discovering fresh due work, preserving its original tuple.
        const receipts = facts.filter(f => f.kind === 'intake-receipt'
          && body(f).adapter === 'scheduled-intake-v1' && (() => {
            try { const ingress = JSON.parse(String(body(f).ingress));
              return ingress.channel === channel && ingress.sender === source.manifest.authority.systemPrincipal
                && ingress.identityEpoch === source.identityEpoch;
            } catch { return false; }
          })());
        const recovered = new Set<string>();
        for (const receipt of receipts) {
          const ingress = JSON.parse(String(body(receipt).ingress));
          if (recovered.has(ingress.eventId) || admitted.some(f => body(f).eventId === ingress.eventId)) continue;
          recovered.add(ingress.eventId);
          const outcome = extract(deps.intake.recover(receipt.id));
          if (outcome?.kind === 'admitted' && take(deps.startOnce(outcome))) started++;
        }
        let candidate: string | null = first;
        let latest: string | null = null, count = 0;
        while (candidate && parseRfc3339Offset(candidate) <= now) {
          latest = candidate;
          if (schedule.kind === 'one-shot') break;
          ensure(++count <= 100_000, 'scheduled catch-up exceeds bounded calendar scan');
          candidate = nextCronInstant(schedule.expression, schedule.timeZone, parseRfc3339Offset(candidate));
        }
        if (!latest) continue;
        const plan = take(planner.planOccurrence({ manifest: source.manifest,
          namespaceVersion: source.namespaceVersion, installationId: source.installationId,
          ...source.targetMachineId ? { targetMachineId: source.targetMachineId } : {},
          scheduledInstant: latest, asOf: at }, deps.context));
        if (plan.disposition === 'missed' && source.manifest.admission.catchUp === 'none') continue;
        const route = routeFor(source, plan);
        const matching = receipts.filter(f => {
          try { return JSON.parse(String(body(f).ingress)).eventId === route.eventId; }
          catch { return false; }
        });
        const existing = admitted.find(f => body(f).eventId === route.eventId);
        if (existing || recovered.has(plan.eventId)) continue;
        // A receipt is capture evidence only. Its original bytes and route are
        // recovered by Four under current stop, authority and capacity gates.
        const result = matching.length ? deps.intake.recover(matching[0]!.id)
          : deps.intake.receive(plan.tickBytes, route);
        const disposition = extract(result);
        if (disposition?.kind === 'admitted' && take(deps.startOnce(disposition))) started++;
      }
      return started;
    });
  }
  return Object.freeze({ tick });
}
