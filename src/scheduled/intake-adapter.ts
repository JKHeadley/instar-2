import { consumeResult, isValid } from '../index.js';
import type { Authorization, BoundaryContext, Clock, ProvenanceInput, Result, Revocation, StandingGrant } from '../index.js';
import type { InboundRoute, IntakeAdapterPort, SenderEvidence } from '../intake/index.js';
import { createScheduledWorkPackagePort } from './package.js';
import type { ScheduledWorkManifest } from './contracts.js';
import { boundary, ensure, take } from './boundary.js';

export const scheduledParserDeclarationId = 'scheduled-intake-v1';

export interface ScheduledSource {
  readonly manifest: ScheduledWorkManifest;
  readonly namespaceVersion: string;
  readonly installationId: string;
  /** Signed key epoch of the registered scheduled system source. */
  readonly identityEpoch: string;
  readonly targetMachineId?: string;
  /** Immutable package and Four-approved act evidence, read at each admission. */
  readonly manifestFact: string;
  readonly approvedActFact: string;
}

export interface ScheduledSourceAuthority {
  /** Reads only owner-verified, active package declarations. */
  sources(): readonly ScheduledSource[];
  /** Verifies the registered source credential over both bytes and the full route. */
  verifySource(raw: string, route: InboundRoute, at: Clock, source: ScheduledSource): Result<ProvenanceInput>;
  /** Reads the Four-approved act, its grant and current revocations from owner-verified facts. */
  authorize(source: ScheduledSource, at: Clock): Result<Readonly<{
    act: Authorization; grant: StandingGrant; revocations: readonly Revocation[];
    actFact: string; manifestFact: string; scopeReference: string; currentBase: string;
  }>>;
  readonly context: BoundaryContext;
}

export function createScheduledIntakeAdapter(authority: ScheduledSourceAuthority): IntakeAdapterPort {
  const planner = createScheduledWorkPackagePort();
  const authenticated = new Map<string, ScheduledSource>();
  function match(raw: string, route: InboundRoute, at: Clock) {
    let tick: Record<string, unknown>;
    try { tick = JSON.parse(raw) as Record<string, unknown>; }
    catch { throw new Error('scheduled tick is not JSON'); }
    ensure(tick && typeof tick === 'object' && !Array.isArray(tick)
      && typeof tick.scheduledInstant === 'string', 'scheduled tick has no instant');
    const matches = authority.sources().flatMap(source => {
      return consumeResult(planner.planOccurrence({ manifest: source.manifest,
        namespaceVersion: source.namespaceVersion, installationId: source.installationId,
        ...source.targetMachineId ? { targetMachineId: source.targetMachineId } : {},
        scheduledInstant: tick.scheduledInstant as string, asOf: at }, authority.context), {
        Success: plan => plan.tickBytes === raw ? [{ source, plan }] : [], Refused: () => [] });
    });
    ensure(matches.length === 1, 'scheduled tick differs from immutable occurrence');
    const selected = matches[0]!;
    ensure(route.channel === `scheduled:${selected.plan.jobInstanceId}`
        && route.sender === selected.source.manifest.authority.systemPrincipal
        && route.identityEpoch === selected.source.identityEpoch
        && route.eventId === selected.plan.eventId, 'scheduled route differs from immutable occurrence');
    return selected;
  }
  return Object.freeze({ id: scheduledParserDeclarationId,
    authenticate(raw: string, route: InboundRoute, at: Clock): Result<SenderEvidence> {
      return boundary('ScheduledSourceAuthentication', { raw, route }, authority.context, () => {
        const { source } = match(raw, route, at);
        ensure(source.manifest.activation.rollout === 'active', 'scheduled package is not active');
        ensure(source.manifestFact.length > 0 && source.approvedActFact.length > 0,
          'scheduled source lacks immutable manifest or approved act evidence');
        const approved = take(authority.authorize(source, at));
        ensure(approved.actFact === source.approvedActFact && approved.manifestFact === source.manifestFact,
          'scheduled act and immutable manifest evidence differ');
        ensure(approved.act.kind.kind === 'approval' && approved.act.approver.kind === 'person'
          && approved.act.action.kind === source.manifest.identity.jobId
          && approved.grant.id === source.manifest.authority.standingGrant
          && approved.act.under === approved.grant.id
          && approved.scopeReference === source.manifest.authority.scope,
        'scheduled act does not authorize this job and standing');
        ensure(isValid(approved.act, approved.currentBase, source.manifest.identity.contentDigest, at,
          { grants: [approved.grant], revocations: approved.revocations }) === 'valid',
        'scheduled act or grant is no longer applicable');
        const provenance = take(authority.verifySource(raw, route, at, source));
        authenticated.set(raw, source);
        return { provenance, principalId: source.manifest.authority.systemPrincipal,
          principalKind: 'system' as const, channel: route.channel, sender: route.sender,
          identityEpoch: route.identityEpoch,
          authorityFacts: { manifest: approved.manifestFact, approvedAct: approved.actFact } };
      });
    },
    parse(raw: string) {
      const source = authenticated.get(raw);
      ensure(source, 'scheduled tick was not authenticated before parsing');
      authenticated.delete(raw);
      return { schemaVersion: 1, kind: 'message', text: source.manifest.intelligence.businessSteps.join('\n') };
    } });
}
