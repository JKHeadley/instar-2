import { createHash } from 'node:crypto';
import { ensure, take } from './boundary.js';
import type { SessionWorkConfig, SessionWorkIO } from './production-session-work.js';

import type { HarnessAdapterPort, HarnessInputDelivery } from './contracts.js';
export type { HarnessWorkerHandle as ConversationWorker, HarnessInputDelivery as ConversationDelivery,
  HarnessNormalizedObservation as ConversationObservation } from './contracts.js';
import type { HarnessNormalizedObservation as ConversationObservation } from './contracts.js';
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

/** Claude conversation mapping around the existing physical driver. A Stop-hook receipt,
 * never pane-idle or repeated file reads, admits the bounded reply capture. */
export function createSessionConversationAdapter(config: Readonly<{
  createDriver: SessionWorkConfig['createDriver']; io: SessionWorkIO;
  resolveDelivery(operation: string): HarnessInputDelivery | undefined;
}>): HarnessAdapterPort<2> {
  const driver = config.createDriver((operation, digest) => {
    const input = config.resolveDelivery(operation);
    ensure(input !== undefined && input.digest === digest && hash(input.text) === digest, 'durable delivery bytes missing or changed');
    return input.text;
  });
  return {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false, contextRecovery: 'host-snapshot' }),
    launch: async input => ({ launch: take(driver.launch({ ...input, handles: [] })), incarnation: input.incarnation, claim: input.claim }),
    deliver: async input => {
      config.io.clearResult(input.resultPath);
      ensure(config.io.readResult(input.resultPath, input.maxBytes) === null, 'stale conversation result remains');
      const receipt = driver.deliver({ operation: input.operation, processIdentity: input.launch, intake: input.operation,
        digest: input.digest, incarnation: input.incarnation });
      return { state: 'accepted', evidence: take(receipt) };
    },
    observe: async input => {
      ensure(Number.isSafeInteger(input.cursor) && input.cursor >= 0 && input.cursor <= 2 && input.limit >= 1 && input.limit <= 64,
        'bounded observation cursor and batch required');
      const observed = take(driver.observe({ operation: input.delivery?.operation ?? input.claim, processIdentity: input.launch }));
      let events: ConversationObservation[] = [];
      if (observed.phase === 'exit-observed') events = [{ kind: 'exit', evidence: observed.evidence }];
      else if (observed.phase === 'pause-observed' || observed.phase === 'uncertain') events = [{ kind: 'paused', evidence: observed.evidence }];
      else if (input.delivery && observed.phase === 'output-observed' && observed.evidence.startsWith('turn-closed:')) {
        const text = config.io.readResult(input.delivery.resultPath, input.delivery.maxBytes);
        ensure(text === null || Buffer.byteLength(text) <= input.delivery.maxBytes, 'conversation result exceeds byte bound');
        if (text?.trim()) events.push({ kind: 'reply', delivery: input.delivery.operation, text, digest: hash(text) });
        events.push({ kind: 'turn-end', delivery: input.delivery.operation, state: text?.trim() ? 'completed' : 'no-reply' });
      }
      // Lifecycle observations are independent of the last turn's cursor.
      if (events[0]?.kind === 'exit' || events[0]?.kind === 'paused') return { observations: events, cursor: input.cursor, complete: true };
      const batch = events.slice(input.cursor, input.cursor + input.limit);
      return { observations: batch, cursor: input.cursor + batch.length, complete: true };
    },
    control: async input => {
      if (input.action === 'compact') return { state: 'refused', evidence: 'use grounded replacement; in-place compaction unsupported' };
      take(driver.stop({ claim: input.claim, incarnation: input.incarnation,
        ...(input.launch ? { processIdentity: input.launch } : {}) }));
      return { state: 'closed', evidence: input.reason };
    },
  };
}
