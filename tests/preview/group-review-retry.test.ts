import { expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { appendGroupCarry } from './group-carry.js';
import { createJournalWorker, openPreviewJournal, replyTimings, type PreviewPorts } from './journal-test-worker.js';
import { GROUP_MEMBERSHIP_FINAL_NOTICE, GROUP_REVIEW_FINAL_NOTICE, ModelDisclosureRefused,
  type ReplyCheckResult } from './reply-check.js';
import { now, key, scope, membership, permissionFor } from './group-carry-fixture.js';
// @ts-expect-error Shipped host port is JavaScript, like production-boot-io.mjs.
import { groupMembershipReader, requireGroupDisclosureFor } from './group-membership-io.mjs';

// Exact answer and review timing quoted from the read-only live diagnosis for update 969390331,
// lanes/helper-topic3-hold-PROGRESS.md, build afa6be39, 2026-10-10 08:49–08:51 PDT.
// The diagnostic did NOT capture all raw Jev scores or the provider error. Do not invent either.
const recorded = { update: 969390331, thread: 3,
  answer: "Got it — I'll remember that the word for this topic is CEDAR.", latencyMs: 2319 };
const capturedUnknown = JSON.parse(readFileSync(new URL('./fixtures/review-unavailable-2026-10-09.json', import.meta.url), 'utf8'));
const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.chat, operator: scope.operator, forum: true as const,
  grant: 'TEST-lineage', configurationDigest: 'sha256:test', expires: now + 86400000,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 };

async function scenario(mode: 'transient' | 'persistent' | 'changed' | 'charged' | 'stop' | 'deadline' | 'crash' | 'format') {
  const dir = mkdtempSync(join(tmpdir(), 'group-review-retry-'));
  const path = join(dir, 'journal.encrypted'), crashed = join(dir, 'crashed.encrypted');
  const { forum: _forum, ...privateGenesis } = genesis;
  const source = openPreviewJournal(join(dir, 'source.encrypted'), key, { ...privateGenesis, chat: scope.operator });
  const journal = openPreviewJournal(path, key, genesis);
  appendGroupCarry(journal, source, scope, permissionFor(scope), true, now, () => false);
  source.close();
  let clock = now + 1000, stopped = false, reviews = 0, providerCalls = 0, failing = false, checks = 0;
  const waits: number[] = [], sent: Parameters<PreviewPorts['send']>[0][] = [];
  const read = groupMembershipReader({ poll: async ({ method, body }: { method: string; body: Record<string, string> }) => {
    checks++;
    if (failing && mode !== 'changed') return { kind: 'response', status: 503, bytes: '{}' };
    const response = await membership((m, _b, v) => failing && mode === 'changed' && m === 'getChatMemberCount' ? 3 : v)(method as never, body);
    if (method === 'getMe') return { kind: 'identity', identity: (response as { result: unknown }).result };
    return { kind: 'response', status: 200, bytes: JSON.stringify(response) };
  } }, () => 'TEST-only', {}, {}, async (ms: number) => { waits.push(ms); clock += ms; });
  const groupDisclosure = async () => { await requireGroupDisclosureFor(scope, () => ({ kind: 'resolved' }), read); return true; };
  const p: PreviewPorts = { now: () => clock, stopped: () => stopped, groupDisclosure,
    model: async () => { throw Error('captured answer must not be regenerated'); }, checkOutbound: () => {},
    send: async input => { sent.push(input); return 7; },
    replyCheck: { elapsedMs: () => clock, jev: async () => { throw Error('captured Jev pass must not repeat'); },
      waitForRetry: async ms => { waits.push(ms); clock += mode === 'deadline' ? 60001 : ms;
        if (mode === 'transient' || mode === 'crash' || mode === 'format') failing = false;
        if (mode === 'stop') stopped = true;
      },
      escalate: async (_text, id) => {
        reviews++;
        if (reviews === 1 && mode !== 'charged') failing = true;
        await groupDisclosure(); // the actual host checkpoint, before route.invoke
        providerCalls++;
        if (mode === 'crash') copyFileSync(path, crashed);
        if (mode === 'format' && providerCalls === 1) throw Error('preview: review malformed');
        if (mode === 'charged') {
          const live = capturedUnknown.turns[0];
          journal.append({ kind: 'reply-review-state', id, state: live.reviewState, diagnostics: live.reviewDiagnostics, at: clock });
          throw Error('preview: reply review unavailable');
        }
        return { verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 };
      } } };
  try {
    const worker = createJournalWorker(journal, p);
    worker.intake([{ update_id: recorded.update, message: { message_id: 6, message_thread_id: recorded.thread,
      chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true }, from: { id: Number(scope.operator) },
      text: 'Remember CEDAR for this topic.' } }]);
    const id = journal.view.order[0]!.id;
    const prompt = JSON.stringify({ messages: [{ role: 'user', content: 'Remember CEDAR for this topic.' },
      { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-group-topic', chat: scope.chat } } }) }] });
    journal.append({ kind: 'reserve', id, prompt, at: clock });
    journal.append({ kind: 'answer', id, text: recorded.answer, state: 'complete', at: clock });
    journal.append({ kind: 'reply-jev-reserve', id, at: clock });
    journal.append({ kind: 'reply-check', id, result: { verdict: 'pass', path: 'jev', ruleIds: [], confidence: null, latencyMs: 156 }, at: clock });
    const reservedBeforeReview = journal.view.calls;
    if (mode === 'stop') await expect(worker.drain()).rejects.toThrow('preview stopped');
    else { await worker.drain(); await worker.drain(); }
    const turn = journal.view.order[0]!;
    const results = [...turn.replyChecks ?? []];
    if (mode === 'transient') {
      expect(replyTimings(journal.view).perReply[0]?.fallbackMs).toBe(750);
      expect(results.map(row => [row.path, row.verdict])).toEqual([['jev', 'pass'], ['holding', 'unavailable'], ['subscription', 'pass']]);
    }
    if (mode === 'persistent') expect(replyTimings(journal.view).perReply[0]?.fallbackMs).toBe(1000);
    if (mode === 'stop') {
      expect(sent).toEqual([]); expect(providerCalls).toBe(0);
    } else {
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ chat: scope.chat, thread: 3, update: recorded.update, replyTo: 6,
        expectedText: mode === 'transient' || mode === 'crash' || mode === 'format' ? recorded.answer
          : mode === 'charged' ? GROUP_REVIEW_FINAL_NOTICE : GROUP_MEMBERSHIP_FINAL_NOTICE });
      expect(turn.answer).toBe(recorded.answer);
      expect(turn.sent).toBe(7);
      if (mode !== 'transient' && mode !== 'crash' && mode !== 'format') expect(turn.heldReview).toBeDefined();
    }
    expect(providerCalls).toBe(mode === 'format' ? 2 : ['transient', 'crash', 'charged'].includes(mode) ? 1 : 0);
    expect(waits.filter(ms => ms === 500)).toHaveLength(mode === 'charged' || mode === 'changed' ? 0 : 1);
    if (mode !== 'charged') expect(results.some(row => row.verdict === 'unavailable'
      && row.reason === (mode === 'changed' ? 'group-membership-changed' : 'group-membership-unavailable'))).toBe(true);
    const calls = journal.view.calls;
    expect(calls).toBe(reservedBeforeReview + (mode === 'format' ? 2 : 1)); // the uncharged retry reuses exactly one reserved slot
    journal.close();
    if (mode !== 'stop') {
      const reopened = openPreviewJournal(mode === 'crash' ? crashed : path, key);
      const before = reviews;
      const repair = { ...p, groupDisclosure: async () => true };
      await createJournalWorker(reopened, repair).drain(); await createJournalWorker(reopened, repair).drain();
      expect(reviews).toBe(before); expect(reopened.view.calls).toBe(calls);
      expect(sent).toHaveLength(mode === 'crash' ? 2 : 1);
      if (mode === 'crash') expect(sent[1]?.expectedText).toBe(GROUP_REVIEW_FINAL_NOTICE);
      reopened.close();
    }
    expect(checks).toBeGreaterThan(0);
    return results;
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
}

it.each(['transient', 'persistent', 'changed', 'charged', 'stop', 'deadline', 'crash', 'format'] as const)(
  'live CEDAR shape: %s failure uses the existing release/send path and preserves every floor', async mode => { await scenario(mode); });

it('typed pre-dispatch proof cannot be confused with a provider error carrying the same words', async () => {
  const { reviewReply } = await import('./reply-check.js');
  for (const error of [Error('group-membership-unavailable'), new ModelDisclosureRefused('group-membership-changed')]) {
    let count = 0, waits = 0; const rows: ReplyCheckResult[] = [];
    const result = await reviewReply(recorded.answer, 'id', { jev: async () => { throw Error('unused'); },
      escalate: async () => { count++; throw error; }, reserveEscalation: () => true,
      waitForRetry: async () => { waits++; }, elapsedMs: () => 0, record: row => rows.push(row) }, []);
    expect(result.outcome).toBe('unavailable'); expect(count).toBe(1); expect(waits).toBe(0);
    expect(rows.at(-1)?.reason).toBeDefined();
  }
});


it('the shipped callSubscription boundary removes pre-dispatch retry proof after any provider attempt', async () => {
  const launcher = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  const start = launcher.indexOf('const callSubscription ='), end = launcher.indexOf('const callJev =', start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  for (const before of [true, false]) {
    let invoked = 0; const recordedCalls: unknown[] = [];
    const refuse = () => { throw new ModelDisclosureRefused('group-membership-unavailable', true); };
    // Execute the actual launcher boundary with only its physical dispatch and clock injected.
    const call = runInNewContext(`(() => { ${launcher.slice(start, end)} return callSubscription; })()`, {
      requireGroupDisclosure: async () => { if (before) refuse(); }, ModelDisclosureRefused,
      wallNow: () => 1, assertLiveJudgment: () => {}, shared: null,
      modelRoute: () => ({ invoke: async () => { invoked++; refuse(); } }), performance: { now: () => 0 },
      journal: { view: { turns: new Map() } }, required: () => 'TEST-model', options: {},
      recordModelCall: (row: unknown) => recordedCalls.push(row),
    }) as (...args: unknown[]) => Promise<unknown>;
    const error = await call('reply-review', 'TEST packet', 'TEST id', { deadline: 100 }).catch((e: unknown) => e);
    expect(error instanceof ModelDisclosureRefused).toBe(before);
    expect(invoked).toBe(before ? 0 : 1); expect(recordedCalls).toHaveLength(before ? 0 : 1);
  }
});
