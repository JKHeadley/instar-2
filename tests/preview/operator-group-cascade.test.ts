import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts, type Turn } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { checkReply, confidentReplyNeedsReview, jevConfidentPass, parseReplyReviewVerdict, sharedAudience,
  type ReplyCheckPorts, type ReplyRule } from './reply-check.js';
import { appendGroupCarry } from './group-carry.js';
import { key, scope, now, permissionFor } from './group-carry-fixture.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/speed-review-live-2026-10-11.json', import.meta.url), 'utf8')) as {
  update: number; text: string; answer: string; delivered: string; checks: NonNullable<Turn['replyChecks']>; review: string;
};
const reviewRead = readAnswer(fixture.review, { wrapped: 'refuse' });
if (!reviewRead.ok) throw Error('recorded review envelope unreadable');
const reviewText = reviewRead.value;
const scores = fixture.checks[0]!.scores!;
const jev = (values = scores) => ({ model: 'jev-1.13.0',
  answers: Object.fromEntries(Object.entries(values).map(([id, noul]) => [id, { type: 'noul', noul }])) });
const prompt = (audience: object, history: unknown[] = []) => JSON.stringify({ messages: [
  { role: 'context', content: JSON.stringify({ packet: { audience, history } }) }, { role: 'user', content: fixture.text }] });
const group = { surface: 'telegram-group-topic', operatorOnlyVerified: true };
const pass = { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1 };

it('only an exact verified operator-only topic admits the confident-pass exception', () => {
  expect(confidentReplyNeedsReview(prompt(group))).toBe(false);
  expect(sharedAudience(prompt(group))).toBe(true); // sensitivity, revisions and echoes retain the group classification
  for (const audience of [{ ...group, operatorOnlyVerified: false }, { surface: group.surface },
    { ...group, operatorOnlyVerified: 'true' }, { ...group, operatorOnlyVerified: 1 },
    { operatorOnlyVerified: true }, { ...group, surface: 'telegram-group' }, { ...group, surface: 'slack-channel' }]) {
    expect(confidentReplyNeedsReview(prompt(audience))).toBe(true);
  }
  expect(confidentReplyNeedsReview(prompt({ surface: 'telegram-private-chat' }))).toBe(false);
});

it('all ten questions must pass; each unsure or positive question retains contextual sensitivity review', async () => {
  const selected: (readonly ReplyRule[] | undefined)[] = [];
  const ports: ReplyCheckPorts = { jev: async () => ({ value: jev(), latencyMs: 176 }),
    escalate: async (_text, _id, _prompt, rules) => { selected.push(rules); return pass; },
    record: () => {}, reserveEscalation: () => true, elapsedMs: () => 0 };
  expect(await checkReply(fixture.delivered, 'recorded:969390381', ports, prompt(group)))
    .toEqual({ outcome: 'pass', path: 'jev' });
  expect(selected).toEqual([]);
  expect(Object.keys(scores)).toHaveLength(10);
  expect(jevConfidentPass(fixture.checks[0]!)).toBe(true);
  expect(jevConfidentPass({ ...pass, path: 'jev' })).toBe(false);
  expect(jevConfidentPass({ ...fixture.checks[0]!, scores: { ...scores, credential: 0.5 } })).toBe(false);
  for (const rule of Object.keys(scores)) for (const score of [0.5, 1]) {
    ports.jev = async () => ({ value: jev({ ...scores, [rule]: score }), latencyMs: 1 });
    expect(await checkReply(fixture.delivered, 'boundary-control', ports, prompt(group)))
      .toEqual({ outcome: 'pass', path: 'subscription' });
    expect(selected.at(-1)).toEqual(expect.arrayContaining([rule, 'sensitive_disclosure', 'self_state_claim', 'breaks_preference']));
  }
  ports.jev = async () => { throw Error('unavailable'); };
  await checkReply(fixture.delivered, 'unavailable-control', ports, prompt(group));
  expect(selected.at(-1)).toEqual(expect.arrayContaining([...Object.keys(scores), 'sensitive_disclosure']));
});

it('replays recorded summary, uncertain, undecided, unsure, review and delivered/empty-context shapes through both audience routes', async () => {
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
  expect(shapes.otherShapes.map(shape => shape.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const shape of shapes.otherShapes) for (const verified of [true, false]) {
    let reviews = 0;
    const recordedJev = shape.kind === 'jev-unsure' ? jev(JSON.parse(shape.raw).scores)
      : shape.kind === 'jev-undecided' ? JSON.parse(shape.raw) : jev();
    const ports: ReplyCheckPorts = { jev: async () => ({ value: recordedJev, latencyMs: 1 }),
      escalate: async (_text, _id, original, rules) => {
        reviews++;
        const context = JSON.parse(original!).messages.find((item: { role: string }) => item.role === 'context');
        expect(JSON.parse(context.content).packet.history[0].recorded).toBe(shape.raw);
        expect(rules).toContain('sensitive_disclosure');
        // Real recorded reply-review bytes go through their native parser on this path.
        return { ...parseReplyReviewVerdict(reviewText, ['sensitive_disclosure', 'self_state_claim', 'breaks_preference']),
          confidence: null, latencyMs: 1 };
      }, record: () => {}, reserveEscalation: () => true, elapsedMs: () => 0 };
    const decision = await checkReply(fixture.delivered, shape.id, ports,
      prompt({ ...group, operatorOnlyVerified: verified }, [{ kind: shape.kind, recorded: shape.raw }]));
    const expected = !verified || shape.kind.startsWith('jev-') ? 1 : 0;
    expect(reviews, shape.id).toBe(expected);
    expect(decision, shape.id).toEqual({ outcome: 'pass', path: expected ? 'subscription' : 'jev' });
  }
});

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
  grant: 'TEST-cascade', configurationDigest: 'sha256:test', expires: now + 86400000,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 };
for (const scenario of ['pass', 'shared', 'unsure', 'unavailable', 'restart', 'restart-shared', 'restart-reserved', 'joined', 'stopped', 'capped', 'secret'] as const) {
  it(`recorded arithmetic through worker and durable reopen: ${scenario}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'operator-cascade-')); dirs.push(dir);
    const path = join(dir, 'journal'); let crashed = false, stop = false, verified = !['shared', 'restart-reserved'].includes(scenario);
    const crash = (stage: string) => {
      if (scenario.startsWith('restart') && stage === (scenario === 'restart-reserved' ? 'after:reply-review-reserve' : 'after:reply-check') && !crashed) { crashed = true; throw Error('TEST crash'); }
    };
    let journal = openPreviewJournal(path, key, { ...genesis, chat: scope.chat, forum: true, maxCalls: scenario === 'capped' ? 2 : 20 }, crash);
    if (scenario === 'joined') {
      const source = openPreviewJournal(join(dir, 'source'), key, genesis);
      appendGroupCarry(journal, source, scope, permissionFor(scope), true, now, () => false); source.close();
    }
    const sent: string[] = []; let reviews = 0, jevs = 0;
    const ports: PreviewPorts = { now: () => now, stopped: () => stop, groupDisclosure: async () => verified,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now),
      model: async () => {
        const answer = readAnswer(fixture.answer, { wrapped: 'refuse' }); expect(answer.ok).toBe(true);
        return scenario === 'secret' ? 'The value is sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890.' : answer.ok ? answer.value : '';
      }, checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
      replyCheck: { elapsedMs: () => 0, jev: async () => {
        jevs++; if (scenario === 'unavailable') throw Error('unavailable');
        if (scenario === 'joined') verified = false;
        if (scenario === 'stopped') stop = true;
        return { value: jev(scenario === 'unsure' || scenario === 'capped' ? { ...scores, credential: 0.5 } : scores), latencyMs: 176 };
      }, escalate: async (_text, _id, _prompt, rules) => {
        reviews++; expect(rules).toContain('sensitive_disclosure');
        if (scenario === 'capped') throw Error('preview: review malformed');
        return { ...parseReplyReviewVerdict(reviewText, ['sensitive_disclosure', 'self_state_claim', 'breaks_preference']),
          confidence: null, latencyMs: 5856 };
      } } };
    let worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: fixture.update, message: { message_id: 1, chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true },
      from: { id: Number(scope.operator) }, text: fixture.text } }]);
    if (scenario.startsWith('restart')) {
      await expect(worker.drain()).rejects.toThrow('TEST crash'); journal.close();
      if (scenario === 'restart-shared') verified = false;
      if (scenario === 'restart-reserved') verified = true;
      journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    }
    if (scenario === 'stopped') await expect(worker.drain()).rejects.toThrow('preview stopped');
    else await worker.drain();
    expect(journal.view.order).toHaveLength(1); // durable intake survives every branch
    expect(reviews).toBe(['shared', 'unsure', 'unavailable', 'capped', 'restart-shared'].includes(scenario) ? 1 : 0);
    if (['joined', 'stopped'].includes(scenario)) expect(sent).toEqual([]);
    else if (['capped', 'secret', 'restart-reserved'].includes(scenario)) expect(sent).not.toContain(fixture.delivered);
    else expect(sent).toEqual([fixture.delivered]);
    if (scenario === 'secret') expect(jevs).toBe(0);
    if (scenario.startsWith('restart')) expect(jevs).toBe(1);
    expect(journal.view.calls).toBeLessThanOrEqual(journal.view.limits.maxCalls);
    const count = sent.length; journal.close(); journal = openPreviewJournal(path, key);
    if (scenario === 'stopped') await expect(createJournalWorker(journal, ports).drain()).rejects.toThrow('preview stopped');
    else await createJournalWorker(journal, ports).drain();
    expect(sent).toHaveLength(count); journal.close();
  });
}
