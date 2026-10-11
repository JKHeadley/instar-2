import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkReply, sharedAudience, replyReviewContext, type ReplyCheckResult } from './reply-check.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { appendGroupCarry } from './group-carry.js';
import { key, scope, now, permissionFor } from './group-carry-fixture.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/audience-classifier-2026-10-11.json', import.meta.url), 'utf8')) as {
  turns: { update: number; reply: string; promptAudience: Record<string, unknown>; replyChecks: ReplyCheckResult[] }[];
};
const envelope = (audience: Record<string, unknown>) => JSON.stringify({ messages: [
  { role: 'context', content: JSON.stringify({ packet: { audience } }) },
] });
const jev = (check: ReplyCheckResult) => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.entries(check.scores!).map(([id, noul]) => [id, { type: 'noul', noul }])) }, latencyMs: check.latencyMs });

for (const turn of fixture.turns) for (const verified of [true, false]) {
  it(`recorded update ${turn.update}, current operator-only=${verified}: selects the measured review route`, async () => {
    const first = turn.replyChecks[0]!;
    let reviews = 0;
    const records: ReplyCheckResult[] = [];
    const result = await checkReply(turn.reply, `recorded:${turn.update}`, {
      elapsedMs: () => 0, jev: async () => jev(first), reserveEscalation: () => true,
      escalate: async () => { reviews++; return { ...turn.replyChecks[1]!, verdict: 'pass' }; },
      record: record => records.push(record),
    }, envelope({ ...turn.promptAudience, operatorOnlyVerified: verified }));
    const expectedReview = !verified || first.verdict !== 'pass';
    expect(reviews).toBe(Number(expectedReview));
    expect(records[0]).toMatchObject({ verdict: first.verdict, scores: first.scores });
    expect(result).toEqual({ outcome: 'pass', path: expectedReview ? 'subscription' : 'jev' });
  });
}
it.each([false, undefined, null, 'true', 1])('unverified standing %s cannot give a group the private route', standing => {
  expect(sharedAudience(envelope({ surface: 'telegram-group-topic', operatorOnlyVerified: standing }))).toBe(true);
});
it('only the bound private surface and a currently verified group topic take the operator route', () => {
  expect(sharedAudience(envelope({ surface: 'telegram-private-chat' }))).toBe(false);
  expect(sharedAudience(envelope({ surface: 'telegram-group-topic', operatorOnlyVerified: true }))).toBe(false);
  expect(sharedAudience(envelope({ surface: 'public', operatorOnlyVerified: true }))).toBe(true);
});

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
  grant: 'TEST-audience-classifier', configurationDigest: 'sha256:test', expires: now + 86400000,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 };
for (const mode of ['fresh', 'restart', 'revoked-restart', 'changed-after-jev', 'secret', 'stopped'] as const) {
  it(`real worker with recorded confident pass preserves current disclosure and floors: ${mode}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'audience-classifier-')); roots.push(root);
    const path = join(root, 'group');
    const source = openPreviewJournal(join(root, 'source'), key, genesis);
    let crashed = false, changed = false, stopped = false, reviews = 0, jevs = 0;
    const restart = mode === 'restart' || mode === 'revoked-restart';
    let journal = openPreviewJournal(path, key, { ...genesis, chat: scope.chat, forum: true }, stage => {
      if (restart && stage === 'after:reply-check' && !crashed) { crashed = true; throw Error('TEST crash'); }
    });
    appendGroupCarry(journal, source, scope, permissionFor(scope), true, now, () => false); source.close();
    const turn = fixture.turns.find(row => row.update === 969390353)!;
    const sends: string[] = [];
    const answer = mode === 'secret' ? 'sk-ant-api03-' + 'a'.repeat(100) : turn.reply;
    const make = () => createJournalWorker(journal, { now: () => now, stopped: () => stopped,
      groupDisclosure: async () => !changed,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now),
      model: async () => answer, checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return sends.length; },
      replyCheck: { elapsedMs: () => 0,
        jev: async () => { jevs++; changed = mode === 'changed-after-jev'; stopped = mode === 'stopped'; return jev(turn.replyChecks[0]!); },
        escalate: async () => { reviews++; return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 1 }; },
      },
    });
    let worker = make();
    worker.intake([{ update_id: turn.update, message: { message_id: 1, chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true },
      from: { id: Number(scope.operator) }, text: 'Run the audience routing probe.' } }]);
    if (restart) {
      await expect(worker.drain()).rejects.toThrow('TEST crash'); journal.close();
      changed = mode === 'revoked-restart'; journal = openPreviewJournal(path, key); worker = make();
    }
    if (mode === 'stopped') await expect(worker.drain()).rejects.toThrow('preview stopped');
    else await worker.drain();
    expect(reviews).toBe(0);
    if (mode === 'fresh' || mode === 'restart') {
      expect(sends).toEqual([answer]); expect(jevs).toBe(1);
      expect(journal.view.order[0]!.replyChecks?.at(-1)).toMatchObject({ path: 'jev', verdict: 'pass' });
      await worker.drain(); expect(sends).toHaveLength(1);
    } else expect(sends).not.toContain(answer);
    journal.close();
  });
}

// These are actual saved model/journal bytes, not substitutes for the routing cases above.
it('recorded summary, uncertain/undecided judgments and delivered/empty context cannot override current audience standing', async () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string; source: string }[];
  };
  expect(corpus.otherShapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  const turn = fixture.turns.find(row => row.update === 969390353)!;
  for (const row of corpus.otherShapes) for (const verified of [true, false]) {
    const prompt = JSON.stringify({ messages: [{ role: 'user', content: 'Run the audience routing probe.' },
      { role: 'context', content: JSON.stringify({ packet: { audience: { ...turn.promptAudience, operatorOnlyVerified: verified },
        history: [{ id: row.id, source: row.source, answer: row.raw }] } }) }] });
    expect(JSON.parse(replyReviewContext(prompt, turn.reply)).history[0].answer).toBe(row.raw);
    let reviews = 0;
    const result = await checkReply(turn.reply, row.id, { elapsedMs: () => 0, jev: async () => jev(turn.replyChecks[0]!),
      reserveEscalation: () => true, record: () => {},
      escalate: async () => { reviews++; return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }; },
    }, prompt);
    expect(result.path).toBe(verified ? 'jev' : 'subscription'); expect(reviews).toBe(Number(!verified));
  }
});
