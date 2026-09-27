import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { exactSummaryFaithfulness, interpretSummaryJev, summaryFaithfulnessEvidence } from './summary-faithfulness.js';

const key = new Uint8Array(32).fill(19);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const jev = (score: number) => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: score } } });

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
