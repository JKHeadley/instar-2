import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MODEL_FAILURE_REPLY, UNKNOWN_ANSWER_NOTICE, openPreviewJournal,
  type PreviewPorts } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { HOLDING_REPLY, JEV_MODEL, REPLY_RULES } from './reply-check.js';

const key = new Uint8Array(32).fill(61);
const now = 1790000000000;
const modelId = 'claude-sonnet-5';
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text } });
const genesis = (maxBytes = 32768) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 120, maxReplies: 80, maxTurns: 80, maxBytes, cursor: 0 });
const answer = (reply: string) => JSON.stringify({ reply, memory: [] });
const summary = JSON.stringify({ summary: 'The operator is testing the preview journal.', people: [], memory: [], commitments: [] });

async function withJournal(run: (journal: ReturnType<typeof openPreviewJournal>, path: string) => Promise<void>, maxBytes = 32768) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-live-regressions-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(maxBytes));
  try { await run(journal, path); }
  finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}
const basePorts = (model: PreviewPorts['model'], sent: string[] = []): PreviewPorts => ({
  now: () => now, stopped: () => false, model,
  prepareModel: input => prepareJournalEnvelope(input, modelId, 'grant:preview', now),
  send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {} });

it('thinking overflow: a 2048-cap answer reporting 8192 output tokens is rejected once and later work proceeds', async () => {
  await withJournal(async journal => {
    const sent: string[] = [], calls: string[] = [];
    const worker = createJournalWorker(journal, basePorts(async input => {
      calls.push(input.id);
      if (input.question === 'First live question') {
        journal.append({ kind: 'call-outcome', id: input.id, role: 'model', at: now,
          outcome: { exitCode: 0, localLimit: 'output-cap', elapsedMs: 2000, type: 'result',
            subtype: 'success', isError: false, outputTokens: 8192, promptBytes: Buffer.byteLength(input.prepared!) } });
        return { state: 'rejected', failureClass: 'rejected',
          usage: { inputTokens: 400, outputTokens: 8192, charge: null } };
      }
      return { text: answer('The second answer is available.'),
          usage: { inputTokens: 400, outputTokens: 2048, charge: null } };
    }, sent));
    worker.intake([update(1, 'First live question')]); await worker.drain();
    expect(journal.view.order[0]).toMatchObject({ modelState: 'rejected', failureClass: 'rejected',
      answer: MODEL_FAILURE_REPLY });
    expect(journal.view.order[0]?.intent).toBe(`PREVIEW — ${MODEL_FAILURE_REPLY}`);
    expect(journal.view.callOutcomes).toMatchObject([{ role: 'model',
      outcome: { localLimit: 'output-cap', outputTokens: 8192 } }]);
    worker.intake([update(2, 'Second live question')]); await worker.drain();
    expect(calls.filter(id => id.endsWith(':1'))).toHaveLength(1);
    expect(journal.view.order[1]?.intent).toBe('PREVIEW — The second answer is available.');
    expect(journal.view.order[1]?.modelState).toBe('complete');
    expect(sent).toHaveLength(2);
  });
});

it('review thinking overflow: a 3617-token review outcome holds the candidate without a second paid review', async () => {
  await withJournal(async journal => {
    const sent: string[] = [];
    let reviews = 0;
    const ports = basePorts(async () => answer('The candidate answer.'), sent);
    ports.replyCheck = { jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
      .map(id => [id, { type: 'noul', noul: 0.5 }])) }, latencyMs: 0 }),
    escalate: async (_candidate, id) => {
      reviews++;
      journal.append({ kind: 'call-outcome', id: `${id}:reply-review`, role: 'reply-review', at: now,
        outcome: { exitCode: 0, localLimit: 'output-cap', elapsedMs: 2000, type: 'result', subtype: 'success',
          isError: false, outputTokens: 3617, promptBytes: 6000 } });
      throw Error('review output cap');
    }, elapsedMs: () => 0 };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Review this answer')]); await worker.drain(); await worker.drain();
    expect(journal.view.order[0]).toMatchObject({ held: 'reply check unavailable', reviewReserved: true });
    expect(journal.view.callOutcomes).toMatchObject([{ role: 'reply-review',
      outcome: { localLimit: 'output-cap', outputTokens: 3617 } }]);
    expect(reviews).toBe(1);
    expect(sent).toEqual([]);
  });
});

it('wrapped Decision JSON: a malformed wrapped answer cannot be sent as raw model syntax', async () => {
  await withJournal(async journal => {
    const sent: string[] = [];
    const wrapped = '```json\n' + answer('The journal remembers this trial.') + '\n```';
    const worker = createJournalWorker(journal, { ...basePorts(async input => input.id.endsWith(':1')
      ? wrapped : answer('The journal remembers this trial.'), sent),
      replyCheck: { jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
        .map(id => [id, { type: 'noul', noul: 0.5 }])) }, latencyMs: 0 }),
      escalate: async candidate => ({ verdict: candidate.includes('```') ? 'violation' as const : 'pass' as const,
        ruleIds: [], confidence: 1, latencyMs: 0 }), elapsedMs: () => 0 } });
    worker.intake([update(1, 'What can you remember?')]); await worker.drain();
    expect(journal.view.order[0]?.intent).toBe(HOLDING_REPLY);
    expect(sent).toEqual([HOLDING_REPLY]);
    expect(journal.view.order[0]?.replyChecks?.at(-1)?.verdict).toBe('violation');
    worker.intake([update(2, 'What does this journal hold?')]); await worker.drain();
    expect(sent[1]).toBe('PREVIEW — The journal remembers this trial.');
  });
});

it('summary preflight unavailable: the original turn is held without a summary reservation or provider call', async () => {
  await withJournal(async journal => {
    const sent: string[] = [], calls: string[] = [];
    let denySummary = true;
    const ports = basePorts(async input => { calls.push(input.id);
      return input.id.startsWith('summary:') ? summary : answer('Recovered from the durable journal.'); }, sent);
    const prepared = ports.prepareModel!;
    ports.prepareModel = input => {
      if (denySummary && input.id.startsWith('summary:')) throw Error('preview: complete prompt overflow');
      return prepared(input);
    };
    const worker = createJournalWorker(journal, ports);
    for (let id = 1; id <= 4; id++) {
      worker.intake([update(id, `Earlier recorded turn ${id}: ${'studio detail '.repeat(65)}`)]);
      await worker.drain();
    }
    journal.view.limits.maxBytes = 3700;
    worker.intake([update(5, 'What do you remember about the studio?')]); await worker.drain();
    expect(journal.view.order[4]?.held).toMatch(/summary unavailable|summary preflight unavailable|overflow/u);
    expect(journal.view.order[4]?.reserved).toBe(false);
    expect(calls.filter(id => id.startsWith('summary:'))).toHaveLength(0);
    expect(sent).toHaveLength(4);
    denySummary = false;
    journal.view.limits.maxBytes = 32768;
    await worker.drain();
    expect(journal.view.order[4]?.intent).toBe('PREVIEW — Recovered from the durable journal.');
    expect(sent).toHaveLength(5);
  }, 32768);
});

it('uncertain effect: a charged unknown answer gets only its loss notice and is never retried', async () => {
  await withJournal(async journal => {
    const sent: string[] = [], calls: string[] = [];
    const worker = createJournalWorker(journal, basePorts(async input => { calls.push(input.id);
      return input.question === 'Uncertain first turn' ? { state: 'uncertain',
        usage: { inputTokens: 512, outputTokens: 3617, charge: null } } : answer('The next turn works.'); }, sent));
    worker.intake([update(1, 'Uncertain first turn')]); await worker.drain(); await worker.drain();
    expect(journal.view.order[0]).toMatchObject({ reserved: true, modelState: 'uncertain' });
    expect(journal.view.order[0]?.intent).toBe(`PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`);
    worker.intake([update(2, 'Independent next turn')]); await worker.drain();
    expect(calls.filter(id => id.endsWith(':1'))).toHaveLength(1);
    expect(journal.view.order[1]?.intent).toBe('PREVIEW — The next turn works.');
    expect(sent).toEqual([`PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`, 'PREVIEW — The next turn works.']);
  });
});

it('memory denial: full-context review holds a false no-memory claim while a grounded answer passes', async () => {
  await withJournal(async journal => {
    const sent: string[] = [], packets: string[] = [];
    const ports = basePorts(async input => { packets.push(input.context);
      return input.question.startsWith('Can you') ? answer('I do not store memory.')
        : answer('I can use this trial journal to remember earlier turns.'); }, sent);
    ports.replyCheck = { jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
      .map(id => [id, { type: 'noul', noul: 0.5 }])) }, latencyMs: 0 }),
    escalate: async (candidate, _id, originalPrompt) => {
      expect(originalPrompt).toContain('Memory is this trial');
      return { verdict: candidate.includes('do not store memory') ? 'violation' as const : 'pass' as const,
        ruleIds: [], confidence: 1, latencyMs: 0 };
    }, elapsedMs: () => 0 };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Can you remember what I tell you?')]); await worker.drain();
    worker.intake([update(2, 'What can this preview remember?')]); await worker.drain();
    expect(JSON.parse(packets[0]!).capability).toContain('Memory is this trial');
    expect(sent).toEqual([HOLDING_REPLY, 'PREVIEW — I can use this trial journal to remember earlier turns.']);
  });
});

it('turn 36 packet growth: actual prepared prompts stay within the 32 KiB cap and replies continue', async () => {
  await withJournal(async journal => {
    const sent: string[] = [], bytes: number[] = [], summaryBytes: number[] = [];
    const ports = basePorts(async input => input.id.startsWith('summary:') ? summary : answer('Recorded.'), sent);
    const prepared = ports.prepareModel!;
    ports.prepareModel = input => { const envelope = prepared(input);
      (input.id.startsWith('summary:') ? summaryBytes : bytes).push(Buffer.byteLength(envelope));
      return envelope; };
    const worker = createJournalWorker(journal, ports);
    let rawHistoryBytes = 0;
    for (let id = 1; id <= 36; id++) {
      const message = `Studio turn ${id}: ${'planning detail '.repeat(100)}`;
      rawHistoryBytes += Buffer.byteLength(message);
      worker.intake([update(id, message)]);
      await worker.drain();
    }
    expect(rawHistoryBytes).toBeGreaterThan(55 * 1024);
    expect(journal.view.order[35]?.sent).toBeDefined();
    expect(sent).toHaveLength(36);
    expect(journal.view.summaries.length).toBeGreaterThan(0);
    expect(Math.max(...bytes)).toBeLessThanOrEqual(32768);
    expect(Math.max(...summaryBytes)).toBeLessThanOrEqual(24576);
    expect(journal.view.order.every(turn => turn.held === undefined)).toBe(true);
  });
}, 120000);
