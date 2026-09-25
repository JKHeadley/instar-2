import { buildGrounding, withholdCredentials, type ConversationMessage, type Grounding, type GroundingTrigger,
  type OpenCommitment, type RecallItem, type RecallPacket } from './grounding.js';
import { decideContext, type SentinelAction, type SentinelConfig, type SentinelState, type StuckSignature } from './sentinel.js';
import { buildWorkIndex, detectOverlaps, workForTopic, type OverlapPair, type SessionActivity, type WorkEntry } from './work.js';

/**
 * Session awareness service: composes the pure grounding builder, own-work index and
 * context sentinel over small ports. Every port is plain data in, plain data out; the
 * physical side (files, tmux, the session driver) stays outside the core.
 */

export interface AwarenessTopic { readonly id: string; readonly name: string; readonly claim: string }
export interface AwarenessSources {
  identity(): Readonly<{ name: string; identity: string }>;
  topics(): readonly AwarenessTopic[];
  conversation(topic: string): Readonly<{ messages: readonly ConversationMessage[]; summary?: string }>;
  commitments(): readonly OpenCommitment[];
  sessions(): readonly SessionActivity[];
}
/** The consumer-side contract for port-memory's recall doorway (docs/21 `RecallPort.prepare`, reduced to what grounding reads). */
export interface RecallPort {
  prepare(input: Readonly<{ topic: string; query: string; now: number; maxItems: number }>): RecallPacket;
}
export interface AwarenessReceipts {
  readonly grounded: readonly Readonly<{ at: number; source: string; digest: string }>[];
  readonly compactions: readonly number[];
  readonly turnsClosed: readonly number[];
}
export interface AwarenessIO {
  writeGrounding(claim: string, text: string): string;
  readGroundingDigest(claim: string): string | null;
  readReceipts(session: string): AwarenessReceipts;
  loadState(): SentinelState;
  saveState(state: SentinelState): void;
  signal(row: Readonly<Record<string, unknown>>): void;
}
export interface ObservedSession {
  readonly session: string;
  readonly topic: string;
  readonly alive: boolean;
  readonly startedAt: number;
  readonly pane: 'idle' | 'busy' | 'unknown';
  readonly stuck: StuckSignature;
}
/** Supplied by the session driver (port-sessions): its sessions and their live pane classification. */
export interface SessionObserverPort { observe(): readonly ObservedSession[] }
/** Bounded actions, performed by their owners. Both must dedupe on `operation`. */
export interface AwarenessActions {
  deliver(input: Readonly<{ session: string; text: string; operation: string }>): void;
  recoverContext(input: Readonly<{ session: string; operation: string }>): void;
}
export interface AwarenessConfig {
  readonly sources: AwarenessSources;
  readonly recall: RecallPort;
  readonly io: AwarenessIO;
  readonly observer: SessionObserverPort;
  readonly actions: AwarenessActions;
  readonly now: () => number;
  readonly stopped: () => boolean;
  readonly recentMessages?: number;
  readonly recallItems?: number;
  readonly sentinel?: Partial<SentinelConfig>;
}
export interface TickReport {
  readonly actions: readonly SentinelAction[];
  readonly failures: readonly Readonly<{ action: SentinelAction['kind']; detail: string }>[];
}

export const FAKE_RECALL_LABEL = 'FAKE recall stand-in — port-memory recall doorway not landed; lexical match over supplied items only';

/** A clearly labelled stand-in until port-memory lands. Lexical only, so it reports `degraded`, never `assembled`. */
export function createLabelledFakeRecall(items: readonly (RecallItem & Readonly<{ topic?: string }>)[] = []): RecallPort {
  const words = (text: string) => new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3));
  return Object.freeze({
    prepare(input: Readonly<{ topic: string; query: string; now: number; maxItems: number }>): RecallPacket {
      const query = words(input.query);
      const hits = items.filter(item => item.topic !== input.topic && !item.secret)
        .map(item => ({ item, score: [...words(item.text)].filter(word => query.has(word)).length }))
        .filter(row => row.score > 0).sort((a, b) => b.score - a.score || b.item.at - a.item.at)
        .slice(0, input.maxItems).map(row => row.item);
      return Object.freeze({ disposition: 'degraded' as const, items: hits, label: FAKE_RECALL_LABEL,
        reason: 'meaning-based recall unavailable (stand-in)' });
    },
  });
}

const regroundPreamble = (kind: string) => [
  `[instar awareness] Your context was ${kind === 'compact' ? 'compacted' : 'reset'} and the session-start grounding was not confirmed.`,
  'Here it is again. Carry on with the work in progress and honour the open commitments below;',
  'do not ask the user to repeat anything that appears here.', ''].join('\n');

export function createAwareness(config: AwarenessConfig) {
  const topicsById = () => new Map(config.sources.topics().map(topic => [topic.id, topic]));
  const work = (): readonly WorkEntry[] => buildWorkIndex(config.sources.sessions(), config.sources.commitments());
  const overlaps = (entries: readonly WorkEntry[] = work()): readonly OverlapPair[] => detectOverlaps(entries, { now: config.now() });
  const recallFor = (topic: string, messages: readonly ConversationMessage[], focus: string): RecallPacket => {
    const query = [...messages.filter(m => m.from === 'user' && !m.secret).slice(-3).map(m => m.text), focus].join(' ');
    try {
      return config.recall.prepare({ topic, query: withholdCredentials(query), now: config.now(), maxItems: config.recallItems ?? 8 });
    } catch (error) {
      return { disposition: 'degraded', items: [], reason: `recall failed: ${error instanceof Error ? error.message : 'unknown'}` };
    }
  };
  const grounding = (topicId: string, source: GroundingTrigger = 'refresh'): Grounding => {
    const topic = topicsById().get(topicId);
    if (!topic) throw new Error(`awareness: unknown topic ${topicId}`);
    const conversation = config.sources.conversation(topic.id);
    const entries = work();
    const messages = conversation.messages.slice(-(config.recentMessages ?? 30));
    const own = entries.find(row => row.topic === topic.id);
    return buildGrounding({ agent: config.sources.identity(), topic: { id: topic.id, name: topic.name }, now: config.now(), source,
      conversation: messages, ...(conversation.summary !== undefined ? { summary: conversation.summary } : {}),
      commitments: config.sources.commitments(), work: workForTopic(topic.id, entries, overlaps(entries)),
      recall: recallFor(topic.id, messages, own?.focus ?? '') });
  };

  const tick = (): TickReport => {
    const now = config.now(), stopped = config.stopped();
    const topics = topicsById();
    const current = new Map([...topics.values()].map(topic => [topic.id, grounding(topic.id)]));
    const observed = config.observer.observe();
    const observations = observed.map(row => ({ ...row, ...config.io.readReceipts(row.session) }));
    const groundings = [...topics.values()].map(topic => ({ topic: topic.id, current: current.get(topic.id)!.digest,
      file: config.io.readGroundingDigest(topic.claim) }));
    const decision = decideContext({ now, stopped, state: config.io.loadState(), observations, groundings,
      ...(config.sentinel ? { config: config.sentinel } : {}) });
    // Record attempts before performing them: a crash can lose an attempt, never repeat one.
    config.io.saveState(decision.state);
    const failures: { action: SentinelAction['kind']; detail: string }[] = [];
    for (const action of decision.actions) {
      try {
        if (action.kind === 'signal') config.io.signal({ at: now, ...action });
        else if (action.kind === 'write-grounding') {
          const topic = topics.get(action.topic)!;
          config.io.writeGrounding(topic.claim, current.get(action.topic)!.text);
        } else if (action.kind === 'reground') {
          const kind = decision.state.sessions.find(row => row.session === action.session)?.episode?.kind ?? 'respawn';
          const text = regroundPreamble(kind) + grounding(action.topic, kind === 'compact' ? 'compact' : 'respawn').text;
          config.actions.deliver({ session: action.session, text, operation: action.operation });
        } else config.actions.recoverContext({ session: action.session, operation: action.operation });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown failure';
        failures.push({ action: action.kind, detail });
        config.io.signal({ at: now, kind: 'signal', event: 'action-failed', action: action.kind, detail });
      }
    }
    return Object.freeze({ actions: decision.actions, failures });
  };

  return Object.freeze({ grounding, work, overlaps: () => overlaps(), tick });
}

/** The Claude Code settings fragment a session driver passes at spawn: SessionStart with no matcher,
 * so startup, resume, clear and compact are all grounded by one hook. Merge beside the driver's own hooks. */
export function groundingHookSettings(hookScript: string): Readonly<{ SessionStart: readonly unknown[] }> {
  if (!hookScript.startsWith('/') || /["\n]/.test(hookScript)) throw new Error('awareness: exact absolute hook path required');
  return Object.freeze({ SessionStart: [{ hooks: [{ type: 'command', command: `node "${hookScript}"` }] }] });
}
