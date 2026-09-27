import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SOURCE_PINS, deskStatusSource, sourcePacket } from './briefing.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(37);
const now = 1_790_500_000_000;
const marker = (n: number) => `FACT-${String(n).padStart(3, '0')}`;
const question = (n: number) => `Question ${n}: ${marker(n)}. What is the current state of this part of the Instar 2.0 preview? `
  + 'Please use the briefing, desk report, and earlier conversation to answer with the correct source and any uncertainty. '
  + 'This is an ordinary follow-up in the same private chat. '.repeat(2).slice(0, 285 - `Question ${n}: ${marker(n)}. What is the current state of this part of the Instar 2.0 preview? Please use the briefing, desk report, and earlier conversation to answer with the correct source and any uncertainty. `.length);
const update = (n: number) => ({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, date: Math.floor(now / 1000) + n, text: question(n) } });
const briefing = sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS,
  { providerAttempts: 160, expiresAt: 9_999_999_999_999 }).sources;
const desk = deskStatusSource({ text: `# Instar 2.0 desk report\n${'Preview work remains a supervised private chat trial with a reviewed activation.\n'.repeat(48)}`,
  modifiedAt: now }, now, '/offline/desk-status.md');
const sources = [...briefing, { id: 'self-state', title: 'Preview self state',
  text: 'The runner is active under the existing capped trial. Its journal is the memory for this private chat.',
  provenance: { path: 'journal projection' } }, desk];

function trial(summaryAvailable: boolean) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-long-conversation-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9_999_999_999_999, maxCalls: 160, maxReplies: 40, maxTurns: 40, maxBytes: 32768, cursor: 0 });
  const answers: number[] = [], summaries: number[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, sources: () => sources,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', journal.view.genesis.grant,
      now, journal.view.limits.maxBytes),
    model: async input => {
      if (!input.id.startsWith('summary:')) {
        answers.push(Number(input.id.split(':').at(-1)));
        if (answers.at(-1) === 35) expect(input.context).toContain(marker(1));
        return JSON.stringify({ reply: `The preview can answer question ${answers.at(-1)} using its current sources.`, memory: [], dated: [] });
      }
      summaries.push(Number(input.id.split(':').at(-1)));
      if (!summaryAvailable) return { state: 'rejected' as const, failureClass: 'rejected' as const,
        usage: { inputTokens: 1, outputTokens: 0, charge: null } };
      const packet = JSON.parse(input.context) as { summary?: { text: string }; history: { user: string }[] };
      const facts = [...new Set([...(packet.summary?.text.match(/FACT-\d{3}/g) ?? []),
        ...packet.history.flatMap(item => item.user.match(/FACT-\d{3}/g) ?? [])])];
      return JSON.stringify({ summary: `The operator asked ordinary preview questions with these distinct facts: ${facts.join(', ')}.`,
        people: [], commitments: [], memory: [], questions: [] });
    },
    summaryCheck: async evidence => {
      const transition = JSON.parse(evidence) as { priorSummary: string; history: { user: string }[]; candidateSummary: string };
      const facts = [...transition.priorSummary.matchAll(/FACT-\d{3}/g),
        ...transition.history.flatMap(item => [...item.user.matchAll(/FACT-\d{3}/g)])].map(item => item[0]);
      return { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul',
        noul: facts.every(fact => transition.candidateSummary.includes(fact)) ? 0.01 : 0.99 } } };
    },
    send: async () => journal.view.replies + 1, checkOutbound: () => {} });
  return { root, journal, worker, answers, summaries };
}

it('answers 40 successive 285-character questions under 32 KiB with faithful rolling summaries', async () => {
  const run = trial(true);
  try {
    for (let n = 1; n <= 40; n++) {
      expect(question(n).length).toBe(285);
      run.worker.intake([update(n)]);
      await run.worker.drain();
      await run.worker.summarizeIfNeeded();
      const turn = run.journal.view.order.at(-1)!;
      if (n === 1) expect(run.summaries).toHaveLength(0);
      expect(turn.sent, `turn ${n}: ${turn.held}`).toBeDefined();
      expect(turn.held, `turn ${n}`).toBeUndefined();
    }
    expect(run.answers).toHaveLength(40);
    expect(run.summaries.length).toBeGreaterThan(0);
    expect(run.summaries[0]).toBeLessThan(15);
    expect(run.journal.view.order.some(turn => turn.held?.includes('summary') || turn.held?.includes('overflow'))).toBe(false);
    expect(run.journal.view.summaries.at(-1)?.text).toContain(marker(1));
  } finally { run.journal.close(); rmSync(run.root, { recursive: true, force: true }); }
}, 120000);

it('keeps an overflowing accepted turn visibly held when a faithful summary is unavailable', async () => {
  const run = trial(false);
  try {
    for (let n = 1; n <= 40; n++) {
      run.worker.intake([update(n)]);
      await run.worker.drain();
      await run.worker.summarizeIfNeeded();
      if (run.journal.view.order.at(-1)?.held?.startsWith('summary unavailable:')) break;
    }
    const held = run.journal.view.order.at(-1)!;
    expect(held.accepted).toBe(true);
    expect(held.text).toBe(question(held.update));
    expect(held.sent).toBeUndefined();
    expect(held.held).toMatch(/^summary unavailable: (context|prompt) overflow$/);
    expect(run.summaries.length).toBeGreaterThan(0);
    expect(run.journal.view.summaries).toHaveLength(0);
    run.journal.close();
    const replay = openPreviewJournal(join(run.root, 'journal.encrypted'), key);
    expect(replay.view.order.at(-1)?.text).toBe(held.text);
    expect(replay.view.order.at(-1)?.held).toBe(held.held);
    replay.close();
  } finally { run.journal.close(); rmSync(run.root, { recursive: true, force: true }); }
}, 120000);
