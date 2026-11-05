import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, obligationSchedule, projectionDigest, commitmentOpen, currentActionFacts } from './journal.js';
import { createJournalWorker } from './journal-test-worker.js';
import { sourcePacket, SOURCE_PINS } from './briefing.js';
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

it('an authenticated parent Threadline receipt keeps a nested promise visible without inventing a Telegram turn', async () => {
  const root = mkdtempSync(join(tmpdir(), 'threadline-nested-promise-')), key = new Uint8Array(32).fill(83), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '-1007654321000',
    operator: '7654321', forum: true, grant: 'isolated', configurationDigest: 'sha256:offline', expires: 10000000,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const network = createNetwork('threadline');
  const sender = network.add('sender', ['code'], () => null);
  const receiver = network.add('receiver', ['code'], () => null);
  network.add('third', ['code'], () => null);
  const hub = new CollaborationSurfacer({ state: () => journal.view.collaboration, append: row => journal.append(row),
    now: () => 1000, admitted: () => true, replicated: async () => true, operator: receipt => receipt === 'operator-receipt',
    topics: () => [{ topicId: 42, topicName: 'Build' }],
    effect: async () => ({ kind: 'accepted', id: 99, receipt: 'isolated-platform-receipt' }) });
  try {
    receiver.endpoint = collaborationEndpoint(receiver.endpoint, hub, receiver.ledger);
    const parent = network.delegate(sender, network.request(network.rootAuthority('sender'), 'receiver'));
    network.tick();
    await hub.drain(async () => ({ warrants: true, parentTopicId: null }));
    await hub.bind({ threadId: parent.transport.conversation, targetTopicId: 42, operatorReceipt: 'operator-receipt' });
    const child = network.delegate(receiver, { ...network.request(network.rootAuthority('receiver'), 'third'), conversation: 'nested-thread' });
    const source = `threadline:${offerEnvelope(parent).key}`;
    journal.append({ kind: 'collaboration', action: 'origin', envelope: offerEnvelope(child), topic: 42, source, at: 1000 });
    expect(journal.view.turns.has(source)).toBe(false);
    expect(commitmentOpen(journal.view, 0)).toBe(true);
    expect(openLoops(journal.view, 100000)).toContainEqual(expect.objectContaining({ kind: 'commitment', source, openedAt: 1000, nextAt: null }));
    expect(obligationSchedule(journal.view)).toEqual([]);
    expect(() => journal.append({ kind: 'collaboration', action: 'origin', envelope: offerEnvelope(child), topic: 42,
      source: 'threadline:missing', at: 1000 })).toThrow(/admitted origin/);
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    expect(commitmentOpen(journal.view, 0)).toBe(true);
    expect(openLoops(journal.view, 100000)).toHaveLength(1);
    expect(currentActionFacts(journal.view, 1000, false).items).toEqual([]);
    expect(currentActionFacts(journal.view, 1000, true).items).toContainEqual(expect.objectContaining({
      kind: 'delegated-work', topic: '42', state: 'open; awaiting external result delivery' }));
    const corpus = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8'));
    const capabilityNote = sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS,
      { providerAttempts: 20, expiresAt: 10000000 }).sources.find(source => source.id === 'capability-note')!;
    const capabilities = JSON.parse(readFileSync('generated/capabilities.json', 'utf8'));
    const description = capabilities.launchers['tests/preview/journal-agent.mjs'].find((item: { id: string }) => item.id === 'preview-collaboration-hub').text;
    expect(capabilityNote.text).toContain(description);
    for (const [index, shape] of corpus.otherShapes.entries()) {
      let invoked = false;
      let packet: { actionFacts: { items: { kind: string }[] }; commitments: unknown[]; sources: { id: string; text: string }[] } | undefined;
      const worker = createJournalWorker(journal, { now: () => 2000 + index, stopped: () => false,
        groupDisclosure: async () => true, sources: [capabilityNote],
        model: async ({ context }) => {
          invoked = true;
          packet = JSON.parse(context) as typeof packet;
          return shape.raw; // Exact historical bytes, no fresh model invocation.
        }, send: async () => null, checkOutbound: () => {} });
      worker.intake([{ update_id: index + 2, message: { chat: { id: -1007654321000, type: 'supergroup', is_forum: true },
        from: { id: 7654321 }, message_thread_id: 42, text: 'Report the state of this delegated task.', date: 2 } }]);
      await worker.drain();
      expect(invoked, shape.id).toBe(true);
      expect(packet?.sources.find(source => source.id === 'capability-note')?.text, shape.id).toContain(description);
      expect(packet?.actionFacts.items.some(item => item.kind === 'delegated-work'), shape.id).toBe(true);
      expect(packet?.commitments ?? []).toEqual([]); // A task is not a quote from an earlier agent reply.
      expect(commitmentOpen(journal.view, 0), shape.id).toBe(true);
    }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 30000);
