import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

/** Live 2026-10-02 (proofroom2-rule40-20261002): the operator ended every note with the same reply style,
 * "No reply needed beyond ok.", and each statement became its own active preference, carried in every later
 * packet twice (preferences and memoryCandidates). At the default 32768 bytes that growth helped push the
 * always-sent parts past the room beside the reply-review reserve. A restated clause is one active preference,
 * carried from its latest statement; a different clause stays its own; every statement stays recorded. */

const key = new Uint8Array(32).fill(31);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('carries a restated reply preference once, keeps a different one, and forgetting it leaves no older copy', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-restatement-')));
  const seen: { preferences?: { text: string; source: string }[]; memoryCandidates?: { id: string; message: string; reply: string }[] }[] = [];
  const styles = ['Shorter please.', 'Use bullet points in replies.'];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; context: string }) => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) {
        const request = packet.memoryRequest?.message as string | undefined;
        // The forget names the one candidate the packet offers for that clause, as a real answer would.
        const offered = packet.memoryCandidates?.find((item: { message: string; reply: string }) =>
          item.message === 'Shorter please.' && item.reply === '');
        const memory = request && styles.includes(request) ? [{ mode: 'prefer', source: packet.memoryRequest.id, quote: request }]
          : request === 'Forget my shorter-reply preference.' ? [{ mode: 'forget', source: offered.id, quote: 'Shorter please.' }] : [];
        return JSON.stringify({ summary: 'The operator discussed answer style.', people: [], memory });
      }
      seen.push(packet);
      return 'Understood.';
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, ports);
    const ask = async (n: number, text: string) => { worker.intake([update(n, text)]); await worker.drain(); };
    await ask(1, 'Shorter please.');
    await ask(2, 'Shorter please.');
    await ask(3, 'How was the garden today?');
    const id = (n: number) => journal.view.order[n - 1]!.id;
    // Both statements are recorded (Rule 7); the packet carries the clause once, from its latest statement.
    expect(journal.view.memory.filter(item => item.mode === 'prefer').map(item => item.source)).toEqual([id(1), id(2)]);
    expect(seen.at(-1)!.preferences).toEqual([{ text: 'Shorter please.', source: id(2) }]);
    // Its preference candidate (the one with no reply) is offered once too; turn messages still ride as ordinary candidates.
    expect(seen.at(-1)!.memoryCandidates!.filter(item => item.message === 'Shorter please.' && item.reply === '')
      .map(item => item.id)).toEqual([id(2)]);
    // The other side: a different clause is a different preference and both ride.
    await ask(4, 'Use bullet points in replies.');
    await ask(5, 'Anything new?');
    expect(seen.at(-1)!.preferences).toEqual([{ text: 'Shorter please.', source: id(2) }, { text: 'Use bullet points in replies.', source: id(4) }]);
    // Forgetting the clause through the one offered candidate retires it: the earlier statement does not resurface.
    await ask(6, 'Forget my shorter-reply preference.');
    await ask(7, 'Anything new?');
    expect(seen.at(-1)!.preferences).toEqual([{ text: 'Use bullet points in replies.', source: id(4) }]);
    expect(journal.view.memory.map(item => item.mode)).toEqual(['prefer', 'prefer', 'prefer', 'forget']);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
