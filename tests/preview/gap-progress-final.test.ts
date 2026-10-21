import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts, type Turn, type ToolAttempt } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { HOLDING_REPLY, type ReplyCheckResult } from './reply-check.js';
import { loopHealth } from './obligations.js';
import { splitReply } from './reply-parts.js';

// Read-only capture from the Studio journal. Models/transport are replayed, never called live.
const capture = JSON.parse(readFileSync(new URL('./fixtures/gap-progress-final-2026-10-18.json', import.meta.url), 'utf8')) as {
  turns: { update: number; at: number; question: string; answer: string; revision: NonNullable<Turn['revision']>;
    checks: ReplyCheckResult[]; revisionReview: NonNullable<Turn['revisionReview']>; delivered: string }[];
  work: { key: string; subject: string; report: string }[];
  tools: { update: number; calls: (Omit<ToolAttempt, 'n'> & { reason: string })[]; consistent: boolean };
};
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const key = new Uint8Array(32).fill(48);
const primary = (answer: string) => answer.split('\n\nFollow-up on "')[0]!;
function world(hold = true, unknown = false) {
  const root = mkdtempSync(join(tmpdir(), 'gap-progress-final-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8993213212', chat: '7812716706', operator: '7812716706',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0, loopRevisitMs: 600000 });
  let now = capture.turns[0]!.at - 601000, current = capture.turns[0]!, seed = true;
  const sent: string[] = [], revisions: string[] = [];
  const ports: PreviewPorts = {
    now: () => now, stopped: () => false, checkOutbound: () => {},
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        const packet = JSON.parse(input.context) as { obligation: { quote: string } };
        return JSON.stringify({ outcome: 'report', report: capture.work.find(w => w.subject === packet.obligation.quote)!.report });
      }
      if (!seed && current.update === capture.tools.update) {
        // Replay the actual admitted Write/Read/wc results without executing the recorded commands.
        journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 3, at: now });
        journal.append({ kind: 'tool-turn', phase: 'trace', id: input.id, attempt: 0, workspaceBytes: 25,
          consistent: capture.tools.consistent, calls: capture.tools.calls.map((call, n) => ({ ...call, n })), at: now });
      }
      return seed ? JSON.stringify({ reply: capture.work.map(w => w.subject).join('\n'), memory: [],
        openLoops: capture.work.map(w => ({ kind: 'deferral', quote: w.subject, waitsOn: 'nothing' })) })
        : primary(current.answer);
    },
    replyCheck: { elapsedMs: () => 0,
      jev: async body => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(
        !seed && hold && body.includes(capture.work.find(work => work.key === 'commitment:0')!.report) ? current.checks[0]!.scores! : { raw_path: 0.02, cli_command: 0.02,
          config_key: 0.02, credential: 0.02, api_endpoint: 0.02, quits_on_self: 0.02, claims_blocked: 0.02,
          parks_on_user: 0.02, defers_work: 0.02, unrecorded_blocker: 0.02 }).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 0 }),
      escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => {
        const result = operation === 'revision' ? current.revisionReview : current.checks.find(check => check.path === 'subscription')!;
        if (result.verdict !== 'pass' && result.verdict !== 'violation') throw Error('recorded review unavailable');
        return { ...result, verdict: result.verdict, confidence: null, latencyMs: 0 };
      },
      revise: async input => { revisions.push(input.text); return { ...current.revision, state: current.revision.state === 'failed' ? 'uncertain' : current.revision.state }; } },
    send: async input => { sent.push(input.expectedText); return unknown ? null : sent.length; },
  };
  let worker = createJournalWorker(journal, ports);
  const say = async (update: number, question: string) => {
    worker.intake([{ update_id: update, message: { message_id: update, chat: { id: 7812716706, type: 'private' },
      from: { id: 7812716706 }, text: question, date: Math.floor(now / 1000) } }]);
    await worker.drain();
  };
  return { sent, revisions, path, ports, get journal() { return journal; }, get worker() { return worker; },
    async prepare() {
      await say(46040270, capture.work.map(w => w.subject).join('\n'));
      seed = false; now += 600000;
      for (let i = 0; i < capture.work.length; i++) await worker.workObligations();
      expect(loopHealth(journal.view, now).awaitingDelivery).toBe(3);
      now = current.at; await say(current.update, current.question);
    },
    async answer(index: number) { current = capture.turns[index]!; now = current.at; await say(current.update, current.question); },
    reopen() { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); },
  };
}

it.each([1, 2])('a held follow-up cannot replace recorded final answer %i (garden split / tool byte count)', async index => {
  const w = world();
  try {
    await w.prepare();
    expect(w.sent.at(-1)).toBe(HOLDING_REPLY); // Real prior hi, update 46040277, held the library report.
    const before = w.sent.length;
    await w.answer(index);
    const answer = primary(capture.turns[index]!.answer), parts = splitReply(answer)!.map(part => part.replaceAll('**', ''));
    expect(w.sent.slice(before)).toEqual(parts);
    if (index === 1) { expect(parts.length).toBeGreaterThan(1); expect(parts.join('\n')).toContain('December — Sow:'); }
    else expect(parts.join('\n')).toContain('Byte count: 25 bytes');
    const turn = w.journal.view.order.at(-1)!;
    expect(turn.heldReview).toBeUndefined();
    if (index === 2) {
      expect(turn.toolAttempts?.map(call => [call.tool, call.decision])).toEqual([['Write', 'allow'], ['Read', 'allow'], ['Bash', 'allow']]);
      expect(turn.toolAttempts?.at(-1)?.result).toContain('25');
    }
    expect(turn.sent).toBeDefined();
    expect(turn.replyParts?.every(part => part.sent !== undefined) ?? true).toBe(true);
  } finally { w.journal.close(); }
});

it.each([false, true])('held reports remain owned repair work across restart, including UNKNOWN notice=%s', async unknown => {
  const w = world(true, unknown);
  try {
    await w.prepare(); w.reopen();
    expect(loopHealth(w.journal.view, capture.turns[0]!.at).awaitingDelivery).toBe(0);
    expect(w.journal.view.closed.size).toBe(0);
    const withheld = Object.values(w.journal.view.obligationWork).map(work => work.withheld?.text);
    expect(withheld.sort()).toEqual(capture.work.map(work => work.report).sort());
    expect(Object.values(w.journal.view.obligationWork).every(work => !!work.withheld?.objection)).toBe(true);
  } finally { w.journal.close(); }
});

it('a passing follow-up delivers and settles each report once instead of returning it to repair', async () => {
  const w = world(false);
  try {
    await w.prepare(); w.reopen();
    expect(Object.values(w.journal.view.obligationWork).every(work => work.report?.delivered && !work.withheld)).toBe(true);
    expect(w.journal.view.closed.size).toBe(3);
    const before = w.sent.length; await w.answer(2);
    expect(w.sent.slice(before)).toEqual([primary(capture.turns[2]!.answer)]);
  } finally { w.journal.close(); }
});
