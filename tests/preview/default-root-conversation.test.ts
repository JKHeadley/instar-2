import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SOURCE_PINS, deskStatusSource, sourcePacket } from './briefing.js';
import { disciplineSource } from './retrospective.js';
import { selfStateBrief, selfStateSource } from './self-state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { MEMORY_ITEM_SHAPE, OBLIGATION_DECISION, OBLIGATION_DECISION_FLOOR, PREVIEW_LIVE_LIMITS, PREVIEW_MIN_TURN_HEADROOM_BYTES,
  concurrentWorkItem, createJournalWorker, declaredObligations, openDirectives, openPreviewJournal, replyReviewReserveFor,
  summaryPromptBytes } from './journal.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { jevQuestions, replyReviewContext, replyReviewQuestion } from './reply-check.js';
import type { ReplyFinding } from './reply-check.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { conclusionText, parseModelJson } from './model-json.js';

/** Why this file exists: live 2026-10-01, room two was created at the launcher's default context limit and
 * answered ONE message before holding every later reply for size. `default-context-floor.test.ts` holds the
 * arithmetic of one turn; this holds the thing the operator actually experiences -- an ordinary conversation.
 * A fresh root at the default limits, with the real briefing read from this checkout, the real self-state,
 * the concurrent-work row a live runner always sends, and reply review wired, must answer twenty short turns
 * with compaction and the rolling summary doing their normal work, hold nothing for size, and lose no history.
 *
 * The trial's spend allowance (16 model attempts) is raised here and only here: twenty turns need an answer
 * and a review call each, so the live allowance would stop the conversation for budget long before bytes.
 * That isolates the question this file asks. No shipped constant is changed; `PREVIEW_LIVE_LIMITS.contextBytes`
 * is used exactly as the launcher's default. The same separation is already made by
 * `long-conversation-headroom.test.ts`, which raises the same allowance for the same reason. */

const key = new Uint8Array(32).fill(53);
const now = 1_790_500_000_000;
const bytes = (value: string) => Buffer.byteLength(value);
const DESK_PATH = '/offline/desk-status.md';
const marker = (n: number) => `FACT-${String(n).padStart(3, '0')}`;
/** An ordinary short operator message: one sentence and a distinct fact to carry. */
const question = (n: number) => `Question ${String(n)}: ${marker(n)}. How is the preview doing right now?`;

type TurnReport = { n: number; sent: boolean; held: string | undefined; notice: string | undefined;
  answerTotal: number; keys: string[]; setAside: boolean };

/** The live proof-room shapes replayed below (see the model-facing note in the last test). */
type ModelUsage = { inputTokens: number | null; outputTokens: number | null; charge: null };
type Recorded = { update: number; text: string; answerOutput: string; answerUsage: ModelUsage };
const misfire = JSON.parse(readFileSync(new URL('./fixtures/proofroom-memory-misfire-715672853-2026-09-30.json',
  import.meta.url), 'utf8')) as { genesis: { bot: string; chat: string; operator: string; grant: string;
    configurationDigest: string }; turns: Recorded[] };
const [RECORDED_PREFERENCE, RECORDED_CAPABILITY_QUESTION] = misfire.turns as [Recorded, Recorded];
/** A live root's recorded shapes, replayed in place of the stub model and reply checks. */
type LiveShape = { now: number; timeZone: string; model: string; concurrentWork: object; runtimeSources: readonly object[];
  replyNotices: () => readonly { key: string; line: string }[];
  answer: (id: string, context: string) => string;
  jevScore: (rule: string, text: string) => number;
  review: (id: string) => { verdict: 'pass'; ruleIds: never[]; reason: string; findings: ReplyFinding[] } };
/** What the live subscription port hands the worker for a complete result (journal-agent invokeSubscription). */
function livePort(raw: string, usage: ModelUsage) {
  const extracted = parseModelJson(raw, { wrapped: 'accept' });
  const decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown;
    conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage }
    : { state: 'complete' as const, value, text: value, usage };
}

/** One fresh root at `maxBytes`, driven through `texts` in order. `answers` are the model outputs to use for
 * each text (keyed by the operator text); anything else gets a short ordinary reply. */
async function conversation(maxBytes: number, texts: readonly string[],
  answers: ReadonlyMap<string, Recorded> = new Map(),
  // A recorded replay keeps the proof room's own genesis and update ids, because a recorded decision quotes
  // its own turn id and would be refused under any other identity.
  identity: { bot: string; chat: string; operator: string; grant: string; configurationDigest: string }
    = { bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
      configurationDigest: 'sha256:offline' },
  updateIds?: readonly number[], live?: LiveShape) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-default-root-')));
  const at = live?.now ?? now;
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', ...identity,
      // Context bytes are the launcher's default; only the spend allowance is raised (see the header note).
      expires: 9_999_999_999_999, maxCalls: 200, maxReplies: 60, maxTurns: 60, maxBytes, cursor: 0 });
    const briefing = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: journal.view.limits.maxCalls, expiresAt: journal.view.expires }).sources;
    const runs = { launches: [{ at: now - 60_000, pid: 1 }], exits: [] };
    const desk = { text: `# desk\n${'Preview work remains a supervised private chat trial with a reviewed activation.\n'.repeat(40)}`,
      modifiedAt: now };
    const sources = () => live ? [...briefing, disciplineSource(journal.view), ...live.runtimeSources] as typeof briefing
      : [...briefing, disciplineSource(journal.view),
        selfStateSource(selfStateBrief(journal.view, runs as never, now, 'UTC', now - 60_000)),
        deskStatusSource(desk, now, DESK_PATH)];
    const answerPackets: string[] = [], answerSizes: number[] = [], summarySizes: number[] = [];
    const answerModel = live?.model ?? 'claude-opus-5-5';
    const prepareModel = (input: { question: string; context: string; id: string }) =>
      prepareJournalEnvelope(input, answerModel, journal.view.genesis.grant, at, journal.view.limits.maxBytes);
    const reviews: { id: string; built: boolean }[] = [];
    const worker = createJournalWorker(journal, { now: () => at, stopped: () => false, sources,
      ...(live ? { timeZone: live.timeZone, replyNotices: live.replyNotices } : {}),
      prepareModel,
      concurrentWork: () => live?.concurrentWork ?? concurrentWorkItem({ now, others: [], scanned: 1, truncated: false, unreadable: 0,
        current: { owner: 'preview-root', launch: now - 60_000,
          conversation: `telegram/bot-${identity.bot}/chat-${identity.chat}` } }),
      model: async input => {
        if (live) {
          const size = bytes(String(input.prepared ?? '')) + bytes(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
          const packet = JSON.parse(input.context) as { audience?: unknown };
          if (input.id.startsWith('summary:')) summarySizes.push(size);
          else if (packet.audience) { answerPackets.push(input.context); answerSizes.push(size); }
          return live.answer(input.id, input.context);
        }
        const size = bytes(String(input.prepared ?? '')) + bytes(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
        if (input.id.startsWith('summary:')) {
          summarySizes.push(size);
          const packet = JSON.parse(input.context) as { summary?: { text: string }; history: { user: string }[] };
          const facts = [...new Set([...(packet.summary?.text.match(/FACT-\d{3}/gu) ?? []),
            ...packet.history.flatMap(item => item.user.match(/FACT-\d{3}/gu) ?? [])])];
          return JSON.stringify({ summary: `The operator asked ordinary preview questions with these distinct facts: ${facts.join(', ')}.`,
            people: [], commitments: [], memory: [], questions: [] });
        }
        // The obligation-work step also calls the model; only an operator answer packet carries `audience`.
        if (!(JSON.parse(input.context) as { audience?: unknown }).audience)
          return JSON.stringify({ reply: 'Nothing further to report on that.', memory: [], dated: [] });
        answerPackets.push(input.context); answerSizes.push(size);
        const recorded = answers.get(input.question);
        return recorded === undefined
          ? JSON.stringify({ reply: `The preview can answer that from its current sources (${String(answerSizes.length)}).`,
            memory: [], dated: [] })
          : livePort(recorded.answerOutput, recorded.answerUsage);
      },
      // Answers whichever question set it is given (the reply rules, or the summary-integrity question), so the
      // reply review and the summary's own integrity check are both real rather than silently unavailable.
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      send: async () => journal.view.replies + 1, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100,
        jev: async (text, questions) => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
          Object.keys(questions ?? jevQuestions).map(id => [id, { type: 'noul',
            noul: questions === undefined || questions === jevQuestions ? live?.jevScore(id, text) ?? 0.01 : 0.01 }])) }, latencyMs: 10 }),
        // The live escalation builds the full-context review prompt before it calls the model, and a prompt over
        // the limit throws there (journal-agent's escalate -> modelEnvelope). Built here the same way, so a review
        // that cannot fit is the real unavailable outcome rather than a stub that always passes.
        escalate: async (text, id, originalPrompt, reviewRules) => {
          if (!live) return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 10 };
          const context = replyReviewContext(String(originalPrompt), text, reviewRules,
            declaredObligations(journal.view, id, at));
          try { prepareModel({ question: replyReviewQuestion(reviewRules ?? []), context, id: `${id}:reply-review` }); }
          catch (error) { reviews.push({ id, built: false }); throw error; }
          reviews.push({ id, built: true });
          return { ...live.review(id), confidence: null, latencyMs: 10 };
        } } });
    const report: TurnReport[] = [];
    for (const [index, text] of texts.entries()) {
      worker.intake([{ update_id: updateIds?.[index] ?? index + 1,
        message: { chat: { id: Number(identity.chat), type: 'private' }, from: { id: Number(identity.operator) },
          date: Math.floor(at / 1000) + index, text } }]);
      await worker.drain();
      await worker.summarizeIfNeeded();
      const turn = journal.view.order.at(-1)!;
      const packet = JSON.parse(answerPackets.at(-1) ?? '{}') as Record<string, unknown>;
      report.push({ n: index + 1, sent: turn.sent !== undefined, held: turn.held, notice: turn.noticeClass,
        answerTotal: answerSizes.at(-1) ?? 0, keys: Object.keys(packet), setAside: 'historySetAside' in packet });
    }
    const result = { report, summarySizes, answerPackets: [...answerPackets], reviews,
      preferStatements: journal.view.memory.filter(item => item.mode === 'prefer').length,
      summaries: journal.view.summaries.map(item => item.text),
      preferences: journal.view.memory.filter(item => item.mode === 'prefer').map(item => item.quote),
      directives: openDirectives(journal.view).map(item => item.note.quote),
      blockers: journal.view.blockers.map(item => item.claim),
      firstText: journal.view.order[0]?.text };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('answers twenty short turns on a fresh root at the default context limit, with nothing held for size', async () => {
  const limit = PREVIEW_LIVE_LIMITS.contextBytes;
  const room = limit - replyReviewReserveFor(limit);
  const run = await conversation(limit, Array.from({ length: 20 }, (_, index) => question(index + 1)));
  expect(run.report).toHaveLength(20);
  for (const turn of run.report) {
    // Answered by the model, not turned into a size notice and not held.
    expect(turn.sent, `turn ${String(turn.n)}: held ${turn.held ?? '-'} notice ${turn.notice ?? '-'}`).toBe(true);
    expect(turn.held, `turn ${String(turn.n)}`).toBeUndefined();
    expect(turn.notice, `turn ${String(turn.n)}`).toBeUndefined();
    // Every turn's prompt stayed inside the room the reply-review reserve leaves.
    expect(turn.answerTotal, `turn ${String(turn.n)}`).toBeLessThanOrEqual(room);
    // Rule 2: no history was set aside, so nothing the operator said dropped out of the packet.
    expect(turn.setAside, `turn ${String(turn.n)}`).toBe(false);
    // The briefing and the memory and dated guidance ride every turn: none of them yielded.
    for (const required of ['sources', 'datedDecision', 'memoryDecision', 'capability', 'audience'])
      expect(turn.keys, `turn ${String(turn.n)} ${required}`).toContain(required);
  }
  // Compaction and the rolling summary did their normal work, faithfully: the first fact is still carried.
  expect(run.summaries.length).toBeGreaterThan(0);
  expect(run.summaries.at(-1)).toContain(marker(1));
  // Every summary step fit its own ceiling. That ceiling tracks the context limit (three quarters of it, at
  // least 24 KiB, at most 96 KiB); at the default it is the 24 KiB floor, the thinner of the two margins here.
  expect(summaryPromptBytes(limit)).toBe(24 * 1024);
  expect(run.summarySizes.length).toBeGreaterThan(0);
  for (const size of run.summarySizes) expect(size).toBeLessThanOrEqual(summaryPromptBytes(limit));
  // Nothing was deleted: the first message is still in the journal verbatim.
  expect(run.firstText).toBe(question(1));
  // The measured gain: the obligation guide survives twice as many opening turns. Before this change the room
  // was 24576 and the guide was present on turns 1 and 2 only, yielding from the third turn of a fresh root
  // onward; it is now present through turn 4. (Proven in both directions: restoring the flat 8192 reserve
  // makes this assertion fail with [1, 2].)
  const withGuide = run.report.filter(turn => turn.keys.includes('obligationDecision')).map(turn => turn.n);
  expect(withGuide.slice(0, 4)).toEqual([1, 2, 3, 4]);
}, 300_000);

it('still serves the live recorded answers after the guidance rewording', async () => {
  // Model-facing replay (observer #106). This change reworded three packet blocks -- the capability guidance,
  // obligationDecision and the capability note's trial line -- so it is replayed against the REAL recorded
  // proof-room shapes rather than stubs (lanes/preview-trial-root/proofroom-2026-09-30, cint-L13 72fb5a82):
  // update 715672779, whose live claude-sonnet-5 answer returned a valid `prefer` memory item, and update
  // 715672853, the live capability question whose answer was grounded in the capability note. Both are
  // replayed verbatim through the reworded packet at the default limit.
  const limit = PREVIEW_LIVE_LIMITS.contextBytes;
  const run = await conversation(limit, [RECORDED_PREFERENCE.text, RECORDED_CAPABILITY_QUESTION.text],
    new Map([[RECORDED_PREFERENCE.text, RECORDED_PREFERENCE],
      [RECORDED_CAPABILITY_QUESTION.text, RECORDED_CAPABILITY_QUESTION]]),
    misfire.genesis, [RECORDED_PREFERENCE.update, RECORDED_CAPABILITY_QUESTION.update]);
  // The real recorded prefer decision still lands: the reply-style preference is recorded from this turn.
  expect(run.preferences).toEqual([RECORDED_PREFERENCE.text]);
  // Both recorded turns were answered and neither was held.
  expect(run.report.map(turn => turn.sent)).toEqual([true, true]);
  expect(run.report.map(turn => turn.held)).toEqual([undefined, undefined]);
  // Every clause the live recorded decisions leaned on is still in the packet they were handed. The prefer
  // shape and its source stay stated in BOTH places they were stated before (journal-dated-memory pins the
  // datedDecision one as a declared contract), and the capability guidance -- which this change did shorten
  // by dropping the sentence the capability note itself already makes -- still names the note it points at.
  const first = JSON.parse(run.answerPackets[0]!) as { memoryDecision?: string; preferenceSource?: string;
    datedDecision?: string; capability?: string };
  expect(first.memoryDecision).toContain(MEMORY_ITEM_SHAPE);
  expect(MEMORY_ITEM_SHAPE).toContain('for prefer, preferenceSource');
  expect(first.datedDecision).toContain('{mode:"prefer",source:current turn id,quote:exact preference clause}');
  expect(first.preferenceSource).toBeDefined();
  expect(first.capability).toContain('capability-note source');
  // The reworded capability guidance no longer repeats what the note states, which is the trimmed path.
  expect(first.capability).not.toContain('generated from the register');
  // And the capability question's packet still carries the note with its generated items, the no-tools
  // sentence the live blocker avenues quote as evidence, and the trial budget line.
  const second = JSON.parse(run.answerPackets[1]!) as { sources: { id: string; text: string }[] };
  const note = second.sources.find(item => item.id === 'capability-note')!;
  expect(note.text).toContain('- preview-conversation: ');
  expect(note.text).toContain('Nothing unlisted is available: no tools');
  expect(note.text).toContain('This trial allows at most');
}, 120_000);

it('leaves the measured headroom the twenty-turn conversation needs', () => {
  // The same claim the conversation above demonstrates, stated as arithmetic so a growth in the fixed parts
  // fails here too: the room left for the operator's message and its history at the default limit.
  const limit = PREVIEW_LIVE_LIMITS.contextBytes;
  expect(limit - replyReviewReserveFor(limit)).toBeGreaterThan(limit - Math.floor(limit / 4));
  expect(PREVIEW_MIN_TURN_HEADROOM_BYTES).toBeGreaterThan(0);
});

/** Live 2026-10-02 (build cint-L29): room two on a FRESH root at the shipped default 32768 bytes answered three
 * short garden notes and then no message at all -- turns 10, replies 3, nothing held, no failure class, the runner
 * alive and idle. The parts every turn carries left 97 bytes on the third turn; the fourth also carried the reply
 * preference the operator had now stated twice and the undo guidance for that change, and its smallest prepared
 * prompt (every earlier turn set aside) was 23830 bytes against 23093 beside the reply-review reserve. The floor
 * could shed nothing more, so the turn was re-held every five minutes for good. The test above passed twenty turns
 * because its stub model records no preference and returns no notice; this one replays the root's own recorded
 * shapes (observer #106): the real answer decisions (a `prefer` memory item on each note, a dated item, the
 * credential reminder the runner appends), the live concurrent-work row, the recorded summary prose and items,
 * the recorded Jev reply-check scores (every one `unsure`, so each reply went to the full-context review, built
 * here exactly as the live escalation builds it) and the recorded review verdicts. */
type RecordedRoot = { genesis: { bot: string; chat: string; operator: string; grant: string; configurationDigest: string };
  maxBytes: number; at: number; turns: { update: number; text: string }[];
  answers: { update: number; modelReply: string; memory: { mode: string; quote: string }[];
    dated: { quote: string; when: string; zone: string; day: string }[] }[];
  notice: { key: string; line: string }; concurrentWork: object; runtimeSources: object[];
  summaries: { through: number; commitments: { in: string; quote: string; owner: string; waitsOn: string }[] }[];
  summaryReviews: { reason: string }[];
  replyChecks: { update: number; jevScores: Record<string, number>; review: { findings: ReplyFinding[] } }[];
  measured: { smallestPreparedPromptBytes: number; preparedPromptBytesLeftBesideReviewReserve: number } };
const room2 = JSON.parse(readFileSync(new URL('./fixtures/defaultroot-proofroom2-rule40-2026-10-02.json', import.meta.url),
  'utf8')) as RecordedRoot;
/** The live sender's note, exactly: the recorded ten are reproduced by it (asserted below), and turns 11-20 continue it. */
const gardenLog = (n: number) => `Garden log ${String(n)}: today I checked bed ${String(n)}, watered for ${String(n + 4)} minutes, `
  + 'pulled a few weeds near the fence and noted that the soil looked a little dry by the afternoon. No reply needed beyond ok.';
const room2Id = (update: number) => `telegram:${room2.genesis.bot}:update:${String(update)}`;

function room2Shapes(): LiveShape {
  let jevCalls = 0;
  const recordedFor = <T extends { update: number }>(rows: readonly T[], update: number) =>
    rows.find(row => row.update === update) ?? rows.at(-1)!;
  return { now: room2.at, timeZone: 'America/Los_Angeles', model: 'claude-sonnet-5', concurrentWork: room2.concurrentWork,
    // The two runner-computed sources as the live runner sent them (the briefing itself is this checkout's).
    runtimeSources: room2.runtimeSources,
    replyNotices: () => [room2.notice],
    answer: (id, context) => {
      const packet = JSON.parse(context) as { audience?: unknown; summary?: { text: string };
        history?: { id: string; user: string; date: string }[] };
      if (id.startsWith('summary:') && id.endsWith(':review'))
        return JSON.stringify({ verdict: 'pass', reason: room2.summaryReviews.at(-1)!.reason });
      if (id.startsWith('summary:')) {
        // The recorded summary's shape: prose in the recorded wording, one memory item and one concept entry per
        // note in the span (the recorded quotes are the note less its label and its reply instruction), and the
        // recorded commitment while the credential reminder is in the span.
        const span = packet.history ?? [];
        const quote = (text: string) => text.replace(/^Garden log \d+: /u, '').replace(/\. No reply needed beyond ok\.$/u, '');
        const prose = ['Summary: Operator posted garden logs in main chat, each saying no reply needed beyond ok, and I replied Ok each time (all accepted by Telegram).',
          ...span.map(item => { const n = /Garden log (\d+)/u.exec(item.user)?.[1] ?? '?';
            return `Log ${n} (${item.date}, #${item.id.split(':').at(-1)!}): bed ${n}, watered for ${String(Number(n) + 4)} minutes, weeds pulled near the fence, soil a little dry by the afternoon.`; })].join(' ');
        return JSON.stringify({ summary: prose, people: [], memory: [], questions: [],
          memoryItems: span.map(item => ({ source: item.id, quote: quote(item.user) })),
          concepts: span.map(item => ({ source: item.id, terms: ['garden log', `bed ${/Garden log (\d+)/u.exec(item.user)?.[1] ?? ''}`,
            'watering', 'weeding', 'soil moisture'] })),
          commitments: span.some(item => item.id === room2Id(room2.turns[0]!.update))
            ? room2.summaries[0]!.commitments.map(item => ({ ...item, source: room2Id(room2.turns[0]!.update) })) : [] });
      }
      if (!packet.audience) return JSON.stringify({ reply: 'Nothing further to report on that.', memory: [], dated: [] });
      // The recorded decision for the recorded update; every later note gets the third note's (a `prefer` item).
      const update = Number(id.split(':').at(-1)), recorded = recordedFor(room2.answers, update);
      const text = gardenLog(update - room2.turns[0]!.update + 1);
      return JSON.stringify({ reply: recorded.modelReply,
        memory: recorded.memory.map(item => ({ mode: item.mode, source: id, quote: item.quote })),
        dated: recorded.dated.map(item => ({ source: id, quote: text.replace(/ No reply needed beyond ok\.$/u, ''),
          when: item.when, zone: item.zone, day: item.day })) });
    },
    jevScore: rule => room2.replyChecks[Math.min(Math.floor(jevCalls++ / Object.keys(jevQuestions).length),
      room2.replyChecks.length - 1)]!.jevScores[rule] ?? 0.01,
    review: id => { const findings = recordedFor(room2.replyChecks, Number(id.split(':').at(-1))).review.findings;
      return { verdict: 'pass', ruleIds: [], reason: findings.map(item => `${item.rule}: ${item.reason}`).join('\n'), findings }; } };
}

it('keeps answering a default-size root through the live recorded shapes that silenced room two', async () => {
  const limit = PREVIEW_LIVE_LIMITS.contextBytes;
  expect(room2.maxBytes).toBe(limit);
  expect(room2.turns.map(turn => turn.text)).toEqual(room2.turns.map((_, index) => gardenLog(index + 1)));
  const first = room2.turns[0]!.update;
  const run = await conversation(limit, Array.from({ length: 20 }, (_, index) => gardenLog(index + 1)), new Map(),
    room2.genesis, Array.from({ length: 20 }, (_, index) => first + index), room2Shapes());
  for (const turn of run.report) {
    expect(turn.sent, `turn ${String(turn.n)}: held ${turn.held ?? '-'} notice ${turn.notice ?? '-'}`).toBe(true);
    expect(turn.held, `turn ${String(turn.n)}`).toBeUndefined();
    expect(turn.notice, `turn ${String(turn.n)}`).toBeUndefined();
  }
  // A fresh root's first turn fits beside the reply-review reserve with the full obligation guide. Within a few
  // notes the full guide no longer does (live, from the fourth note on): those turns set history aside and carry the
  // guide's floor form, which keeps them beside the reserve too, where before they reached the last rung. That rung
  // stays exercised by the declaration-duty test below.
  const room = limit - replyReviewReserveFor(limit);
  expect(run.report[0]!.answerTotal).toBeLessThanOrEqual(room);
  const pressed = run.report.filter(turn => turn.setAside);
  expect(pressed.length).toBeGreaterThan(0);
  for (const turn of pressed) expect(turn.answerTotal, `turn ${String(turn.n)}`).toBeLessThanOrEqual(room);
  expect(pressed.every(turn => turn.keys.includes('obligationDecision'))).toBe(true);
  for (const turn of run.report) expect(turn.answerTotal, `turn ${String(turn.n)}`).toBeLessThanOrEqual(limit);
  // Every recorded Jev verdict was unsure, so every reply went to the full-context review. The reserve sizes the
  // review for a 4096-byte reply; with the recorded short replies a last-rung turn's review still builds and runs,
  // so yielding the reserve did not turn these reviews into unavailable ones.
  expect(run.reviews.length).toBe(20);
  expect(run.reviews.filter(review => !review.built)).toEqual([]);
  // The operator stated the same reply preference on every note: each statement stays recorded (Rule 7), and the
  // packet carries it once.
  expect(run.preferStatements).toBeGreaterThanOrEqual(18);
  const lastPacket = JSON.parse(run.answerPackets.at(-1)!) as { preferences?: unknown[]; memoryCandidates?: { id: string }[] };
  expect(lastPacket.preferences).toHaveLength(1);
  // Nothing was deleted: the first note is still in the journal verbatim.
  expect(run.firstText).toBe(gardenLog(1));
}, 300_000);

/** Live 2026-10-03 (proof room one, build cint-L38b 5257ddcf, a default-size root filled by the same Rule 40 garden
 * script as room two): "From now on, end every gift list with "— D60"." drew "Got it — from now on I'll end every gift
 * list with "— D60"", yet no directive was recorded, and the next cannot-do reply drew the reply check's
 * unrecorded_blocker. The recorded packets (lanes/w3-floorduty-PROGRESS.md) carried no obligation guide at all: under
 * byte pressure the ladder dropped it whole, so the model had nowhere to declare a directive or a blocker and said so in
 * its recorded reasoning. Replayed here after room two's twenty recorded notes, which reach the same pressure, with the
 * four recorded room-one messages and the REAL claude-sonnet-5 outputs on those recorded packets once they carried the
 * guide's floor form (observer #106). */
const room1 = JSON.parse(readFileSync(new URL('./fixtures/floorduty-proofroom1-rule40-2026-10-03.json', import.meta.url),
  'utf8')) as { maxBytes: number; turns: { update: number; text: string;
    live: { obligationDecision: boolean; historySetAside: boolean }; realModel: { output: string } }[] };

it('keeps the declaration duty in every packet of a default-size root under byte pressure', async () => {
  const limit = PREVIEW_LIVE_LIMITS.contextBytes;
  expect(room1.maxBytes).toBe(limit);
  // The recorded failure: every one of these live packets had set history aside and carried no obligation guide.
  expect(room1.turns.every(turn => !turn.live.obligationDecision && turn.live.historySetAside)).toBe(true);
  const first = room2.turns[0]!.update, shapes = room2Shapes();
  const extra = new Map(room1.turns.map((turn, index) => [first + 20 + index, turn]));
  const run = await conversation(limit, [...Array.from({ length: 20 }, (_, index) => gardenLog(index + 1)),
    ...room1.turns.map(turn => turn.text)], new Map(), room2.genesis,
  Array.from({ length: 24 }, (_, index) => first + index), { ...shapes,
    answer: (id, context) => extra.get(Number(id.split(':').at(-1)))?.realModel.output ?? shapes.answer(id, context) });
  const tail = run.report.slice(20);
  for (const turn of tail) expect(turn.sent, `turn ${String(turn.n)}: held ${turn.held ?? '-'} notice ${turn.notice ?? '-'}`).toBe(true);
  // Every answer packet carried a way to declare: the full guide while it fits, its floor form under pressure.
  const guides = run.answerPackets.map(packet => (JSON.parse(packet) as { obligationDecision?: string }).obligationDecision);
  expect(guides.filter(guide => guide !== OBLIGATION_DECISION && guide !== OBLIGATION_DECISION_FLOOR)).toEqual([]);
  // The replayed room-one turns ran under the same pressure as live (history set aside). The directive turn is the floor
  // path: its full guide no longer fits beside the reply-review reserve, so the floor form keeps the duty and the reserve.
  const replayed = run.answerPackets.slice(-4).map(packet => JSON.parse(packet) as Record<string, unknown>);
  expect(replayed.every(packet => 'historySetAside' in packet)).toBe(true);
  expect(replayed[0]!.obligationDecision).toBe(OBLIGATION_DECISION_FLOOR);
  expect(tail[0]!.answerTotal).toBeLessThanOrEqual(limit - replyReviewReserveFor(limit));
  // The longer recorded cannot-do turns still reach the last rung (the reserve yields), and keep a guide there too.
  expect(tail.some(turn => turn.answerTotal > limit - replyReviewReserveFor(limit))).toBe(true);
  // Both sides of the decision: the standing instruction is recorded; the cannot-do claims become settled blockers;
  // the plain question declares nothing.
  expect(run.directives).toEqual(['end every gift list with "— D60".']);
  expect(room1.turns[0]!.text).toContain(run.directives[0]!);
  expect(run.blockers).toHaveLength(2);
  expect(run.blockers.every(claim => claim.startsWith('I can\'t'))).toBe(true);
}, 300_000);
