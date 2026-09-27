import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDecipheriv } from 'node:crypto';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { exactSummaryFaithfulness, interpretSummaryJev, summaryFaithfulnessEvidence } from './summary-faithfulness.js';

const key = new Uint8Array(32).fill(19);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const jev = (score: number) => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: score } } });
function durableRows(path: string): { kind: string; through?: number; result?: { usage?: { inputTokens: number; outputTokens: number } } }[] {
  const bytes = readFileSync(path), rows = [];
  for (let offset = 0; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), frame = bytes.subarray(offset + 4, offset + 4 + length);
    const decipher = createDecipheriv('aes-256-gcm', key, frame.subarray(0, 12));
    decipher.setAAD(Buffer.from(`preview-journal:${offset}`));
    decipher.setAuthTag(frame.subarray(12, 28));
    rows.push(JSON.parse(Buffer.concat([decipher.update(frame.subarray(28)), decipher.final()]).toString('utf8')));
    offset += length + 4;
  }
  return rows;
}

it('proves exact coverage without Jev, and accepts a faithful paraphrase only after Jev', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-pass-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const evidence: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.id === 'summary:1'
        ? JSON.stringify({ summary: 'My workshop code is 7319. Understood.', people: [] })
        : input.id === 'summary:2'
          ? JSON.stringify({ summary: 'The workshop code remains 7319; it opens on Tuesday.', people: [] })
          : 'Understood.',
      summaryCheck: async state => { evidence.push(state); return jev(0.01); },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My workshop code is 7319.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(1);
    expect(evidence).toHaveLength(0);
    worker.intake([update(2, 'It opens on Tuesday.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(2);
    expect(evidence).toHaveLength(1);
    expect(JSON.parse(evidence[0]!).priorSummary).toContain('7319');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([{ score: 0.99, reason: 'active memory item lost' }, { score: 0.5, reason: 'undecided' }])
  ('rejects a lost or undecidable active item, keeps the prior summary and durable reason (%s)', async ({ score, reason }) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-reject-')));
    const path = join(root, 'journal.encrypted');
    try {
      let journal = openPreviewJournal(path, key, genesis);
      const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
        model: async input => input.id === 'summary:1'
          ? JSON.stringify({ summary: 'My workshop code is 7319. Understood.', people: [] })
          : input.id === 'summary:2'
            ? JSON.stringify({ summary: 'It opens on Tuesday.', people: [] })
            : 'Understood.',
        summaryCheck: async () => jev(score), send: async () => 1, checkOutbound: () => {} });
      worker.intake([update(1, 'My workshop code is 7319.')]); await worker.drain();
      await worker.summarizeIfNeeded(true);
      worker.intake([update(2, 'It opens on Tuesday.')]); await worker.drain();
      await worker.summarizeIfNeeded(true);
      expect(journal.view.summaries).toHaveLength(1);
      expect(journal.view.summaries[0]?.text).toContain('7319');
      expect(journal.view.order[1]?.held).toContain(reason);
      const failed = journal.view.lastSummaryFailure;
      expect(failed).toMatchObject({
        faithfulness: { path: 'jev', verdict: score > 0.85 ? 'lost' : 'undecided', score } });
      expect(JSON.parse(failed!.evidence!).candidateSummary).toBe('It opens on Tuesday.');
      journal.close();
      journal = openPreviewJournal(path, key);
      expect(journal.view.summaries).toHaveLength(1);
      expect(journal.view.order[1]?.held).toContain(reason);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

it('treats an unrecorded correction decision as undecided and gives Jev the decision context', () => {
  const packet = JSON.stringify({ summary: { text: 'The code is 7319.' },
    history: [{ user: 'Actually, forget my workshop code.', answer: null }],
    memoryRequest: { message: 'Actually, forget my workshop code.' } });
  expect(exactSummaryFaithfulness(packet, 'The code is 7319. Actually, forget my workshop code.', [])).toBe('undecided');
  expect(exactSummaryFaithfulness(JSON.stringify({ summary: { text: 'The code is 7319.' },
    history: [], memory: [{ mode: 'corrected', replacement: 'The code is 4412.' }] }), 'The code is 7319.', [])).toBe('undecided');
  expect(JSON.parse(summaryFaithfulnessEvidence(packet, 'The code is gone.', [])).memoryRequest.message).toContain('forget');
  expect(interpretSummaryJev(jev(0.01))).toBe('pass');
  expect(interpretSummaryJev(jev(0.99))).toBe('lost');
  expect(interpretSummaryJev({})).toBe('undecided');
});

it('keeps the first summary uncommitted when a new fact is omitted and Jev is unavailable', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-unavailable-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'A greeting occurred.', people: [] }) : 'Understood.',
      summaryCheck: async () => { throw Error('Jev unavailable'); },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My workshop code is 7319.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(0);
    expect(journal.view.order[0]?.held).toBe('summary faithfulness: undecided');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not commit a Jev pass if the stop gate closes during the check', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-stop-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let stopped = false;
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => stopped,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The workshop code is 7319.', people: [] }) : 'Understood.',
      summaryCheck: async () => { stopped = true; return jev(0.01); },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My workshop code is 7319.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(0);
    expect(journal.view.order[0]?.held).toBe('summary faithfulness: undecided');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds a summary that repeats an already corrected exact claim with a reason', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-stale-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'My workshop code is 7319.', people: [] }) : 'Understood.',
      summaryCheck: async () => jev(0.01), send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My workshop code is 7319.')]); await worker.drain();
    worker.intake([update(2, 'Actually, my workshop code is 4412.')]);
    const source = journal.view.order[0]!, trigger = journal.view.order[1]!;
    journal.append({ kind: 'summary-reserve', through: 2, at: 1790000000000 });
    journal.append({ kind: 'summary', through: 2, text: 'The workshop code is 4412.', memoryFor: [trigger.id],
      memory: [{ mode: 'correct', source: source.id, quote: 'My workshop code is 7319.',
        trigger: trigger.id, replacement: 'my workshop code is 4412.' }], at: 1790000000000 });
    worker.intake([update(3, 'Thank you.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(1);
    expect(journal.view.order[2]?.held).toBe('summary faithfulness: stale corrected or forgotten claim');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([
  { candidate: 'The workshop access code is 7319. Riley owns a red bike.', rejected: true },
  { candidate: 'Riley owns a red bike. The operator said thanks.', rejected: false },
])('audits a prior forgetting decision while preserving an unrelated fact ($rejected)', async ({ candidate, rejected }) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-forgotten-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const seen: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: candidate, people: [] }) : 'Understood.',
      summaryCheck: async evidence => {
        seen.push(evidence);
        const audit = JSON.parse(evidence).auditDecisions;
        return jev(audit.some((decision: { sourceQuote: string; summaryPassages: string[] }) =>
          decision.sourceQuote === 'My workshop code is 7319.'
          && decision.summaryPassages.includes('The operator\'s workshop code is 7319.'))
          && candidate.includes('workshop access code') ? 0.99 : 0.01);
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My workshop code is 7319.'), update(2, 'Riley owns a red bike.')]);
    await worker.drain();
    const source = journal.view.order[0]!;
    worker.intake([update(3, 'Please forget my workshop code.')]); await worker.drain();
    const trigger = journal.view.order[2]!;
    journal.append({ kind: 'summary-reserve', through: 3, at: 1790000000000 });
    journal.append({ kind: 'summary', through: 3, text: 'Riley owns a red bike.', memoryFor: [trigger.id],
      memory: [{ mode: 'forget', source: source.id, quote: 'My workshop code is 7319.', trigger: trigger.id,
        summaryPassages: ["The operator's workshop code is 7319."] }], at: 1790000000000 });
    worker.intake([update(4, 'Thank you.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(seen).toHaveLength(1);
    const evidence = JSON.parse(seen[0]!);
    expect(evidence.auditDecisions).toMatchObject([{ mode: 'forget', sourceQuote: 'My workshop code is 7319.',
      sourceContext: 'My workshop code is 7319.',
      operatorRequest: 'Please forget my workshop code.',
      summaryPassages: ["The operator's workshop code is 7319."] }]);
    expect(evidence.priorSummary).toBe('Riley owns a red bike.');
    expect(evidence.activeMemory).toMatchObject([{ mode: 'forgotten' }]);
    expect(JSON.stringify(evidence.activeMemory)).not.toContain('7319');
    expect(journal.view.summaries).toHaveLength(rejected ? 1 : 2);
    if (rejected) expect(journal.view.order[3]?.held).toBe('summary faithfulness: active memory item lost');
    else expect(journal.view.summaries[1]?.text).toContain('Riley owns a red bike.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([['lost', 0.99], ['supervisor outage', 0.01]] as const)(
  'records each completed summary and faithfulness call once on %s', async (_case, score) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-composition-')));
    const path = join(root, 'journal.encrypted');
    const usage = { inputTokens: 1234, outputTokens: 67, charge: null };
    try {
      const journal = openPreviewJournal(path, key, genesis);
      const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
        model: async input => input.id.startsWith('summary:')
          ? { state: 'complete', text: JSON.stringify({ summary: 'A paraphrase.', people: [] }), usage }
          : 'Understood.',
        summaryCheck: async () => ({ ...jev(score), usage: { input_tokens: 777, output_tokens: 7 } }),
        replyCheck: { elapsedMs: () => 100, jev: async (_state, questions) => {
          if (questions && score < 0.85) {
            const prefix = durableRows(path);
            expect(prefix.find(row => row.kind === 'summary-faithfulness' && row.through === 1)?.result?.usage)
              .toMatchObject({ inputTokens: 777, outputTokens: 7 });
            expect(prefix.some(row => row.kind === 'summary')).toBe(false);
          }
          if (questions) throw Error('supervisor unavailable');
          return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(
            ['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self', 'claims_blocked', 'parks_on_user']
              .map(id => [id, { type: 'noul', noul: 0 }])) }, latencyMs: 1 };
        }, escalate: async () => { throw Error('unexpected review'); } },
        send: async () => 1, checkOutbound: () => {} });
      worker.intake([update(1, 'My workshop code is 7319.')]); await worker.drain();
      await worker.summarizeIfNeeded(true);
      const failure = journal.view.lastSummaryFailure;
      expect(failure?.faithfulness).toMatchObject({ path: 'jev', verdict: score > 0.85 ? 'lost' : 'pass',
        usage: { inputTokens: 777, outputTokens: 7 } });
      expect(failure?.usage).toBeUndefined();
      expect(journal.view.summaries).toHaveLength(0);
      journal.close();
      const replay = openPreviewJournal(path, key);
      expect(replay.view.lastSummaryFailure?.faithfulness).toEqual(failure?.faithfulness);
      replay.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
