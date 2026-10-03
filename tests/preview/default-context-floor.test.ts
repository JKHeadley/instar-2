import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SOURCE_PINS, deskStatusSource, sourcePacket } from './briefing.js';
import { disciplineSource } from './retrospective.js';
import { readRuns, selfStateBrief, selfStateSource } from './self-state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { PREVIEW_FIXED_PROMPT_BYTES, PREVIEW_LIVE_LIMITS, PREVIEW_MIN_SERVABLE_CONTEXT_BYTES,
  PREVIEW_MIN_TURN_HEADROOM_BYTES, PREVIEW_REPLY_BOUND_BYTES, REPLY_REVIEW_FIXED_BYTES,
  concurrentWorkItem, createJournalWorker, declaredObligations, openPreviewJournal, replyReviewReserveFor,
  OBLIGATION_DECISION, OBLIGATION_DECISION_TOOLS, previewCapabilities,
  unservableContextReason } from './journal.js';
import { jevQuestions, replyReviewContext, replyReviewQuestion } from './reply-check.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { OFFLINE_STORAGE_KEY, offlineProfile, successiveWorld } from './successive-fixture.js';

/** Why this file exists: live 2026-10-01, room two was created at the launcher's then-default
 * `--max-context-bytes 32768`. It answered one message and held the next -- recorded packet 21448 of
 * 32768 with one optional item already dropped, `heldRepliesToday` reason "summary unavailable: prompt
 * overflow", twelve later turns unanswered. The parts every answer carries already filled the limit, so
 * no summary or set-aside could make room. These two tests hold the two halves of the repair: the fixed
 * parts may not outgrow what the default allows, and a doorway may not create a root below the floor. */

const key = new Uint8Array(32).fill(41);
const now = 1_790_500_000_000;
const bytes = (value: string) => Buffer.byteLength(value);
/** A fixed path so the cut desk report's own label cannot move the measurement. */
const DESK_PATH = '/offline/desk-status.md';

/** One fresh root, one ordinary operator turn, the real briefing from this checkout, reply review wired
 * and the concurrent-work row a live runner always sends. Returns what the provider would receive. */
async function firstTurn(maxBytes: number, tools = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-default-floor-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9_999_999_999_999, maxCalls: PREVIEW_LIVE_LIMITS.calls, maxReplies: PREVIEW_LIVE_LIMITS.replies,
      maxTurns: PREVIEW_LIVE_LIMITS.turns, maxBytes, cursor: 0 });
    const briefing = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: journal.view.limits.maxCalls, expiresAt: journal.view.expires, tools }).sources;
    const runs = { launches: [{ at: now - 60_000, pid: 1 }], exits: [] };
    // Larger than its cut bound, so the measured shape is the one every answer carries under pressure.
    const desk = { text: `# desk\n${'Preview work remains a supervised private chat trial with a reviewed activation.\n'.repeat(40)}`,
      modifiedAt: now };
    const sources = () => [...briefing, disciplineSource(journal.view),
      selfStateSource(selfStateBrief(journal.view, runs as never, now, 'UTC', now - 60_000)),
      deskStatusSource(desk, now, DESK_PATH)];
    let answer: { context: string; prepared: string } | undefined;
    let summary: { context: string; prepared: string } | undefined;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, sources,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', journal.view.genesis.grant, now,
        journal.view.limits.maxBytes),
      toolRoute: () => tools,
      concurrentWork: () => concurrentWorkItem({ now, others: [], scanned: 1, truncated: false, unreadable: 0,
        current: { owner: 'preview-root', launch: now - 60_000, conversation: 'telegram/bot-12345678/chat-7654321' } }),
      model: async input => {
        const row = { context: input.context, prepared: String(input.prepared ?? '') };
        if (input.id.startsWith('summary:')) { summary ??= row;
          return JSON.stringify({ summary: 'The operator asked about the preview\'s state.', people: [],
            commitments: [], memory: [], questions: [] }); }
        answer ??= row;
        return JSON.stringify({ reply: 'A short preview answer.', memory: [], dated: [] });
      },
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      send: async () => 1, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100,
        // Answers whichever question set it is given (the reply rules, or the summary-integrity question),
        // so the reply review and the summary's own checks are both real rather than silently unavailable.
        jev: async (_text, questions) => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
          Object.keys(questions ?? jevQuestions).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 10 }),
        escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 10 }) } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      date: Math.floor(now / 1000), text: 'What is the state of the preview right now?' } }]);
    await worker.drain();
    await worker.summarizeIfNeeded(true);
    const turn = journal.view.order.at(-1)!;
    const total = (row: { prepared: string } | undefined) => row === undefined ? null
      : bytes(row.prepared) + bytes(tools ? SUBSCRIPTION_TOOLS_SYSTEM_PROMPT : SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
    // What the reply review of THIS turn would really send: the same answer prompt rebuilt as the review's
    // own input, with a candidate reply at the send path's own bound. This is what the reserve must cover.
    const reviewTotal = answer === undefined ? null
      : bytes(prepareJournalEnvelope({ question: replyReviewQuestion([]),
        context: replyReviewContext(answer.prepared, 'x'.repeat(PREVIEW_REPLY_BOUND_BYTES), [],
          declaredObligations(journal.view, turn.id, now)), id: `${turn.id}:reply-review`,
        writer: { id: 'runner', kind: 'system', adapter: 'preview' } }, 'claude-opus-5-5',
      journal.view.genesis.grant, now, 10_000_000)) + bytes(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
    const deskText = answer === undefined ? '' : ((JSON.parse(answer.context) as
      { sources?: { id: string; text: string }[] }).sources ?? []).find(item => item.id === 'desk-status')?.text ?? '';
    const result = { sent: turn.sent !== undefined, held: turn.held, notice: turn.noticeClass,
      answerTotal: total(answer), summaryTotal: total(summary), reviewTotal,
      deskCut: deskText.includes('[cut for space'),
      keys: answer === undefined ? [] : Object.keys(JSON.parse(answer.context) as object),
      packet: answer === undefined ? null : JSON.parse(answer.context) as { capabilities?: { externalTools?: string };
        obligationDecision?: string; governingConstraints?: Record<string, string> } };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('keeps the always-sent prompt parts inside what the measured floor allows, with its reply review beside them', async () => {
  // Measured at the floor, not at the default: there the room is exactly the fixed parts, so the ladder is
  // forced to the shape that is ALWAYS present -- desk report at its cut bound, obligation guide intact --
  // which is what `PREVIEW_FIXED_PROMPT_BYTES` records. At the default the whole desk report now fits
  // instead (the second test below), so measuring there would measure a variable shape.
  const floor = PREVIEW_MIN_SERVABLE_CONTEXT_BYTES;
  const measured = await firstTurn(floor);
  expect(measured.sent).toBe(true);
  expect(measured.held).toBeUndefined();
  expect(measured.notice).toBeUndefined();
  expect(measured.answerTotal).not.toBeNull();
  expect(measured.deskCut).toBe(true);
  // Nothing the ladder can drop was dropped: the briefing, the decision guidance and the
  // concurrent-work row are all still there, so this is the whole always-sent shape.
  for (const required of ['sources', 'obligationDecision', 'governingConstraints', 'capabilities',
    'memoryDecision', 'datedDecision', 'concurrentWork', 'audience'])
    expect(measured.keys, required).toContain(required);
  // The drift guard. `PREVIEW_FIXED_PROMPT_BYTES` is the recorded measurement; if a longer system
  // prompt, rule row, briefing excerpt or guidance block pushes the real parts past it, this fails
  // here rather than in a live chat that answers once and goes quiet. A trim lowers the constant.
  expect(measured.answerTotal!).toBeLessThanOrEqual(PREVIEW_FIXED_PROMPT_BYTES);
  // And the parts must fit beside the reply review's own room at the floor, by the same inequality the
  // answer path applies.
  expect(PREVIEW_FIXED_PROMPT_BYTES).toBeLessThanOrEqual(floor - replyReviewReserveFor(floor));
  // The reserve is sized from what the review really needs, so the review of THIS turn -- with a candidate
  // reply at the send path's own bound -- fits in the room the reserve sets aside. This is the half the flat
  // 8192 only guessed at: measured here, it is 6636 (4096 reply bound + 2540 review-only parts; 6775 at cint-L25).
  expect(measured.reviewTotal).not.toBeNull();
  expect(measured.reviewTotal! - measured.answerTotal!).toBeLessThanOrEqual(replyReviewReserveFor(floor));
  expect(measured.reviewTotal! - measured.answerTotal!)
    .toBeLessThanOrEqual(PREVIEW_REPLY_BOUND_BYTES + REPLY_REVIEW_FIXED_BYTES);
  // Both halves of the reserve are real, not padding: a review with a bound-length reply needs more than
  // the review-only parts alone, so neither addend can be dropped.
  expect(measured.reviewTotal! - measured.answerTotal!).toBeGreaterThan(REPLY_REVIEW_FIXED_BYTES);
  // A summary step for that same turn also fits, so a conversation can be compacted at the floor.
  expect(measured.summaryTotal).not.toBeNull();
  expect(measured.summaryTotal!).toBeLessThanOrEqual(floor - replyReviewReserveFor(floor));
  // The default is admissible: at or above the floor, and within the approved live bound.
  expect(PREVIEW_MIN_SERVABLE_CONTEXT_BYTES).toBeLessThanOrEqual(PREVIEW_LIVE_LIMITS.contextBytes);
  expect(unservableContextReason(PREVIEW_LIVE_LIMITS.contextBytes)).toBeNull();
}, 60_000);

it('leaves a fresh root at the default limit real room for the message and its history', async () => {
  // The repair's measurable claim. Before: 32768 - 8192 reserve - 23013 parts = 1563 bytes for the operator's
  // message and ALL of its history, and the packet dropped the obligation guide from the third turn onward.
  // After (re-measured at cint-L25): 32768 - 6775 - 22959 = 3034; at cint-L27 32768 - 6636 - 22959 = 3173. The whole
  // desk report fits at the first turn.
  const limit = PREVIEW_LIVE_LIMITS.contextBytes;
  const headroom = limit - replyReviewReserveFor(limit) - PREVIEW_FIXED_PROMPT_BYTES;
  expect(headroom).toBeGreaterThanOrEqual(PREVIEW_MIN_TURN_HEADROOM_BYTES);
  // The reserve is the derived one, not a quarter of the limit: at 32768 the quarter is 8192 and this is less.
  expect(replyReviewReserveFor(limit)).toBe(PREVIEW_REPLY_BOUND_BYTES + REPLY_REVIEW_FIXED_BYTES);
  expect(replyReviewReserveFor(limit)).toBeLessThan(Math.floor(limit / 4));
  // The quarter still binds on a small root, so a tiny limit is not handed a reserve larger than itself.
  expect(replyReviewReserveFor(4096)).toBe(1024);
  // And the real turn at the default is answered with the full shape, the whole desk report included.
  const measured = await firstTurn(limit);
  expect(measured.sent).toBe(true);
  expect(measured.held).toBeUndefined();
  expect(measured.notice).toBeUndefined();
  expect(measured.deskCut).toBe(false);
  for (const required of ['sources', 'obligationDecision', 'governingConstraints', 'capabilities',
    'memoryDecision', 'datedDecision', 'concurrentWork', 'audience'])
    expect(measured.keys, required).toContain(required);
  expect(measured.answerTotal!).toBeLessThanOrEqual(limit - replyReviewReserveFor(limit));
}, 60_000);

it('states the floor from the measured parts and refuses a limit below it on both sides', async () => {
  // The derivation, not a chosen number: the least limit that leaves the fixed parts room beside the reserve.
  expect(PREVIEW_MIN_SERVABLE_CONTEXT_BYTES - replyReviewReserveFor(PREVIEW_MIN_SERVABLE_CONTEXT_BYTES))
    .toBeGreaterThanOrEqual(PREVIEW_FIXED_PROMPT_BYTES);
  const below = PREVIEW_MIN_SERVABLE_CONTEXT_BYTES - 1;
  expect(below - replyReviewReserveFor(below)).toBeLessThan(PREVIEW_FIXED_PROMPT_BYTES + 3);
  // Both sides of the decision boundary, with the reason naming the measurement and the required value.
  expect(unservableContextReason(PREVIEW_MIN_SERVABLE_CONTEXT_BYTES)).toBeNull();
  expect(unservableContextReason(4096)).toContain(String(PREVIEW_FIXED_PROMPT_BYTES));
  expect(unservableContextReason(4096)).toContain(String(PREVIEW_MIN_SERVABLE_CONTEXT_BYTES));
  expect(unservableContextReason(below)).toContain('cannot serve one ordinary turn');
  expect(unservableContextReason(0)).not.toBeNull();
  expect(unservableContextReason(1.5)).not.toBeNull();
  // Below the floor the parts really do not fit: the ladder has to drop the obligation guide to get under.
  const squeezed = await firstTurn(PREVIEW_MIN_SERVABLE_CONTEXT_BYTES - 1024);
  expect(squeezed.keys).not.toContain('obligationDecision');
}, 60_000);

it('refuses an unservable limit at the real launcher, at genesis and when caps are re-declared', () => {
  const world = successiveWorld(), root = join(world.directory, 'floor-journal');
  const activation = world.activation();
  const activationPath = join(world.directory, 'activation.json'), profilePath = join(world.directory, 'profile.json');
  const ioPath = join(world.directory, 'io.mjs'), loaderPath = join(world.directory, 'loader.mjs');
  writeFileSync(activationPath, JSON.stringify(activation));
  writeFileSync(profilePath, JSON.stringify(offlineProfile));
  writeFileSync(ioPath, `export { productionStorageIO, createSubscriptionProviderIO } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'scripts/production-boot-io.mjs')).href)};
export const createProductionTelegramIO = () => ({ invoke(input) {
  if (input.method === 'getMe') return { kind: 'identity', identity: { id: ${world.configuration.botId} } };
  if (input.method === 'getUpdates') return { kind: 'response', status: 200, bytes: '{"ok":true,"result":[]}' };
  throw Error('unexpected outbound dispatch');
} });`);
  writeFileSync(loaderPath, `export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-boot-io.mjs'))
    return { url: ${JSON.stringify(pathToFileURL(ioPath).href)}, shortCircuit: true };
  return next(specifier, context);
}`);
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
  const agent = (...rest: string[]) => spawnSync(process.execPath, ['--no-warnings',
    '--loader', './scripts/slice-ts-loader.mjs', '--loader', loaderPath, 'tests/preview/journal-agent.mjs', ...rest],
  { cwd: process.cwd(), env, encoding: 'utf8', timeout: 60_000 });
  const run = (...extra: string[]) => agent('run', '--root', root,
    '--bot-id', world.configuration.botId, '--bot-username', world.configuration.botUsername,
    '--chat-id', world.configuration.chatId, '--operator-sender-id', world.configuration.operatorSenderId,
    '--grant-reference', activation.trial, '--configuration-digest', activation.baseConfigurationDigest,
    '--expires-at', String(activation.expiresAt), '--activation-record', activationPath,
    '--operator-records', join(world.directory, 'operator-records'),
    '--login-profile', profilePath, '--model', world.model, '--max-cycles', '1', ...extra);

  const refused = run('--max-context-bytes', '4096');
  expect(refused.status, refused.stderr).not.toBe(0);
  // Refused before creation, so no unservable root is left behind.
  expect(existsSync(join(root, 'journal.encrypted'))).toBe(false);
  // The launcher keeps stderr terse by design; the plain reason is the durable refusal record.
  const recorded = readRuns(join(root, 'runs.jsonl')).launches.map(row => row.refused ?? '').join(' ');
  expect(recorded).toContain('cannot serve one ordinary turn');
  expect(recorded).toContain(String(PREVIEW_MIN_SERVABLE_CONTEXT_BYTES));

  // The positive neighbour: the default (which the launcher now takes from the approved live bound) is served.
  const accepted = run();
  expect(accepted.status, accepted.stderr).toBe(0);
  expect(existsSync(join(root, 'journal.encrypted'))).toBe(true);

  // Re-declaring the limit below the floor is refused too, and names the flag that would fix it.
  const lowered = agent('raise-caps', '--root', root, '--max-context-bytes', '8192',
    '--authority', 'offline test authority');
  expect(lowered.status, lowered.stderr).not.toBe(0);
  const after = agent('status', '--root', root);
  expect(after.status, after.stderr).toBe(0);
  expect((JSON.parse(after.stdout) as { limits: { maxBytes: number } }).limits.maxBytes)
    .toBe(PREVIEW_LIVE_LIMITS.contextBytes);
  rmSync(world.directory, { recursive: true, force: true });
}, 180_000);

it('keeps a tool turn\'s always-sent parts inside the same measured floor (Part Thirteen §9, docs/17-harness-adapters)', async () => {
  // The tool briefing line replaces the no-tools line at no more bytes, so the packet ladder keeps the whole
  // always-sent shape at the floor. The tool system prompt is longer than the conversation one (measured:
  // SYSTEM_GROWTH below); the tool route's room is max(maxBytes, the policy's 32768), so at the floor the
  // prompt still fits with room to spare, and above it the runner's envelope reserves the difference.
  const floor = PREVIEW_MIN_SERVABLE_CONTEXT_BYTES;
  const plain = await firstTurn(floor), tools = await firstTurn(floor, true);
  expect(tools.sent).toBe(true);
  for (const required of ['sources', 'obligationDecision', 'governingConstraints', 'capabilities',
    'memoryDecision', 'datedDecision', 'concurrentWork', 'audience'])
    expect(tools.keys, required).toContain(required);
  const growth = bytes(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) - bytes(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
  // 603 at w4-toolsreal round 0; +20 when the sentence stopped claiming deletes are refused (they are inside the scratch volume);
  // 906 at w4-toolsfull, whose sentence names the web reads, the subagent bound and the effect doorway; 971 at w4-persist,
  // whose workspace sentence says files stay for later turns and that the current context outranks the kept session.
  expect(growth).toBe(971);
  // The packet names what the call really has (review round 1, finding 5): the text-only route keeps the no-tools read and
  // its "attempted nothing" guidance; the tool route says the tools are as listed and that only its recorded calls ran.
  expect(plain.packet?.capabilities?.externalTools).toBe('none');
  expect(plain.packet?.obligationDecision).toBe(OBLIGATION_DECISION);
  expect(plain.packet?.governingConstraints?.['no-tools']).toBe('no external tools or accounts');
  expect(tools.packet?.capabilities).toEqual(previewCapabilities(true));
  expect(tools.packet?.capabilities?.externalTools).toBe('as listed');
  expect(tools.packet?.obligationDecision).toBe(OBLIGATION_DECISION_TOOLS);
  expect(tools.packet?.obligationDecision).not.toContain('You attempted nothing outside this reply');
  expect(tools.packet?.governingConstraints?.['no-tools']).toBe('listed tools; no account writes');
  const plainPacket = plain.answerTotal! - bytes(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
  const toolsPacket = tools.answerTotal! - bytes(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  expect(toolsPacket).toBeLessThanOrEqual(plainPacket);
  expect(tools.answerTotal!).toBeLessThanOrEqual(PREVIEW_FIXED_PROMPT_BYTES + growth);
  expect(tools.answerTotal!).toBeLessThanOrEqual(Math.max(floor, 32768));
}, 60_000);
