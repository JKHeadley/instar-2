/** Row 88: CollaborationSurfacer routing and hub binding, adapted from 1.x.
 * The host supplies its existing admitted effect doorway, not a second sender.
 * Intent precedes dispatch; UNKNOWN is retained across restart, never retried.
 * All state is projected in the existing encrypted, replicated owner journal.
 */
import { conversationBrief, hubIntentDecision, hubIntentRequest, briefRequest, type ConversationTurn, type HubModelRequest, type BriefMessageRow } from './hub-model-contract.js';
import { redact } from '../../src/recall/redact.js';
import { offerEnvelope, resultEnvelope, semanticDigest, envelopeIntact } from '../../src/rungraph/index.js';
import type { DelegationLedger, AgentEndpoint, AgentTransportEnvelope, EndpointReceipt } from '../../src/rungraph/index.js';

export interface HubThread {
  threadId: string; peerName: string; subject: string; surfacedAt: number;
  parent: number | null;
  /** Original admitted route survives an explicit operator move. */
  originTopic?: number;
}
export type HubEffect =
  | { kind: 'topic'; name: string }
  | { kind: 'message'; topic: number; text: string; silent: boolean };
export type HubOutcome = { kind: 'accepted'; id: number; receipt?: string }
  | { kind: 'refused' | 'unknown'; reason: string };
export interface HubAttempt { id: string; effect: HubEffect; authorization?: string; dispatched?: true; outcome?: HubOutcome }
export interface HubInbox { envelope: AgentTransportEnvelope; receipt: EndpointReceipt; handled: boolean }
export interface HubModelCall { id: string; promptId: string; maxTokens: number; deadline: number; settled?: true }
export interface HubState { modelCalls?: HubModelCall[]; origins?: { edge: string; digest: string; topic: number; source: string }[];
  threads: HubThread[]; attempts: HubAttempt[]; inbox: HubInbox[]; openings: { threadId: string; topicName: string; summary: string }[] }
export type HubRecord = { kind: 'collaboration'; at: number } & (
  | { action: 'origin'; envelope: AgentTransportEnvelope; topic: number; source: string }
  | { action: 'model-reserve'; id: string; promptId: 'hub-intent-v1' | 'open-conversation-brief-v1'; maxTokens: number; deadline: number; maxInputTokens: number }
  | { action: 'model-settle'; id: string; usage?: { inputTokens: number | null; outputTokens: number | null; charge: null; inputComplete?: true } }
  | { action: 'thread'; thread: HubThread }
  | { action: 'intent'; attempt: HubAttempt }
  | { action: 'dispatch'; id: string }
  | { action: 'outcome'; id: string; outcome: HubOutcome }
  | { action: 'receive'; envelope: AgentTransportEnvelope; receipt: EndpointReceipt }
  | { action: 'handled'; key: string }
  | { action: 'opening'; threadId: string; topicName: string; summary: string }
  | { action: 'bind'; threadId: string; topic: number });
type NewHubRecord = HubRecord extends infer R ? R extends HubRecord ? Omit<R, 'at'> : never : never;
const validText = (s: unknown, max: number): s is string => typeof s === 'string' && s.length > 0 && s.length <= max;
const topicId = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) > 0;
const need = (yes: unknown, reason: string) => { if (!yes) throw Error(`collaboration: ${reason}`); };
export function applyHubRecord(previous: HubState | undefined, row: HubRecord): HubState {
  const next: HubState = structuredClone({ threads: [], attempts: [], inbox: [], ...previous, openings: previous?.openings ?? [] });
  need(Number.isSafeInteger(row.at) && row.at >= 0, 'invalid time');
  if (row.action === 'origin') {
    const e = row.envelope, c = e.contract;
    need(envelopeIntact(e) && e.kind === 'offer' && c && offerEnvelope(c).digest === e.digest && e.sender === c.owner
      && e.recipient === c.recipient && e.conversation === c.transport.conversation
      && topicId(row.topic) && validText(row.source, 1024), 'exact admitted outgoing delegation required');
    const thread = next.threads.find(item => item.threadId === e.conversation);
    need(!thread || (thread.originTopic ?? thread.parent) === row.topic, 'automatic origin cannot redirect a conversation');
    const origins = next.origins ??= [], prior = origins.find(item => item.edge === c!.id);
    need(!prior || prior.digest === c!.digest && prior.topic === row.topic && prior.source === row.source, 'delegation origin differs');
    if (!prior) {
      need(origins.length < 8000, 'origin capacity; history retained');
      origins.push({ edge: c!.id, digest: c!.digest, topic: row.topic, source: row.source });
    }
    if (!thread) {
      need(next.threads.length < 2000, 'thread capacity; history retained');
      next.threads.push({ threadId: e.conversation, peerName: readablePeer(e.recipient),
        subject: readableHubGist(c!.task.question), surfacedAt: row.at, parent: row.topic, originTopic: row.topic });
    } else thread.originTopic = row.topic;
  } else if (row.action === 'model-reserve') {
    const calls = next.modelCalls ??= [];
    const limits = row.promptId === 'hub-intent-v1' ? [200, 4000] : row.promptId === 'open-conversation-brief-v1' ? [320, 15000] : null;
    need(limits && row.maxTokens === limits[0] && Number.isSafeInteger(row.deadline)
      && row.deadline > row.at && row.deadline <= row.at + limits[1]!, 'model invocation bounds differ');
    need(validText(row.id, 1024) && !calls.some(call => call.id === row.id) && calls.length < 8000,
      'model invocation missing, repeated or capacity exhausted');
    calls.push({ id: row.id, promptId: row.promptId, maxTokens: row.maxTokens, deadline: row.deadline });
  } else if (row.action === 'model-settle') {
    const call = next.modelCalls?.find(item => item.id === row.id);
    need(call && !call.settled, 'model settlement without unique reservation'); call!.settled = true;
  } else if (row.action === 'receive') {
    const { envelope: e, receipt: r } = row;
    need(r.key === e.key && r.digest === (e.result?.digest ?? e.digest) && r.durability !== null
      && ['durably-queued', 'delivered-to-worker', 'answered'].includes(r.state), 'no admitted endpoint receipt');
    need(!next.inbox.some(x => x.envelope.key === e.key), 'duplicate intake');
    need(next.inbox.length < 2000, 'inbox capacity; accepted evidence retained');
    next.inbox.push({ envelope: e, receipt: r, handled: false });
  } else if (row.action === 'handled') {
    const item = next.inbox.find(x => x.envelope.key === row.key);
    need(item && !item.handled, 'intake missing or already handled'); item!.handled = true;
  } else if (row.action === 'thread') {
    const t = row.thread;
    need(validText(t.threadId, 512) && validText(t.peerName, 120) && validText(t.subject, 240)
      && t.surfacedAt === row.at && (t.parent === null || topicId(t.parent)) && t.originTopic === undefined, 'invalid thread');
    need(!next.threads.some(x => x.threadId === t.threadId), 'thread already retained');
    need(next.threads.length < 2000, 'thread capacity; history retained');
    next.threads.push(t);
  } else if (row.action === 'intent') {
    const a = row.attempt, e = a.effect;
    need(validText(a.id, 1024) && a.outcome === undefined && a.dispatched === undefined && !next.attempts.some(x => x.id === a.id), 'invalid or repeated intent');
    need(a.authorization === undefined || validText(a.authorization, 32768), 'invalid effect authorization');
    need(e.kind === 'topic' ? validText(e.name, 40)
      : e.kind === 'message' && topicId(e.topic) && validText(e.text, 4000) && typeof e.silent === 'boolean', 'invalid effect');
    need(next.attempts.length < 8000, 'effect capacity; evidence retained');
    next.attempts.push(a);
  } else if (row.action === 'dispatch') {
    const a = next.attempts.find(x => x.id === row.id);
    need(a && !a.dispatched && !a.outcome, 'dispatch without unique prepared intent'); a!.dispatched = true;
  } else if (row.action === 'outcome') {
    const a = next.attempts.find(x => x.id === row.id), o = row.outcome;
    need(a && a.dispatched && !a.outcome, 'outcome without unique intent');
    need(o.kind === 'accepted' ? topicId(o.id) && (o.receipt === undefined || validText(o.receipt, 16384))
      : (o.kind === 'refused' || o.kind === 'unknown') && validText(o.reason, 1024), 'invalid outcome');
    a!.outcome = o;
  } else if (row.action === 'opening') {
    need(next.threads.some(t => t.threadId === row.threadId) && !next.openings.some(o => o.threadId === row.threadId), 'opening missing thread or repeated');
    need(validText(row.topicName, 40) && validText(row.summary, 600), 'invalid opening brief');
    next.openings.push({ threadId: row.threadId, topicName: row.topicName, summary: row.summary });
  } else if (row.action === 'bind') {
    const t = next.threads.find(x => x.threadId === row.threadId);
    need(t && topicId(row.topic), 'thread missing or invalid topic');
    t!.parent = row.topic;
  } else throw Error('collaboration: unknown action');
  return next;
}

export interface HubHost {
  state(): HubState | undefined;
  append(row: HubRecord): void;
  now(): number;
  admitted(): boolean;
  /** Achieve the installation's existing durability demand before dispatch. */
  replicated(): Promise<boolean>;
  /** Existing owner doorway rechecks secrets, scope, stop and current ownership. */
  effect(id: string, effect: HubEffect): Promise<HubOutcome>;
  /** Exact current grant/binding/policy cause. Null refuses before preparation.
   * Installed hosts supply this; legacy dispatched outcomes remain evidence. */
  authorization?(effect: HubEffect): string | null;
  /** Revalidate an existing independently verified operator receipt. A string
   * from the request itself is never authority. No fallback to agent standing. */
  operator(receipt: string): boolean;
  topics(): readonly { topicId: number; topicName: string }[];
}
export type HubBindResult = { ok: true; threadId: string; topicId: number; outcome: 'bound' | 'pending' }
  | { ok: false; status: number; error: string };

/** Session input is a principal (R29). Resolve only an actually retained
 * endpoint receipt plus its operator/origin binding, never a caller's topic. */
export function collaborationTopicForOperation(state: HubState | undefined, operation: string): number | null {
  const received = state?.inbox.find(item => operation === `threadline:${item.envelope.key}`);
  if (!received || received.receipt.durability === null
    || !['durably-queued', 'delivered-to-worker', 'answered'].includes(received.receipt.state)
    || received.receipt.key !== received.envelope.key
    || received.receipt.digest !== semanticDigest(received.envelope)) return null;
  return state!.threads.find(thread => thread.threadId === received.envelope.conversation)?.parent ?? null;
}

// The 1.x readable-gist algorithm and 240-character bound, with the existing
// secret redactor applied before anything can reach a topic title or message.
export function readableHubGist(text: string): string {
  let t = (text ?? '').trim();
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      const parsed = JSON.parse(t);
      const extracted = parsed && (parsed.text ?? parsed.content ?? parsed.body ?? parsed.message);
      t = typeof extracted === 'string' && extracted.trim() ? extracted.trim() : '(structured message)';
    } catch { t = '(message)'; }
  }
  t = redact(t).text.replace(/\s+/g, ' ').trim();
  if (!t) return '(no preview)';
  return t.length > 240 ? t.slice(0, 239) + '…' : t;
}
function readablePeer(name: string): string {
  const n = redact((name ?? '').trim()).text;
  if (!n) return 'An agent';
  if (/^[a-f0-9]{16,}$/i.test(n)) return n.slice(0, 8);
  return n.slice(0, 120);
}

export class CollaborationSurfacer {
  // One host owns the journal. Serialization prevents concurrent first contacts
  // creating two hubs or two bind operations racing across an awaited effect.
  private tail: Promise<unknown> = Promise.resolve();
  private draining: Promise<void> | null = null;
  constructor(private readonly host: HubHost) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result;
  }
  private append(row: NewHubRecord): void {
    need(this.host.admitted(), 'owner, stop or grant refused');
    this.host.append({ ...row, at: this.host.now() } as HubRecord);
  }
  private async effect(id: string, effect: HubEffect, permitted: () => boolean = () => true): Promise<HubOutcome> {
    const old = this.host.state()?.attempts.find(x => x.id === id);
    const authorization = this.host.authorization?.(effect);
    if (!old?.dispatched && this.host.authorization && (authorization === null
      || old && old.authorization !== authorization)) return { kind: 'refused', reason: 'current effect role/binding/scope authorization unavailable or changed' };
    if (old) {
      need(JSON.stringify(old.effect) === JSON.stringify(effect), 'effect identity conflicts with recorded payload');
      if (old.outcome) return old.outcome;
      if (old.dispatched) return { kind: 'unknown', reason: 'dispatch interrupted; reconcile before any retry' };
    } else this.append({ kind: 'collaboration', action: 'intent', attempt: { id, effect, ...(authorization === undefined || authorization === null ? {} : { authorization }) } });
    if (!await this.host.replicated() || !this.host.admitted() || !permitted()
      || this.host.authorization && this.host.authorization(effect) !== authorization)
      return { kind: 'unknown', reason: 'prepared; durability or owner unavailable' };
    this.append({ kind: 'collaboration', action: 'dispatch', id });
    // Replicate the dispatch fence too. Losing it could let a successor replay.
    if (!await this.host.replicated() || !this.host.admitted() || !permitted()
      || this.host.authorization && this.host.authorization(effect) !== authorization)
      return { kind: 'unknown', reason: 'dispatch fence confirmation unavailable' };
    let outcome: HubOutcome;
    try { outcome = await this.host.effect(id, effect); }
    catch { outcome = { kind: 'unknown', reason: 'effect doorway did not return a receipt' }; }
    this.append({ kind: 'collaboration', action: 'outcome', id, outcome });
    if (!await this.host.replicated()) return { kind: 'unknown', reason: 'outcome replication pending' };
    return outcome;
  }
  private async hub(): Promise<number | null> {
    const out = await this.effect('hub:create', { kind: 'topic', name: 'Threadline' });
    return out.kind === 'accepted' ? out.id : null;
  }
  list(): HubState { const state = this.host.state(); return structuredClone({ threads: [], attempts: [], inbox: [], ...state, openings: state?.openings ?? [] }); }
  /** Only the wrapper below calls this, after the real endpoint admits the
   * authenticated envelope. It never supplies execution authority. */
  capture(envelope: AgentTransportEnvelope, receipt: EndpointReceipt): void {
    if (this.list().inbox.some(x => x.envelope.key === envelope.key)) return;
    this.append({ kind: 'collaboration', action: 'receive', envelope, receipt });
  }
  drain(review: (envelope: AgentTransportEnvelope) => Promise<{
    warrants: boolean; parentTopicId: number | null;
  } | null>): Promise<void> {
    if (this.draining) return this.draining;
    this.draining = this.drainOnce(review).finally(() => { this.draining = null; });
    return this.draining;
  }
  private async drainOnce(review: Parameters<CollaborationSurfacer['drain']>[0]): Promise<void> {
    // A bounded snapshot; uncertain judgment leaves its durable input pending.
    for (const input of this.list().inbox.filter(x => !x.handled).slice(0, 50)) {
      if (!this.host.admitted()) return;
      const decision = await review(input.envelope);
      if (!decision || !this.host.admitted()) continue;
      const e = input.envelope;
      const text = e.contract?.task.question ?? e.result?.result ?? e.reason ?? '(no preview)';
      const parent = this.list().threads.find(t => t.threadId === e.conversation)?.parent ?? decision.parentTopicId;
      if (parent !== null) {
        if (!this.host.topics().some(t => t.topicId === parent)) continue;
        const existing = this.list().threads.find(t => t.threadId === e.conversation);
        if (!existing) this.append({ kind: 'collaboration', action: 'thread', thread: {
          threadId: e.conversation, peerName: readablePeer(e.sender), subject: readableHubGist(text),
          surfacedAt: this.host.now(), parent } });
        await this.content({ threadId: e.conversation, messageId: e.key, text });
      } else await this.surface({ threadId: e.conversation, senderName: e.sender, text,
        hasParentTopic: false, warrants: decision.warrants });
      if (!this.list().attempts.some(a => !a.dispatched))
        this.append({ kind: 'collaboration', action: 'handled', key: e.key });
    }
  }
  mostRecentUnbound() {
    const state = this.list();
    const unbound = state.threads.filter(r => r.parent === null
      && state.attempts.some(a => a.id === `surface:${r.threadId}` && a.outcome?.kind === 'accepted'));
    // Stable journal order resolves equal clock readings, as legacy append order did.
    return { record: unbound.at(-1) ?? null, ambiguous: unbound.length > 1 };
  }
  surface(input: { threadId: string; senderName: string; text: string; hasParentTopic: boolean; warrants: boolean }) {
    return this.serial(async () => {
      if (input.hasParentTopic) return { surfaced: false, reason: 'has-parent-topic' };
      if (!input.warrants) return { surfaced: false, reason: 'not-warranted' };
      const existing = this.list().threads.find(r => r.threadId === input.threadId);
      if (existing?.parent !== null && existing !== undefined) return { surfaced: false, reason: 'has-parent-topic' };
      const posted = this.list().attempts.find(a => a.id === `surface:${input.threadId}`);
      if (posted?.dispatched) return { surfaced: false, reason: posted.outcome?.kind === 'accepted' ? 'already-surfaced' : 'delivery-unconfirmed' };
      const peer = existing?.peerName ?? readablePeer(input.senderName), gist = existing?.subject ?? readableHubGist(input.text);
      if (!existing) this.append({ kind: 'collaboration', action: 'thread', thread: { threadId: input.threadId,
        peerName: peer, subject: gist, surfacedAt: this.host.now(), parent: null } } as HubRecord);
      const topic = await this.hub();
      if (topic === null) return { surfaced: false, reason: 'hub-unconfirmed' };
      const out = await this.effect(`surface:${input.threadId}`, { kind: 'message', topic, silent: true,
        text: `🧵 ${peer} started a Threadline conversation:\n${gist}\n\n(reply in-thread, or say "open this" to give it its own topic)` });
      return { surfaced: out.kind === 'accepted', reason: out.kind, topicId: topic };
    });
  }
  notify(input: { id: string; threadId: string; title: string; body: string; peerName?: string }) {
    return this.serial(async () => {
      const topic = await this.hub();
      if (topic === null) return { kind: 'unknown' as const, reason: 'hub-unconfirmed' };
      const peer = input.peerName ? ` — ${readablePeer(input.peerName)}` : '';
      return this.effect(`notice:${JSON.stringify([input.threadId, input.id])}`, { kind: 'message', topic, silent: true,
        text: `🧵 ${readableHubGist(input.title)}${peer}\n${readableHubGist(input.body)}` });
    });
  }
  /** Explicit API binding. Model-directed most-recent choice must resolve its
   * thread first; a scripted ambiguous request never silently chooses one. */
  bind(args: { threadId?: string; targetTopicId: number; operatorReceipt: string }): Promise<HubBindResult> {
    return this.serial(async () => {
      need(this.host.admitted(), 'owner, stop or grant refused');
      need(this.host.operator(args.operatorReceipt), 'verified operator required');
      const mru = this.mostRecentUnbound();
      if (!args.threadId && mru.ambiguous) return { ok: false, status: 409, error: 'More than one unbound conversation — specify threadId' };
      const thread = args.threadId ? this.list().threads.find(t => t.threadId === args.threadId) : mru.record;
      if (!thread) return { ok: false, status: 404, error: 'Conversation not found' };
      if (!this.host.topics().some(t => t.topicId === args.targetTopicId)) return { ok: false, status: 400, error: 'Target topic is not available' };
      if (thread.parent !== args.targetTopicId) this.append({ kind: 'collaboration', action: 'bind', threadId: thread.threadId, topic: args.targetTopicId } as HubRecord);
      const durable = await this.host.replicated();
      return { ok: true, threadId: thread.threadId, topicId: args.targetTopicId, outcome: durable ? 'bound' : 'pending' };
    });
  }
  /** The caller supplies its existing bounded/reserved model doorway. Null,
   * unavailable or malformed judgments leave the user's message unconsumed. */
  async command(input: { text: string; context: ConversationTurn[]; operatorReceipt: string; id: string },
    model: (id: string, request: HubModelRequest) => Promise<string | null>,
    messages: (threadId: string) => BriefMessageRow[]) {
    if (!this.host.admitted() || !this.host.operator(input.operatorReceipt)) return { handled: false as const };
    const prepared = hubIntentRequest(input.text, input.context, [...this.host.topics()]);
    let raw: string | null;
    try { raw = await model(`classify:${input.id}`, prepared.request); } catch { raw = null; }
    const command = hubIntentDecision(raw, prepared.topics);
    if (!command || !this.host.admitted() || !this.host.operator(input.operatorReceipt)) return { handled: false as const };
    // 1.x model-interpreted "this" selects most-recent; explicit API bind keeps
    // its 409 above. Snapshot before an awaited brief to avoid a moving target.
    const thread = this.mostRecentUnbound().record;
    if (!thread) return { handled: false as const };
    if (command.action === 'tie') {
      const result = await this.bind({ threadId: thread.threadId, targetTopicId: command.targetTopicId, operatorReceipt: input.operatorReceipt });
      return { handled: result.ok, result };
    }
    const rows = messages(thread.threadId);
    let briefRaw: string | null = null;
    if (rows.length >= 2 && !this.list().openings.some(o => o.threadId === thread.threadId)) {
      try { briefRaw = await model(`brief:${input.id}`, briefRequest(rows)); } catch { /* original template fallback */ }
    }
    const brief = conversationBrief({ threadId: thread.threadId, conversation: { remoteAgent: thread.peerName }, messages: rows, raw: briefRaw });
    const result = await this.open({ threadId: thread.threadId, operatorReceipt: input.operatorReceipt, ...brief });
    return { handled: result.ok, result };
  }
  open(args: { threadId: string; operatorReceipt: string; topicName: string; summary: string }): Promise<HubBindResult> {
    return this.serial(async () => {
      need(this.host.admitted() && this.host.operator(args.operatorReceipt), 'verified operator and owner required');
      const thread = this.list().threads.find(t => t.threadId === args.threadId);
      if (!thread) return { ok: false, status: 404, error: 'Conversation not found' };
      let opening = this.list().openings.find(o => o.threadId === args.threadId);
      if (!opening) {
        if (thread.parent !== null) return { ok: false, status: 409, error: 'Conversation already bound' };
        opening = { threadId: args.threadId, topicName: redact(args.topicName).text, summary: redact(args.summary).text };
        this.append({ kind: 'collaboration', action: 'opening', ...opening });
      }
      const topic = await this.effect(`open:${args.threadId}`, { kind: 'topic', name: opening.topicName }, () => this.host.operator(args.operatorReceipt));
      if (topic.kind !== 'accepted') return { ok: false, status: 503, error: 'Topic creation unconfirmed; do not repeat outside reconciliation' };
      need(this.host.operator(args.operatorReceipt), 'operator receipt expired');
      if (thread.parent !== null && thread.parent !== topic.id) return { ok: false, status: 409, error: 'Conversation already bound elsewhere' };
      if (thread.parent === null) this.append({ kind: 'collaboration', action: 'bind', threadId: args.threadId, topic: topic.id });
      if (!await this.host.replicated()) return { ok: true, threadId: args.threadId, topicId: topic.id, outcome: 'pending' };
      const intro = await this.effect(`intro:${args.threadId}`, { kind: 'message', topic: topic.id, text: opening.summary, silent: false }, () => this.host.operator(args.operatorReceipt));
      return { ok: true, threadId: args.threadId, topicId: topic.id, outcome: intro.kind === 'accepted' ? 'bound' : 'pending' };
    });
  }
  /** Bound content uses the parent's existing route. Housekeeping never calls
   * this path, and a repeated message key never repeats an uncertain send. */
  content(input: { threadId: string; messageId: string; text: string }) {
    return this.serial(async () => {
      const thread = this.list().threads.find(t => t.threadId === input.threadId);
      if (!thread || thread.parent === null) return { kind: 'refused' as const, reason: 'No bound parent' };
      return this.effect(`content:${JSON.stringify([input.threadId, input.messageId])}`, { kind: 'message', topic: thread.parent,
        silent: false, text: redact(input.text).text.slice(0, 4000) });
    });
  }
}

/** Bind to the existing endpoint AND its durable ledger. Reconstruct admitted
 * offers/results at boot and explicit maintenance: a crash between endpoint custody and
 * hub capture must not depend on the sender submitting again (lookup stays pure).
 * Cancellation is lifecycle housekeeping, supplied through notify, not content.
 */
export function collaborationEndpoint(endpoint: AgentEndpoint, hub: CollaborationSurfacer,
  ledger: Pick<DelegationLedger, 'view'>): AgentEndpoint & { recoverCollaboration(): void } {
  const capture = (envelope: AgentTransportEnvelope, receipt: EndpointReceipt) => {
    if ((envelope.kind === 'offer' || envelope.kind === 'result') && receipt.durability !== null
      && ['durably-queued', 'delivered-to-worker', 'answered'].includes(receipt.state)) hub.capture(envelope, receipt);
  };
  const recover = () => {
    for (const edge of ledger.view().values()) {
      const c = edge.contract;
      const envelope = c.recipient === endpoint.principal && edge.executable ? offerEnvelope(c)
        : c.owner === endpoint.principal && edge.result ? resultEnvelope(c, edge.result, c.createdAt) : null;
      if (envelope) capture(envelope, endpoint.lookup(envelope.key, semanticDigest(envelope), envelope.sender));
    }
  };
  recover();
  return Object.freeze({ ...endpoint, recoverCollaboration: recover, receive(envelope: AgentTransportEnvelope, at: number, from: string) {
    const receipt = endpoint.receive(envelope, at, from);
    // Use the admitted contract's routing fields, never the transport wrapper's
    // conversation claim. A valid signature alone is not parent-topic authority.
    if (receipt.durability !== null && ['durably-queued', 'delivered-to-worker', 'answered'].includes(receipt.state)) recover();
    return receipt;
  } });
}

/** Operator adapter, invoked only by the existing authenticated PIN/CSRF HTTP
 * boundary. A receipt is live only for this exact call, never supplied by a
 * model, a conversation bearer or retained as reusable effect authority. */
export function createCollaborationSurface(host: Omit<HubHost, 'operator'>, commands?: {
  admitted(id: string): boolean;
  model(id: string, request: HubModelRequest): Promise<string | null>;
  messages(threadId: string): BriefMessageRow[];
}) {
  const receipts = new Map<string, number>();
  const hub = new CollaborationSurfacer({ ...host, operator: receipt => (receipts.get(receipt) ?? 0) > 0
    && (!receipt.startsWith('command:') || commands?.admitted(receipt.slice(8)) === true) });
  const bind = async (input: { threadId?: string; targetTopicId: number }, receipt: string) => {
    if (!/^dashboard:[a-f0-9]{64}$/u.test(receipt)) throw Error('verified operator surface required');
    receipts.set(receipt, (receipts.get(receipt) ?? 0) + 1);
    try { return await hub.bind({ ...input, operatorReceipt: receipt }); }
    finally { const left = receipts.get(receipt)! - 1; if (left) receipts.set(receipt, left); else receipts.delete(receipt); }
  };
  const command = async (input: { id: string; text: string; context: ConversationTurn[] }) => {
    if (!commands?.admitted(input.id)) return { handled: false as const };
    const receipt = `command:${input.id}`;
    receipts.set(receipt, (receipts.get(receipt) ?? 0) + 1);
    try { return await hub.command({ ...input, operatorReceipt: receipt }, commands.model, commands.messages); }
    finally { const left = receipts.get(receipt)! - 1; if (left) receipts.set(receipt, left); else receipts.delete(receipt); }
  };
  return Object.freeze({ hub, bind, command, list: () => ({ threads: hub.list().threads, topics: host.topics() }) });
}
