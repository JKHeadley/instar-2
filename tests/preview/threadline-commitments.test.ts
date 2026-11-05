import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, obligationSchedule, projectionDigest } from './journal.js';
import { openLoops } from './obligations.js';
import { CollaborationSurfacer, collaborationEndpoint, type HubEffect } from './collaboration-hub.js';
import { offerEnvelope } from '../../src/rungraph/index.js';
import { findCommitmentByThread } from '../../src/rungraph/promises.js';
import { createNetwork } from '../transport/agent-fault-harness.js';

// Additional projection test: the network's explicit test authority is NOT an
// installed owner. production-delegation.test covers the real booted authority.
it('origin, operator move and confirmed peer-result delivery share the existing promise projection across restart', async () => {
  const root = mkdtempSync(join(tmpdir(), 'threadline-promise-')), key = new Uint8Array(32).fill(81), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '-1007654321000',
    operator: '7654321', forum: true, grant: 'isolated', configurationDigest: 'sha256:offline', expires: 10000000,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const network = createNetwork('threadline');
  const sender = network.add('sender', ['code'], () => null);
  network.add('receiver', ['code'], () => ({ terminal: 'completed', result: 'The recorded work is complete.' }));
  const sends: HubEffect[] = [];
  const hub = new CollaborationSurfacer({ state: () => journal.view.collaboration, append: row => journal.append(row),
    now: () => 1000, admitted: () => true, replicated: async () => true, operator: receipt => receipt === 'operator-receipt',
    topics: () => [{ topicId: 42, topicName: 'Build' }, { topicId: 43, topicName: 'Review' }],
    effect: async (_id, effect) => { sends.push(effect); return { kind: 'accepted', id: sends.length, receipt: 'checked-platform-receipt' }; } });
  try {
    const source = 'telegram:12345678:update:1';
    journal.append({ kind: 'intake', id: source, update: 1, text: 'Please ask the peer to review.',
      raw: JSON.stringify({ update_id: 1, message: { chat: { id: -1007654321000, type: 'supergroup', is_forum: true },
        from: { id: 7654321 }, message_thread_id: 42, text: 'Please ask the peer to review.' } }),
      accepted: true, thread: 42, cursor: 2, at: 1000 });
    const contract = network.delegate(sender, network.request(network.rootAuthority('sender'), 'receiver'));
    const origin = { kind: 'collaboration' as const, action: 'origin' as const,
      envelope: offerEnvelope(contract), topic: 42, source, at: 1000 };
    journal.append(origin); journal.append(origin);
    expect(journal.view.commitments).toHaveLength(1);
    expect(obligationSchedule(journal.view)).toEqual([]);
    expect(openLoops(journal.view, 100000).find(row => row.kind === 'commitment')).toMatchObject({ nextAt: null, revisitDue: false });
    await hub.bind({ threadId: contract.transport.conversation, targetTopicId: 43, operatorReceipt: 'operator-receipt' });
    expect(findCommitmentByThread(journal.view, contract.transport.conversation)?.note.threadline?.topic).toBe(43);
    sender.endpoint = collaborationEndpoint(sender.endpoint, hub, sender.ledger);
    network.tick(2);
    expect(hub.list().inbox).toHaveLength(1);
    expect(journal.view.closed.size).toBe(0); // A peer result is not a delivery receipt.
    await hub.drain(async () => ({ warrants: true, parentTopicId: null }));
    expect(sends.at(-1)).toMatchObject({ topic: 43, silent: false });
    expect(journal.view.closed.get(0)?.source).toBe('checked-platform-receipt');
    journal.append(origin); // Recovery never reopens a delivered promise.
    expect(journal.view.commitments).toHaveLength(1);
    const digest = projectionDigest(journal.view);
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    expect(projectionDigest(journal.view)).toBe(digest);
    expect(findCommitmentByThread(journal.view, contract.transport.conversation)).toBeNull();
    expect(journal.view.collaboration?.threads[0]).toMatchObject({ parent: 43, originTopic: 42 });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
