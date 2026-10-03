/** The guidance sentinel family (Part 18 §16), proved on recorded live shapes (Rule 106 / observer #106).
 *
 * The fixture is captured from a COPY of Justin's live preview journal (never the live root), by the capture case at
 * the bottom of this file. It holds every reviewed turn's recorded checks and send record (reasons kept only on the
 * named turns), the operator's recorded preference statements, and real full-context reviewer outputs on recorded
 * answer packets with this branch's question selection. Every assertion below replays those recorded bytes through
 * this branch's code. Constructed inputs appear only as additional both-sides checks, each named as such. */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GUIDANCE_FAMILY, guidanceQuality, guidanceReport, guidanceVerdicts, preferenceRecurrences } from './guidance.js';
import { CONTEXT_RULES, REPLY_RULES, exciseNamedClaims, guidanceReviewRules, jevQuestions, parseReplyReviewVerdict, quotedSpans,
  replyReviewContext, replyReviewQuestion, reviewReply, segmentCarries, type ReplyCheckPorts, type ReplyRule } from './reply-check.js';
import type { Turn } from './journal.js';
import { conclusionText } from './model-json.js';

const FIXTURE = resolve(process.cwd(), 'tests/preview/fixtures/guidance-live-2026-10-03.json');
type Sample = { scenario: string; update: number; rules: ReplyRule[]; model: string; promptSha256: string; raw: string };
type Fixture = { source: string; turns: Turn[]; memory: { mode: string; source: string; quote: string; in?: string }[];
  samples: Sample[] };
const fixture = (): Fixture => JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture;
const turn = (data: Fixture, update: number) => data.turns.find(item => item.update === update)!;
const body = (candidate: string) => candidate.replace(/^PREVIEW — /u, '');

describe('P14-NF-70: the family is the one reply review, never a second gate', () => {
  it('every member names only reply-review questions, and no question belongs to two members', () => {
    const all = GUIDANCE_FAMILY.flatMap(member => member.rules);
    expect(new Set(all).size).toBe(all.length);
    for (const rule of all) expect(Object.hasOwn(REPLY_RULES, rule)).toBe(true);
    // The credential question is the reply review's floor (Rule 4), not a guidance member.
    expect(all).not.toContain('credential');
    expect(GUIDANCE_FAMILY.map(member => member.id)).toEqual(['tone-self-stop', 'deferral', 'claim-verification', 'correction-learning', 'sensitivity']);
  });
  it('the context questions are never asked of Jev, and ride every contextual review that runs', () => {
    for (const rule of CONTEXT_RULES) expect(Object.hasOwn(jevQuestions, rule)).toBe(false);
    // The sensitivity member's audience question is never asked of Jev either (sensitivity.test.ts).
    expect(Object.keys(jevQuestions)).toHaveLength(Object.keys(REPLY_RULES).length - CONTEXT_RULES.length - 1);
    expect(guidanceReviewRules(['defers_work'])).toEqual(['defers_work', 'self_state_claim', 'breaks_preference']);
    expect(guidanceReviewRules(['self_state_claim'])).toEqual(['self_state_claim', 'breaks_preference']);
    expect(replyReviewQuestion(guidanceReviewRules(['credential']))).toContain('packet.declaredObligations is what the runner admitted');
  });
  it('the review call carries the context questions in its one batched call (constructed ports)', async () => {
    const seen: (readonly ReplyRule[] | undefined)[] = [];
    const ports: ReplyCheckPorts = { jev: async () => ({ value: null, latencyMs: 1 }),
      escalate: async (_text, _id, _prompt, rules) => { seen.push(rules); return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 1 }; },
      reserveEscalation: () => true, record: () => undefined, elapsedMs: () => 0 };
    expect((await reviewReply('PREVIEW — reply', 'turn', ports, ['defers_work'])).outcome).toBe('pass');
    expect(seen).toEqual([['defers_work', 'self_state_claim', 'breaks_preference']]);
  });
});

describe('P14-NF-72/73/74/75: recorded live shapes (fixture captured from a copy of the live journal)', () => {
  it('tone and self-stop: the 22:36 false cannot-do (update 969390016) fired, and its correction never landed', () => {
    const data = fixture(), recorded = turn(data, 969390016);
    expect(recorded.answer).toMatch(/^I can't raise my own model-call limit/u);
    const verdict = guidanceVerdicts([recorded]).find(item => item.member === 'tone-self-stop')!;
    // The capture kept no send receipt, so the recorded selection (unlocated) is not claimed as delivered.
    expect(verdict).toMatchObject({ verdict: 'fired', rules: ['unrecorded_blocker'], decisions: ['no-decision'], landing: 'no-receipt', selected: 'unlocated' });
    expect(recorded.revision?.state).toBe('uncertain');
  });
  it('the named claim the reviewer elided is now located, so the recorded judgment lands (969390016)', () => {
    const recorded = turn(fixture(), 969390016);
    const claims = recorded.replyChecks!.flatMap(check => check.findings ?? []).filter(finding => finding.verdict === 'violation')
      .flatMap(finding => quotedSpans(finding.reason));
    expect(claims).toEqual(["I can't raise my own model-call limit... not something I have authority or tools to change myself"]);
    expect(recorded.release?.withheld?.unlocated).toEqual(claims);
    const cut = exciseNamedClaims(body(recorded.reviewCandidate!), claims);
    expect(cut.unlocated).toEqual([]);
    expect(cut.removed).toHaveLength(1);
    expect(cut.removed[0]).toMatch(/^I can't raise my own model-call limit/u);
    expect(cut.text).toMatch(/^If you want it raised now/u);
  });
  it('a quote ending on a comma where the reply ends its sentence is located (969390038)', () => {
    const recorded = turn(fixture(), 969390038);
    const unlocated = recorded.release!.withheld!.unlocated;
    expect(unlocated).toEqual(['I still can\'t raise my own model-call limit — I have no authority or tools to do that myself,']);
    const cut = exciseNamedClaims(body(recorded.reviewCandidate!), unlocated);
    expect(cut.unlocated).toEqual([]);
    expect(cut.text).toMatch(/^The earlier proposal I surfaced/u);
    expect(cut.text).toContain('passing along a fresh request below for your approval');
  });
  it('a paraphrased quote still locates nothing: code removes only what was named verbatim (969389954)', () => {
    const recorded = turn(fixture(), 969389954);
    const unlocated = recorded.release!.withheld!.unlocated;
    expect(unlocated).toEqual(["can't check back with you later on my own"]);
    expect(exciseNamedClaims(body(recorded.reviewCandidate!), unlocated).removed).toEqual([]);
  });
  it('deferral: the untracked promise of 969389883 fired on the full-context review and the reply was held', () => {
    const verdicts = guidanceVerdicts([turn(fixture(), 969389883)]);
    expect(verdicts.find(item => item.member === 'deferral')).toMatchObject({ verdict: 'fired', rules: ['defers_work'], landing: 'held' });
    expect(verdicts.find(item => item.member === 'tone-self-stop')).toMatchObject({ verdict: 'clear' });
    // Before this branch the context questions were never asked.
    expect(verdicts.find(item => item.member === 'claim-verification')).toMatchObject({ verdict: 'not-asked' });
  });
  it('correction learning: the two-sentence preference was restated twice after it was on file', () => {
    const recurrences = preferenceRecurrences(fixture().memory);
    expect(recurrences).toEqual([{ quote: 'Your replies are too long — keep them to two sentences.',
      sources: ['telegram:8820318295:update:969389742', 'telegram:8820318295:update:969389767', 'telegram:8820318295:update:969389924'],
      restatements: 2 }]);
  });
  it('the whole recorded journal: per-member quality from durable history alone', () => {
    const data = fixture();
    const quality = guidanceQuality(guidanceVerdicts(data.turns));
    const tone = quality.find(item => item.member === 'tone-self-stop')!;
    const deferral = quality.find(item => item.member === 'deferral')!;
    // Recorded fact: the self-stop family fires, but its correction rarely reaches the sent reply.
    expect(tone.fired).toBeGreaterThan(0);
    // The capture predates receipt preservation: no correction is counted as delivered without a receipt.
    expect(tone.landing.revised + tone.landing.excised + tone.landing.unchanged + tone.landing.unlocated).toBe(0);
    const selected = guidanceVerdicts(data.turns).filter(item => item.member === 'tone-self-stop' && item.landing === 'no-receipt');
    expect(selected.length).toBe(tone.landing['no-receipt']);
    expect(selected.filter(item => item.selected !== 'revised' && item.selected !== 'excised').length)
      .toBeGreaterThan(selected.filter(item => item.selected === 'revised' || item.selected === 'excised').length);
    expect(deferral.fired).toBeGreaterThan(0);
    // The context questions were never asked on the recorded journal: no fabricated clear.
    for (const member of ['claim-verification', 'correction-learning'] as const) {
      const row = quality.find(item => item.member === member)!;
      expect(row.clear + row.fired + row.unconfirmed).toBe(0);
      expect(row.notAsked).toBe(row.replies);
    }
    const report = guidanceReport({ order: data.turns, memory: data.memory });
    expect(report.recurringPreferences).toEqual([{ sources: expect.any(Array), restatements: 2 }]);
    expect(JSON.stringify(report)).not.toContain('two sentences');
  });
});

describe('P14-NF-73/75: real reviewer outputs on recorded answer packets, this branch\'s selection', () => {
  // As the live launcher reads it: the Decision's conclusion value, an object serialized (conclusionText), then the verdict.
  const parsed = (sample: Sample) => {
    const decision = JSON.parse(sample.raw) as { conclusion: { value: unknown } };
    return parseReplyReviewVerdict(conclusionText(decision.conclusion.value)!, sample.rules);
  };
  it('each sample answered every selected question, context questions included, in the exact per-rule form', () => {
    const { samples } = fixture();
    expect(samples.map(sample => sample.update)).toEqual([969389923, 969389925, 969389883, 969390016, 969389926]);
    for (const sample of samples) {
      for (const rule of CONTEXT_RULES) expect(sample.rules).toContain(rule);
      expect(parsed(sample).findings!.map(finding => finding.rule).sort()).toEqual([...sample.rules].sort());
    }
  });
  it('correction learning fires on the recorded three-sentence reply after the preference (969389923), and not on the two-sentence one (969389925)', () => {
    const { samples } = fixture();
    const finding = (update: number, rule: ReplyRule) => parsed(samples.find(sample => sample.update === update)!)
      .findings!.find(item => item.rule === rule)!;
    expect(finding(969389923, 'breaks_preference').verdict).toBe('violation');
    expect(finding(969389925, 'breaks_preference').verdict).toBe('pass');
  });
  it('claim verification fires on a self-claim its own records contradict (969389926), and passes where they support it', () => {
    const data = fixture();
    const finding = (update: number) => parsed(data.samples.find(sample => sample.update === update)!)
      .findings!.find(item => item.rule === 'self_state_claim')!;
    // The live review of 969389926 ran (Jev unsure, then a full-context pass), so on this branch the same call carries the question.
    expect(turn(data, 969389926).replyChecks!.map(check => [check.path, check.verdict])).toEqual([['jev', 'unsure'], ['subscription', 'pass']]);
    expect(finding(969389926).verdict).toBe('violation');
    expect(finding(969389926).reason).toMatch(/overdue/u);
    // The automatic-raise detail of 969390016 and the requested-action note of 969389883 match their records.
    expect(finding(969390016).verdict).toBe('pass');
    expect(finding(969389883).verdict).toBe('pass');
  });
  it('a review verdict that drops a context question is a format miss, as before (recorded raw, one line removed)', () => {
    const sample = fixture().samples.find(item => item.update === 969389923)!;
    const decision = JSON.parse(sample.raw) as { conclusion: { value: string } };
    const short = decision.conclusion.value.split('\n').filter(line => !line.trim().startsWith('breaks_preference:')).join('\n');
    expect(() => parseReplyReviewVerdict(short, sample.rules)).toThrow('preview: review malformed');
  });
  it('the recorded {reply} wrapper (969389883) is read as its lines; a wrapper with any other field stays a format miss', () => {
    const sample = fixture().samples.find(item => item.update === 969389883)!;
    const value = (JSON.parse(sample.raw) as { conclusion: { value: unknown } }).conclusion.value as { reply: string };
    expect(Object.keys(value)).toEqual(['reply']);
    expect(parsed(sample).findings!.find(item => item.rule === 'defers_work')!.verdict).toBe('violation');
    expect(parsed(sample).findings!.find(item => item.rule === 'breaks_preference')!.verdict).toBe('violation');
    expect(() => parseReplyReviewVerdict(JSON.stringify({ ...value, memory: [] }), sample.rules)).toThrow('preview: review malformed');
    expect(() => parseReplyReviewVerdict(JSON.stringify({ reply: 'not a verdict' }), sample.rules)).toThrow('preview: review malformed');
  });
});

describe('P14-NF-71/72: wired on the live worker path (constructed ports, real journal and worker)', () => {
  // One real worker turn: Jev is unsure about one rule, the full-context review carries the context questions and
  // finds the preference broken, the agent accepts and revises, the revision is re-reviewed and sent. The objection
  // is advice the agent answered, never a hold, and the durable turn projects as a fired, revised guidance verdict.
  // One worker turn on a real encrypted journal; `send` is the transport port. Returns the durable turn, reopened.
  const runTurn = async (send: (text: string) => Promise<number>) => {
    const { mkdtempSync, realpathSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { openPreviewJournal, createJournalWorker } = await import('./journal.js');
    const { prepareJournalEnvelope } = await import('./journal-envelope.js');
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-guidance-')));
    const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(16);
    const reviewedRules: (readonly ReplyRule[] | undefined)[] = [], now = 1790000000000;
    try {
      const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
        grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 3,
        maxTurns: 3, maxBytes: 32768, cursor: 0 });
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
        prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
        model: async () => 'Seventeen times three is fifty-one. It is still fifty-one. Ask me again any time.',
        checkOutbound: () => {}, send: async input => send(input.expectedText),
        replyCheck: { elapsedMs: () => 0,
          jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(jevQuestions)
            .map(id => [id, { type: 'noul', noul: id === 'parks_on_user' ? 0.5 : 0.01 }])) }, latencyMs: 0 }),
          escalate: async (_text, _id, _prompt, rules, _deadline, operation) => {
            reviewedRules.push(rules);
            if (operation === 'revision') return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 };
            const findings = (rules ?? []).map(rule => rule === 'breaks_preference'
              ? { rule, verdict: 'violation' as const, reason: 'Three sentences against the two-sentence preference.' }
              : { rule, verdict: 'pass' as const, reason: 'fine' });
            return { verdict: 'violation', ruleIds: ['breaks_preference'], confidence: null, latencyMs: 0,
              reason: 'breaks_preference: Three sentences against the two-sentence preference.', findings };
          },
          revise: async input => {
            expect(input.objections).toEqual(['breaks_preference']);
            return { state: 'complete', text: 'Seventeen times three is fifty-one. Ask me again any time.',
              dispositions: [{ objection: 'breaks_preference', decision: 'accept' }] };
          } } });
      worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'No, it is 41.' } }]);
      await worker.drain();
      journal.close();
      expect(reviewedRules[0]).toEqual(['parks_on_user', 'self_state_claim', 'breaks_preference']);
      const reopened = openPreviewJournal(path, key);
      const durable = reopened.view.order[0]!;
      reopened.close();
      return durable;
    } finally { rmSync(root, { recursive: true, force: true }); }
  };
  it('a broken preference is answered by the agent and its revision is sent; the verdict is read back from the durable journal', async () => {
    const sends: string[] = [];
    const durable = await runTurn(async text => { sends.push(text); return sends.length; });
    expect(sends).toEqual(['PREVIEW — Seventeen times three is fifty-one. Ask me again any time.']);
    expect(durable.held).toBeUndefined();
    expect(durable.sent).toBe(1);
    expect(guidanceVerdicts([durable]).find(item => item.member === 'correction-learning'))
      .toMatchObject({ verdict: 'fired', rules: ['breaks_preference'], decisions: ['accept'], landing: 'revised' });
    expect(guidanceVerdicts([durable]).find(item => item.member === 'claim-verification')).toMatchObject({ verdict: 'clear' });
  });
  it('the same revision whose send outcome is unknown is not counted as landed (no receipt)', async () => {
    const durable = await runTurn(async () => { throw Error('transport outcome unknown'); });
    expect(durable.release?.revised).toBe(true);
    expect(durable.sent).toBeUndefined();
    const verdict = guidanceVerdicts([durable]).find(item => item.member === 'correction-learning')!;
    expect(verdict).toMatchObject({ verdict: 'fired', decisions: ['accept'], landing: 'no-receipt', selected: 'revised' });
    const quality = guidanceQuality([verdict]).find(item => item.member === 'correction-learning')!;
    expect(quality.landing.revised).toBe(0);
    expect(quality.landing['no-receipt']).toBe(1);
  });
});

describe('P14-NF-72/74/75: both sides of each new decision (constructed inputs)', () => {
  it('an elided quote locates only when every part is long enough and present in order in one sentence', () => {
    const sentence = 'I cannot change the trial end myself, and nothing in my records lets me do it.';
    expect(segmentCarries(sentence, 'I cannot change the trial end myself... nothing in my records lets me do it')).toBe(true);
    expect(segmentCarries(sentence, 'nothing in my records lets me do it... I cannot change the trial end myself')).toBe(false);
    expect(segmentCarries(sentence, 'I cannot... nothing in my records lets me do it')).toBe(false);
    expect(segmentCarries(sentence, 'I cannot change the trial end myself... the operator must approve it')).toBe(false);
  });
  it('a preference stated once is no recurrence; one recorded from the agent\'s own reply is not a correction', () => {
    expect(preferenceRecurrences([{ mode: 'prefer', source: 'a', quote: 'Bullets please.' }])).toEqual([]);
    expect(preferenceRecurrences([{ mode: 'prefer', source: 'a', quote: 'Bullets please.' },
      { mode: 'prefer', source: 'b', quote: 'Bullets please.', in: 'reply' }, { mode: 'correct', source: 'c', quote: 'Bullets please.' }])).toEqual([]);
  });
  it('a Jev-only flag is unconfirmed, a confirmed review violation fires, and a pass is clear', () => {
    const base = { id: 't', update: 1, text: '', raw: '', accepted: true, at: 0, reserved: true } as Turn;
    const jev = { verdict: 'violation' as const, ruleIds: ['defers_work' as ReplyRule], confidence: 0.9, path: 'jev' as const, latencyMs: 1,
      scores: Object.fromEntries(Object.keys(jevQuestions).map(id => [id, id === 'defers_work' ? 0.9 : 0.01])) as never };
    const at = (turnRecord: Turn) => guidanceVerdicts([turnRecord]).find(item => item.member === 'deferral')!.verdict;
    expect(at({ ...base, replyChecks: [jev, { verdict: 'unavailable', ruleIds: ['defers_work'], confidence: null, path: 'subscription', latencyMs: 1 }] }))
      .toBe('unconfirmed');
    expect(at({ ...base, replyChecks: [jev, { verdict: 'violation', ruleIds: ['defers_work'], confidence: null, path: 'subscription', latencyMs: 1 }] }))
      .toBe('fired');
    expect(at({ ...base, replyChecks: [jev, { verdict: 'pass', ruleIds: [], confidence: null, path: 'subscription', latencyMs: 1 }] }))
      .toBe('clear');
  });
});

// ---- Capture, from a COPY of the live journal; never the live root. Skipped unless pointed at one. ----
// INSTAR_GUIDANCE_ROOT: a directory holding a copy of lanes/preview-trial-root/runner-2026-09-26/journal.encrypted.
// INSTAR_SECRET_PREVIEW_STORAGE_KEY: from the vault (preview_storage_key), bound in the environment, never printed.
// INSTAR_GUIDANCE_LIVE=1 additionally runs the real full-context reviewer on five recorded answer packets.
const COPY = process.env.INSTAR_GUIDANCE_ROOT, STORAGE = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
const NAMED = [969390016, 969390038, 969389954, 969389883, 969389923, 969389925, 969389926];
const SAMPLES: { scenario: string; update: number; all?: true }[] = [
  { scenario: 'preference-break', update: 969389923 }, { scenario: 'preference-kept', update: 969389925 },
  { scenario: 'self-claim', update: 969389883 }, { scenario: 'false-cannot-do', update: 969390016, all: true },
  { scenario: 'self-claim-count', update: 969389926 }];
it.skipIf(COPY === undefined || STORAGE === undefined)('captures the guidance fixture from a copy of the live journal', async () => {
  const { openPreviewJournal, declaredObligations } = await import('./journal.js');
  const { prepareJournalEnvelope } = await import('./journal-envelope.js');
  const { subscriptionConversationPolicy, SUBSCRIPTION_THINKING_ENV } = await import('../../src/assembly/production-provider.js');
  const bytes = Buffer.from(STORAGE!, /^[a-f0-9]{64}$/iu.test(STORAGE!) ? 'hex' : 'base64');
  const journal = openPreviewJournal(resolve(COPY!, 'journal.encrypted'), new Uint8Array(bytes), undefined, undefined, true);
  try {
    const view = journal.view;
    const slim = (item: Turn): Turn => {
      const named = NAMED.includes(item.update);
      const checks = (item.replyChecks ?? []).map(check => ({ ...check,
        ...(named ? {} : { reason: undefined, usage: undefined, candidateDigest: undefined,
          findings: check.findings?.map(finding => ({ ...finding, reason: '' })) }) }));
      return { id: item.id, update: item.update, text: named ? item.text : '', raw: '', accepted: item.accepted, at: item.at, reserved: item.reserved,
        ...(named && item.answer !== undefined ? { answer: item.answer } : {}),
        ...(named && item.reviewCandidate !== undefined ? { reviewCandidate: item.reviewCandidate } : {}),
        ...(item.replyChecks ? { replyChecks: JSON.parse(JSON.stringify(checks)) as Turn['replyChecks'] } : {}),
        ...(item.release ? { release: { ...item.release, ...(named ? {} : { reason: undefined }) } } : {}),
        ...(item.heldReview ? { heldReview: { ...item.heldReview, ...(named ? {} : { reason: undefined }) } } : {}),
        ...(item.revision ? { revision: { state: item.revision.state } } : {}), ...(item.held ? { held: item.held } : {}),
        // The receipt is the only evidence a correction was delivered; a capture without it reads as no-receipt.
        ...(item.sent !== undefined ? { sent: item.sent } : {}), ...(item.groupedInto !== undefined ? { groupedInto: item.groupedInto } : {}) } as Turn;
    };
    // A sample already captured for the same update is kept, not re-run: each real-model call is spent once.
    const prior = (() => { try { return fixture().samples; } catch { return []; } })();
    const samples: Sample[] = SAMPLES.flatMap(plan => prior.filter(sample => sample.update === plan.update));
    if (process.env.INSTAR_GUIDANCE_LIVE === '1') for (const plan of SAMPLES) {
      if (samples.some(sample => sample.update === plan.update)) continue;
      const recorded = view.order.find(item => item.update === plan.update)!;
      const envelope = JSON.parse(recorded.prompt!) as { model: string };
      const jev = recorded.replyChecks?.find(check => check.path === 'jev');
      // The selection reviewReply makes: what Jev left unresolved (every rule when Jev gave nothing), plus the context questions.
      const selected = guidanceReviewRules(plan.all || !jev?.ruleIds.length ? Object.keys(REPLY_RULES) as ReplyRule[] : jev.ruleIds);
      const candidate = recorded.reviewCandidate ?? `PREVIEW — ${recorded.answer!}`;
      const context = replyReviewContext(recorded.prompt!, candidate, selected, declaredObligations(view, recorded.id, recorded.at));
      const prepared = prepareJournalEnvelope({ question: replyReviewQuestion(selected), context, id: `${recorded.id}:reply-review` },
        envelope.model, view.genesis.grant, recorded.at, view.limits.maxBytes);
      const policy = subscriptionConversationPolicy(envelope.model);
      const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('CLAUDE_CODE_') && name !== 'CLAUDECODE'
        && !name.startsWith('INSTAR_SECRET_')));
      const run = spawnSync('/usr/local/bin/claude', [...policy.args], { input: prepared, encoding: 'utf8', timeout: 170_000,
        env: { ...env, CLAUDE_CODE_MAX_RETRIES: '0', CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(policy.maxTokens), ...SUBSCRIPTION_THINKING_ENV },
        maxBuffer: 4 * 1024 * 1024 });
      const frame = JSON.parse(run.stdout) as { result?: unknown };
      if (typeof frame.result !== 'string') throw Error(`model frame without result: ${run.stdout.slice(0, 300)}`);
      samples.push({ scenario: plan.scenario, update: plan.update, rules: selected, model: envelope.model,
        promptSha256: createHash('sha256').update(prepared).digest('hex'), raw: frame.result });
    }
    // One turn per line keeps the recorded population compact and reviewable.
    const compact = (value: unknown) => JSON.stringify(value);
    writeFileSync(FIXTURE, `${JSON.stringify({
      source: 'Captured by tests/preview/guidance.test.ts (w4-guidance, Mac Studio, 2026-10-03) from a COPY of Justin\'s live preview journal '
        + '(lanes/preview-trial-root/runner-2026-09-26/journal.encrypted, copied 10:53 PDT); the live root was never read or written. turns: every turn with '
        + 'its recorded reply checks and send record; message text, answer, candidate and reasons are kept only on the named turns '
        + `${NAMED.join(', ')}. memory: the recorded preference statements. samples: the real full-context reviewer (the production conversation `
        + 'framing, MAX_THINKING_TOKENS=0, the envelope\'s own recorded model) on the recorded answer packets of the named updates, with this '
        + 'branch\'s question selection (Jev\'s recorded flags plus the context questions; every rule for 969390016, whose recorded review judged every rule); '
        + '`raw` is the model output verbatim and promptSha256 the envelope it answered.',
      turns: '@TURNS@',
      memory: view.memory.filter(change => change.mode === 'prefer').map(change => ({ mode: change.mode, source: change.source, quote: change.quote,
        ...(change.in ? { in: change.in } : {}) })),
      samples }, null, 1).replace('"@TURNS@"',
        `[\n${view.order.filter(item => item.replyChecks?.length).map(item => `  ${compact(slim(item))}`).join(',\n')}\n ]`)}\n`);
  } finally { journal.close(); }
}, 900_000);
