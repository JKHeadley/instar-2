import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { auditJournal } from './journal-audit.mjs';

// Reviewer-created boundary case, derived from the submitted frontier fixture.
// A later authenticated forgetting decision precedes retry of an older summary.
const facts = [
  [6235539, "Always use shorter replies."],
  [6235554, 'The farmers market stall I like sells quince jam.'],
  [6235556, 'The spare cabin key hangs behind the barometer.'],
  [6235557, 'My cousin Tomas lives in Ghent.'],
  [6235558, 'Forget my preference to always use shorter replies.'],
] as const;
const at = 1792767180879;
const key = new Uint8Array(32).fill(33);

it.each(['forget', 'correct', 'prefer'] as const)('keeps an older summary audit consistent after a later preference decision (%s)', async mode => {
  for (const frontier of [6235554]) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'summary-candidate-frontier-')));
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8989505249', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 86400000,
      maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 });
    try {
      for (const [update, original] of facts) {
        const text = update !== 6235558 ? original : mode === 'correct' ? 'Instead, always use detailed replies.'
          : mode === 'prefer' ? facts[0][1] : original;
        const id = `telegram:8989505249:update:${update}`;
        const raw = JSON.stringify({ update_id: update, message: { chat: { id: 7654321, type: 'private' },
          from: { id: 7654321 }, text } });
        journal.append({ kind: 'intake', id, update, text, raw, accepted: true, cursor: update + 1, at });
        journal.append({ kind: 'reserve', id, at });
        journal.append({ kind: 'answer', id, text: 'Noted.', memory: update === 6235558 ? [{ mode, ...(mode === 'correct' ? { replacement: 'always use detailed replies.' } : {}), source: mode === 'prefer' ? id : 'telegram:8989505249:update:6235539', trigger: id, quote: facts[0][1] }] : update === 6235539 ? [{ mode: 'prefer', source: id, trigger: id, quote: text }] : [],
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
      expect(calls.map(call => call.id)).toEqual(['summary:6235539']);
      const packet = JSON.parse(calls[0]!.context);
      expect(packet.preferences).toBeUndefined();
      expect(packet.history[0].user).toBe(mode === 'prefer' ? facts[0][1] : '[withheld: operator correction or forgetting]');
      expect(packet.history[0].answer).toBe(mode === 'prefer' ? 'Noted.' : '[withheld: operator correction or forgetting]');
      expect(packet.memoryRequest.message).toBe(mode === 'prefer' ? facts[0][1] : '[withheld: operator correction or forgetting]');
      // The audit must still reject forged history, replies, requests and a revived preference.
      if (mode !== 'prefer') for (const [field, code] of [['user', 'history-text-source'], ['answer', 'reply-text-source'],
        ['request', 'memory-request-source'], ['preference', 'preference-source']] as const) {
        const forged = structuredClone(journal.view);
        const envelope = JSON.parse(forged.lastPrompt!.prompt!);
        const context = envelope.messages.find((item: { role: string }) => item.role === 'context');
        const body = JSON.parse(context.content);
        if (field === 'request') body.packet.memoryRequest.message = facts[0][1];
        else if (field === 'preference') body.packet.preferences = [{ source: journal.view.order[0]!.id, text: facts[0][1] }];
        else body.packet.history[0][field] = facts[0][1];
        context.content = JSON.stringify(body); forged.lastPrompt!.prompt = JSON.stringify(envelope);
        expect(auditJournal(forged).findings.map(item => item.code)).toContain(code);
      }
      expect(auditJournal(journal.view).findings).toEqual([]);
      expect(journal.view.memory).toHaveLength(2);
      journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
      expect(auditJournal(journal.view).findings).toEqual([]);
      expect(journal.view.memory).toHaveLength(2);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});
