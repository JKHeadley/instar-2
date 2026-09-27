import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(47);
const now = 1790500000000;
const source = (update: number) => `telegram:12345678:update:${update}`;

it('measures which memories survive a capped packet after 5,000 turns', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-packet-pressure-')));
  try {
    const genesis = {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 100, maxReplies: 100, maxTurns: 5001, maxBytes: 262144, cursor: 0 } as const;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const planted = new Map([
      [100, 'Harbor key amber: the handoff is with Mira.'],
      [200, 'Harbor key blue: the handoff is with Noor.'],
      [300, 'Harbor key coral: the handoff is with Ivo.'],
      [400, 'Harbor key dusk: the handoff is with Ren.'],
      [500, 'Harbor key ember: the handoff is with Sol.'],
    ]);
    for (let update = 1; update <= 5000; update++) {
      const text = planted.get(update) ?? (update === 5000 ? 'Where did the answer go?'
        : `Ordinary turn ${update}: routine workshop and planning notes.`);
      const turn = { id: source(update), update, text,
        raw: JSON.stringify({ update_id: update, message: { chat: { id: 7654321, type: 'private' },
          from: { id: 7654321 }, text, date: Math.floor(now / 1000) + update } }),
        accepted: true, at: now, reserved: false };
      journal.view.turns.set(turn.id, turn);
      journal.view.order.push(turn);
    }
    const grounding = (recalled: string[]) => ({ packetSha256: 'offline', summaryThrough: null,
      history: [], recalled, people: [], commitments: [], channelItems: [], corrections: [],
      memoryChanges: [], memoryCandidates: [] });
    journal.append({ kind: 'reserve', id: source(4998), grounding: grounding([source(100)]), at: now });
    journal.append({ kind: 'answer', id: source(4998), text: 'The handoff was recorded.', at: now });
    journal.append({ kind: 'intent', id: source(4998), text: 'PREVIEW — The handoff was recorded.',
      chat: '7654321', update: 4998, grant: 'grant:preview', at: now });
    journal.append({ kind: 'sent', id: source(4998), message: 4998, at: now });
    journal.append({ kind: 'reserve', id: source(5000), grounding: grounding([source(200)]), at: now });
    journal.append({ kind: 'summary-reserve', through: 5000, at: now });
    journal.append({ kind: 'summary', through: 5000, text: 'The operator discussed harbor key handoffs.',
      questions: [{ source: source(5000), quote: 'Where did the answer go?', reason: 'unanswered-reply' }], at: now });
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    // int12: the reply packet carries more fixed instructions, so the one- and two-item
    // pressure points moved from 3000/3500 bytes to 5750/6000 (measured; the memory
    // self-description and person-attribute instructions added the last 500 bytes).
    for (const limit of [5750, 6000, 6500]) {
      journal.view.limits.maxBytes = limit;
      const probe = worker.probe('What is the harbor key handoff status?');
      if ('reason' in probe) {
        process.stdout.write(`packet pressure ${limit}: ${probe.reason}\n`);
        continue;
      }
      const packet = JSON.parse(probe.context) as { recalled?: { id: string }[]; openQuestions?: { id: string }[] };
      const kept = packet.recalled?.map(item => item.id) ?? [];
      process.stdout.write(`packet pressure ${limit}: bytes=${Buffer.byteLength(probe.context)} kept=${kept.map(id => id.split(':').at(-1)).join(',')} dropped=${probe.dropped.map(item => `${item.kind}:${item.source.split(':').at(-1)}`).join(',')} open=${packet.openQuestions?.length ?? 0}\n`);
      expect(Buffer.byteLength(probe.context)).toBeLessThanOrEqual(limit);
      if (limit === 5750) {
        expect(kept).toEqual([source(200)]); // open question link wins a one-item boundary
      }
      if (limit === 6000) {
        expect(kept).toEqual([source(100), source(200)]);
        expect(probe.dropped.filter(item => item.kind === 'recent').map(item => item.source))
          .toEqual([source(300), source(400), source(500)]);
      }
    }
    journal.view.limits.maxBytes = 6000;
    const recentTurn = journal.view.turns.get(source(4998))!;
    const sent = recentTurn.sent!;
    delete recentTurn.sent;
    const withoutRecent = worker.probe('What is the harbor key handoff status?');
    if ('reason' in withoutRecent) throw Error(withoutRecent.reason);
    expect((JSON.parse(withoutRecent.context) as { recalled?: { id: string }[] }).recalled?.map(item => item.id))
      .toEqual([source(200), source(500)]);
    recentTurn.sent = sent;
    const questions = journal.view.questions.splice(0);
    const withoutOpen = worker.probe('What is the harbor key handoff status?');
    if ('reason' in withoutOpen) throw Error(withoutOpen.reason);
    expect((JSON.parse(withoutOpen.context) as { recalled?: { id: string }[] }).recalled?.map(item => item.id))
      .toEqual([source(100), source(500)]);
    delete recentTurn.sent;
    const withoutSignals = worker.probe('What is the harbor key handoff status?');
    if ('reason' in withoutSignals) throw Error(withoutSignals.reason);
    const before = (JSON.parse(withoutSignals.context) as { recalled?: { id: string }[] }).recalled?.map(item => item.id) ?? [];
    expect(before).toEqual([source(400), source(500)]);
    process.stdout.write(`packet pressure 6000 without reference signals: kept=${before.map(id => id.split(':').at(-1)).join(',')} needed=0/2\n`);
    recentTurn.sent = sent;
    journal.view.questions.push(...questions);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
