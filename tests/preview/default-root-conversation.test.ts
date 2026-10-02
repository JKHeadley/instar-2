import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SOURCE_PINS, deskStatusSource, sourcePacket } from './briefing.js';
import { disciplineSource } from './retrospective.js';
import { selfStateBrief, selfStateSource } from './self-state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { MEMORY_ITEM_SHAPE, PREVIEW_LIVE_LIMITS, PREVIEW_MIN_TURN_HEADROOM_BYTES, SUMMARY_MAX_PROMPT_BYTES,
  concurrentWorkItem, createJournalWorker, openPreviewJournal, replyReviewReserveFor } from './journal.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { jevQuestions } from './reply-check.js';
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
  updateIds?: readonly number[]) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-default-root-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', ...identity,
      // Context bytes are the launcher's default; only the spend allowance is raised (see the header note).
      expires: 9_999_999_999_999, maxCalls: 200, maxReplies: 60, maxTurns: 60, maxBytes, cursor: 0 });
    const briefing = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: journal.view.limits.maxCalls, expiresAt: journal.view.expires }).sources;
    const runs = { launches: [{ at: now - 60_000, pid: 1 }], exits: [] };
    const desk = { text: `# desk\n${'Preview work remains a supervised private chat trial with a reviewed activation.\n'.repeat(40)}`,
      modifiedAt: now };
    const sources = () => [...briefing, disciplineSource(journal.view),
      selfStateSource(selfStateBrief(journal.view, runs as never, now, 'UTC', now - 60_000)),
      deskStatusSource(desk, now, DESK_PATH)];
    const answerPackets: string[] = [], answerSizes: number[] = [], summarySizes: number[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, sources,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', journal.view.genesis.grant, now,
        journal.view.limits.maxBytes),
      concurrentWork: () => concurrentWorkItem({ now, others: [], scanned: 1, truncated: false, unreadable: 0,
        current: { owner: 'preview-root', launch: now - 60_000,
          conversation: `telegram/bot-${identity.bot}/chat-${identity.chat}` } }),
      model: async input => {
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
        jev: async (_text, questions) => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
          Object.keys(questions ?? jevQuestions).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 10 }),
        escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 10 }) } });
    const report: TurnReport[] = [];
    for (const [index, text] of texts.entries()) {
      worker.intake([{ update_id: updateIds?.[index] ?? index + 1,
        message: { chat: { id: Number(identity.chat), type: 'private' }, from: { id: Number(identity.operator) },
          date: Math.floor(now / 1000) + index, text } }]);
      await worker.drain();
      await worker.summarizeIfNeeded();
      const turn = journal.view.order.at(-1)!;
      const packet = JSON.parse(answerPackets.at(-1) ?? '{}') as Record<string, unknown>;
      report.push({ n: index + 1, sent: turn.sent !== undefined, held: turn.held, notice: turn.noticeClass,
        answerTotal: answerSizes.at(-1) ?? 0, keys: Object.keys(packet), setAside: 'historySetAside' in packet });
    }
    const result = { report, summarySizes, answerPackets: [...answerPackets],
      summaries: journal.view.summaries.map(item => item.text),
      preferences: journal.view.memory.filter(item => item.mode === 'prefer').map(item => item.quote),
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
  // Every summary step fit its own ceiling, which does not scale with the context limit.
  expect(run.summarySizes.length).toBeGreaterThan(0);
  for (const size of run.summarySizes) expect(size).toBeLessThanOrEqual(SUMMARY_MAX_PROMPT_BYTES);
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
