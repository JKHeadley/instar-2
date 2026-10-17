import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditPacket } from './journal-audit.mjs';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

it.each([
  ['2026-10-16T13:57:00Z', 'America/Los_Angeles', '2026-10-16 06:57 PDT'],
  ['2026-12-16T14:57:00Z', 'America/Los_Angeles', '2026-12-16 06:57 PST'],
  ['2026-10-16T13:57:00Z', 'UTC', '2026-10-16 13:57 UTC'],
])('renders real journal packet times for %s in %s', async (instant, timeZone, expected) => {
  const root = mkdtempSync(join(tmpdir(), 'packet-time-'));
  const at = Date.parse(instant);
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: '-7654321', operator: '7654321', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 86400000,
    maxCalls: 30, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0,
  });
  let packet: { actionFacts: { siblingWords: { items: { ownWords: string }[] } }; history: { sourceLabel: string; date: string }[] };
  const worker = createJournalWorker(journal, { now: () => at, timeZone, stopped: () => false,
    groupDisclosure: async () => true, checkOutbound: () => {}, send: async () => 1,
    model: async input => { packet = JSON.parse(input.context); return 'The restart remains on hold.'; } });
  const intake = (id: number, thread: number) => worker.intake([{ update_id: id, message: {
    message_id: id, chat: { id: -7654321, type: 'supergroup', is_forum: true }, from: { id: 7654321 },
    date: at / 1000, message_thread_id: thread, text: 'What about the restart?',
  } }]);
  try {
    intake(1, 3); await worker.drain();
    intake(2, 4); await worker.drain();
    expect(packet!.actionFacts.siblingWords.items[0]!.ownWords).toContain(`when I said it: ${expected} (reply delivery); operator input received:`);
    intake(3, 4); await worker.drain();
    expect(packet!.history[0]!.sourceLabel).toContain(expected);
    const current = journal.view.order.at(-1)!;
    const shown = packet!.history[0]!;
    const audit = () => auditPacket(journal.view, current, packet);
    expect(audit().findings.filter((item: { code: string }) => item.code.includes('date-source'))).toEqual([]);
    shown.date = expected;
    expect(audit().findings.filter((item: { code: string }) => item.code.includes('date-source'))).toEqual([]);
    shown.date = instant.slice(0, 16) + 'Z'; // Historical packets remain auditable.
    expect(audit().findings.filter((item: { code: string }) => item.code.includes('date-source'))).toEqual([]);
    shown.date = '2026-10-16 13:57 Pacific'; // The live fault must fail the audit.
    expect(audit().findings).toContainEqual(expect.objectContaining({ code: 'history-date-source' }));
    expect(journal.view.turns.get('telegram:12345678:update:1')!.at).toBe(at);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
