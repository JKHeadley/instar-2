import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, createJournalWorker, type Turn } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { appendGroupCarry } from './group-carry.js';
import { verifyGroupAudience } from './group-disclosure.js';
import { key, scope, now, permissionFor, membership } from './group-carry-fixture.js';
import { HOLDING_REPLY, parseReplyReviewVerdict, type ReplyRule } from './reply-check.js';
import { readAnswer } from './answer-reading.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/group-audience-live-2026-10-10.json', import.meta.url), 'utf8')) as {
  recorded: { update: number; text: string; answer: string; checks: NonNullable<Turn['replyChecks']>;
    revision: NonNullable<Turn['revision']>; revisionReview: NonNullable<Turn['revisionReview']>; delivered: string };
  samples: { name: string; candidate: string; rules: ReplyRule[]; raw: string }[];
};
const sample = (name: string) => fixture.samples.find(s => s.name === name)!;
const verdict = (name: string) => {
  const s = sample(name), read = readAnswer(s.raw, { wrapped: 'refuse' });
  if (!read.ok) throw Error('recorded reviewer result unreadable');
  return parseReplyReviewVerdict(read.value, s.rules);
};
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
  grant: 'TEST-audience', configurationDigest: 'sha256:test', expires: now + 86400000,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 };

it('real reviewer on update 969390330: own information passes verified membership and is withheld from a shared group', () => {
  expect(verdict('operator-only')).toMatchObject({ verdict: 'pass' });
  expect(verdict('shared')).toMatchObject({ verdict: 'violation', ruleIds: ['sensitive_disclosure'] });
  expect(verdict('fragment')).toMatchObject({ verdict: 'violation', ruleIds: expect.arrayContaining(['incoherent_remainder']) });
  expect(verdict('coherent')).toMatchObject({ verdict: 'pass' });
});

for (const audience of ['verified', 'other-member', 'unverified', 'changed-before-review'] as const) {
  it(`worker uses current membership, never a stored group label: ${audience}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'group-audience-')); dirs.push(root);
    const source = openPreviewJournal(join(root, 'source'), key, genesis);
    const journal = openPreviewJournal(join(root, 'group'), key, { ...genesis, chat: scope.chat, forum: true });
    appendGroupCarry(journal, source, scope, permissionFor(scope), true, now, () => false);
    source.close();
    let changed = false, models = 0, reviews = 0;
    const sends: string[] = [], audiences: boolean[] = [];
    const checkAudience = (prompt: string) => {
      const context = JSON.parse(prompt).messages.find((m: { role: string }) => m.role === 'context');
      const packet = JSON.parse(context.content).packet;
      audiences.push(packet.audience.operatorOnlyVerified);
      expect(packet.audience.surface).toBe('telegram-group-topic');
    };
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      groupDisclosure: async () => audience === 'unverified' ? false : verifyGroupAudience(scope,
        membership((method, _body, value) => method === 'getChatMemberCount' && (audience === 'other-member' || changed) ? 3 : value)),
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now),
      model: async prompt => { models++; checkAudience(prompt.prepared!); changed = audience === 'changed-before-review'; return fixture.recorded.answer; },
      checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return sends.length; },
      replyCheck: { elapsedMs: () => 0,
        jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(fixture.recorded.checks[0]!.scores!)
          .map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 0 }),
        escalate: async (_text, _id, prompt) => { reviews++; checkAudience(prompt!);
          return { ...verdict('operator-only'), confidence: null, latencyMs: 1 }; } },
    });
    worker.intake([{ update_id: 1, message: { message_id: 1, chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true },
      from: { id: Number(scope.operator) }, text: fixture.recorded.text } }]);
    await worker.drain();
    if (audience === 'verified') {
      expect(sends).toEqual([fixture.recorded.answer]); expect(models).toBe(1); expect(reviews).toBe(1);
      expect(audiences).toEqual([true, true]);
    } else {
      expect(sends).toEqual([]); expect(reviews).toBe(0);
      expect(models).toBe(audience === 'changed-before-review' ? 1 : 0);
    }
    journal.close();
  });
}

it('replays the exact live review, revision and unavailable revision review: sends holding, never the recorded fragment', async () => {
  const root = mkdtempSync(join(tmpdir(), 'group-fragment-')); dirs.push(root);
  const journal = openPreviewJournal(join(root, 'journal'), key, { ...genesis, chat: scope.chat, forum: true });
  const sends: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now),
    model: async () => fixture.recorded.answer, checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return sends.length; },
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(fixture.recorded.checks[0]!.scores!)
        .map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 164 }),
      escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => {
        if (operation === 'revision') throw Error('preview: reply review unavailable');
        return { ...fixture.recorded.checks[1]!, verdict: 'violation' as const };
      },
      revise: async () => ({ ...fixture.recorded.revision, state: 'complete' as const }),
    } });
  worker.intake([{ update_id: fixture.recorded.update, message: { message_id: 1,
    chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true }, from: { id: Number(scope.operator) }, text: fixture.recorded.text } }]);
  await worker.drain();
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(sends).not.toContain(fixture.recorded.delivered);
  expect(journal.view.order[0]!.answer).toBe(fixture.recorded.answer);
  expect(journal.view.order[0]!.revisionReview).toEqual(fixture.recorded.revisionReview);
  journal.close();
});

for (const outcome of ['fragment', 'coherence-only', 'coherent', 'unavailable', 'cap', 'deadline', 'restart', 'unknown-restart'] as const) {
  it(`claim remainder gets its own bounded durable full-context judgment: ${outcome}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'remainder-review-')); dirs.push(root);
    const path = join(root, 'journal');
    let interrupted = false, clock = now, checks = 0;
    const coherent = sample('coherent').candidate;
    const answer = outcome === 'coherent' || outcome === 'restart' ? `${fixture.recorded.answer.split('. So far')[0]}. ${coherent}` : fixture.recorded.answer;
    const crash = outcome === 'restart' ? 'after:reply-revision-review' : outcome === 'unknown-restart' ? 'after:reply-revision-review-reserve' : '';
    let journal = openPreviewJournal(path, key, { ...genesis, chat: scope.chat, forum: true, maxCalls: outcome === 'cap' ? 2 : 20 }, stage => {
      if (!interrupted && stage === crash) { interrupted = true; throw Error('TEST crash'); }
    });
    const sends: string[] = [];
    const make = () => createJournalWorker(journal, { now: () => clock, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now),
      model: async () => answer, checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return sends.length; },
      replyCheck: { elapsedMs: () => 0,
        jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(fixture.recorded.checks[0]!.scores!)
          .map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 164 }),
        escalate: async (text, _id, prompt, rules, _deadline, operation) => {
          if (operation !== 'revision') {
            if (outcome === 'deadline') clock += 60001;
            return { ...fixture.recorded.checks[1]!, verdict: 'violation' as const };
          }
          checks++; expect(rules).toContain('incoherent_remainder'); expect(prompt).toContain(fixture.recorded.text);
          if (outcome === 'unavailable') throw Error('preview: reply review unavailable');
          const name = outcome === 'coherent' || outcome === 'restart' ? 'coherent' : 'fragment';
          expect(text).toBe(sample(name).candidate);
          const result = verdict(name);
          // Isolate the recorded coherence finding from the separate disclosure finding: a coherent-answer
          // requirement must itself hold even if every privacy finding passed (constructed boundary control).
          return { ...result, ...(outcome === 'coherence-only' ? { ruleIds: ['incoherent_remainder' as const],
            findings: result.findings?.filter(f => f.rule === 'incoherent_remainder') } : {}), confidence: null, latencyMs: 1 };
        } },
    });
    let worker = make();
    worker.intake([{ update_id: fixture.recorded.update, message: { message_id: 1,
      chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true }, from: { id: Number(scope.operator) }, text: fixture.recorded.text } }]);
    if (crash) {
      await expect(worker.drain()).rejects.toThrow('TEST crash'); journal.close();
      journal = openPreviewJournal(path, key); worker = make();
    }
    await worker.drain();
    expect(sends).toEqual([outcome === 'coherent' || outcome === 'restart' ? coherent : HOLDING_REPLY]);
    expect(checks).toBe(['cap', 'deadline', 'unknown-restart'].includes(outcome) ? 0 : 1);
    const turn = journal.view.order[0]!;
    expect(turn.answer).toBe(answer);
    expect((turn.release ?? turn.heldReview)?.withheld?.removed).toEqual(fixture.recorded.checks[1]!.findings!
      .filter(f => f.rule === 'sensitive_disclosure').map(() => fixture.recorded.answer.split('. So far')[0] + '.'));
    journal.compact(); journal.close();
    journal = openPreviewJournal(path, key);
    await make().drain(); expect(sends).toHaveLength(1); journal.close();
  });
}
