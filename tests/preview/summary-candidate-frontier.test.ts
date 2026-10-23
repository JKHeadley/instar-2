import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { auditJournal } from './journal-audit.mjs';

// proofroom2-q-20261023-065800, startup 1792767180879: summary:6235554
// offered saved facts from 6235556–6235558. These clauses and update ids are
// from that room's recorded intake, not approximations of the failed packet.
const facts = [
  [6235539, "The neighbour's cat is called Biscuit."],
  [6235554, 'The farmers market stall I like sells quince jam.'],
  [6235556, 'The spare cabin key hangs behind the barometer.'],
  [6235557, 'My cousin Tomas lives in Ghent.'],
  [6235558, 'The umbrella I keep at work is orange.'],
] as const;
const at = 1792767180879;
const key = new Uint8Array(32).fill(33);

it.each(['remember', 'prefer'] as const)('bounds saved %s candidates by each summary frontier without losing later memory', async mode => {
  for (const frontier of [6235554, 6235557]) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'summary-candidate-frontier-')));
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8989505249', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 86400000,
      maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 });
    try {
      for (const [update, text] of facts) {
        const id = `telegram:8989505249:update:${update}`;
        const raw = JSON.stringify({ update_id: update, message: { chat: { id: 7654321, type: 'private' },
          from: { id: 7654321 }, text } });
        journal.append({ kind: 'intake', id, update, text, raw, accepted: true, cursor: update + 1, at });
        journal.append({ kind: 'reserve', id, at });
        journal.append({ kind: 'answer', id, text: 'Noted.', memory: [{ mode, source: id, trigger: id, quote: text }],
          ...(update === frontier ? { memoryPending: true as const } : {}), at });
        journal.append({ kind: 'intent', id, text: 'Noted.', chat: '7654321', update, grant: 'grant:preview', at });
        journal.append({ kind: 'sent', id, message: update, at });
      }
      const calls: { id: string; context: string }[] = [];
      const worker = createJournalWorker(journal, { now: () => at + 1000, stopped: () => false,
        prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
          { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
        model: async input => { calls.push(input); return { state: 'uncertain' as const }; },
        send: async () => { throw Error('summary cannot send'); }, checkOutbound: () => {} });
      await worker.summarizeIfNeeded(true);
      expect(calls.map(call => call.id)).toEqual([`summary:${frontier}`]);
      const packet = JSON.parse(calls[0]!.context);
      const ids = packet.memoryCandidates.map((item: { id: string }) => item.id);
      for (const [update] of facts) {
        if (update <= frontier) expect(ids).toContain(`telegram:8989505249:update:${update}`);
        else expect(ids).not.toContain(`telegram:8989505249:update:${update}`);
      }
      expect(auditJournal(journal.view).findings).toEqual([]);
      expect(journal.view.memory).toHaveLength(facts.length);
      journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
      expect(auditJournal(journal.view).findings).toEqual([]);
      expect(journal.view.memory).toHaveLength(facts.length);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});
