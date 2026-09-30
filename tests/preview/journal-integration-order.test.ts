import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal, UNKNOWN_ANSWER_NOTICE } from './journal-test-worker.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';

// Astra int6 MUST-FIX 1: a pending memory correction held on an EARLIER ordinary turn
// must not stop the scan before a LATER already-due lost-answer notice.
it('sends a later loss notice while an earlier ordinary turn is held for a pending correction', async () => {
  const key = new Uint8Array(32).fill(17);
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
  const update = (id: number, text: string) => ({ update_id: id,
    message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text } });
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'int6-order-')));
  let journal: ReturnType<typeof openPreviewJournal> | undefined;
  try {
    const path = join(root, 'journal.encrypted');
    let crash = true;
    journal = openPreviewJournal(path, key, genesis, stage => {
      if (crash && stage === 'after:model-uncertain') { crash = false; throw Error('interrupted after durable ended-UNKNOWN'); }
    });
    const sends: { text: string }[] = [];
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string; question: string; context: string }) => {
        if (input.id.startsWith('summary:')) {
          const request = JSON.parse(input.context).memoryRequest?.message ?? '';
          return JSON.stringify({ summary: 'The questions remain unanswered.', people: [], memory: [],
            ...(request.startsWith('Actually,') ? { memoryDisposition: 'unresolved' } : {}) });
        }
        if (input.question === 'First question') throw Error('no durable model result');
        return { state: 'uncertain' as const };
      },
      replyCheck: { jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
        .map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 0 }),
        escalate: async () => { throw Error('unexpected escalation'); }, elapsedMs: () => 0 },
      send: async (input: { text: string }) => { sends.push(input); return sends.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports as never);
    worker.intake([update(1, 'First question'), update(2, 'Second question')]);
    await expect(worker.drain()).rejects.toThrow('interrupted');
    expect(journal.view.order[1]?.modelState).toBe('uncertain');
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports as never);
    worker.intake([update(3, 'Actually, the cedar trail starts at West Pier.')]);
    for (let i = 0; i < 4; i++) await worker.drain();
    expect(sends.filter(item => item.text.includes(UNKNOWN_ANSWER_NOTICE))).toHaveLength(1);
    expect(journal.view.order[1]?.noticeClass).toBe('unknown-answer');
    // The correction's own summary judgment came back unresolved on both bounded attempts, so it settles as
    // undecided and is answered with the not-recorded notice instead of holding forever (the 2026-09-29 wedge fix).
    expect(journal.view.order[2]).toMatchObject({ memoryPending: true, memoryUndecided: true });
    expect(journal.view.order[2]?.intentBody).toBe(MEMORY_UNDECIDED_REPLY);
  } finally { journal?.close(); rmSync(root, { recursive: true, force: true }); }
}, 30000);
