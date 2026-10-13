/** Recorded user-walk 2026-10-13: held is not answered, due is not sent, and plain is not a failed mutation. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { replyReviewContext, replyReviewQuestion } from './reply-check.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/status-truth-1013.json', import.meta.url), 'utf8')) as {
  frames: { frame: number; kind: string; id: string; raw: string; text: string; prompt: string; output: string; at: number }[];
};
const frame = (n: number) => fixture.frames.find(row => row.frame === n)!;
const packetOf = (prompt: string) => JSON.parse(JSON.parse(prompt).messages.find((m: { role: string }) => m.role === 'context').content).packet;
const key = new Uint8Array(32).fill(71);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:status-truth-replay', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 30, maxTurns: 30, maxBytes: 32768, cursor: 0 };
const reminder = packetOf(frame(933).prompt).dated[0];
const now = frame(933).at;
const update = (id: number, text: string) => ({ update_id: id, message: { message_id: id,
  from: { id: Number(genesis.operator) }, chat: { id: Number(genesis.chat), type: 'private' }, text } });

for (const [intake, call, answer] of [[626, 638, 640], [888, 900, 902], [932, 944, 946]])
  it(`replays unrelated update ${JSON.parse(frame(intake!).raw).update_id} without a change warning and keeps the reminder`, async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'status-truth-'))), path = join(root, 'journal');
    let journal = openPreviewJournal(path, key, genesis);
    const reading = readAnswer(frame(call!).output, { wrapped: 'accept', evidence: [frame(intake!).id] });
    if (!reading.ok) throw Error(reading.shape);
    const sent: string[] = [], packets: string[] = [];
    const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
      model: async (input: { question: string; context: string }) => {
        packets.push(input.context);
        // Replay the actual plain answer first. The existing format repair then supplies the
        // contextual no-withdrawal decision; this simulated judgment is not a fresh model proof.
        if (JSON.parse(input.context).formatReminder)
          return JSON.stringify({ reply: reading.value, memory: [], cancelReminders: [] });
        return input.question === reminder.quote
          ? JSON.stringify({ reply: 'Scheduled.', memory: [], dated: [reminder] }) : reading.value;
      }, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } };
    try {
      const worker = createJournalWorker(journal, ports);
      worker.intake([update(6233129, reminder.quote)]); await worker.drain();
      expect(openRequests(journal.view)).toHaveLength(1);
      worker.intake([JSON.parse(frame(intake!).raw)]); await worker.drain();
      expect(frame(answer!).text).toContain('No change was recorded'); // the original failure, never rewritten
      expect(sent.at(-1)).toContain(reading.value);
      expect(sent.at(-1)).not.toContain('If you meant to cancel');
      expect(sent.at(-1)).not.toContain('No cancellation was recorded');
      expect(journal.view.order.at(-1)).toMatchObject({ answerRetried: true, reminderDecided: true });
      expect(openRequests(journal.view)).toHaveLength(1);
      expect(JSON.parse(packets.at(-1)!).capability).toContain('delivery outcomes outrank earlier answers and summaries');
      journal.close(); journal = openPreviewJournal(path, key);
      await createJournalWorker(journal, ports).drain();
      expect(sent).toHaveLength(2);
      expect(openRequests(journal.view)).toHaveLength(1);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

for (const [reserve, answer] of [[889, 902], [933, 946], [1189, 1199]])
  it(`retains recorded delivered/held and due/sent distinctions in the contextual review of frame ${answer}`, () => {
    const packet = JSON.parse(replyReviewContext(frame(reserve!).prompt, frame(answer!).text, ['self_state_claim']));
    const held = packet.history.find((row: { id: string }) => row.id.endsWith(':6233134'));
    expect(held.outcome).toBe('holding reply delivered after review violation');
    expect(held.answer).toBe(frame(876).text);
    // A prior acknowledgement does not keep a subsequently delivered answer open.
    expect(packet.history.find((row: { id: string }) => row.id.endsWith(':6233120')))
      .toMatchObject({ heldNotice: true, outcome: 'Telegram API accepted' });
    if (reserve !== 1189) {
      expect(packet.reminders).toHaveLength(1);
      expect(packet.clock.time < '09:15').toBe(true);
      expect(frame(993).at).toBeGreaterThan(packet.now);
    } else {
      expect(packet.reminders).toBeUndefined();
      expect(frame(993).at).toBeLessThan(packet.now);
      expect(packet.history.find((row: { id: string }) => row.id === 'requested-action:0'))
        .toMatchObject({ outcome: 'Telegram API accepted', answer: frame(991).text });
    }
    const question = replyReviewQuestion(['self_state_claim']);
    expect(question).toContain('A holding notice does not deliver the answer or refusal');
    expect(question).toContain('a future reminder cannot have fired at the packet clock');
    expect(question).toContain('A confirmed delivered answer or closed item supports completion');
    expect(question).toContain('Distinguish self-state as-of time from startup time');
  });

it('discloses unresolved requests for recorded non-decision shapes without treating uncertain or empty output as completion', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
    import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
  for (const shape of captured.otherShapes) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'status-truth-shapes-'))), path = join(root, 'journal');
    let journal = openPreviewJournal(path, key, genesis);
    const sent: string[] = [];
    const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
      model: async (input: { question: string }) => input.question === reminder.quote
        ? JSON.stringify({ reply: 'Scheduled.', memory: [], dated: [reminder] })
        : shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) as { state: 'uncertain' } : shape.raw,
      send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } };
    try {
      const worker = createJournalWorker(journal, ports);
      worker.intake([update(1, reminder.quote)]); await worker.drain();
      worker.intake([update(2, 'Please reconsider the open request.')]); await worker.drain();
      expect(journal.view.reminderCancels, shape.id).toEqual([]);
      expect(openRequests(journal.view), shape.id).toHaveLength(1);
      if (shape.kind === 'summary-uncertain')
        expect(journal.view.order.at(-1)?.modelState, shape.id).toBe('uncertain');
      else if (!shape.raw.trim())
        expect(journal.view.order.at(-1)?.failureClass, shape.id).toBe('empty');
      else {
        expect(sent.at(-1), shape.id).toContain('No cancellation was recorded.');
        expect(sent.at(-1), shape.id).toContain('Your open request still stands');
      }
      journal.close(); journal = openPreviewJournal(path, key);
      expect(journal.view.reminderCancels, shape.id).toEqual([]);
      expect(openRequests(journal.view), shape.id).toHaveLength(1);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});
