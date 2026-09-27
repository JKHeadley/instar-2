import { createHash } from 'node:crypto';
import { consumeResult, decode, readEvidence } from '../index.js';
import type { BoundaryContext, Evidence, Json, Result } from '../index.js';
import { authorAndAppend, hashBytes } from '../facts/index.js';
import { invokeConsumedDispatch } from '../transport/index.js';
import type { FactContext, FactStorePort } from '../facts/index.js';
import type { DispatchClaim, FenceToken, TransportAuthority, TransportHost } from '../transport/index.js';
import type { Capture, JudgmentCapturePort, ProviderObservation, ProviderResponseEvidence } from '../judgment/index.js';
type ProviderCallPayload = import('../effects/provider-api.js').ProviderCallPayload;
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

/** Assembly-only route custody. Its closure owns the credential; no credential or
 * client is reachable from the worker's request or the returned adapter handle. */
export interface ConfinedProviderRoute {
  readonly provider: string; readonly model: string; readonly route: string; readonly disclosure: string;
  readonly automaticRetries: 0; readonly environment: 'local-test' | 'production';
  readonly custodyProof?: ProviderCustodyProof;
  invoke(bytes: string, bounds: Readonly<{ operation: string; deadline: number; timeout: number;
    maxOutputBytes: number; maxTokens: number; maxCharge: number; automaticRetries: 0 }>): Promise<ProviderRouteObservation>;
}
export interface ProviderResponseEvidenceDraft {
  readonly eligibility: ProviderResponseEvidence['eligibility']; readonly contract: ProviderResponseEvidence['contract'];
  readonly basis: Readonly<{ sourceEvidence: readonly string[]; terminalEvidence: string;
    terminalReasonField: string; successfulFinalReplyReasons: readonly string[] }>;
  readonly source: Omit<ProviderResponseEvidence['source'], 'observerPrincipal' | 'request' | 'attempt' | 'operation' | 'claim'>;
  readonly terminal: Omit<ProviderResponseEvidence['terminal'], 'raw' | 'observedAt'> & Readonly<{ rawBase64: string; rawDigest: string }>;
  readonly answer: Omit<ProviderResponseEvidence['answer'], 'source'>;
}
export interface ProviderRouteObservation extends Omit<ProviderObservation, 'responseEvidence'> {
  readonly responseEvidenceDraft?: ProviderResponseEvidenceDraft;
}
declare const providerCustodyBrand: unique symbol;
/** The brand alone is not authority: admission checks exact object registration. */
export type ProviderCustodyProof = Readonly<{ [providerCustodyBrand]: true }>;
const productionCustody = new WeakMap<ConfinedProviderRoute, ProviderCustodyProof>();
const responseEvidenceBounds = new WeakMap<ConfinedProviderRoute, ProviderResponseEvidence['contract']>();

/** Owner-internal route registration. It is deliberately not re-exported from
 * the assembly barrel: only the route factory can attach approved finite caps. */
export function registerProviderResponseEvidenceBounds(route: ConfinedProviderRoute,
  contract: ProviderResponseEvidence['contract']): void {
  ensure(Object.isFrozen(route) && !responseEvidenceBounds.has(route), 'immutable response evidence route required');
  for (const value of [contract.maxMetadataBytes, contract.maxRawTerminalBytes, contract.maxCaptureBytes])
    ensure(Number.isSafeInteger(value) && value > 0, 'finite positive response evidence bound required');
  responseEvidenceBounds.set(route, freeze(contract));
}

/** GRANT U4-A: owner-internal registration; never export through assembly/index. */
export function registerProductionProviderCustody(route: ConfinedProviderRoute): void {
  ensure(Object.isFrozen(route) && route.environment === 'production'
    && route.custodyProof !== undefined && Object.isFrozen(route.custodyProof), 'immutable provider custody required');
  ensure(!productionCustody.has(route), 'provider custody already registered');
  productionCustody.set(route, route.custodyProof);
}
export interface ProviderInvocationPort {
  readonly owner: 'part-ten';
  invoke(payload: ProviderCallPayload, claim: DispatchClaim, fence: FenceToken,
    accepted: () => Result<string>): Promise<Result<Capture>>;
}
export function createConfinedProviderInvocation(route: ConfinedProviderRoute, authority: TransportAuthority,
  host: TransportHost, captures: JudgmentCapturePort, c: BoundaryContext, store: FactStorePort,
  author?: Readonly<{ context: FactContext; privateKey: string }>): Result<ProviderInvocationPort> {
  return boundary('ConfinedProviderConstruction', null, c, () => {
    ensure(route.environment === 'local-test' || (route.environment === 'production'
      && route.custodyProof !== undefined && productionCustody.get(route) === route.custodyProof),
    'NON-EXECUTABLE-UNTIL-production-boot-credential-custody');
    ensure(route.automaticRetries === 0, 'hidden retry forbidden');
    const send = route.invoke.bind(route);
    const binding = { provider: route.provider, model: route.model, route: route.route, disclosure: route.disclosure };
    return Object.freeze({ owner: 'part-ten', invoke: async (payload, claim, fence, accepted) => {
      const checked = <T>(name: string, fn: () => T) => boundary(name, null, c, fn);
      const issued: import('../judgment/index.js').CaptureCapacity[] = [];
      const bindingAttempts = new Set<import('../judgment/index.js').CaptureCapacity>();
      const reserve = (maxBytes: number) => {
        const token = take(captures.reserve(maxBytes)); issued.push(token); return token;
      };
      const putReserved = (token: import('../judgment/index.js').CaptureCapacity, bytes: string) => {
        bindingAttempts.add(token); return take(captures.putReserved(token, bytes));
      };
      const cleanup = (tokens: readonly import('../judgment/index.js').CaptureCapacity[]) => {
        let failure: Extract<Result<void>, { kind: 'Refused' }> | undefined;
        for (const token of tokens) {
          if (bindingAttempts.has(token)) continue;
          const result = captures.releaseReserved(token);
          const refused = consumeResult(result, { Success: () => undefined, Refused: value => value });
          if (refused && !failure) failure = refused;
        }
        return failure;
      };
      const admission = checked('ProviderInvocationAdmission', () => {
        ensure(route.automaticRetries === 0, 'hidden retry forbidden');
        ensure(Object.entries(binding).every(([k, v]) => payload[k as keyof ProviderCallPayload] === v), 'unapproved provider route');
        ensure(claim.digest === payload.submittedDigest && claim.attempt === payload.attempt
          && claim.executor === host.incarnation, 'provider claim/attempt/digest mismatch');
        ensure(!host.current().stopped && payload.deadline > host.monotonic(), 'provider stale deadline or stop');
        const bytes = take(captures.read(payload.submitted));
        ensure(hashBytes(bytes) === payload.submitted.hash && encoded(bytes).hash === payload.submittedDigest, 'missing or changed submitted bytes');
        ensure(new TextEncoder().encode(bytes).length <= payload.maxInputBytes, 'provider input bound exceeded');
        const wire = JSON.parse(bytes) as Record<string, unknown>;
        ensure(wire.provider === payload.provider && wire.model === payload.model && wire.route === payload.route
          && encoded(wire.settings).hash === payload.settingsDigest && encoded(wire.outputSchema).hash === payload.outputSchemaDigest,
          'submitted model/settings/schema changed');
        const evidenceContract = responseEvidenceBounds.get(route);
        const checkedAdd = (...values: readonly number[]) => {
          let total = 0;
          for (const value of values) { ensure(Number.isSafeInteger(value) && value >= 0
            && Number.isSafeInteger(total + value), 'response evidence capacity overflow'); total += value; }
          return total;
        };
        const checkedMultiply = (left: number, right: number) => {
          const product = left * right;
          ensure(Number.isSafeInteger(product) && product >= 0, 'response evidence capacity overflow'); return product;
        };
        const legacyReceiptBytes = checkedAdd(checkedMultiply(6, payload.maxOutputBytes), 8192);
        let capacities: Readonly<{ receipt: import('../judgment/index.js').CaptureCapacity;
          raw?: import('../judgment/index.js').CaptureCapacity; answer?: import('../judgment/index.js').CaptureCapacity;
          sourceClaim?: import('../judgment/index.js').CaptureCapacity; terminalClaim?: import('../judgment/index.js').CaptureCapacity }>;
        if (evidenceContract) {
          const rawBase64Bytes = checkedMultiply(Math.ceil(evidenceContract.maxRawTerminalBytes / 3), 4);
          const receiptBytes = checkedAdd(legacyReceiptBytes, rawBase64Bytes,
            checkedMultiply(2, evidenceContract.maxMetadataBytes));
          const total = checkedAdd(receiptBytes, rawBase64Bytes, payload.maxOutputBytes,
            checkedMultiply(2, evidenceContract.maxMetadataBytes));
          ensure(total <= evidenceContract.maxCaptureBytes && total <= payload.maxCaptureBytes,
            'response evidence exceeds admitted aggregate capture budget');
          capacities = { receipt: reserve(receiptBytes), raw: reserve(rawBase64Bytes),
            answer: reserve(payload.maxOutputBytes), sourceClaim: reserve(evidenceContract.maxMetadataBytes),
            terminalClaim: reserve(evidenceContract.maxMetadataBytes) };
        } else capacities = { receipt: reserve(legacyReceiptBytes) };
        const consumed = take(authority.consume(claim, fence));
        ensure(consumed.request === payload.effectRequest && consumed.run === payload.run
          && consumed.semanticMessage === payload.semanticMessage && consumed.charge === payload.maxCharge, 'consumed claim binding differs');
        const acceptance = take(accepted());
        const snapshot = take(store.readForProjection());
        // Validate the ACCEPTED operation's required dependency closure, not every
        // unrelated record in the store: an unrelated unavailable fact must not block
        // an otherwise clean invocation, while a tainted dependency of the acceptance
        // still refuses. Every taint/conflict status is left exactly as observed.
        const validateDependencies = (ids: readonly string[]) => {
          const seen = new Set<string>();
          const visit = (id: string) => {
            if (seen.has(id)) return; seen.add(id);
            const dependency = snapshot.entries.find(e => e.fact.id === id);
            ensure(dependency && !dependency.taint.length && !dependency.conflicts.length, 'provider acceptance tainted');
            dependency.fact.predecessors.required.forEach(visit);
          };
          ids.forEach(visit);
        };
        if (snapshot.entries.some(e => e.fact.id === acceptance)) validateDependencies([acceptance]);
        const entry = snapshot.entries.find(e => e.fact.id === acceptance);
        const record = entry?.fact.body as unknown as { record?: { stage: string; operation: string; request: string; digest: string; claim: string } };
        ensure(entry?.fact.kind === 'effect-provider-ProviderOperationObservation' && record?.record?.stage === 'executor-accepted'
          && record.record.operation === claim.operation && record.record.request === consumed.request && record.record.digest === claim.digest,
          'guarded Eight executor acceptance missing');
        const claimFact = snapshot.entries.find(e => e.fact.id === record.record!.claim);
        const claimRecord = claimFact?.fact.body as unknown as { record?: { state: string; operation: string } };
        ensure(claimFact?.fact.kind === 'transport-AdmissionReservation' && claimRecord?.record?.state === 'dispatch-claimed'
          && claimRecord.record.operation === claim.operation, 'executor acceptance claim differs');
        // No formatting, queue or provider-owned object is consulted after this
        // final equality check. The next operation submits these very bytes.
        ensure(take(captures.read(payload.submitted)) === bytes && hashBytes(bytes) === payload.submitted.hash
          && encoded(bytes).hash === claim.digest, 'submitted bytes changed immediately before call');
        ensure(!host.current().stopped && host.monotonic() < payload.deadline, 'provider stopped before call');
        return { bytes, capacities, evidenceContract, claimId: claimFact.fact.id };
      });
      return consumeResult(admission, { Refused: r => Promise.resolve(cleanup(issued) ?? r), Success: async admitted => {
        let observation: ProviderObservation;
        try {
          const invoke = () => send(admitted.bytes, { operation: claim.operation, deadline: payload.deadline,
            timeout: payload.timeout, maxOutputBytes: payload.maxOutputBytes, maxTokens: payload.maxTokens,
            maxCharge: payload.maxCharge, automaticRetries: 0 });
          const serving = take(authority.inspect()).some(row => row.record.type === 'ServingRecord'
            && row.record.action === 'bind');
          const returned = await (serving
            ? take(invokeConsumedDispatch(authority, claim, fence, c, invoke)) : invoke());
          // Copy once at the transport return; no SDK sees or edits this receipt.
          const own = (v: object, key: string) => Object.getOwnPropertyDescriptor(v, key)?.value as unknown;
          const usage = own(returned, 'usage');
          ensure(usage !== null && typeof usage === 'object', 'provider usage missing');
          // Copy data fields only: provider getters and unrelated metadata never
          // execute or enter the receipt's bounded canonical encoding.
          const limitation = own(returned, 'limitation'), draft = own(returned, 'responseEvidenceDraft');
          const failure = own(returned, 'failure');
          const safeDraft = draft && typeof draft === 'object' && admitted.evidenceContract
            ? snapshotEvidenceDraft(draft, payload.maxOutputBytes, admitted.evidenceContract) : undefined;
          observation = { state: own(returned, 'state'), bytes: own(returned, 'bytes'), providerOperation: own(returned, 'providerOperation'),
            usage: { inputTokens: own(usage, 'inputTokens'), outputTokens: own(usage, 'outputTokens'), charge: own(usage, 'charge'), source: own(usage, 'source') },
            retryBlocked: own(returned, 'retryBlocked'), ...(limitation && typeof limitation === 'object' ? { limitation: { kind: own(limitation, 'kind'), observedBytesAtLeast: own(limitation, 'observedBytesAtLeast') } } : {}),
            ...(failure && typeof failure === 'object' ? { failure: { failureClass: own(failure, 'failureClass'), resetHint: own(failure, 'resetHint'), resetAt: own(failure, 'resetAt') } } : {}),
            ...(safeDraft ? { responseEvidence: materializeEvidence(safeDraft,
              payload, claim, admitted.claimId, own(returned, 'bytes'), admitted.capacities, putReserved) } : {}) } as ProviderObservation;
        } catch {
          observation = { state: 'uncertain', bytes: null, providerOperation: null,
            usage: { inputTokens: null, outputTokens: null, charge: null,
              source: 'provider timeout or transport failure; liability unresolved' }, retryBlocked: false,
            limitation: { kind: 'transport-threw', observedBytesAtLeast: null } };
        }
        const captured = checked('CaptureProviderReturn', () => {
          ensure(['complete', 'rejected', 'uncertain'].includes(observation.state), 'invalid provider state');
          if (observation.failure) ensure(observation.state !== 'complete'
            && ['limit', 'policy', 'timeout', 'transport', 'unknown'].includes(observation.failure.failureClass)
            && (observation.failure.resetHint === null || /^\d{1,2}:\d{2}(?:am|pm)$/.test(observation.failure.resetHint))
            && (observation.failure.resetAt === null || Number.isSafeInteger(observation.failure.resetAt) && observation.failure.resetAt >= 0), 'invalid provider failure code');
          ensure(observation.bytes === null || typeof observation.bytes === 'string'
            && observation.bytes.length <= payload.maxOutputBytes && new TextEncoder().encode(observation.bytes).length <= payload.maxOutputBytes, 'provider output bound exceeded; uncertainty retained');
          ensure(observation.state !== 'complete' || observation.bytes !== null, 'complete provider response lacks bytes');
          ensure(observation.providerOperation === null || typeof observation.providerOperation === 'string' && observation.providerOperation.length <= 256, 'provider operation bound');
          ensure(typeof observation.usage.source === 'string' && observation.usage.source.length > 0 && observation.usage.source.length <= 256, 'provider usage source bound');
          if (observation.limitation) {
            ensure(observation.state === 'uncertain' && ['transport-threw', 'invalid-provider-observation', 'response-byte-limit'].includes(observation.limitation.kind), 'invalid provider limitation');
            const lower = observation.limitation.observedBytesAtLeast;
            ensure(lower === null || Number.isSafeInteger(lower) && lower >= 0, 'invalid provider byte lower bound');
          }
          ensure(typeof observation.retryBlocked === 'boolean', 'provider retry status absent');
          ensure(!observation.retryBlocked, 'hidden retry reported; uncertainty retained');
          for (const n of [observation.usage.inputTokens, observation.usage.outputTokens, observation.usage.charge])
            ensure(n === null || Number.isSafeInteger(n) && n >= 0, 'invalid provider usage');
          ensure(observation.usage.outputTokens === null || observation.usage.outputTokens <= payload.maxTokens, 'provider token bound exceeded; uncertainty retained');
          ensure(observation.usage.charge === null || observation.usage.charge <= payload.maxCharge, 'provider charge bound exceeded; uncertainty retained');
          if (observation.responseEvidence) {
            const evidence = observation.responseEvidence;
            ensure(evidence.source.request === payload.request.id && evidence.source.attempt === payload.attempt
              && evidence.source.operation === claim.operation && evidence.source.claim === admitted.claimId
              && evidence.source.submittedDigest === payload.submittedDigest && evidence.source.provider === payload.provider
              && evidence.source.model === payload.model && evidence.source.route === payload.route,
            'response evidence call binding differs');
            ensure(take(captures.read(evidence.answer.source)) === observation.bytes
              && hashBytes(observation.bytes!) === evidence.answer.answerDigest, 'response answer capture changed');
            if (evidence.eligibility === 'admitted') {
              ensure(evidence.terminal.reason === 'successful-final-reply' && !evidence.terminal.limited && !evidence.terminal.errored
                && !evidence.terminal.cancelled && !evidence.terminal.timedOut && !evidence.terminal.truncated && !evidence.terminal.toolCall,
              'response completion contract not satisfied');
              const snapshot = take(store.readForProjection());
              const ids = [...evidence.source.evidence, evidence.terminal.evidence];
              ensure(ids.every(id => snapshot.entries.some(entry => !entry.taint.length && !entry.conflicts.length
                && (entry.fact.body as unknown as { evidence?: { id?: string } }).evidence?.id === id)),
              'response Evidence fact absent, tainted, or conflicted');
            }
          }
          return putReserved(admitted.capacities.receipt, encoded(freeze(observation)).bytes);
        });
        const retained = consumeResult(captured, { Success: () => captured, Refused: refusal => {
          if (bindingAttempts.has(admitted.capacities.receipt)) return refusal;
          const uncertain: ProviderObservation = { state: 'uncertain', bytes: null, providerOperation: null,
            usage: { inputTokens: null, outputTokens: null, charge: null,
              source: 'malformed provider return retained as uncertainty' }, retryBlocked: false,
            limitation: { kind: 'invalid-provider-observation', observedBytesAtLeast: null } };
          const persisted = checked('CaptureMalformedProviderReturn', () =>
            putReserved(admitted.capacities.receipt, encoded(freeze(uncertain)).bytes));
          return consumeResult(persisted, {
            Success: () => refusal,
            Refused: persistenceRefusal => persistenceRefusal,
          });
        } });
        const evidenceTokens = [admitted.capacities.raw, admitted.capacities.answer,
          admitted.capacities.sourceClaim, admitted.capacities.terminalClaim]
          .filter((token): token is import('../judgment/index.js').CaptureCapacity => !!token);
        return cleanup(evidenceTokens) ?? retained;
      } });
    } } satisfies ProviderInvocationPort);
  });

  function materializeEvidence(draft: ProviderResponseEvidenceDraft, payload: ProviderCallPayload,
    claim: DispatchClaim, claimId: string, answer: unknown,
    capacities: Readonly<{ raw?: import('../judgment/index.js').CaptureCapacity;
      answer?: import('../judgment/index.js').CaptureCapacity; sourceClaim?: import('../judgment/index.js').CaptureCapacity;
      terminalClaim?: import('../judgment/index.js').CaptureCapacity }>,
    putReserved: (capacity: import('../judgment/index.js').CaptureCapacity, bytes: string) => Capture): ProviderResponseEvidence {
    ensure(capacities.raw && capacities.answer && capacities.sourceClaim && capacities.terminalClaim,
      'response evidence capacity was not admitted before dispatch');
    ensure(typeof answer === 'string' && draft.answer.answerDigest === hashBytes(answer), 'response evidence answer digest differs');
    const raw = Buffer.from(draft.terminal.rawBase64, 'base64');
    ensure(raw.toString('base64') === draft.terminal.rawBase64
      && `sha256:${createHash('sha256').update(raw).digest('hex')}` === draft.terminal.rawDigest, 'raw terminal bytes or digest differ');
    let frame: Record<string, unknown> | undefined, extracted: string | undefined;
    try {
      frame = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) as Record<string, unknown>;
      const transformed = frame.structured_output === undefined ? frame.result : JSON.stringify(frame.structured_output);
      if (typeof transformed === 'string') extracted = transformed;
    } catch { /* The bounded raw return is retained, but cannot issue affirmative completion Evidence. */ }
    const actualReason = frame?.[draft.basis.terminalReasonField];
    const providerReason = typeof actualReason === 'string' ? actualReason : '';
    const reasonClass = providerReason.toLowerCase();
    const errored = frame?.is_error !== false;
    const cancelled = reasonClass.includes('cancel');
    const timedOut = reasonClass.includes('timeout');
    const truncated = reasonClass.includes('length') || reasonClass.includes('limit') || reasonClass.includes('truncat');
    const toolCall = reasonClass.includes('tool') || reasonClass.includes('function');
    const terminalAllowed = frame?.type === 'result' && !errored && extracted === answer
      && draft.basis.successfulFinalReplyReasons.includes(providerReason)
      && !cancelled && !timedOut && !truncated && !toolCall;
    const rawCapture = putReserved(capacities.raw, Buffer.from(raw).toString('base64'));
    const answerCapture = putReserved(capacities.answer, answer);
    const source = { ...draft.source, observerPrincipal: host.principal.id, request: payload.request.id,
      attempt: payload.attempt, operation: claim.operation, claim: claimId };
    const terminal = { reason: terminalAllowed ? 'successful-final-reply' : 'unsupported-terminal', providerReason,
        rawDigest: draft.terminal.rawDigest,
        limited: draft.terminal.limited, errored, cancelled, timedOut, truncated, toolCall,
        observedAt: host.current().clock.value, raw: rawCapture };
    const answerView = { ...draft.answer, source: answerCapture };
    if (draft.eligibility !== 'admitted' || !author || !terminalAllowed) return freeze({ eligibility: 'held', contract: draft.contract,
      source: { ...source, evidence: draft.basis.sourceEvidence },
      terminal: { ...terminal, evidence: draft.basis.terminalEvidence }, answer: answerView });

    const snapshot = take(store.readForProjection());
    const authorityEvidence = (id: string, predicate: string, expected: Json) => {
      const row = snapshot.entries.find(entry => !entry.taint.length && !entry.conflicts.length
        && (entry.fact.body as unknown as { evidence?: Evidence }).evidence?.id === id);
      ensure(row, 'approved response evidence-contract fact absent, tainted, or conflicted');
      const evidence = (row.fact.body as unknown as { evidence: Evidence }).evidence;
      const read = take(readEvidence(evidence, host.current().clock, c.preserved));
      ensure(read.subject === draft.contract.evidenceContractReference && read.predicate === predicate
        && encoded(read.value).bytes === encoded(expected).bytes, 'response evidence-contract authority differs');
      const captured = author.context.captures[evidence.capture.reference];
      ensure(captured?.status === 'available' && captured.bytes !== null && captured.hash === evidence.capture.hash
        && hashBytes(captured.bytes) === evidence.capture.hash, 'response evidence-contract authority capture unavailable');
      return row.fact.id;
    };
    const sourceBasis = { version: draft.contract.evidenceContractVersion,
      parserReference: draft.contract.parserReference, parserVersion: draft.contract.parserVersion,
      endpoint: source.endpoint, account: source.account, credentialReference: source.credentialReference,
      controller: source.controller, executableArtifact: source.executableArtifact,
      provider: source.provider, model: source.model, route: source.route };
    const terminalBasis = { version: draft.contract.evidenceContractVersion,
      parserReference: draft.contract.parserReference, parserVersion: draft.contract.parserVersion,
      terminalReasonField: draft.basis.terminalReasonField,
      successfulFinalReplyReasons: draft.basis.successfulFinalReplyReasons };
    const sourceAuthority = draft.basis.sourceEvidence.map(id => authorityEvidence(id, 'provider-response-source-contract', sourceBasis));
    const terminalAuthority = authorityEvidence(draft.basis.terminalEvidence, 'provider-response-terminal-contract', terminalBasis);
    const authValue = { evidenceContractReference: draft.contract.evidenceContractReference,
      evidenceContractVersion: draft.contract.evidenceContractVersion,
      parserReference: draft.contract.parserReference, parserVersion: draft.contract.parserVersion,
      endpoint: source.endpoint, account: source.account, credentialReference: source.credentialReference,
      controller: source.controller, executableArtifact: source.executableArtifact,
      provider: source.provider, model: source.model, route: source.route, call: source.call,
      request: source.request, attempt: source.attempt, operation: source.operation, claim: source.claim,
      submittedDigest: source.submittedDigest, rawDigest: terminal.rawDigest, answerDigest: answerView.answerDigest };
    const completionValue = { evidenceContractReference: draft.contract.evidenceContractReference,
      evidenceContractVersion: draft.contract.evidenceContractVersion,
      parserReference: draft.contract.parserReference, parserVersion: draft.contract.parserVersion,
      terminalCapture: rawCapture, rawDigest: terminal.rawDigest, reason: terminal.reason,
      providerReason: terminal.providerReason, limited: terminal.limited, errored: terminal.errored,
      cancelled: terminal.cancelled, timedOut: terminal.timedOut, truncated: terminal.truncated,
      toolCall: terminal.toolCall, answerCapture, answerDigest: answerView.answerDigest,
      extractionContract: answerView.extractionContract };
    const appendEvidence = (predicate: 'response-authenticity' | 'response-completeness', value: Json,
      capacity: import('../judgment/index.js').CaptureCapacity, required: readonly string[]) => {
      const claimCapture = putReserved(capacity, encoded(value).bytes);
      const identity = encoded({ subject: claim.operation, predicate, value }).hash;
      const evidence = take(decode('Evidence', { type: 'Evidence', schemaVersion: 1,
        id: `provider-response-evidence:${identity}`, claim: { subject: claim.operation, predicate, value },
        source: host.principal, observedAt: host.current().clock, freshFor: payload.timeout,
        capture: claimCapture, strength: draft.source.strength }, host.current().decode));
      const prior = snapshot.entries.find(entry => (entry.fact.body as unknown as { evidence?: Evidence }).evidence?.id === evidence.id);
      if (prior) { ensure(encoded((prior.fact.body as unknown as { evidence: Evidence }).evidence).bytes === encoded(evidence).bytes,
        'response Evidence immutable collision'); return { evidence, fact: prior.fact.id }; }
      const body = JSON.parse(encoded({ evidence }).bytes) as Json;
      const fact = take(authorAndAppend({ kind: 'evidence-record', schemaVersion: 1, machine: host.machine,
        principal: JSON.parse(encoded(host.principal).bytes) as Json,
        provenance: JSON.parse(encoded(host.principal.provenance).bytes) as Json,
        at: JSON.parse(encoded(host.current().clock).bytes) as Json, body,
        required: [...new Set([payload.request.id, claimId, ...required])].sort() },
      author.context, store, author.privateKey)).fact;
      return { evidence, fact: fact.id };
    };
    const actualSource = appendEvidence('response-authenticity', authValue as Json, capacities.sourceClaim, sourceAuthority);
    const actualTerminal = appendEvidence('response-completeness', completionValue as unknown as Json,
      capacities.terminalClaim, [terminalAuthority]);
    return freeze({ eligibility: 'admitted', contract: draft.contract,
      source: { ...source, evidence: [actualSource.evidence.id] },
      terminal: { ...terminal, evidence: actualTerminal.evidence.id }, answer: answerView });
  }

  function snapshotEvidenceDraft(value: object, maxOutputBytes: number,
    registered: ProviderResponseEvidence['contract']): ProviderResponseEvidenceDraft {
    let nodes = 0;
    const clone = (input: unknown, depth: number): unknown => {
      ensure(depth <= 8 && ++nodes <= 512, 'response evidence draft exceeds structural bound');
      if (input === null || typeof input === 'number' || typeof input === 'boolean') return input;
      if (typeof input === 'string') {
        ensure(input.length <= 12 * maxOutputBytes + 65536, 'response evidence draft text exceeds bound');
        return input;
      }
      ensure(input && typeof input === 'object', 'response evidence draft value refused');
      if (Array.isArray(input)) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
        ensure(lengthDescriptor && 'value' in lengthDescriptor && Number.isSafeInteger(lengthDescriptor.value)
          && lengthDescriptor.value >= 0 && lengthDescriptor.value <= 64, 'response evidence draft array exceeds bound');
        const allowed = new Set(['length', ...Array.from({ length: lengthDescriptor.value }, (_, index) => String(index))]);
        ensure(Reflect.ownKeys(input).every(key => typeof key === 'string' && allowed.has(key)),
          'response evidence draft array fields differ');
        return Array.from({ length: lengthDescriptor.value }, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
          ensure(descriptor && 'value' in descriptor, 'response evidence draft array accessor refused');
          return clone(descriptor.value, depth + 1);
        });
      }
      ensure([Object.prototype, null].includes(Object.getPrototypeOf(input)), 'response evidence draft prototype refused');
      const output: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(input)) {
        ensure(typeof key === 'string', 'response evidence draft symbol refused');
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        ensure(descriptor && 'value' in descriptor, 'response evidence draft accessor refused');
        output[key] = clone(descriptor.value, depth + 1);
      }
      return output;
    };
    const draft = clone(value, 0) as unknown as ProviderResponseEvidenceDraft;
    const keys = (input: object, expected: readonly string[]) => ensure(Reflect.ownKeys(input).sort().join(',') === [...expected].sort().join(','),
      'response evidence draft fields differ');
    keys(draft, ['eligibility', 'contract', 'basis', 'source', 'terminal', 'answer']);
    keys(draft.contract, ['parserReference', 'parserVersion', 'evidenceContractReference', 'evidenceContractVersion',
      'mode', 'maxMetadataBytes', 'maxRawTerminalBytes', 'maxCaptureBytes']);
    keys(draft.basis, ['sourceEvidence', 'terminalEvidence', 'terminalReasonField', 'successfulFinalReplyReasons']);
    keys(draft.source, ['controller', 'evidence', 'endpoint', 'account', 'credentialReference', 'executableArtifact',
      'provider', 'model', 'route', 'call', 'submittedDigest', 'strength']);
    keys(draft.terminal, ['rawBase64', 'rawDigest', 'evidence', 'reason', 'providerReason', 'limited', 'errored', 'cancelled',
      'timedOut', 'truncated', 'toolCall']);
    keys(draft.answer, ['extractionContract', 'answerDigest']);
    ensure(encoded(draft.contract).bytes === encoded(registered).bytes
      && draft.contract.maxRawTerminalBytes >= 0 && draft.contract.maxMetadataBytes > 0
      && draft.terminal.rawBase64.length <= Math.ceil(draft.contract.maxRawTerminalBytes / 3) * 4,
    'response evidence draft capture bound differs');
    return draft;
  }
}
