import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ANSWER_INSTRUCTIONS, LITERAL_COPY_INSTRUCTIONS } from './briefing.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { readAnswer } from './answer-reading.js';
import { SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

// Captured read-only from the failed forum answer copy, update 715675751. The
// three new outputs are real, bounded model replays of that same recorded packet.
// This checks copying fidelity; it does not claim a deterministic guarantee from prose.
const capture = JSON.parse(readFileSync(new URL('./fixtures/literal-copy-715675751.json', import.meta.url), 'utf8'));

it('retains the delivered one-character error and binds the fresh replays to the shipped instructions', () => {
  expect(capture.original.update).toBe(715675751);
  expect(capture.original.sent).toBe(347);
  expect(capture.original.question).toContain('probe-7d09d28a');
  expect(capture.original.answer).toContain('probe-7d09d38a');
  expect(capture.original.answer).not.toContain('probe-7d09d28a');
  expect(capture.original.answerReason).toContain('probe-7d09d38a');
  expect(capture.instructions).toBe(ANSWER_INSTRUCTIONS);
  expect(capture.system).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  expect(LITERAL_COPY_INSTRUCTIONS).not.toContain('probe');
  expect(capture.runs).toHaveLength(3);
});

it('delivers each real corrected output through both answer readers once, retaining the copying instruction after restart', async () => {
  for (const run of capture.runs) {
    const reading = readAnswer(run.raw, { wrapped: 'accept' });
    expect(reading.ok).toBe(true);
    if (!reading.ok) throw Error(reading.defect);
    expect(reading.value).toBe(run.readerValue);
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'literal-copy-')));
    const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(61);
    const now = 1791877939061;
    let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 86400000,
      maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 131072, cursor: 0 });
    try {
      const prepared: string[] = [], sent: string[] = [];
      const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
        prepareModel: input => prepareJournalEnvelope(input, capture.model, 'grant:preview', now, 131072),
        model: async input => { prepared.push(String(input.prepared)); return reading.value; },
        send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {} });
      const first = worker();
      first.intake([{ update_id: capture.original.update, message: { message_id: 345,
        chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: capture.original.question } }]);
      await first.drain();
      expect(sent).toEqual(['probe-7d09d28a']);
      expect(prepared).toHaveLength(1);
      expect(JSON.parse(prepared[0]!).messages.find((m: { role: string }) => m.role === 'instructions').content)
        .toBe(ANSWER_INSTRUCTIONS);
      journal.close(); journal = openPreviewJournal(path, key);
      await worker().drain();
      expect(sent).toHaveLength(1);
      expect(prepared).toHaveLength(1);
      expect(journal.view.order[0]!.intent).toBe('probe-7d09d28a');
      const probe = worker().probe(capture.original.question);
      expect('reason' in probe).toBe(false);
      if ('reason' in probe) throw Error(probe.reason);
      const envelope = prepareJournalEnvelope({ question: capture.original.question, context: probe.context,
        id: 'telegram:12345678:update:715675752' }, capture.model, 'grant:preview', now, 131072);
      expect(JSON.parse(envelope).messages.find((m: { role: string }) => m.role === 'instructions').content)
        .toBe(ANSWER_INSTRUCTIONS);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});

it('keeps literal-copy guidance on the answer path without adding it to summary or review tasks', () => {
  for (const id of ['summary:715675751', 'telegram:12345678:update:715675751:reply-review']) {
    const envelope = JSON.parse(prepareJournalEnvelope({ question: 'Task', context: '{}', id }, capture.model,
      'grant:preview', 1791877939061, 131072));
    expect(envelope.messages.some((message: { role: string }) => message.role === 'instructions')).toBe(false);
  }
});
