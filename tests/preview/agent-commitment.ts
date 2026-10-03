/** The preview's own promises. Whether a reply promises something, and whether a
 * later reply carries a promise out, is the answering model's reading (Rule 10);
 * code only checks exact values: the quoted sentence is in the reply actually
 * sent, the date phrase is inside that quote, and the counts and sizes are bounded. */
import { parseDatedItem, type DatedItem } from './dated-memory.js';

/** `promised` marks a model-proposed promise; the other actions are legacy journal rows. */
export interface AgentPromise { quote: string; action: 'promised' | 'remind' | 'check' | 'follow up' | 'send' | 'tell' | 'update' | 'keep';
  owner: 'agent'; waitsOn: 'next-relevant-reply'; due?: DatedItem }
export interface PromiseProposal { quote: string; when?: string }
export interface FulfillmentProposal { id: number; quote: string }
export const AGENT_PROMISE_LIMIT = 5;

/** A fulfilment quote is bounded by the reply it must appear in, not by the sentence bound a promise
 * quote carries: a longer verbatim excerpt is MORE constrained, not less, and a sendable reply is at most
 * 4096 bytes (the send path's own ceiling). Live 2026-10-03 (room two, A-proofroom2-20261003-022222, check
 * A5b) a delivered promise stayed open; the live answer row was not readable, so its exact cause is
 * UNCONFIRMED. Real claude-sonnet-5 calls on the recorded packet showed one answer shape that this bound
 * decided: the whole reply quoted as the excerpt closed the promise at 413 bytes and was refused at 526, so
 * the reply's length alone decided whether a fulfilment was recorded (the live reply body was 610 bytes). */
export const REPLY_EXCERPT_LIMIT = 4096;

const exactClause = (value: unknown, within: string, limit = 500) => typeof value === 'string' && value.trim() === value
  && value.length >= 3 && Buffer.byteLength(value) <= limit && within.includes(value);

/** Validated promise proposals from one answer, or undefined when the proposal is malformed. */
export function promiseProposals(value: unknown, reply: string): PromiseProposal[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > AGENT_PROMISE_LIMIT) return undefined;
  const found: PromiseProposal[] = [];
  for (const item of value as { quote?: unknown; when?: unknown }[]) {
    if (!item || typeof item !== 'object' || !exactClause(item.quote, reply)) return undefined;
    const quote = item.quote as string;
    if (item.when !== undefined && !(typeof item.when === 'string' && item.when.trim() === item.when
      && item.when.length > 0 && Buffer.byteLength(item.when) <= 100 && quote.includes(item.when))) return undefined;
    if (!found.some(saved => saved.quote === quote))
      found.push({ quote, ...(typeof item.when === 'string' ? { when: item.when } : {}) });
  }
  return found;
}
/** The one rule deciding whether a reply may carry out commitment `id`: the commitment is a promise the
 * agent itself made. A commitment the operator asked for — a reminder to them — is not the agent's promise,
 * so a reply delivering it settles that reminder through its own path, never as a fulfillment claim. */
export const fulfillableCommitment = (commitments: readonly { agentPromise?: unknown }[], id: number): boolean =>
  commitments[id]?.agentPromise !== undefined;

/** The whole support rule for one fulfillment claim: the reply as written still quotes it, and it names a
 * commitment this reply may carry out. The writer applies this before it appends an answer row and the
 * replay applies it when it reads that row back, so the two cannot drift. They did drift once: the writer
 * offered every agent-OWNED commitment while the replay accepted only agent PROMISES, so one delivered
 * reminder wrote a row the replay refused and made a whole journal unreadable (build 30bda628, 2026-10-01). */
export const fulfillmentSupported = (item: FulfillmentProposal, reply: string,
  commitments: readonly { agentPromise?: unknown }[]): boolean =>
  reply.includes(item.quote) && fulfillableCommitment(commitments, item.id);

/** Validated fulfillment proposals from one answer, or undefined when the proposal is malformed or claims
 * anything `supported` refuses. `supported` is the caller's own narrowing of `fulfillmentSupported`. */
export function fulfillmentProposals(value: unknown, reply: string,
  supported: (item: FulfillmentProposal) => boolean): FulfillmentProposal[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > AGENT_PROMISE_LIMIT) return undefined;
  const found: FulfillmentProposal[] = [];
  for (const item of value as { id?: unknown; quote?: unknown }[]) {
    if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.id)
      || !exactClause(item.quote, reply, REPLY_EXCERPT_LIMIT)
      || !supported({ id: item.id as number, quote: item.quote as string })) return undefined;
    if (!found.some(saved => saved.id === item.id)) found.push({ id: item.id as number, quote: item.quote as string });
  }
  return found;
}
/** The promises recorded with a reply at send intent: only proposals still quoted exactly in the final reply. */
export function recordedPromises(proposals: readonly PromiseProposal[], reply: string, source: string, at: number, zone: string): AgentPromise[] {
  return proposals.filter(item => reply.includes(item.quote)).map(item => {
    const due = item.when ? parseDatedItem(source, item.quote, item.when, at, zone) : undefined;
    return { quote: item.quote, action: 'promised' as const, owner: 'agent' as const, waitsOn: 'next-relevant-reply' as const, ...(due ? { due } : {}) };
  });
}

/** Legacy replay only: journal intents recorded before model-proposed fulfillment
 * carry no `fulfills` field and keep the closure rule they were written under. */
export function legacyFulfillsReminder(promise: AgentPromise, reply: string): boolean {
  if (promise.action !== 'remind') return false;
  const target = /^(?:I’ll|I'll|I will) remind you to\s+(.+?)(?:[.!?])?$/iu.exec(promise.quote)?.[1]
    ?.replace(/\s+(?:tomorrow|today|on \d{4}-\d{2}-\d{2})\s*$/iu, '').replace(/[.!?]+$/u, '').trim();
  if (!target) return false;
  const reminder = /^Reminder:[ \t]+(.+?)(?:[.!?])?$/iu.exec(reply.replace(/^PREVIEW — /u, '').trim())?.[1]
    ?.replace(/[.!?]+$/u, '').trim();
  return reminder?.toLowerCase() === target.toLowerCase();
}
