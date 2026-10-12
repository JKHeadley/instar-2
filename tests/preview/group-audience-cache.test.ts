import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGroupAudienceCache, verifyGroupAudience } from './group-disclosure.js';
import { membership, scope, now, key, permissionFor } from './group-carry-fixture.js';
import { openPreviewJournal, createJournalWorker, type Turn } from './journal.js';
import { appendGroupCarry } from './group-carry.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { parseReplyReviewVerdict, type ReplyRule } from './reply-check.js';

it('shares a bounded observation, coalesces concurrent callers, and expires without sliding the deadline', async () => {
  let clock = 0, reads = 0;
  const read = membership();
  const cache = createGroupAudienceCache(() => clock, () => async (m, b) => { reads++; return read(m, b); });
  expect(await Promise.all([cache.verify(scope), cache.verify(scope)])).toEqual([true, true]);
  expect(reads).toBe(6);
  clock = 9999; expect(await cache.verify(scope)).toBe(true); expect(reads).toBe(6);
  clock = 10000; expect(await cache.verify(scope)).toBe(true); expect(reads).toBe(12);
  clock = 0; expect(await cache.verify(scope)).toBe(true); expect(reads).toBe(18);
  cache.observe([{ message: { text: 'ordinary question' } }]);
  expect(await cache.verify(scope)).toBe(true); expect(reads).toBe(18);
});

it.each([
  { chat_member: {} }, { my_chat_member: {} }, { message: { new_chat_members: [{}], text: 'joined' } },
  { message: { left_chat_member: {} } }, { edited_message: { migrate_to_chat_id: -2, text: 'migrated' } },
  { message: { unknown_service: {} } },
])('invalidates before the next decision on %j, including a replayed update', async update => {
  let count = 2;
  const cache = createGroupAudienceCache(() => 0, () => membership((m, _b, v) => m === 'getChatMemberCount' ? count : v));
  expect(await cache.verify(scope)).toBe(true);
  count = 3; cache.observe([update]); expect(await cache.verify(scope)).toBe(false);
  count = 2; expect(await cache.verify(scope)).toBe(true);
  count = 3; cache.observe([update]); expect(await cache.verify(scope)).toBe(false);
});

it('never caches failures, stale probes or invalidated in-flight results', async () => {
  let clock = 0, invalidate = false, unavailable = false, delay = 0;
  const read = membership();
  const cache = createGroupAudienceCache(() => clock, () => async (m, b) => {
    if (unavailable) throw Error('offline');
    clock += delay;
    if (invalidate) cache.invalidate();
    return read(m, b);
  });
  unavailable = true; expect(await cache.verify(scope)).toBe(false);
  unavailable = false; expect(await cache.verify(scope)).toBe(true);
  cache.invalidate(); invalidate = true; expect(await cache.verify(scope)).toBe(false);
  invalidate = false; expect(await cache.verify(scope)).toBe(true);
  cache.invalidate(); delay = 2000; expect(await cache.verify(scope)).toBe(false);
  delay = 0; expect(await cache.verify(scope)).toBe(true);
  clock = NaN; expect(await cache.verify(scope)).toBe(false);
});

it.each(['sourceRoot', 'destinationRoot', 'chat', 'operator', 'bot'] as const)('does not reuse another %s scope', async field => {
  let reads = 0;
  const read = membership();
  const cache = createGroupAudienceCache(() => 0, () => async (m, b) => { reads++; return read(m, b); });
  expect(await cache.verify(scope)).toBe(true);
  await cache.verify({ ...scope, [field]: field.endsWith('Root') ? '/another' : field === 'chat' ? '-2' : '42' });
  expect(reads).toBeGreaterThan(6);
  const before = reads;
  expect(await cache.verify(scope)).toBe(true); expect(reads).toBe(before + 6);
});

it('the shipped launcher shares the cache at every serving boundary and observes before intake filtering', () => {
  const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  expect(source).toContain('createGroupAudienceCache(clock.elapsed, membershipReadFor)');
  expect(source.match(/verifyGroupAudience\(scope, membershipReadFor\(scope\)\)/gu)).toHaveLength(1); // one-time carry only
  expect(source).toContain("'callback_query', 'chat_member', 'my_chat_member'");
  expect(source.indexOf('groupAudience.observe(updates.result)')).toBeLessThan(source.indexOf('const batch = shared ? updates.result.filter'));
});

const fixture = JSON.parse(readFileSync(new URL('./fixtures/group-audience-live-2026-10-10.json', import.meta.url), 'utf8')) as {
  recorded: { update: number; text: string; answer: string; checks: NonNullable<Turn['replyChecks']> };
  samples: { name: string; rules: ReplyRule[]; raw: string }[];
};

it('replays recorded group question through durable intake, reserve, two reviews and one send: cold and warm', async () => {
  const measurements = [];
  for (const mode of ['before', 'cold', 'warm'] as const) {
    const root = mkdtempSync(join(tmpdir(), 'intake-cache-replay-'));
    let clock = now, reads = 0, probes = 0;
    const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
      grant: 'TEST-cache', configurationDigest: 'sha256:test', expires: now + 86400000,
      maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 };
    const source = openPreviewJournal(join(root, 'source'), key, genesis);
    const path = join(root, 'group');
    let journal = openPreviewJournal(path, key, { ...genesis, chat: scope.chat, forum: true });
    try {
      appendGroupCarry(journal, source, scope, permissionFor(scope), true, now, () => false);
      const member = membership();
      const read = async (m: Parameters<typeof member>[0], b: Parameters<typeof member>[1]) => {
        reads++; clock += 1000; return member(m, b);
      };
      const cache = createGroupAudienceCache(() => clock, () => read);
      if (mode === 'warm') { expect(await cache.verify(scope)).toBe(true); reads = 0; }
      const started = clock;
      const sends: string[] = [];
      let reviews = 0;
      const sample = fixture.samples.find(s => s.name === 'operator-only')!;
      const parsed = readAnswer(sample.raw, { wrapped: 'refuse' });
      if (!parsed.ok) throw Error('recorded review unreadable');
      const make = () => createJournalWorker(journal, { now: () => clock, stopped: () => false,
        groupDisclosure: async () => { probes++; return mode === 'before' ? verifyGroupAudience(scope, read) : cache.verify(scope); },
        prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, clock),
        model: async () => fixture.recorded.answer,
        checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return sends.length; },
        replyCheck: { elapsedMs: () => 0,
          jev: async () => { reviews++; return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(
            Object.entries(fixture.recorded.checks[0]!.scores!).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 0 }; },
          escalate: async () => { reviews++; return { ...parseReplyReviewVerdict(parsed.value, sample.rules), confidence: null, latencyMs: 0 }; } },
      });
      const worker = make();
      const batch = [{ update_id: fixture.recorded.update, message: { message_id: 1,
        chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true },
        from: { id: Number(scope.operator) }, text: fixture.recorded.text } }];
      cache.observe(batch); worker.intake(batch);
      expect(journal.view.order).toHaveLength(1); // durable intake precedes any membership read
      await worker.drain();
      const intakeMs = journal.view.order[0]!.reservedAt! - started;
      expect(sends).toEqual([fixture.recorded.answer]); expect(reviews).toBe(2);
      measurements.push({ mode, intakeMs, reads, probes });
      journal.close(); journal = openPreviewJournal(path, key);
      await make().drain(); expect(sends).toHaveLength(1);
    } finally { journal.close(); source.close(); rmSync(root, { recursive: true, force: true }); }
  }
  console.log('intake membership replay (injected 1000ms/read)', measurements);
  expect(measurements).toEqual([
    { mode: 'before', intakeMs: 12000, reads: 36, probes: 6 },
    { mode: 'cold', intakeMs: 6000, reads: 6, probes: 6 },
    { mode: 'warm', intakeMs: 0, reads: 0, probes: 6 },
  ]);
});
