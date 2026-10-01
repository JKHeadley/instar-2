// Rule 7 (Archiving May Never Mean Deleting), live failure K13a on 2026-09-30 08:41-08:44 PDT
// (lanes/pipeline/live-proof/results/K-live-20260930-082150): after k4 stated a padlock code and k5
// corrected it, k6 asked what the code was before and the operator read "I couldn't produce an answer".
// The k6 packet carried only the replacement (2093); the corrected-away 5186 for this padlock was nowhere in
// it, and both answer attempts came back prose-wrapped (modelJsonShapes answer/decision/malformed/prose-wrapped
// 5 -> 7). This replays the recorded texts, update ids, sender ids and change shapes (status-k6.json withheld[],
// inspect-k6.json last.memory and last.memorySearch). The recorded model failure is reproduced by shape only:
// the live model's raw text was not recorded.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CORRECTED_HISTORY_GUIDANCE, createJournalWorker, MODEL_FAILURE_REPLY, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(23);
const operator = 7812716706;
const genesis = { kind: 'genesis' as const, bot: '8820318295', chat: String(operator), operator: String(operator),
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 16000, cursor: 0 };
// Recorded: msg-k4.txt, msg-k5.txt, msg-k6.txt and update-k4..k6.
const K4 = { update: 969389761, text: 'For this test, the code for my padlock P-082150 is 5186.' };
const K5 = { update: 969389762, text: 'Correction: the code for my padlock P-082150 is 2093.' };
const K6 = { update: 969389763, text: 'What was the code for my padlock P-082150 before?' };
const CURRENT = 'What is the code for my padlock P-082150 now?';
// Recorded: status-k6.json withheld[1].quote and inspect-k6.json last.memory[1].replacement.
const OLD = 'the code for my padlock P-082150 is 5186';
const NEW = 'the code for my padlock P-082150 is 2093';
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: operator, type: 'private' }, from: { id: operator }, text, date: 1790782800 + (id - K4.update) * 60 } });

type SearchItem = { status: string; quote: string; was?: string };

function world(root: string) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const packets = new Map<string, string>();
  const sends: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1790783000000, stopped: () => false,
    model: async input => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'A padlock code was stated and corrected.', people: [], memory: [] });
      packets.set(input.question, input.context);
      if (input.question === K4.text) return 'Noted — your padlock P-082150 code is 5186.';
      // Recorded k5: the correction was accepted on the answer path (reply-k5.json is the runner's "Changed" acknowledgement).
      if (input.question === K5.text) {
        const source = (packet.memoryCandidates ?? []).find((item: { message: string }) => item.message.includes('5186'));
        return JSON.stringify({ reply: 'Updated.', memory: source ? [{ mode: 'correct', source: source.id, quote: OLD, replacement: NEW }] : [] });
      }
      const corrected = (packet.memorySearch?.items ?? [] as SearchItem[]).find((item: SearchItem) =>
        item.status === 'corrected' && item.quote.includes('2093'));
      if (input.question === K6.text) return corrected?.was?.includes('5186')
        ? JSON.stringify({ reply: 'It was 5186 before; you corrected it to 2093, which is the current code.', memory: [] })
        // The recorded k6 outcome without that evidence: the launcher classified both attempts prose-wrapped,
        // i.e. a complete call whose Decision was malformed (status-k6.json modelFailureClasses.malformed 19 -> 21).
        : { state: 'complete' as const, failureClass: 'malformed' as const };
      if (input.question === CURRENT) return corrected ? 'The code for your padlock P-082150 is 2093.' : 'I do not have that code.';
      return 'Understood.';
    }, send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
  const say = async (id: number, text: string) => {
    worker.intake([update(id, text)]); await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, packets, sends, say };
}

it('answers the recorded k6 "what was it before" with the corrected-away value labelled as corrected', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-corrected-history-')));
  try {
    const w = world(root);
    await w.say(K4.update, K4.text);
    await w.say(K5.update, K5.text);
    // The correction landed with the recorded shape (status-k6.json withheld[1]).
    expect(w.journal.view.memory).toMatchObject([{ mode: 'correct', quote: OLD, replacement: NEW }]);
    expect(w.journal.view.memory[0]?.historical).toBeFalsy();
    // reply-k5.json, without the delivery-time line.
    expect(w.sends[1]).toBe(`PREVIEW — Changed ${OLD} → ${NEW}.`);
    await w.say(K6.update, K6.text);
    const answer = w.journal.view.order.at(-1)!;
    expect(answer.answer).not.toBe(MODEL_FAILURE_REPLY);
    expect(answer.answerRetried).toBeFalsy();
    expect(w.sends.at(-1)).toContain('5186');
    expect(w.sends.at(-1)).toContain('2093');
    expect(w.sends.at(-1)).toMatch(/corrected/u);
    expect(w.sends.some(text => text.includes("couldn't produce an answer"))).toBe(false);
    const packet = JSON.parse(w.packets.get(K6.text)!);
    const corrected = (packet.memorySearch.items as SearchItem[]).filter(item => item.status === 'corrected');
    expect(corrected).toEqual([expect.objectContaining({ quote: NEW, was: OLD, correctedBy: `turn ${K5.update}` })]);
    expect(packet.capability).toContain(CORRECTED_HISTORY_GUIDANCE);
    // The guidance rides only with a corrected-away value: k5's packet, before the correction, has none.
    const before = JSON.parse(w.packets.get(K5.text)!);
    expect(JSON.stringify(before.memorySearch ?? {})).not.toContain('"was"');
    expect(before.capability).not.toContain(CORRECTED_HISTORY_GUIDANCE);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);

it('keeps the corrected value current: the old value appears only as labelled history', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-corrected-current-')));
  try {
    const w = world(root);
    await w.say(K4.update, K4.text);
    await w.say(K5.update, K5.text);
    await w.say(K6.update + 1, CURRENT);
    const raw = w.packets.get(CURRENT)!;
    const packet = JSON.parse(raw);
    expect(packet.memory).toMatchObject([{ mode: 'corrected', replacement: NEW }]);
    const items = packet.memorySearch.items as SearchItem[];
    // No item presents the old value as its quote, and every current item is free of it.
    for (const item of items) expect(item.quote).not.toContain('5186');
    expect(items.find(item => item.status === 'corrected')).toMatchObject({ quote: NEW, was: OLD });
    // Outside that labelled field, the old clause stays withheld (history, summary, memory records).
    const withoutWas = JSON.stringify({ ...packet, memorySearch: { ...packet.memorySearch,
      items: items.map(({ was: _was, ...rest }) => rest) } });
    expect(withoutWas).not.toContain(OLD);
    expect(w.sends.at(-1)).toContain('2093');
    expect(w.sends.at(-1)).not.toContain('5186');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);
