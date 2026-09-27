import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';
import { interpretSummaryJev, interpretSummaryReview, SUMMARY_QUESTION } from './summary-check.js';
import { readRuns, selfState, selfStateSource } from './self-state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { spawnSync } from 'node:child_process';
import { createDecipheriv } from 'node:crypto';
import type { JournalRecord } from './journal.js';

const key = new Uint8Array(32).fill(31);
const genesis = (maxCalls = 12) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls, maxReplies: 12, maxTurns: 12, maxBytes: 32768, cursor: 0 });
const replyScores = () => Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0 }]));
const jevAnswer = (score: number) => ({ model: JEV_MODEL, answers: { summary_integrity: { type: 'noul', noul: score } } });
const usage = { inputTokens: 1234, outputTokens: 67, charge: null };
const reviewUsage = { inputTokens: 321, outputTokens: 12, charge: null };
function records(path: string): JournalRecord[] {
  const bytes = readFileSync(path), rows: JournalRecord[] = [];
  for (let offset = 0; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), frame = bytes.subarray(offset + 4, offset + 4 + length);
    const decipher = createDecipheriv('aes-256-gcm', key, frame.subarray(0, 12));
    decipher.setAAD(Buffer.from(`preview-journal:${offset}`)); decipher.setAuthTag(frame.subarray(12, 28));
    rows.push(JSON.parse(Buffer.concat([decipher.update(frame.subarray(28)), decipher.final()]).toString('utf8')) as JournalRecord);
    offset += length + 4;
  }
  return rows;
}

async function caseRun(score: number | 'unavailable', review: 'pass' | 'violation' | 'unavailable' | 'definite-unavailable' = 'pass', maxCalls = 12) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-check-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(maxCalls));
  let summaryChecks = 0, reviews = 0, observed = '';
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
    model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'On 26 September, Justin asked us to remember the launch.', people: [], commitments: [], memory: [] })
      : 'I will remember the launch.',
    send: async () => 1, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 100,
      jev: async (state, questions) => {
        if (!questions) return { value: { model: JEV_MODEL, answers: replyScores() }, latencyMs: 10 };
        expect(questions).toEqual(SUMMARY_QUESTION);
        observed = state; summaryChecks++;
        if (score === 'unavailable') throw Error('TypeSafe unavailable');
        return { value: jevAnswer(score), latencyMs: 20 };
      },
      escalate: async () => { throw Error('reply escalation not expected'); },
      summaryReview: async state => {
        reviews++; expect(state).toContain('Justin asked us to remember the launch');
        if (review === 'unavailable') throw Error('review outcome unknown');
        if (review === 'definite-unavailable') return { verdict: 'unavailable' as const, retryable: true as const, latencyMs: 30 };
        return { verdict: review, latencyMs: 30 };
      } } });
  worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'On 26 September, remember the launch.' } }]);
  await worker.drain(); await worker.summarizeIfNeeded(true);
  return { root, journal, worker, get summaryChecks() { return summaryChecks; }, get reviews() { return reviews; }, get observed() { return observed; } };
}

it('classifies Jev pass, violation, uncertainty and malformed output', () => {
  expect(interpretSummaryJev(jevAnswer(0.1), 1).verdict).toBe('pass');
  expect(interpretSummaryJev(jevAnswer(0.9), 1).verdict).toBe('violation');
  expect(interpretSummaryJev(jevAnswer(0.5), 1).verdict).toBe('unsure');
  expect(() => interpretSummaryJev(jevAnswer(Number.NaN), 1)).toThrow();
});

it('keeps uncertain review usage and the UNKNOWN fence; definite outcomes can retry or decide', () => {
  expect(interpretSummaryReview({ state: 'uncertain', usage: reviewUsage }, 30)).toMatchObject({
    verdict: 'unavailable', path: 'subscription', usage: reviewUsage });
  expect(interpretSummaryReview({ state: 'uncertain' }, 30)).not.toHaveProperty('retryable');
  expect(interpretSummaryReview({ state: 'rejected', usage: reviewUsage }, 30)).toMatchObject({
    verdict: 'unavailable', retryable: true, usage: reviewUsage });
  expect(interpretSummaryReview({ state: 'complete', value: '{"verdict":"pass","reason":"All turns covered."}', usage: reviewUsage }, 30))
    .toMatchObject({ verdict: 'pass', reason: 'All turns covered.', usage: reviewUsage });
  expect(interpretSummaryReview({ state: 'complete', value: '{"verdict":"violation","reason":"A commitment is missing."}' }, 30))
    .toMatchObject({ verdict: 'violation', reason: 'A commitment is missing.' });
});

it.each([0.05, 0.9, 0.5])('accepts only a passing Jev or full-context review (%s)', async score => {
  const run = await caseRun(score);
  try {
    expect(run.journal.view.summaries).toHaveLength(1);
    expect(run.summaryChecks).toBe(1);
    expect(run.reviews).toBe(score === 0.05 ? 0 : 1);
    expect(run.observed).toContain('On 26 September, remember the launch.');
    expect(run.journal.view.summaryCandidates.get(1)).toBe(run.observed);
    expect(run.journal.view.summaryCheckCounts.pass).toBe(1);
    run.journal.close();
    const replay = openPreviewJournal(join(run.root, 'journal.encrypted'), key);
    expect(replay.view.summaries).toHaveLength(1);
    expect(replay.view.summaryCheckCounts.pass).toBe(1);
    replay.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('redacts quoted summary secrets before serializing the supervisor payload and keeps ordinary prose', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-secret-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis());
    const secret = 'fixture-secret-9283';
    let supervised = '';
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: `The studio trial continues. password: "${secret}"`, people: [], memory: [], commitments: [] })
        : 'The studio trial continues.',
      summaryCheck: async () => ({ model: JEV_MODEL, answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      replyCheck: { elapsedMs: () => 100, jev: async (state, questions) => {
        if (questions) { supervised = state; return { value: jevAnswer(0.05), latencyMs: 1 }; }
        return { value: { model: JEV_MODEL, answers: replyScores() }, latencyMs: 1 };
      }, escalate: async () => { throw Error('unexpected review'); } },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Please continue the studio trial.' } }]);
    await worker.drain(); await worker.summarizeIfNeeded(true);
    expect(supervised).toContain('The studio trial continues.');
    expect(supervised).not.toContain(secret);
    expect(JSON.parse(supervised).proposed.summary).not.toContain(secret);
    expect(journal.view.summaryCandidates.get(1)).toBe(supervised);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.summaryCandidates.get(1)).not.toContain(secret);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([[0.9, 'violation'], ['unavailable', 'pass']])('keeps the prior frontier on %s / %s', async (score, review) => {
  const run = await caseRun(score as number | 'unavailable', review as 'pass' | 'violation');
  try {
    expect(run.journal.view.summaries).toHaveLength(0);
    expect(run.journal.view.summaryFailures.get(1)).toBe(1);
    expect(run.journal.view.order[0]?.text).toContain('remember the launch');
    expect(run.journal.view.summaryCheckCounts[score === 'unavailable' ? 'unavailable' : 'violation']).toBeGreaterThan(0);
    expect(run.journal.view.summaryCandidates.get(1)).toContain('Justin asked us to remember the launch');
    run.journal.close();
    const replay = openPreviewJournal(join(run.root, 'journal.encrypted'), key);
    expect(replay.view.summaries).toHaveLength(0);
    expect(replay.view.order).toHaveLength(1);
    replay.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('reserves a review under the shared cap and leaves an unknown review pending', async () => {
  const run = await caseRun(0.9, 'unavailable');
  try {
    expect(run.journal.view.calls).toBe(3);
    expect(run.journal.view.summaryReservations.has(1)).toBe(true);
    expect(run.journal.view.summaries).toHaveLength(0);
    run.journal.close();
    const replay = openPreviewJournal(join(run.root, 'journal.encrypted'), key);
    expect(replay.view.summaryReservations.has(1)).toBe(true);
    replay.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('retries a definite subscription failure without accepting the candidate', async () => {
  const run = await caseRun(0.9, 'definite-unavailable');
  try {
    expect(run.journal.view.summaries).toHaveLength(0);
    expect(run.journal.view.summaryFailures.get(1)).toBe(1);
    expect(run.journal.view.summaryReservations.size).toBe(0);
    expect(run.journal.view.summaryCheckCounts.unavailable).toBe(1);
    run.journal.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('retries an unavailable Jev result only within the existing two-attempt frontier bound', async () => {
  const run = await caseRun('unavailable');
  try {
    await run.worker.summarizeIfNeeded(true);
    await run.worker.summarizeIfNeeded(true);
    expect(run.summaryChecks).toBe(2);
    expect(run.journal.view.summaryFailures.get(1)).toBe(2);
    expect(run.journal.view.summaries).toHaveLength(0);
    expect(run.journal.view.calls).toBe(3);
    expect(run.journal.view.order[0]?.text).toContain('remember the launch');
    run.journal.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('does not reserve a paid review or accept a summary after stop during Jev', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-stop-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let stopped = false, reviews = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
      model: async input => input.id.startsWith('summary:') ? 'A proposed summary.' : 'ok',
      send: async () => 1, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100,
        jev: async (_state, questions) => {
          if (questions) { stopped = true; return { value: jevAnswer(0.9), latencyMs: 20 }; }
          return { value: { model: JEV_MODEL, answers: replyScores() }, latencyMs: 10 };
        },
        escalate: async () => { throw Error('unexpected reply review'); },
        summaryReview: async () => { reviews++; return { verdict: 'pass', latencyMs: 20 }; } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Remember Maya on Tuesday.' } }]);
    await worker.drain();
    await expect(worker.summarizeIfNeeded(true)).rejects.toThrow('preview stopped');
    expect(reviews).toBe(0);
    expect(journal.view.calls).toBe(2);
    expect(journal.view.summaries).toHaveLength(0);
    expect(journal.view.order).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['stop', 'expiry'] as const)('retains completed summary usage when %s arrives during the model call', async cause => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-interrupted-')));
  const path = join(root, 'journal.encrypted');
  const grant = genesis();
  let stopped = false, now = 1000, checks = 0, reviews = 0;
  const journal = openPreviewJournal(path, key, grant);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    model: async input => {
      if (!input.id.startsWith('summary:')) return 'ok';
      if (cause === 'stop') stopped = true;
      else now = grant.expires;
      return { state: 'complete', text: JSON.stringify({ summary: 'Short recap.', people: [], commitments: [] }), usage };
    }, send: async () => 1, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 100,
      jev: async (_state, questions) => {
        if (questions) checks++;
        return { value: questions ? jevAnswer(0.05)
          : { model: JEV_MODEL, answers: replyScores() }, latencyMs: 1 };
      }, escalate: async () => { throw Error('unexpected reply review'); },
      summaryReview: async () => { reviews++; return { verdict: 'pass', latencyMs: 1 }; } } });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Remember this.' } }]);
    await worker.drain();
    await expect(worker.summarizeIfNeeded(true)).rejects.toThrow('preview stopped');
    expect(checks).toBe(0);
    expect(reviews).toBe(0);
    expect(journal.view.calls).toBe(2);
    expect(journal.view.summaries).toHaveLength(0);
    expect(journal.view.summaryReservations.has(1)).toBe(true);
    expect(records(path).filter(row => row.kind === 'summary-candidate' && row.usage?.inputTokens === 1234)).toHaveLength(1);
    expect(records(path).filter(row => row.kind === 'summary-check' || row.kind === 'summary')).toHaveLength(0);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.calls).toBe(2);
    expect(replay.view.summaries).toHaveLength(0);
    expect(replay.view.summaryReservations.has(1)).toBe(true);
    expect(records(path).filter(row => row.kind === 'summary-candidate' && row.usage?.inputTokens === 1234)).toHaveLength(1);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps rejected and accepted candidate packets out of status and the next model packet across replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-state-')));
  const path = join(root, 'journal.encrypted');
  const g = { ...genesis(16), maxReplies: 16, maxTurns: 16 };
  let journal = openPreviewJournal(path, key, g), checks = 0;
  const packets: string[] = [];
  const worker = () => createJournalWorker(journal, { now: () => 1000, stopped: () => false,
    sources: () => [selfStateSource(selfState(journal.view, readRuns(join(root, 'runs.jsonl')), 1000, 'UTC'))],
    prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', g.grant, 1000, g.maxBytes),
    model: async input => {
      packets.push(input.prepared ?? input.context);
      return input.id.startsWith('summary:')
        ? JSON.stringify({ summary: checks === 0 ? 'REJECTED_CANDIDATE_ONLY' : 'Short accepted recap.', people: [], commitments: [] })
        : 'ok';
    }, send: async () => 1, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 100,
      jev: async (_state, questions) => ({ value: questions ? jevAnswer(++checks === 1 ? 0.9 : 0.05)
        : { model: JEV_MODEL, answers: replyScores() }, latencyMs: 1 }),
      escalate: async () => { throw Error('unexpected reply review'); },
      summaryReview: async () => ({ verdict: 'violation', latencyMs: 1 }) } });
  try {
    const first = worker();
    for (let id = 1; id <= 3; id++) {
      first.intake([{ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: `short turn ${id}` } }]);
      await first.drain(); await first.summarizeIfNeeded(true);
    }
    expect(journal.view.summaryCandidates.size).toBeGreaterThan(0);
    expect(JSON.stringify(Object.fromEntries(journal.view.providerStates))).not.toContain('REJECTED_CANDIDATE_ONLY');
    const state = selfStateSource(selfState(journal.view, readRuns(join(root, 'runs.jsonl')), 1000, 'UTC'));
    expect(state.text).not.toContain('REJECTED_CANDIDATE_ONLY');
    expect(Buffer.byteLength(state.text)).toBeLessThan(5000);
    journal.close(); journal = openPreviewJournal(path, key);
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8', timeout: 10000 });
    expect(status.status, status.stderr).toBe(0);
    expect(status.stdout).not.toContain('REJECTED_CANDIDATE_ONLY');
    const next = worker();
    next.intake([{ update_id: 4, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'short turn 4' } }]);
    await next.drain();
    expect(journal.view.order[3]?.sent).toBe(1);
    expect(packets.at(-1)).not.toContain('REJECTED_CANDIDATE_ONLY');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([
  ['pass', 0.05, 'pass'],
  ['Jev outage', 'unavailable', 'pass'],
  ['review rejection', 0.9, 'violation'],
  ['review UNKNOWN', 0.9, 'unknown']
] as const)('records completed summary usage once on %s and replay', async (_name, score, outcome) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-usage-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis());
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
    model: async input => input.id.startsWith('summary:')
      ? { state: 'complete', text: JSON.stringify({ summary: 'Short recap.', people: [], commitments: [] }), usage }
      : 'ok', send: async () => 1, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 100,
      jev: async (_state, questions) => {
        if (questions && score === 'unavailable') throw Error('Jev outage');
        return { value: questions ? jevAnswer(score as number)
          : { model: JEV_MODEL, answers: replyScores() }, latencyMs: 1 };
      }, escalate: async () => { throw Error('unexpected reply review'); },
      summaryReview: async () => outcome === 'unknown'
        ? { verdict: 'unavailable', latencyMs: 1, usage: reviewUsage }
        : { verdict: outcome, latencyMs: 1, usage: reviewUsage } } });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Remember this.' } }]);
    await worker.drain(); await worker.summarizeIfNeeded(true);
    const before = records(path).filter(row => row.kind.startsWith('summary'));
    expect(before.filter(row => 'usage' in row && row.usage?.inputTokens === 1234)).toHaveLength(1);
    if (outcome === 'unknown') {
      expect(journal.view.summaryReservations.has(1)).toBe(true);
      expect(journal.view.summaryChecks.get(1)?.at(-1)?.usage).toEqual(reviewUsage);
    }
    journal.close();
    expect(records(path).filter(row => 'usage' in row && row.usage?.inputTokens === 1234)).toHaveLength(1);
    const replay = openPreviewJournal(path, key);
    expect(replay.view.summaryReservations.has(1)).toBe(outcome === 'unknown');
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a completed faithfulness verdict in the journal before a supervisor interruption', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-faithfulness-outage-')));
  const path = join(root, 'journal.encrypted');
  try {
    let entered!: () => void, release!: () => void;
    const supervisorEntered = new Promise<void>(resolve => { entered = resolve; });
    const interrupted = new Promise<never>((_resolve, reject) => {
      release = () => reject(Error('supervisor interrupted'));
    });
    const journal = openPreviewJournal(path, key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? { state: 'complete', text: JSON.stringify({ summary: 'A short paraphrase.', people: [] }), usage }
        : 'Okay.',
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } },
        usage: { input_tokens: 777, output_tokens: 7 } }),
      replyCheck: { elapsedMs: () => 100, jev: async (_state, questions) => {
        if (questions) { entered(); return interrupted; }
        return { value: { model: JEV_MODEL, answers: replyScores() }, latencyMs: 1 };
      }, escalate: async () => { throw Error('unexpected review'); } },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Remember this.' } }]);
    await worker.drain();
    const summary = worker.summarizeIfNeeded(true);
    await supervisorEntered;
    expect(records(path).filter(row => row.kind === 'summary-check')).toMatchObject([{
      faithfulness: { path: 'jev', verdict: 'pass', usage: { inputTokens: 777, outputTokens: 7 } },
    }]);
    expect(records(path).filter(row => row.kind === 'summary-check' && row.result)).toHaveLength(0);
    const inFlight = openPreviewJournal(path, key);
    expect(inFlight.view.summaryReservations.has(1)).toBe(true);
    expect(inFlight.view.summaryChecks.get(1)).toBeUndefined();
    inFlight.close();
    release(); await summary;
    expect(records(path).filter(row => row.kind === 'summary-check' && row.result)).toMatchObject([{
      result: { verdict: 'unavailable' } }]);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.lastSummaryFailure?.faithfulness).toMatchObject({ verdict: 'pass' });
    expect(records(path).filter(row => row.kind === 'summary-check' && row.faithfulness?.usage)).toHaveLength(1);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
