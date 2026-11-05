/** Rule 114: one receiving Run owner, one signed spine and Four's ordinary
 * intake. Installation supplies existing custody and policy; this composition
 * cannot enroll a peer, mint a grant, or install a parser declaration. */
import { authorAndAppend } from '../facts/index.js';
import type { FactStorePort, FactContext } from '../facts/index.js';
import { createIntakePort } from '../intake/index.js';
import type { IntakeDependencies, IntakeCapturePort } from '../intake/index.js';
import { createAgentEndpoint, createDelegationLedger, createFactDelegationStore,
  createDelegatedRunAuthority, createDelegatedRunProposals, createDelegatedRunSteps, offerEnvelope, resultEnvelope, semanticDigest, cancelEnvelope } from '../rungraph/index.js';
import type { AgentTransportEnvelope, CapabilityAdvertisement, DelegatedRunProposals, DelegatedWorker, DelegatedAsyncWorker,
  DelegatedWorkReferences, DelegationContract, DelegationRequest, EndpointReceipt, Run, RunDecodeContext, RunGraphDependencies, RunGraphPort } from '../rungraph/index.js';
import { createThreadlineIntakeAdapter, createThreadlineReferenceAdapter, isProductionRunAdmission,
  threadlineIntakeRoute } from '../transport/index.js';
import { createProductionDelegatedWorker } from './production-delegated-work.js';
import { createDelegatedProviderWork } from './production-delegated-provider.js';
import type { DelegatedProviderPolicy } from './production-delegated-provider.js';
import type { ProductionProviderOwners } from './production-provider-owners.js';
import type { ProviderJudgmentDependencies } from '../judgment/index.js';
import type { EffectSettlement } from '../effects/index.js';
import type { EffectDoorway } from '../effects/index.js';
import type { FenceToken } from '../transport/index.js';
import type { ThreadlineKeys, ThreadlineRelay, TransportAuthority } from '../transport/index.js';
import type { Clock, VerifiedPrincipal } from '../index.js';
import { boundary, ensure, json, take } from './boundary.js';

export interface ProductionDelegationConfiguration {
  readonly keys: ThreadlineKeys;
  readonly relay: ThreadlineRelay;
  /** Existing Ten opaque-byte custody; a Telegram-specific capture adapter
   * must not interpret encrypted Threadline bytes as a Telegram update. */
  readonly capture: IntakeCapturePort;
  /** Existing enrolled key epoch. Missing enrollment refuses after preservation. */
  epoch(principal: string): string | null;
  advertisement(): CapabilityAdvertisement;
  advertisements(peer: string): readonly CapabilityAdvertisement[];
  policyRun(): string;
  readonly work: DelegatedWorkReferences;
  /** When present the actual composed Seven/Eight owners issue and dispatch
   * the invocation; work supplies only placement and recorded completion. */
  readonly provider?: DelegatedProviderPolicy;
  /** Existing Six lease capability, never an installed authority synthesized here. */
  fence(): FenceToken;
  /** The current installed decode context, including Four's work-owner mapping. */
  context(): RunDecodeContext;
  /** Optional projection consumer; called only with canonical ledger custody.
   * Failure cannot erase intake. recover() rebuilds it from the same spine. */
  custody?(envelope: AgentTransportEnvelope, receipt: EndpointReceipt): void;
  /** Routing projection of the actual parent, never a model-supplied topic. */
  origin?(contract: DelegationContract, parent: Run): void;
}

export interface ProductionDelegationProjection {
  custody(envelope: AgentTransportEnvelope, receipt: EndpointReceipt): void;
  origin(contract: DelegationContract, parent: Run): void;
}

export function composeProductionDelegation(input: Readonly<{
  configuration: ProductionDelegationConfiguration; intake: IntakeDependencies;
  graph: RunGraphPort; store: FactStorePort; admission: RunGraphDependencies['admission'];
  author: Readonly<{ context: FactContext; principal: VerifiedPrincipal; machine: string; privateKey: string }>;
  transport: TransportAuthority<EffectSettlement>; effect: EffectDoorway;
  provider: ProductionProviderOwners; judgment: Omit<ProviderJudgmentDependencies, 'runs'>;
  exitCheck: RunGraphDependencies['exitCheck'];
  current(): Readonly<{ clock: Clock; stopped: boolean; principal: string }>;
}>) {
  const config = input.configuration;
  return boundary('ProductionDelegationComposition', null, config.context(), () => {
    ensure(isProductionRunAdmission(input.admission), 'delegation: canonical Six admission required');
    ensure(config.keys.principal === input.current().principal, 'delegation: installed custody owner differs');
    ensure(config.context().facts.schemas.some(schema => schema.kind === 'run-delegation'),
      'delegation: existing signed ledger schema must be installed');
    const adapter = createThreadlineIntakeAdapter({ keys: config.keys, capture: config.capture,
      machine: input.intake.author.machine, epoch: config.epoch, context: config.context() });
    const intake = take(createIntakePort({ ...input.intake, capture: config.capture, adapter }));
    const ledger = createDelegationLedger(createFactDelegationStore({ read: () => input.store.read(),
      author: (kind, body) => {
        const author = input.author;
        return authorAndAppend({ kind, schemaVersion: 1, body, required: [],
          machine: author.machine, principal: json(author.principal), provenance: json(author.principal.provenance),
          at: json(input.current().clock) }, author.context, input.store, author.privateKey);
      } }), config.context());
    const providerWork = config.provider ? createDelegatedProviderWork({ policy: config.provider, work: config.work,
      provider: input.provider, judgment: input.judgment, graph: input.graph, effect: input.effect,
      transport: input.transport, fence: config.fence }) : null;
    const steps = createDelegatedRunSteps({ graph: input.graph, admission: input.admission,
      work: providerWork?.work ?? config.work, context: config.context, clock: () => input.current().clock });
    const installedWorker = providerWork ? providerWork.worker(steps.recover!)
      : createProductionDelegatedWorker({ graph: input.graph, effect: input.effect,
        transport: input.transport, fence: config.fence, recover: steps.recover! });
    const authority = createDelegatedRunAuthority({ graph: input.graph, ledger, store: input.store,
      admission: input.admission, transport: input.transport, context: config.context, current: input.current,
      exitCheck: input.exitCheck,
      proposals: createDelegatedRunProposals({ graph: input.graph, policyRun: config.policyRun,
        context: config.context, clock: () => input.current().clock, steps }) });
    const endpoint = createAgentEndpoint({ principal: config.keys.principal, ledger, authority,
      advertisement: config.advertisement, now: () => input.current().clock.value });
    let projection: ProductionDelegationProjection | undefined;
    const origin = (contract: DelegationContract, parent: Run) => {
      config.origin?.(contract, parent); projection?.origin(contract, parent);
    };
    const parentFor = (contract: DelegationContract) => {
      const incoming = contract.parentEdge === null ? null : ledger.view().get(contract.parentEdge);
      ensure(contract.parentEdge === null || incoming?.contract.childRun === contract.parentRun && incoming.acceptance,
        'delegation: originating parent mapping unavailable');
      return take(input.graph.read(incoming?.acceptance?.localRun ?? contract.parentRun)).run;
    };
    const recover = () => {
      const edges = [...ledger.view().values()].filter(edge => edge.conflicts.length === 0);
      // Inbound custody first: a nested origin may depend on that retained
      // parent routing after a crash between endpoint and journal appends.
      for (const edge of edges) {
        const contract = edge.contract;
        const envelope = contract.recipient === endpoint.principal && edge.executable ? offerEnvelope(contract)
          : contract.owner === endpoint.principal && edge.result ? resultEnvelope(contract, edge.result, contract.createdAt) : null;
        if (envelope) {
          const receipt = endpoint.lookup(envelope.key, semanticDigest(envelope), envelope.sender);
          if (receipt.durability !== null && ['durably-queued', 'delivered-to-worker', 'answered'].includes(receipt.state)) {
            config.custody?.(envelope, receipt); projection?.custody(envelope, receipt);
          }
        }
      }
      for (const edge of edges) if (edge.contract.owner === endpoint.principal && edge.dispatchable)
        origin(edge.contract, parentFor(edge.contract));
    };
    const transport = createThreadlineReferenceAdapter({ keys: config.keys, relay: config.relay,
      now: () => input.current().clock.value, freshFor: 1000, context: config.context(), advertisements: config.advertisements,
      preserve: raw => config.capture.preserve(raw, input.current().clock),
      observedReceipt: (envelope, receipt, capture) => {
        if (envelope.kind !== 'offer') return;
        take(ledger.record({ type: 'DeliveryEvidence', schemaVersion: 1, key: envelope.key, digest: envelope.digest,
          edge: envelope.edge, conversation: envelope.conversation, state: 'uncertain',
          witness: { kind: 'observer', principal: config.keys.principal }, authoritative: capture.reference,
          unresolved: 'authenticated receipt retained before canonical endpoint consumption', attempt: `receipt:${capture.hash}`,
          observedAt: input.current().clock.value, freshFor: 1000 }));
      },
      intake: { port: intake, route: frame => threadlineIntakeRoute(frame, config.epoch(frame.sender) ?? 'unenrolled') } });
    const guardSubmission = (identity: string) => {
      // A new command for this exact prefix forces Six to check the current
      // fence. Reusing an old admitted-write command would only read its prior
      // receipt and could conceal a lease handoff from the old process.
      take(input.transport.admitWrite(`delegation-send:${identity}:${take(input.store.read()).length}`, config.fence()));
    };
    const dispatch = (contract: DelegationContract, attempt: string, first: boolean) => {
      const edge = ledger.view().get(contract.id);
      ensure(edge?.dispatchable && edge.conflicts.length === 0, 'delegation: dispatchable exact edge required');
      if (edge.result) return edge;
      const plan = take(ledger.retry(contract.id));
      const mode = first || plan.mode === 'resubmit' ? 'submit' : 'lookup';
      if (mode === 'submit') {
        origin(contract, parentFor(contract)); take(authority.authorizeDispatch(contract)); guardSubmission(contract.id);
      }
      const evidence = take(transport.port.send(offerEnvelope(contract), attempt, mode));
      return take(ledger.record(evidence));
    };
    const nextCollection = new Map<string, number>();
    const collect = (edgeId: string) => boundary('ProductionDelegationCollect', { edgeId }, config.context(), () => {
      const edge = ledger.view().get(edgeId);
      ensure(edge && edge.contract.owner === input.current().principal, 'delegation: unknown owned edge');
      if (edge.result) return take(ledger.collect(edgeId, input.current().clock.value));
      return dispatch(edge.contract, `lookup:${edgeId}:${input.current().clock.value}`, false);
    });
    return Object.freeze({ ledger, authority, intake, port: transport.port, recover,
      /** One existing journal consumer, connected by the installed driver after
       * its own owner admission. Reconnection cannot replace custody authority. */
      connectProjection(consumer: ProductionDelegationProjection) {
        ensure(!projection || projection === consumer, 'delegation: projection already connected');
        projection = consumer; recover();
      },
      delegate(parentRun: string, request: Omit<DelegationRequest, 'parent' | 'grants' | 'at' | 'generation' | 'resultDestination'>) {
        return boundary('ProductionDelegateFromRun', { parentRun, request }, config.context(), () => {
          const before = new Set(ledger.view().keys());
          const { contract, parent: run } = take(authority.delegate(parentRun, request));
          // A durable origin must be visible before the first remote effect.
          try { origin(contract, run); }
          catch (error) {
            // Only this newly created edge is known never to have reached the
            // send boundary. A recovered edge may already have remote custody.
            if (!before.has(contract.id)) {
              const envelope = offerEnvelope(contract);
              take(ledger.record({ type: 'DeliveryEvidence', schemaVersion: 1, key: envelope.key, digest: envelope.digest,
                edge: contract.id, conversation: envelope.conversation, state: 'refused', refusedWhat: 'transport-send',
                witness: { kind: 'observer', principal: config.keys.principal }, authoritative: 'production:origin-before-dispatch',
                attempt: `origin:${contract.id}`, observedAt: input.current().clock.value, freshFor: 1000 }));
            }
            throw error;
          }
          dispatch(contract, `offer:${contract.id}`, !before.has(contract.id));
          return contract;
        });
      },
      collect,
      /** A disposable cadence cache bounds the installed maintenance tick.
       * Restart can repeat a lookup, never a worker or an unknown submission. */
      collectDue() {
        const current = input.current();
        const owned = ledger.outstanding().filter(edge => edge.contract.owner === current.principal);
        const active = new Set(owned.map(edge => edge.contract.id));
        for (const id of nextCollection.keys()) if (!active.has(id)) nextCollection.delete(id);
        return owned.filter(edge => (nextCollection.get(edge.contract.id) ?? edge.contract.createdAt) <= current.clock.value)
          .sort((a, b) => (nextCollection.get(a.contract.id) ?? a.contract.createdAt)
            - (nextCollection.get(b.contract.id) ?? b.contract.createdAt)).slice(0, 32).map(edge => {
            nextCollection.set(edge.contract.id, current.clock.value + Math.max(1, edge.contract.collectionCadence));
            return collect(edge.contract.id);
          });
      },
      cancel(edgeId: string, reason: string) {
        return boundary('ProductionDelegationCancel', { edgeId }, config.context(), () => {
          const edge = ledger.view().get(edgeId), current = input.current();
          ensure(edge && edge.contract.owner === current.principal, 'delegation: unknown owned cancellation');
          const prior = edge.cancellationRequest;
          const envelope = cancelEnvelope(edge.contract, prior?.reason ?? reason, prior?.message?.at ?? current.clock.value);
          if (!prior?.message) guardSubmission(envelope.key);
          take(ledger.cancel(edgeId, current.principal, envelope.reason!, current.clock.value,
            { key: envelope.key, digest: envelope.digest, at: envelope.at }));
          return take(transport.port.send(envelope, `cancel:${edgeId}`, prior?.message ? 'lookup' : 'submit'));
        });
      },
      pump() { const refused = transport.pump(endpoint); recover(); return refused; },
      async workAsync(worker: DelegatedAsyncWorker = installedWorker) {
        const results = await endpoint.workAsync(worker, input.current().clock.value);
        for (const envelope of results) {
          guardSubmission(envelope.key); take(transport.port.send(envelope, `result:${envelope.digest}`, 'submit'));
        }
        recover(); return results;
      },
      work(worker: DelegatedWorker) {
        const results = endpoint.work(worker, input.current().clock.value);
        // A lost result send remains in the recipient's durable ledger. The
        // sender's lookup returns it; an unknown send never starts work again.
        for (const envelope of results) {
          guardSubmission(envelope.key); take(transport.port.send(envelope, `result:${envelope.digest}`, 'submit'));
        }
        recover(); return results;
      } });
  });
}
