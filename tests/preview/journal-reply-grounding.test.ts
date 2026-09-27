import { createHash } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(19);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grounding-trial', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 262144, cursor: 0 };
const id = (update: number) => `telegram:12345678:update:${update}`;
const update = (n: number, text: string) => ({ update_id: n,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

it.each([1, null])('records exact full-history IDs before an accepted or UNKNOWN send (%s)', async receipt => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-grounding-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    const contexts = new Map<string, string>();
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => { contexts.set(input.id, input.context); return 'answer'; },
      send: async () => receipt, checkOutbound: () => {} });
    worker.intake([update(1, 'The dock is blue.'), update(2, 'What color is the dock?')]);
    await worker.drain();
    const turn = journal.view.turns.get(id(2))!;
    const audit = turn.grounding!;
    expect(audit.history).toEqual([id(1)]);
    expect(audit.summaryThrough).toBeNull();
    expect(audit.recalled).toEqual([]);
    expect(audit.channelItems).toEqual([]);
    expect(audit.packetSha256).toBe(createHash('sha256').update(contexts.get(id(2))!).digest('hex'));
    expect(turn.intent).toBe('PREVIEW — answer');
    expect(turn.sent).toBe(receipt ?? undefined);
    journal.close();
    if (receipt !== null) {
      const inspected = spawnSync(process.execPath, ['--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/journal-agent.mjs', 'inspect', '--root', root, '--update', '2'],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8' });
      expect(inspected.status, inspected.stderr).toBe(0);
      const output = JSON.parse(inspected.stdout) as { reply: { text: string; telegramMessageId: number; grounding: unknown } };
      expect(output.reply).toEqual({ update: 2, text: 'PREVIEW — answer', telegramMessageId: 1,
        outcome: 'api-accepted', grounding: audit });
    }
    const replay = openPreviewJournal(path, key);
    expect(replay.view.turns.get(id(2))?.grounding).toEqual(audit);
    expect(replay.view.turns.get(id(2))?.sent).toBe(receipt ?? undefined);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('indexes only selected compacted turns and imported items', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-grounding-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    const contexts = new Map<string, string>();
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => { const packet = JSON.parse(input.context);
        if ((input.id === id(3) || input.id === id(4)) && !packet.summary) throw Error('prompt overflow');
        if (input.id === id(4) && packet.channelMemory?.length) throw Error('prompt overflow');
        return input.context; },
      model: async input => { contexts.set(input.id, input.context); return 'answer'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'The dock seven marker is blue.'), update(2, 'Remember that Mara uses the red locker.')]);
    await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 2, at: 1000 });
    journal.append({ kind: 'summary', through: 2, text: 'Dock seven and Mara locker facts.',
      people: [{ name: 'Mara', source: id(2), quote: 'Mara uses the red locker.' }],
      commitments: [{ in: 'message', source: id(2), quote: 'Remember that Mara uses the red locker.' }], at: 1000 });
    journal.append({ kind: 'channel-item', item: { source: 'email', account: 'agent@example.test', id: 'mail-7',
      from: 'Mara', at: 1000, text: 'Dock seven has a blue marker.' }, at: 1000 });
    worker.intake([update(3, 'What did Mara say about dock seven and the locker?')]);
    await worker.drain();
    const turn = journal.view.turns.get(id(3))!;
    const packet = JSON.parse(contexts.get(id(3))!) as { history: unknown[]; recalled?: unknown[];
      people?: unknown[]; commitments?: unknown[]; channelMemory?: unknown[]; summary?: { through: number } };
    const audit = turn.grounding!;
    expect(packet.summary?.through).toBe(2);
    expect(audit.summaryThrough).toBe(2);
    expect(audit.history).toEqual([]);
    expect(audit.recalled).toEqual([id(1)]);
    expect(audit.people).toEqual([id(2)]);
    expect(audit.commitments).toEqual([0]);
    expect(audit.channelItems).toEqual(['channel:["email","agent@example.test","mail-7"]']);
    expect(audit.recalled).toHaveLength(packet.recalled?.length ?? 0);
    expect(audit.channelItems).toHaveLength(packet.channelMemory?.length ?? 0);
    worker.intake([update(4, 'What did Mara say about dock seven and the locker?')]);
    await worker.drain();
    const omitted = journal.view.turns.get(id(4))!.grounding!;
    expect(omitted.channelItems).toEqual([]);
    expect(JSON.parse(contexts.get(id(4))!).channelMemory).toBeUndefined();
    expect(journal.view.channelItems.size).toBe(1);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.turns.get(id(3))?.grounding).toEqual(audit);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
