import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditJournal } from './journal-audit.mjs';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(53);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:memory-soak', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 200, maxReplies: 200, maxTurns: 2000, maxBytes: 65536, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const at = (n: number) => 1790000000000 + n * 60000;
const question = "What do you remember about Sam's atlas and the locker code?";
const message = (n: number) => n === 1 ? "Sam's atlas is blue."
  : n === 2 ? 'The locker code is 7319.'
  : n === 501 ? "Correction: Sam's atlas is green."
  : n === 1001 ? 'Forget what I told you about the locker code.'
  : `Ordinary conversation turn ${n}.`;
const raw = (n: number, text: string) => JSON.stringify({ update_id: n, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
  date: Math.floor(at(n) / 1000) } });
const normalized = (value: unknown) => JSON.stringify(value, (_key, item) =>
  item instanceof Map ? [...item] : item instanceof Set ? [...item] : item);
const workerFor = (journal: ReturnType<typeof openPreviewJournal>) => createJournalWorker(journal,
  { now: () => at(2001), stopped: () => false, model: async () => { throw Error('offline probe made a call'); },
    send: async () => { throw Error('offline probe sent a reply'); }, checkOutbound: () => {} });
const answerFrom = (context: string) => {
  const packet = JSON.parse(context);
  const evidence = JSON.stringify({ summary: packet.summary, memory: packet.memory,
    search: packet.memorySearch, recalled: packet.recalled });
  return { answer: evidence.includes("Sam's atlas is green") ? 'green atlas'
    : evidence.includes("Sam's atlas is blue") ? 'blue atlas' : 'atlas unknown',
    locker: evidence.includes('7319') ? 'locker visible' : 'locker withheld' };
};
const recall = (journal: ReturnType<typeof openPreviewJournal>) => {
  const probe = workerFor(journal).probe(question);
  if ('reason' in probe) throw Error(probe.reason);
  return { packet: probe.context, ...answerFrom(probe.context) };
};

it('keeps memory projection, recall answers and audit bytes across 100 restarts and 20 compactions', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-restart-soak-')));
  const steadyPath = join(root, 'steady.encrypted'), restartPath = join(root, 'restart.encrypted');
  let steady = openPreviewJournal(steadyPath, key, genesis);
  let restarted = openPreviewJournal(restartPath, key, genesis);
  try {
    let finalPacket = '', restartCount = 0, compactionCount = 0;
    for (let n = 1; n <= 2000; n++) {
      if (n === 2000) {
        finalPacket = recall(steady).packet;
        expect(recall(restarted).packet, 'final answer packet diverged before frame 2000').toBe(finalPacket);
      }
      const text = n === 2000 ? question : message(n);
      const row = { kind: 'intake' as const, id: id(n), update: n, text, raw: raw(n, text),
        accepted: true, cursor: n + 1, at: at(n) };
      steady.append(row); restarted.append(row);
      if (n % 100 === 0 && n < 2000) {
        // The same durable memory facts are available to both projections. Only
        // the stressed journal crosses the snapshot/replay boundary.
        const memory = n === 600 ? [{ mode: 'correct' as const, source: id(1),
          quote: "Sam's atlas is blue.", replacement: "Sam's atlas is green.", trigger: id(501) }]
          : n === 1100 ? [{ mode: 'forget' as const, source: id(2),
            quote: 'The locker code is 7319.', trigger: id(1001) }] : undefined;
        const summary = { kind: 'summary' as const, through: n,
          text: n < 600 ? "Sam's atlas is blue. The locker code is 7319."
            : n < 1100 ? "Sam's atlas is green. The locker code is 7319."
              : "Sam's atlas is green. The locker code was forgotten.",
          ...(memory ? { memory } : {}), at: at(n) };
        for (const journal of [steady, restarted]) {
          journal.append({ kind: 'summary-reserve', through: n, at: at(n) });
          journal.append(summary);
        }
        const steadyRecall = recall(steady), restartRecall = recall(restarted);
        expect(restartRecall, `recall diverged at summary frame ${n}`).toEqual(steadyRecall);
        expect(steadyRecall.answer, `atlas recall lost at frame ${n}`).toBe(n < 600 ? 'blue atlas' : 'green atlas');
        expect(steadyRecall.locker, `forgetting diverged at frame ${n}`).toBe(n < 1100 ? 'locker visible' : 'locker withheld');
        restarted.compact(); compactionCount++;
      }
      if (n === 2000) { restarted.compact(); compactionCount++; }
      if (n % 20 === 0) {
        restarted.close();
        restarted = openPreviewJournal(restartPath, key);
        restartCount++;
        expect(normalized(restarted.view), `projection diverged after restart at frame ${n}`)
          .toBe(normalized(steady.view));
        // Let the test worker answer Vitest's task-update RPC during this long soak.
        await new Promise<void>(resolve => setImmediate(resolve));
      }
    }
    expect({ restartCount, compactionCount }).toEqual({ restartCount: 100, compactionCount: 20 });
    // A durable prepared answer makes the ordinary audit inspect the same
    // recall packet that supplied the answer, including after one final replay.
    const prepared = answerFrom(finalPacket), answer = `${prepared.answer}; ${prepared.locker}`;
    const prompt = JSON.stringify({ messages: [{ role: 'user', content: question },
      { role: 'context', content: JSON.stringify({ packet: JSON.parse(finalPacket) }) }] });
    for (const journal of [steady, restarted]) {
      journal.append({ kind: 'reserve', id: id(2000), prompt, at: at(2000) });
      journal.append({ kind: 'answer', id: id(2000), text: answer, at: at(2000) });
    }
    const expectedAudit = JSON.stringify(auditJournal(steady.view));
    expect(auditJournal(steady.view).findings).toEqual([]);
    expect(JSON.stringify(auditJournal(restarted.view)), 'audit diverged before final replay').toBe(expectedAudit);
    restarted.close(); restarted = openPreviewJournal(restartPath, key);
    expect(normalized(restarted.view), 'final memory projection diverged').toBe(normalized(steady.view));
    expect(recall(restarted)).toEqual(recall(steady));
    expect(JSON.stringify(auditJournal(restarted.view)), 'audit diverged after final replay').toBe(expectedAudit);
  } finally { steady.close(); restarted.close(); rmSync(root, { recursive: true, force: true }); }
}, 1_800_000);
