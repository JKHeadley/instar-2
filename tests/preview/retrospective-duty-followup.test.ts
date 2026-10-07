import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETRO_DUTY_FOLLOWUP_QUESTION, RETRO_DUTY_NO_CASES_NOTE, RETRO_DUTY_ROWS_NOTE, RETRO_DUTY_UNINSPECTED_NOTE,
  RETRO_ROW_BACKED_DUTIES, RETROSPECTIVE_DUTIES, WAIVER_EVIDENCE_UNAVAILABLE,
  disciplineSource, dutiesLeftUninspected, dutyFollowUpPacket, mergeDutyFollowUp, owedCases, retroCallReserve, retrospectiveStatusLine,
  validateRetrospective, type RetroCase, type RetroPass, type RetroResult, type RetrospectiveDuty, type RetrospectivePlan } from './retrospective.js';
import { isStatusCommand } from './status-command.js';

/** Plan row #440 (w4-retroduties). Live 2026-10-03 room two's pass 0 on the cint-L43 root "completed" with six of
 * fourteen duties left uninspected although their evidence was present (check I1b), and the model-written answer
 * to "What is your status?" dropped the retrospective line the status record carried (check I1d). Every replay
 * below starts from a RECORDED shape: the live pass's duty rows and status line (fixture
 * retrospective-duty-followup-live-2026-10-03.json), and the six verbatim real-model answers to the cint-L40 packet
 * (retrospective-live-failures-4-2026-10-03.json). The follow-up answers are stubs, as no real one exists yet. */
const LIVE = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-live-2026-10-03.json', import.meta.url), 'utf8')) as {
  livePass: { duties: { duty: RetrospectiveDuty; disposition: 'inspected' | 'unavailable'; note: string }[]; efficiency: string };
  statusLine: string; statusQuestion: string; statusUpdate: number; modelReply: string };
const REAL = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-4-2026-10-03.json', import.meta.url), 'utf8')) as {
  recorded: { livePass: { contextDigest: string; at: number; packetSha256: string } };
  plan: Pick<RetrospectivePlan, 'omitted' | 'prior' | 'waiverAvailable' | 'waiverRefs'> & { cases: RetroCase[]; state: string };
  realModelCalls: { call: number; answer: string }[]; branchQuestionCalls: { call: number; answer: string }[] };
const plan = REAL.plan, live = REAL.recorded.livePass;
const view = { retroPasses: [], dated: [], turns: new Map() } as unknown as JournalView;
const calls = [...REAL.realModelCalls, ...REAL.branchQuestionCalls].map(row => ({ call: row.call, answer: JSON.parse(row.answer) as Record<string, unknown> }));
const validate = (answer: unknown) => validateRetrospective(answer, plan, view, 0, live.at, live.contextDigest);
const merge = (followUp: unknown, held: RetroResult) => mergeDutyFollowUp(followUp, plan, view, 0, held, live.at, live.contextDigest);
const supplied = plan.cases.map(item => item.id);
const owedAfter = (result: RetroResult) => owedCases({ retroPasses: [{ pass: 0, at: live.at, turnsSeen: 10, cases: supplied, omitted: [],
  eligible: supplied.length, packetSha256: live.packetSha256, contextDigest: live.contextDigest, state: 'complete', result } satisfies RetroPass] } as unknown as JournalView,
plan.cases, live.at).map(row => row.item.id).sort();
/** The I.sh I1b predicate, verbatim in meaning: 14 rows; waiver-recurrence unavailable or inspected; every other duty inspected. */
const i1b = (duties: readonly { duty: string; disposition: string }[]) => duties.length === 14
  && duties.every(row => row.disposition === 'inspected' || (row.duty === 'waiver-recurrence' && row.disposition === 'unavailable'));
/** The I.sh I1d predicate on a reply text. */
const i1d = (text: string) => text.includes('Retrospective review') && text.includes('inspected') && text.includes('efficiency duty ran');
const LIVE_SIX = ['unsupported-reversal', 'removable-attention', 'workaround', 'process-tier', 'proportionality', 'benchmark-divergence'];
/** Whether the plan, not the answer's list, decides a duty (RETRO_ROW_BACKED_DUTIES): its kind has no supplied case,
 * or at least one supplied case of its kind was inspected with its row accepted. */
const planDecides = (result: Pick<RetroResult, 'inspected'>, cases: readonly RetroCase[] = plan.cases) => (duty: string) => {
  const category = (RETRO_ROW_BACKED_DUTIES as Record<string, string>)[duty];
  if (category === undefined) return false;
  const kind = cases.filter(item => item.category === category);
  return !kind.length || kind.some(item => result.inspected.includes(item.id));
};
/** The worker's packets hold no rerun case, so benchmark-divergence is the plan's to decide and never asked. */
const WORKER_ASKED = LIVE_SIX.filter(duty => duty !== 'benchmark-divergence');

describe('which duties the follow-up asks about, on recorded shapes', () => {
  it('the live cint-L43 pass 0: exactly the six duties left uninspected with evidence present, never waiver-recurrence', () => {
    expect(i1b(LIVE.livePass.duties)).toBe(false);
    expect(dutiesLeftUninspected(LIVE.livePass)).toEqual(LIVE_SIX);
    expect(LIVE.livePass.duties.find(row => row.duty === 'waiver-recurrence')!.note.startsWith(WAIVER_EVIDENCE_UNAVAILABLE)).toBe(true);
  });

  it('the six real answers to the cint-L40 packet: the follow-up fires for calls 1, 2, 4 and 5 and NOT for 3 and 6', () => {
    expect(plan.waiverAvailable).toBe(false);
    for (const { call, answer } of calls) {
      const result = validate(answer), asked = dutiesLeftUninspected(result);
      const expected = (answer.uninspected as string[]).filter(duty => duty !== 'waiver-recurrence' && !planDecides(result)(duty));
      expect(asked, String(call)).toEqual(RETROSPECTIVE_DUTIES.filter(duty => expected.includes(duty)));
      expect(asked.length > 0, String(call)).toBe([1, 2, 4, 5].includes(call));
    }
  });
});

describe('row-backed duties are decided by the plan, not the answer\'s list (live 2026-10-07 I1b)', () => {
  const answerOf = (call: number) => calls.find(row => row.call === call)!.answer;
  const rowOf = (result: RetroResult, duty: RetrospectiveDuty) => result.duties.find(row => row.duty === duty)!;
  const verdict = plan.cases.find(item => item.category === 'verdict')!.id;

  it('real call 1 lists standing-grant and benchmark-divergence over a packet with no authorization or rerun case: inspected, nothing to review', () => {
    expect((answerOf(1).uninspected as string[])).toEqual(expect.arrayContaining(['standing-grant', 'benchmark-divergence']));
    const result = validate(answerOf(1));
    for (const duty of ['standing-grant', 'benchmark-divergence'] as const)
      expect(rowOf(result, duty), duty).toEqual({ duty, disposition: 'inspected', note: RETRO_DUTY_NO_CASES_NOTE });
    expect(dutiesLeftUninspected(result)).not.toContain('standing-grant');
  });

  it('real call 2 lists refuted-reason while grading the supplied verdict: inspected through its accepted grade row', () => {
    expect((answerOf(2).uninspected as string[])).toContain('refuted-reason');
    const result = validate(answerOf(2));
    expect(result.inspected).toContain(verdict);
    expect(rowOf(result, 'refuted-reason')).toEqual({ duty: 'refuted-reason', disposition: 'inspected', note: RETRO_DUTY_ROWS_NOTE });
  });

  it('the other side, on a real answer: call 4 lists refuted-reason and its verdict row is not accepted, so the duty stays not inspected', () => {
    expect((answerOf(4).uninspected as string[])).toContain('refuted-reason');
    const result = validate(answerOf(4));
    expect(result.inspected).not.toContain(verdict);
    expect(result.omitted.map(row => row.case)).toContain(verdict);
    expect(rowOf(result, 'refuted-reason')).toEqual({ duty: 'refuted-reason', disposition: 'unavailable', note: RETRO_DUTY_UNINSPECTED_NOTE });
  });

  it('the other side: with the verdict case omitted, no grade row stood behind the duty, so refuted-reason stays not inspected', () => {
    const answer = answerOf(2);
    const omittedVerdict = { ...answer, inspected: (answer.inspected as string[]).filter(id => id !== verdict),
      omitted: [...(answer.omitted as unknown[] ?? []), { case: verdict, reason: 'answer budget' }],
      grades: (answer.grades as { case: string }[]).filter(row => row.case !== verdict) };
    const result = validate(omittedVerdict);
    expect(result.inspected).not.toContain(verdict);
    expect(rowOf(result, 'refuted-reason')).toEqual({ duty: 'refuted-reason', disposition: 'unavailable', note: RETRO_DUTY_UNINSPECTED_NOTE });
    expect(dutiesLeftUninspected(result)).toContain('refuted-reason');
    // A verdict whose grade row is missing stays owed too, and still discharges nothing.
    const ungraded = validate({ ...answer, grades: (answer.grades as { case: string }[]).filter(row => row.case !== verdict) });
    expect(ungraded.inspected).not.toContain(verdict);
    expect(rowOf(ungraded, 'refuted-reason').disposition).toBe('unavailable');
  });

  it('a duty the answer did NOT list keeps its own derivation, and a refused finding keeps its own note', () => {
    const answer = answerOf(3);
    expect(answer.uninspected).toEqual(['waiver-recurrence']);
    const refused = validate({ ...answer, findings: [...(answer.findings as unknown[]),
      { duty: 'standing-grant', refs: [], summary: 'nothing found', disposition: { declined: 'none' } }] });
    expect(rowOf(refused, 'standing-grant').disposition).toBe('unavailable');
    expect(rowOf(refused, 'standing-grant').note).not.toBe(RETRO_DUTY_NO_CASES_NOTE);
  });
});

describe('mergeDutyFollowUp on real held answers', () => {
  const held = calls.filter(row => [1, 2, 4, 5].includes(row.call)).map(row => ({ call: row.call, result: validate(row.answer) }));

  it('a follow-up that inspects every asked duty completes the duty set and changes nothing else', () => {
    for (const { call, result } of held) {
      const asked = dutiesLeftUninspected(result);
      const merged = merge({ uninspected: [], findings: [{ duty: asked[0], refs: [supplied[0]], summary: 'a candidate worth a permanent ability',
        disposition: { owner: 'agent', next: 'propose the tool' } }] }, result);
      expect(i1b(merged.duties), String(call)).toBe(true);
      expect(dutiesLeftUninspected(merged), String(call)).toEqual([]);
      expect(merged.duties.find(row => row.duty === asked[0])!.note, String(call)).toBe('inspected; finding opened');
      expect(merged.duties.find(row => row.duty === 'waiver-recurrence'), String(call)).toEqual(result.duties.find(row => row.duty === 'waiver-recurrence'));
      expect(merged.duties.find(row => row.duty === 'waiver-recurrence')!.note.startsWith(WAIVER_EVIDENCE_UNAVAILABLE), String(call)).toBe(true);
      for (const duty of RETROSPECTIVE_DUTIES) if (!asked.includes(duty))
        expect(merged.duties.find(row => row.duty === duty), `${String(call)} ${duty}`).toEqual(result.duties.find(row => row.duty === duty));
      expect(merged.findings, String(call)).toEqual([...result.findings, expect.objectContaining({ id: 'retro:0:duties:0', duty: asked[0] })]);
      for (const field of ['inspected', 'omitted', 'grades', 'feedback', 'authorizations', 'comparisons', 'closures', 'efficiency', 'gravityWells'] as const)
        expect(merged[field], `${String(call)} ${field}`).toEqual(result[field]);
      expect(owedAfter(merged), String(call)).toEqual(owedAfter(result));
    }
  });

  it('the other side: a duty the follow-up still lists keeps the first answer\'s not-inspected row; never narrowed', () => {
    for (const { call, result } of held) {
      const asked = dutiesLeftUninspected(result), still = asked.slice(0, Math.ceil(asked.length / 2));
      const merged = merge({ uninspected: still, findings: [] }, result);
      for (const duty of still) expect(merged.duties.find(row => row.duty === duty), `${String(call)} ${duty}`)
        .toEqual(result.duties.find(row => row.duty === duty));
      expect(dutiesLeftUninspected(merged), String(call)).toEqual(still);
      expect(i1b(merged.duties), String(call)).toBe(false);
    }
  });

  it('takes nothing from a follow-up whose uninspected list is absent or names an unknown duty', () => {
    const { result } = held[0]!;
    expect(merge({ findings: [] }, result).duties).toEqual(result.duties);
    expect(merge({ uninspected: ['unsupported reversal'], findings: [] }, result).duties).toEqual(result.duties);
    expect(() => merge('not an object', result)).toThrow();
  });

  it('records no finding of a duty that was not asked, and keeps an asked duty uninspected when its only finding is refused', () => {
    const { result } = held[0]!;
    const asked = dutiesLeftUninspected(result);
    const notAsked = RETROSPECTIVE_DUTIES.find(duty => !asked.includes(duty) && duty !== 'waiver-recurrence')!;
    const merged = merge({ uninspected: [], findings: [
      { duty: notAsked, refs: [supplied[0]], summary: 'outside the ask', disposition: { owner: 'agent', next: 'x' } },
      { duty: asked[0], refs: ['answer:nowhere'], summary: 'cites an unknown record', disposition: { owner: 'agent', next: 'x' } }] }, result);
    expect(merged.findings).toEqual(result.findings);
    expect(merged.refusedRows).toEqual(expect.arrayContaining([`follow-up finding row refused: duty ${notAsked} was not asked`]));
    expect(merged.duties.find(row => row.duty === asked[0])).toEqual(result.duties.find(row => row.duty === asked[0]));
    for (const duty of asked.slice(1)) expect(merged.duties.find(row => row.duty === duty)!.disposition).toBe('inspected');
  });

  it('takes wells only when gravity-well was asked', () => {
    const { result } = held[0]!;
    const wells = GRAVITY_WELLS.map((_, index) => index === 0 ? [supplied[0]] : 0);
    expect(merge({ uninspected: [], wells, findings: [] }, result).gravityWells).toEqual(result.gravityWells);
    const withWell = { ...result, duties: result.duties.map(row => row.duty === 'gravity-well'
      ? { ...row, disposition: 'unavailable' as const, note: RETRO_DUTY_UNINSPECTED_NOTE } : row) };
    const merged = merge({ uninspected: [], wells, findings: [] }, withWell);
    expect(merged.gravityWells.filter(row => row.observed).map(row => row.well)).toEqual([GRAVITY_WELLS[0]!.id]);
    expect(merged.duties.find(row => row.duty === 'gravity-well')!.note).toBe('inspected; finding opened');
  });

  it('the follow-up packet is the pass\'s own packet plus the asked duties', () => {
    const packet = JSON.parse(dutyFollowUpPacket(plan.state, ['workaround'])) as Record<string, unknown>;
    expect(packet.followUpDuties).toEqual(['workaround']);
    expect({ ...packet, followUpDuties: undefined }).toEqual({ ...JSON.parse(plan.state) as object, followUpDuties: undefined });
    expect(RETRO_DUTY_FOLLOWUP_QUESTION).toContain('followUpDuties');
  });
});

// ---- the worker: one follow-up call inside the pass and the cap ----
const key = new Uint8Array(32).fill(44);
const start = Date.UTC(2026, 9, 3, 17);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 80, maxReplies: 80, maxTurns: 80, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: Math.floor(start / 1000) + id, text } });
const casesOf = (state: string) => (JSON.parse(state) as { cases: RetroCase[] }).cases;
/** A valid first answer for the supplied cases, leaving the live six duties uninspected exactly as pass 0 did. */
const firstAnswer = (state: string, uninspected: string[] = [...LIVE_SIX, 'waiver-recurrence']) => {
  const cases = casesOf(state);
  return JSON.stringify({ inspected: cases.map(item => item.id), omitted: [], uninspected, wells: GRAVITY_WELLS.map(() => 0),
    eff: LIVE.livePass.efficiency, findings: [], feedback: [], closures: [], authorizations: [], comparisons: [],
    grades: cases.filter(item => item.category === 'decision' || item.category === 'verdict').map(item => ({ case: item.id,
      conclusion: { assessment: 'unverifiable', evidence: [] }, reason: { assessment: item.reason ? 'unverifiable' : 'not-applicable', evidence: [] },
      outcome: { assessment: 'pending', reason: 'no later message settles it yet', evidence: [] }, observations: [] })) });
};
type Reply = { state: 'complete'; value: string } | { state: 'uncertain' } | 'throw';

function world(maxCalls = genesis.maxCalls, path?: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-duty-')));
  const file = path ?? join(root, 'journal.encrypted');
  const journal = openPreviewJournal(file, key, { ...genesis, maxCalls });
  const asks: { id: string; question: string | undefined; state: string }[] = [], modelIds: string[] = [];
  let followUp: (state: string) => Reply = () => ({ state: 'complete', value: JSON.stringify({ uninspected: [], findings: [] }) });
  let first: (state: string) => string = state => firstAnswer(state);
  let during: (id: string) => void = () => {};
  const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, timeZone: 'America/Los_Angeles',
    sources: () => [disciplineSource(journal.view)],
    model: async (input: { id: string }) => { modelIds.push(input.id);
      return input.id.startsWith('summary:') ? JSON.stringify({ summary: 'Chat.', people: [], memory: [], commitments: [], questions: [] })
        : JSON.stringify({ reply: 'Noted.', memory: [], dated: [] }); },
    send: async () => 7, checkOutbound: () => {},
    retrospect: async (state: string, id: string, question?: string) => {
      asks.push({ id, question, state }); during(id);
      const usage = { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true as const };
      if (!id.endsWith(':duties')) return { state: 'complete' as const, value: first(state), usage };
      const reply = followUp(state);
      if (reply === 'throw') throw Error('stopped mid-call');
      return { ...reply, usage };
    } });
  let next = 1;
  return { root, file, journal, worker, asks, modelIds,
    onFollowUp: (fn: (state: string) => Reply) => { followUp = fn; }, onFirst: (fn: (state: string) => string) => { first = fn; },
    during: (fn: (id: string) => void) => { during = fn; },
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text))); await worker.drain(); },
    done: () => { try { journal.close(); } catch { /* closed by the test */ } rmSync(root, { recursive: true, force: true }); } };
}
const tenMessages = Array.from({ length: 10 }, (_, index) => `message ${String(index + 1)}`);

describe('the pass\'s duty follow-up in the worker', () => {
  it('asks once about exactly the uninspected duties, then records the pass complete with every duty inspected (I1b)', async () => {
    const w = world();
    try {
      await w.converse(tenMessages);
      const before = w.journal.view.calls;
      await w.worker.retrospect('sha256:config-a');
      expect(w.asks.map(ask => [ask.id, ask.question])).toEqual([['retrospective:0', undefined],
        ['retrospective:0:duties', RETRO_DUTY_FOLLOWUP_QUESTION]]);
      expect((JSON.parse(w.asks[1]!.state) as { followUpDuties: string[] }).followUpDuties).toEqual(WORKER_ASKED);
      expect({ ...JSON.parse(w.asks[1]!.state) as object, followUpDuties: undefined }).toEqual({ ...JSON.parse(w.asks[0]!.state) as object, followUpDuties: undefined });
      expect(w.journal.view.calls).toBe(before + 2);
      const pass = w.journal.view.retroPasses[0]!;
      expect(pass).toMatchObject({ state: 'complete', dutyFollowUp: { duties: WORKER_ASKED, state: 'complete' }, outputTokens: 50 });
      expect(pass.reason).toBeUndefined();
      expect(i1b(pass.result!.duties)).toBe(true);
      const line = retrospectiveStatusLine(w.journal.view);
      expect(line).toContain('efficiency duty ran');
      expect(line).not.toContain('although their evidence was present');
      // The durable record replays to the same view.
      const projected = JSON.stringify(w.journal.view.retroPasses);
      w.journal.close();
      const reopened = openPreviewJournal(w.file, key);
      expect(JSON.stringify(reopened.view.retroPasses)).toBe(projected);
      reopened.close();
    } finally { w.done(); }
  });

  it('the other side: a first answer that inspected every duty makes no follow-up call', async () => {
    const w = world();
    try {
      await w.converse(tenMessages);
      w.onFirst(state => firstAnswer(state, ['waiver-recurrence']));
      await w.worker.retrospect('sha256:config-a');
      expect(w.asks.map(ask => ask.id)).toEqual(['retrospective:0']);
      expect(w.journal.view.retroPasses[0]!.dutyFollowUp).toBeUndefined();
      expect(i1b(w.journal.view.retroPasses[0]!.result!.duties)).toBe(true);
    } finally { w.done(); }
  });

  it('keeps the reply reserve: with no spare attempt it does not run, and the pass says so honestly', async () => {
    const probe = world();
    let used: number;
    try { await probe.converse(tenMessages); used = probe.journal.view.calls; } finally { probe.done(); }
    // Exactly one spare attempt before the pass: the pass spends it, so the follow-up would eat into the reserve.
    let maxCalls = used + 5;
    while (maxCalls - used - retroCallReserve(maxCalls) !== 1) maxCalls++;
    const w = world(maxCalls);
    try {
      await w.converse(tenMessages);
      expect(w.journal.view.calls).toBe(used);
      await w.worker.retrospect('sha256:config-a');
      expect(w.asks.map(ask => ask.id)).toEqual(['retrospective:0']);
      const pass = w.journal.view.retroPasses[0]!;
      expect(pass).toMatchObject({ state: 'complete', reason: 'duty follow-up: not run, model attempts kept in reserve for replies' });
      expect(dutiesLeftUninspected(pass.result!)).toEqual(WORKER_ASKED);
      expect(i1b(pass.result!.duties)).toBe(false);
      expect(retrospectiveStatusLine(w.journal.view)).toContain(`duties not inspected although their evidence was present: ${WORKER_ASKED.join(', ')} (duty follow-up: not run`);
    } finally { w.done(); }
  });

  it('an uncertain, refused or failed follow-up leaves the first answer\'s rows, with the reason; nothing is replayed', async () => {
    for (const [reply, reason] of [[{ state: 'uncertain' } as Reply, 'duty follow-up: model outcome uncertain'],
      [{ state: 'complete', value: 'not json' } as Reply, 'duty follow-up: answer refused, answer was not JSON'],
      ['throw' as Reply, 'duty follow-up: model call failed or was stopped, outcome unknown']] as const) {
      const w = world();
      try {
        await w.converse(tenMessages);
        w.onFollowUp(() => reply);
        await w.worker.retrospect('sha256:config-a');
        const pass = w.journal.view.retroPasses[0]!;
        expect(pass, reason).toMatchObject({ state: 'complete', reason });
        expect(dutiesLeftUninspected(pass.result!), reason).toEqual(WORKER_ASKED);
        expect(pass.dutyFollowUp!.state, reason).toBe(reply === 'throw' || (typeof reply === 'object' && reply.state === 'uncertain') ? 'unknown' : 'failed');
        await w.worker.retrospect('sha256:config-a');
        expect(w.asks.filter(ask => ask.id.endsWith(':duties')), reason).toHaveLength(1);
      } finally { w.done(); }
    }
  });

  it('a crash between the follow-up reservation and the pass record keeps the first answer, never replays the call', async () => {
    const w = world();
    const copy = join(w.root, 'at-crash.encrypted');
    try {
      await w.converse(tenMessages);
      w.during(id => { if (id.endsWith(':duties')) copyFileSync(w.file, copy); });
      await w.worker.retrospect('sha256:config-a');
      const resumed = world(genesis.maxCalls, copy);
      try {
        const pending = resumed.journal.view.retroPasses[0]!;
        expect(pending.state).toBeUndefined();
        expect(pending.dutyFollowUp).toMatchObject({ duties: WORKER_ASKED });
        expect(pending.dutyFollowUp!.state).toBeUndefined();
        await resumed.worker.retrospect('sha256:config-a');
        const pass = resumed.journal.view.retroPasses[0]!;
        expect(pass).toMatchObject({ state: 'complete', reason: 'duty follow-up: interrupted, outcome unknown, never replayed',
          dutyFollowUp: { state: 'unknown' }, outputTokens: 50 });
        expect(pass.result).toEqual(pending.dutyFollowUp!.held);
        expect(resumed.asks.filter(ask => ask.id.endsWith(':duties'))).toEqual([]);
      } finally { resumed.done(); }
    } finally { w.done(); }
  });
});

describe('the status reply carries the retrospective line (I1d)', () => {
  it('the recorded operator question is an exact status command; status-like prose is still the mind\'s (Rule 4)', () => {
    expect(LIVE.statusQuestion).toBe('What is your status?');
    expect(isStatusCommand(LIVE.statusQuestion)).toBe(true);
    for (const text of ['what is your status', "What's your status?", 'WHAT IS YOUR STATUS!']) expect(isStatusCommand(text), text).toBe(true);
    for (const text of ['What is your status on the build?', 'what is your status? also check the cap', 'tell me your status'])
      expect(isStatusCommand(text), text).toBe(false);
  });

  it('replays both recorded shapes: the status record\'s line passes I1d, the model-written reply that dropped it does not', () => {
    expect(i1d(LIVE.statusLine)).toBe(true);
    expect(i1d(LIVE.modelReply)).toBe(false);
  });

  it('answers "What is your status?" with the fixed pull, including the retrospective line, and no model call', async () => {
    const w = world();
    try {
      await w.converse(tenMessages);
      await w.worker.retrospect('sha256:config-a');
      const models = w.modelIds.length;
      await w.converse([LIVE.statusQuestion]);
      expect(w.modelIds).toHaveLength(models);
      const reply = w.journal.view.order.at(-1)!.intent!;
      expect(reply).toContain(retrospectiveStatusLine(w.journal.view, undefined).split(';')[0]!);
      expect(reply).toContain('Retrospective review: 1 completed pass(es)');
      expect(i1d(reply)).toBe(true);
    } finally { w.done(); }
  });
});

describe('the follow-up on REAL model answers (rule 106)', () => {
  const REAL_FOLLOWUPS = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-real-2026-10-03.json', import.meta.url), 'utf8')) as {
    calls: { heldCall: number; question: 'first-draft' | 'final'; asked: RetrospectiveDuty[]; answer: string }[] };
  const heldOf = (call: number) => validate(calls.find(row => row.call === call)!.answer);

  it('replays the very ask each real answer was given', () => {
    // Recorded under the earlier rule, when the answer's list also decided the row-backed duties: today's ask is that
    // recorded ask less the duties the plan now decides, and nothing else.
    for (const row of REAL_FOLLOWUPS.calls) { const held = heldOf(row.heldCall);
      expect(dutiesLeftUninspected(held), String(row.heldCall)).toEqual(row.asked.filter(duty => !planDecides(held)(duty))); }
  });

  it('the shipped question: each real follow-up answer completes the duty set of its held real answer (I1b)', () => {
    const finals = REAL_FOLLOWUPS.calls.filter(row => row.question === 'final');
    expect(finals.map(row => row.heldCall)).toEqual([1, 2, 4]);
    for (const row of finals) {
      const held = heldOf(row.heldCall), merged = merge(JSON.parse(row.answer), held);
      expect(i1b(held.duties), String(row.heldCall)).toBe(false);
      expect(i1b(merged.duties), String(row.heldCall)).toBe(true);
      expect(merged.efficiency, String(row.heldCall)).toEqual(held.efficiency);
      expect(merged.inspected, String(row.heldCall)).toEqual(held.inspected);
    }
  });

  it('the first draft\'s real answer (a ref-less "nothing found" finding per duty) is refused per duty: nothing is recorded inspected that was not', () => {
    const draft = REAL_FOLLOWUPS.calls.find(row => row.question === 'first-draft')!;
    const held = heldOf(draft.heldCall), merged = merge(JSON.parse(draft.answer), held);
    expect((JSON.parse(draft.answer) as { findings: { refs: unknown[] }[] }).findings.every(item => item.refs.length === 0)).toBe(true);
    expect(dutiesLeftUninspected(merged)).toEqual(draft.asked.filter(duty => !planDecides(held)(duty)));
    expect(merged.duties).toEqual(held.duties);
    expect(RETRO_DUTY_FOLLOWUP_QUESTION).toContain('Never write a finding to say that nothing was found');
  });
});
