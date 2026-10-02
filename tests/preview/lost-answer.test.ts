/** Unit w3-lostanswer (plan row #304), Rule 11 on the live room S of 2026-10-02 (cint-L29).
 *
 * Fault 1: a right recall ended in "I lost my answer to that message. Please send it again." The first answer call
 * for update 6230861 returned a lookup request (the malformed count is the same before and after the turn, so it was
 * not a format re-ask), the lookup found the fact, and the lookup's second call ended at the 120 s local timeout. An
 * UNKNOWN answer call ended the turn in the fixed loss notice. Group A update 6230665 is the same timeout on a first
 * call. docs/09 lets a replacement take separate capacity while the timed-out call stays UNKNOWN and charged, so the
 * turn now asks once more on the same packet. Only a recorded local timeout with confirmed cleanup qualifies.
 *
 * Fault 2: the never-said question (update 6230862) ran its one lookup and the model concluded it had searched and
 * not found the answer (its recorded reason), but it also set memoryList, and the runner replaced its reply with the
 * saved-items list ("I have no active saved memory items about you in this preview journal."). A turn that ran a
 * lookup asked about one earlier thing; the list does not replace that answer.
 *
 * Recorded shapes (observer #106): the physical call outcomes of 6230861, 6230665 and 6230862, their delivered texts
 * and the 6230862 reason are verbatim in fixtures/lostanswer-live-2026-10-02.json. The model outputs are verbatim real
 * claude-sonnet-5 answers from fixtures/proofroom2-recallrank-2026-10-02.json (the same room's lookup samples). The
 * evidence does not carry the 6230862 reply text; the real never-said reply stands in for it. Telegram is a stub. */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UNKNOWN_ANSWER_NOTICE, openPreviewJournal, pendingUnknownCalls, type CallOutcome, type PreviewPorts } from './journal.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { fixture, genesis, key, neutral, question, room, sourceId, update } from './recall-rank-room.js';

interface Recorded { id: string; role: 'model'; at: number; [field: string]: unknown }
const live = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/lostanswer-live-2026-10-02.json'), 'utf8')) as {
  lostAfterLookup: { callOutcomes: Recorded[]; malformedBefore: Record<string, number>; malformedAfter: Record<string, number>; delivered: string; recalledIds: string[]; factUpdate: number };
  lostFirstCall: { callOutcomes: Recorded[]; delivered: string };
  listReplacedAnswer: { callOutcomes: Recorded[]; answerReason: string; delivered: string } };
const samples = (fixture as unknown as { lookupSamples: { samples: { label: string; calls: { raw: string }[] }[] } }).lookupSamples.samples;
/** The runner's own decode of a recorded real answer: the Decision's conclusion value as text. */
const real = (label: string, call: number) => {
  const parsed = parseModelJson(samples.find(item => item.label === label)!.calls[call]!.raw);
  if (!parsed.ok) throw Error('recorded output is not JSON');
  return conclusionText((parsed.value.conclusion as { value?: unknown }).value)!;
};
/** The journal row the launcher appends for one recorded physical outcome (status projects it flattened). */
const outcomeRow = (recorded: Recorded, id: string) => {
  const { id: _id, role, at: _at, ...outcome } = recorded;
  return { kind: 'call-outcome' as const, id, role, outcome: outcome as unknown as CallOutcome };
};
const usage = { inputTokens: 10, outputTokens: 5, charge: null };
const questionId = sourceId(question.update);
type Step = { text: string; reason?: string; outcome?: Recorded } | { uncertain: true; outcome?: Recorded } | 'throw';

/** One question through the real answer path of the recorded room. Each scripted call may first append the recorded
 * physical outcome the launcher would have journaled for it, as the live launcher does before returning. */
async function turn(steps: Step[], options: { text?: string; room?: number; prepared?: boolean } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-lost-answer-')));
  const inputs: { context: string; prepared?: string }[] = [], sent: string[] = [];
  const seeded = (() => { const probe = room(join(dir, 'seed.encrypted'), 'B', [], neutral);
    const calls = probe.journal.view.calls; probe.journal.close(); return calls; })();
  let journal: ReturnType<typeof room>['journal'] | undefined;
  const ports: Partial<PreviewPorts> = {
    send: async input => { sent.push(input.text); return input.update; },
    // The launcher's envelope shape, so its inspect can read the packet a turn's call saw.
    ...(options.prepared ? { prepareModel: input => JSON.stringify({ messages: [{ role: 'context',
      content: JSON.stringify({ packet: JSON.parse(input.context) as unknown }) }] }) } : {}),
    model: async input => {
      inputs.push({ context: input.context, ...(input.prepared === undefined ? {} : { prepared: input.prepared }) });
      const step = steps[inputs.length - 1];
      if (step === undefined) throw Error('model called beyond the test script');
      if (step === 'throw') throw Error('scripted: outcome unknown');
      if (step.outcome) journal!.append({ ...outcomeRow(step.outcome, input.id), at: 1790000000000 + inputs.length });
      if ('uncertain' in step) return { state: 'uncertain' as const };
      return { state: 'complete' as const, text: step.text, usage, ...(step.reason ? { reason: step.reason } : {}) };
    } };
  const limits = options.room === undefined ? {} : { maxCalls: seeded + options.room };
  const path = join(dir, 'journal.encrypted');
  const opened = room(path, 'B', [], neutral, ports, limits);
  journal = opened.journal;
  opened.worker.intake([update(question.update, options.text ?? question.message)]);
  let drainError: unknown;
  await opened.worker.drain().catch((error: unknown) => { drainError = error; });
  return { ...opened, dir, inputs, sent, drainError, asked: () => opened.journal.view.turns.get(questionId)!,
    spent: () => opened.journal.view.calls - seeded,
    reopen: () => { opened.journal.close(); return openPreviewJournal(path, key, { ...genesis, ...limits }); },
    close: () => { try { opened.journal.close(); } catch { /* already closed */ } rmSync(dir, { recursive: true, force: true }); } };
}

const recordedRow = (rows: Recorded[], index: number) => { const row = rows[index]; if (!row) throw Error('recorded row missing'); return row; };
const firstLate = recordedRow(live.lostAfterLookup.callOutcomes, 0), timedOutLate = recordedRow(live.lostAfterLookup.callOutcomes, 1);
const timedOutA = recordedRow(live.lostFirstCall.callOutcomes, 0);
const lookupRequest = real('P4', 0), factReply = real('P1', 1);

describe('fault 1: a recall the local timeout interrupted is answered, not lost (recorded S 6230861, A 6230665)', () => {
  it('the recorded evidence: a lookup, then a timeout with confirmed cleanup, and no format re-ask', () => {
    expect(firstLate.localLimit).toBeNull();
    expect(firstLate.outputTokens).toBe(597);
    expect(timedOutLate.localLimit).toBe('timeout');
    expect(timedOutLate.elapsedMs).toBeGreaterThan(120000);
    expect((timedOutLate.resources as { cleanup: string }).cleanup).toBe('verified');
    // The second packet is the first plus the lookup result; a format re-ask would have counted a malformed answer.
    expect(timedOutLate.promptBytes).toBeGreaterThan(firstLate.promptBytes as number);
    expect(live.lostAfterLookup.malformedAfter).toEqual(live.lostAfterLookup.malformedBefore);
    expect(live.lostAfterLookup.recalledIds).toContain(`telegram:8989505249:update:${live.lostAfterLookup.factUpdate}`);
    expect(live.lostAfterLookup.delivered).toBe(`PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`);
    expect(timedOutA.localLimit).toBe('timeout');
    expect(live.lostFirstCall.delivered).toBe(`PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`);
  });

  it('replaces the timed-out lookup call once, on the same lookup packet, and sends the answer', async () => {
    const r = await turn([{ text: lookupRequest, outcome: firstLate }, { uncertain: true, outcome: timedOutLate }, { text: factReply }]);
    try {
      expect(r.drainError).toBeUndefined();
      expect(r.inputs).toHaveLength(3);
      // The replacement asks the question the timed-out call asked: the lookup packet, byte for byte.
      expect(r.inputs[2]!.context).toBe(r.inputs[1]!.context);
      expect(r.inputs[2]!.prepared).toBe(r.inputs[1]!.prepared);
      expect(r.sent).toHaveLength(1);
      expect(r.sent[0]).toContain('2958');
      expect(r.sent[0]).not.toContain(UNKNOWN_ANSWER_NOTICE);
      expect(r.asked().answerReplaced).toBe(true);
      expect(r.asked().noticeClass).toBeUndefined();
      // The timed-out call stays UNKNOWN and charged: three calls spent, one still unknown.
      expect(r.spent()).toBe(3);
      expect(pendingUnknownCalls(r.journal.view)).toContain(`answer-replaced:${questionId}`);
      expect(pendingUnknownCalls(r.journal.view)).not.toContain(`answer:${questionId}`);
    } finally { r.close(); }
  });

  it('replaces a first call the local timeout ended (group A shape)', async () => {
    const r = await turn([{ uncertain: true, outcome: timedOutA }, { text: factReply }]);
    try {
      expect(r.inputs).toHaveLength(2);
      expect(r.inputs[1]!.context).toBe(r.inputs[0]!.context);
      expect(r.sent).toEqual([expect.stringContaining('2958')]);
      expect(r.spent()).toBe(2);
    } finally { r.close(); }
  });

  it('a replay of the journal reads the replaced turn back the same way', async () => {
    const r = await turn([{ uncertain: true, outcome: timedOutA }, { text: factReply }]);
    try {
      const before = { calls: r.journal.view.calls, unknown: pendingUnknownCalls(r.journal.view) };
      expect(before.unknown).toEqual([`answer-replaced:${questionId}`]);
      const replayed = r.reopen();
      try {
        expect(replayed.view.calls).toBe(before.calls);
        expect(pendingUnknownCalls(replayed.view)).toEqual(before.unknown);
        expect(replayed.view.turns.get(questionId)!.answerReplaced).toBe(true);
        expect(replayed.view.turns.get(questionId)!.answer).toContain('2958');
      } finally { replayed.close(); }
    } finally { r.close(); }
  });

  it('keeps the replacement through a compaction snapshot: still UNKNOWN, and a second replacement is refused', async () => {
    const r = await turn([{ uncertain: true, outcome: timedOutA }, { text: factReply }]);
    try {
      const before = { calls: r.journal.view.calls, unknown: pendingUnknownCalls(r.journal.view) };
      r.journal.compact();
      const reopened = r.reopen();
      try {
        expect(reopened.view.calls).toBe(before.calls);
        expect(pendingUnknownCalls(reopened.view)).toEqual([`answer-replaced:${questionId}`]);
        expect(reopened.view.turns.get(questionId)!.answerReplaced).toBe(true);
        expect(() => reopened.append({ kind: 'answer-replace', id: questionId, state: 'uncertain', at: 1790000009000 }))
          .toThrow(/answer replacement order or cap/u);
      } finally { reopened.close(); }
    } finally { r.close(); }
  });
});

describe('fault 1, the other side of each boundary: when no replacement is made', () => {
  it('an UNKNOWN outcome without a recorded timeout keeps the loss path (one call, no replacement)', async () => {
    const r = await turn([{ uncertain: true }]);
    try {
      expect(r.inputs).toHaveLength(1);
      expect(r.asked().modelState).toBe('uncertain');
      expect(r.asked().answerReplaced).toBeUndefined();
      expect(r.spent()).toBe(1);
    } finally { r.close(); }
  });

  it('a timeout whose cleanup was not confirmed is not replaced', async () => {
    const unresolved = { ...timedOutA, resources: { ...(timedOutA.resources as object), cleanup: 'unresolved' } };
    const r = await turn([{ uncertain: true, outcome: unresolved }]);
    try {
      expect(r.inputs).toHaveLength(1);
      expect(r.asked().modelState).toBe('uncertain');
    } finally { r.close(); }
  });

  it('a replacement that times out too ends in the loss notice path, never a third call', async () => {
    const r = await turn([{ uncertain: true, outcome: timedOutA }, { uncertain: true, outcome: timedOutA }]);
    try {
      expect(r.inputs).toHaveLength(2);
      expect(r.asked().modelState).toBe('uncertain');
      expect(r.asked().answerReplaced).toBe(true);
      expect(r.spent()).toBe(2);
      await r.worker.drain();
      expect(r.inputs).toHaveLength(2);
      // Both calls stay UNKNOWN, each under its own key.
      expect(pendingUnknownCalls(r.journal.view)).toEqual(expect.arrayContaining([`answer:${questionId}`, `answer-replaced:${questionId}`]));
    } finally { r.close(); }
  });

  it('a replacement whose call throws stays UNKNOWN and is never repeated', async () => {
    const r = await turn([{ uncertain: true, outcome: timedOutA }, 'throw']);
    try {
      expect(r.inputs).toHaveLength(2);
      expect(r.sent).toEqual([]);
      await r.worker.drain();
      expect(r.inputs).toHaveLength(2);
      expect(r.spent()).toBe(2);
    } finally { r.close(); }
  });

  it('no replacement when the call cap leaves no room for it', async () => {
    // Room for the answer call only (this room binds no reply check, so no slot is held back for one).
    const r = await turn([{ uncertain: true, outcome: timedOutA }], { room: 1 });
    try {
      expect(r.inputs).toHaveLength(1);
      expect(r.asked().answerReplaced).toBeUndefined();
      expect(r.asked().modelState).toBe('uncertain');
    } finally { r.close(); }
  });

  it('the journal refuses a replacement row without a recorded timeout', async () => {
    const r = await turn([{ uncertain: true }]);
    try {
      // The turn already holds its uncertain outcome; a forged replacement is refused at the writer.
      expect(() => r.journal.append({ kind: 'answer-replace', id: questionId, state: 'uncertain', at: 1790000009000 }))
        .toThrow(/answer replacement order or cap/u);
    } finally { r.close(); }
  });
});

describe('fault 2: the never-said question keeps its searched-and-not-found answer (recorded S 6230862)', () => {
  const neverLookup = real('never-said', 0), neverReply = real('never-said', 1);
  /** The recorded turn's decision: the real never-said reply, with the memoryList flag and reason the S turn carried. */
  const withList = (reply: string) => JSON.stringify({ ...(JSON.parse(reply) as object), memoryList: true });

  it('the recorded evidence: the model searched, concluded not found, and the list replaced its reply', () => {
    expect(live.listReplacedAnswer.answerReason).toMatch(/I must say plainly I searched and did not find it/u);
    expect(live.listReplacedAnswer.delivered).toContain('I have no active saved memory items about you in this preview journal.');
    expect(live.listReplacedAnswer.callOutcomes).toHaveLength(2);
  });

  it('after its lookup, the reply is the model\'s own answer, not the saved-items list', async () => {
    const r = await turn([{ text: neverLookup }, { text: withList(neverReply), reason: live.listReplacedAnswer.answerReason }],
      { text: "What name did I give you for my sister's horse?", prepared: true });
    try {
      expect(r.drainError).toBeUndefined();
      expect(r.inputs).toHaveLength(2);
      expect(r.asked().lookup).toBeDefined();
      expect(r.sent).toHaveLength(1);
      expect(r.sent[0]).not.toContain('active saved memory items');
      expect(r.sent[0]).toContain('searched');
      expect(r.sent[0]).toContain("isn't proof");
      // The launcher's inspect now shows the lookup the harness reads as last.memoryLookup (it was always null).
      r.journal.close();
      const inspected = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/journal-agent.mjs', 'inspect', '--root', r.dir], { cwd: process.cwd(), encoding: 'utf8', timeout: 60000,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
      expect(inspected.status, inspected.stderr).toBe(0);
      const last = (JSON.parse(inspected.stdout) as { last: { update: number; memoryLookup: { searched: string[] } | null } }).last;
      expect(last.update).toBe(question.update);
      expect(last.memoryLookup?.searched).toEqual(r.asked().lookup!.words);
    } finally { r.close(); }
  });

  it('without a lookup, memoryList still renders the saved-items list ("what do you remember about me")', async () => {
    const r = await turn([{ text: withList(JSON.stringify({ reply: 'Here is what I remember.' })) }],
      { text: 'What do you remember about me?' });
    try {
      expect(r.inputs).toHaveLength(1);
      expect(r.asked().lookup).toBeUndefined();
      expect(r.sent).toHaveLength(1);
      expect(r.sent[0]).toMatch(/active (saved )?memory items/u);
    } finally { r.close(); }
  });
});
