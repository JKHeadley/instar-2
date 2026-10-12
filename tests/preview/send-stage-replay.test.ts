import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, type JournalRecord, type Turn } from './journal.js';
import { appendGroupCarry } from './group-carry.js';
import { verifyGroupAudience } from './group-disclosure.js';
import { key, now, scope, permissionFor } from './group-carry-fixture.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { parseReplyReviewVerdict, type ReplyRule } from './reply-check.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/group-audience-live-2026-10-10.json', import.meta.url), 'utf8')) as {
  recorded: { update: number; text: string; answer: string; checks: NonNullable<Turn['replyChecks']> };
  samples: { name: string; raw: string; rules: ReplyRule[] }[];
};
const memory = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as {
  genesis: { bot: string; operator: string; chat: string; grant: string; configurationDigest: string;
    maxCalls: number; maxReplies: number; maxTurns: number; maxBytes: number }; rows: JournalRecord[];
};
const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

// Recorded memory and answer/reviewer bytes; TEST-only authority, identity and transport.
// This measures worker dispatch with injected I/O, not live Telegram latency or model judgment quality.
it.each(['accepted', 'joined-before-send', 'stopped-during-probe', 'unknown-send'] as const)(
  'replays recorded question through the carried-memory send boundary: %s', async outcome => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const root = mkdtempSync(join(tmpdir(), 'send-stage-')); dirs.push(root);
    const source = openPreviewJournal(join(root, 'source'), key,
      { ...memory.genesis, kind: 'genesis', expires: now + 86400000, cursor: 0 });
    for (const row of memory.rows) source.append(row);
    const subject = { ...scope, operator: memory.genesis.operator, bot: memory.genesis.bot };
    const path = join(root, 'group');
    const journal = openPreviewJournal(path, key, { ...memory.genesis, kind: 'genesis', chat: subject.chat,
      forum: true, expires: now + 86400000, cursor: 0 });
    appendGroupCarry(journal, source, subject, permissionFor(subject), true, now, () => false);
    source.close();
    let afterReview = false, stopped = false, active = 0, peak = 0, probes = 0, reads = 0, models = 0, reviews = 0;
    let sendProbeReads = 0, sendProbeStart = 0;
    const sends: string[] = [], acknowledgements: string[] = [];
    const ports = {
      now: () => Date.now(), stopped: () => stopped,
      groupDisclosure: async () => {
        probes++;
        if (afterReview) sendProbeStart = Date.now();
        return verifyGroupAudience(subject, async (method, body) => {
          reads++; if (afterReview) sendProbeReads++;
          active++; peak = Math.max(peak, active);
          // Admission fits the bounded Jev attempt; only the send probe is deliberately slow.
          await new Promise(resolve => setTimeout(resolve, afterReview ? 1000 : 100)); active--;
          if (afterReview && outcome === 'stopped-during-probe') stopped = true;
          return { ok: true, result: method === 'getChat' ? { id: Number(subject.chat), type: 'supergroup', is_forum: true }
            : method === 'getMe' ? { id: Number(subject.bot), is_bot: true }
              : method === 'getChatMemberCount' ? afterReview && outcome === 'joined-before-send' ? 3 : 2
                : { status: 'member', user: { id: Number(body.user_id), is_bot: body.user_id === subject.bot } } };
        });
      },
      prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) =>
        prepareJournalEnvelope(input, 'claude-sonnet-5', memory.genesis.grant, Date.now()),
      // Trigger the acknowledgement with answer latency, independently of admission latency.
      model: async () => { models++; await new Promise(resolve => setTimeout(resolve, 8000)); return captured.recorded.answer; },
      checkOutbound: () => {},
      send: async (input: { expectedText: string }) => {
        if (input.expectedText === REPLY_ACKNOWLEDGEMENT) {
          acknowledgements.push(input.expectedText); return 2;
        }
        expect(journal.view.order[0]!.intent).toBe(captured.recorded.answer);
        sends.push(input.expectedText);
        await new Promise(resolve => setTimeout(resolve, 100));
        if (outcome === 'unknown-send') throw Error('transport outcome unknown');
        return 1;
      },
      replyCheck: { elapsedMs: () => Date.now(),
        jev: async () => { afterReview = true; return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(
          Object.entries(captured.recorded.checks[0]!.scores!).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 0 }; },
        escalate: async () => {
          reviews++;
          const sample = captured.samples.find(item => item.name === 'operator-only')!;
          const parsed = readAnswer(sample.raw, { wrapped: 'refuse' });
          if (!parsed.ok) throw Error('recorded review unreadable');
          return { ...parseReplyReviewVerdict(parsed.value, sample.rules), confidence: null, latencyMs: 0 };
        } },
    };
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: captured.recorded.update, message: { message_id: 1,
      chat: { id: Number(subject.chat), type: 'supergroup', is_forum: true },
      from: { id: Number(subject.operator) }, text: captured.recorded.text } }]);
    let failure: unknown;
    const draining = worker.drain().catch(error => { failure = error; });
    await vi.runAllTimersAsync(); await draining;
    const turn = journal.view.order[0]!;
    expect(models).toBe(1); expect(reviews).toBe(0); expect(turn.replyChecks?.map(check => check.path)).toEqual(['jev']);
    expect(acknowledgements).toEqual([REPLY_ACKNOWLEDGEMENT]); // the deliberately slow answer leaves time for one acknowledgement
    expect(active).toBe(0); expect(turn.text).toBe(captured.recorded.text);
    if (outcome === 'accepted') {
      console.log(JSON.stringify({ stage: 'send', update: captured.recorded.update, sendMs: turn.sendMs,
        audienceMs: Date.now() - sendProbeStart - 100, transportMs: 100, probes, reads, sendProbeReads, peak }));
      expect(failure).toBeUndefined(); expect(sends).toEqual([captured.recorded.answer]);
      expect(turn.sendMs).toBe(3100); expect(sendProbeReads).toBe(6); expect(peak).toBe(4); // the answer is ready before the ten-second acknowledgement deadline
    } else if (outcome === 'unknown-send') {
      expect(sends).toEqual([captured.recorded.answer]); expect(turn.intent).toBe(captured.recorded.answer);
      expect(turn.sent).toBeUndefined();
    } else {
      expect(sends).toEqual([]); expect(turn.intent).toBeUndefined();
      if (outcome === 'joined-before-send') expect(turn.held).toBe('group disclosure refused');
    }
    journal.close();
    // Accepted and uncertain dispatches both retain their durable cause and never retry after restart.
    if (outcome === 'accepted' || outcome === 'unknown-send') {
      const reopened = openPreviewJournal(path, key);
      const replay = createJournalWorker(reopened, ports).drain();
      await vi.runAllTimersAsync(); await replay;
      expect(sends).toHaveLength(1); expect(models).toBe(1); reopened.close();
    }
  });
