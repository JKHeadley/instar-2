import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { REPLY_RULES } from './reply-check.js';

const key = new Uint8Array(32).fill(8);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, replyTo?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    ...(replyTo === undefined ? {} : { reply_to_message: { message_id: replyTo } }) } });
const jevPass = { model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0.01 }])) };

it('answers from the earlier reply packet across restart and sends through Jev', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-why-'))), path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, genesis);
    const seen: Record<string, unknown>[] = [];
    let checks = 0, sends = 0;
    const ports = { now: () => 1000, stopped: () => false,
      prepareModel: (input: { question: string; context: string; id: string }) =>
        prepareJournalEnvelope(input, 'claude-offline-exact-1', genesis.grant, 1000),
      model: async (input: { question: string; context: string }) => {
        const packet = JSON.parse(input.context) as Record<string, unknown>; seen.push(packet);
        return input.question.startsWith('Why') ? 'The recorded packet included your Cedar turn; I cannot tell which input I relied on.'
          : input.question === 'What is the marker?' ? 'Cedar is the marker.' : 'I will remember Cedar.';
      }, send: async () => ++sends, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100, jev: async () => { checks++; return { value: jevPass, latencyMs: 1 }; },
        escalate: async () => { throw Error('unexpected review'); } } };
    const worker = createJournalWorker(first, ports);
    worker.intake([update(1, 'The marker is Cedar.')]); await worker.drain();
    first.append({ kind: 'channel-item', item: { source: 'conversation', account: 'agent-owned', id: 'note-7',
      from: 'Justin (export metadata)', at: 1000, text: 'Cedar is the marker.' }, at: 1000 });
    worker.intake([update(2, 'What is the marker?')]); await worker.drain();
    expect(seen[1]?.replyProvenance).toBeUndefined();
    first.close();

    const replay = openPreviewJournal(path, key);
    const resumed = createJournalWorker(replay, ports);
    resumed.intake([update(3, 'Why did you say Cedar is the marker?', 2)]); await resumed.drain();
    const evidence = seen[2]?.replyProvenance as { update: number; reply: string; recorded: {
      history: { user: string }[]; channelMemory: { sourceId: string; quote: string }[] } };
    expect(evidence.update).toBe(2);
    expect(evidence.reply).toBe('Cedar is the marker.');
    expect(evidence.recorded.history).toEqual(expect.arrayContaining([expect.objectContaining({ user: 'The marker is Cedar.' })]));
    expect(evidence.recorded.channelMemory).toEqual([expect.objectContaining({ sourceId: 'note-7', quote: 'Cedar is the marker.' })]);
    expect(replay.view.order[1]?.prompt).toBeTruthy();
    expect(replay.view.order[2]?.intent).toContain('recorded packet included your Cedar turn');
    expect(replay.view.order[2]?.replyChecks?.at(-1)?.path).toBe('jev');
    expect(checks).toBe(3);
    expect(sends).toBe(3);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('reports a missing historical packet instead of inventing a reason', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-why-missing-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    journal.append({ kind: 'intake', id: 'old', update: 1, text: 'What is the marker?', raw: JSON.stringify(update(1, 'What is the marker?')),
      accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id: 'old', at: 1000 });
    journal.append({ kind: 'answer', id: 'old', text: 'Cedar is the marker.', at: 1000 });
    journal.append({ kind: 'intent', id: 'old', text: 'PREVIEW — Cedar is the marker.', chat: genesis.chat,
      update: 1, grant: genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id: 'old', message: 11, at: 1000 });
    let seen: { recorded: unknown; missing: string } | undefined;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => { seen = (JSON.parse(input.context) as { replyProvenance: typeof seen }).replyProvenance;
        return 'The reply is recorded, but its input packet is missing, so I cannot say why.'; },
      send: async () => 12, checkOutbound: () => {} });
    worker.intake([update(2, 'Why did you say Cedar is the marker?')]); await worker.drain();
    expect(seen?.recorded).toBeNull();
    expect(seen?.missing).toContain('No packet was retained');
    expect(journal.view.order[1]?.intent).toContain('input packet is missing');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps answering honestly when the old packet cannot fit the reply bound', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-why-bound-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { ...genesis, maxBytes: 1900 });
    const seen: Record<string, unknown>[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      sources: [{ id: 'source:large', text: 'x'.repeat(450) }],
      prepareModel: input => JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => { seen.push(JSON.parse(input.context)); return input.question.startsWith('Why')
        ? 'I have the reply, but its recorded packet did not fit this context.' : 'Cedar is the marker.'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'What is the marker?')]); await worker.drain();
    worker.intake([update(2, 'Why did you say Cedar is the marker?')]); await worker.drain();
    expect(seen).toHaveLength(2);
    expect((seen[1]?.replyProvenance as { recorded: unknown; missing: string }).recorded).toBeNull();
    expect((seen[1]?.replyProvenance as { missing: string }).missing).toContain('did not fit');
    expect(journal.view.order[1]?.intent).toContain('did not fit');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('selects a quoted older reply and marks a first-turn why question as having no reply record', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-why-select-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    const seen: Record<string, unknown>[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => { seen.push(JSON.parse(input.context));
        return input.question === 'First question: why did you say that?' ? 'There is no earlier reply here.'
          : input.question === 'Alpha prompt' ? 'Alpha quartz' : input.question === 'Beta prompt' ? 'Beta maple'
            : 'The Alpha reply had the Alpha prompt available.'; },
      send: async input => input.update, checkOutbound: () => {} });
    for (const [id, question] of ['First question: why did you say that?', 'Alpha prompt', 'Beta prompt',
      'Why did you say Alpha quartz?'].entries()) {
      worker.intake([update(id + 1, question)]); await worker.drain();
    }
    expect((seen[0]?.replyProvenance as { recorded: unknown; missing: string }).recorded).toBeNull();
    expect((seen[0]?.replyProvenance as { missing: string }).missing).toContain('No earlier reply');
    expect((seen[3]?.replyProvenance as { update: number }).update).toBe(2);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
