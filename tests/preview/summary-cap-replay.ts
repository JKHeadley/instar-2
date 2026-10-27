/** Recorded train-163 S0b conversation, replayed without transport or a serving root. */
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type CallOutcome, type PreviewPorts } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

export const summaryCapFixture = JSON.parse(readFileSync(new URL('./fixtures/summary-cap-2026-10-26.json', import.meta.url), 'utf8')) as {
  sources: { id: string; text: string }[];
  turns: { id: string; update: number; text: string; reply: string; at: number; sentAt: number | null }[];
  writers: { id: string; outcome: CallOutcome; usage: { inputTokens: number; outputTokens: number; charge: null } | null }[];
};
const key = new Uint8Array(32).fill(67);
const genesis = { kind: 'genesis' as const, bot: '8813073094', chat: '7812716706', operator: '7812716706',
  grant: 'grant:summary-cap-replay', configurationDigest: 'sha256:summary-cap-replay', expires: 9999999999999,
  maxCalls: 2000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0 };

export function summaryCapReplay(options: {
  model: (input: Parameters<PreviewPorts['model']>[0], journal: ReturnType<typeof openPreviewJournal>) => ReturnType<PreviewPorts['model']>;
  review?: NonNullable<PreviewPorts['replyCheck']>['summaryReview'];
  end?: number;
}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'summary-cap-replay-')));
  const path = join(dir, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), now = 1793061000000, stopped = false;
  for (const turn of summaryCapFixture.turns.filter(t => t.update <= (options.end ?? Infinity))) {
    const { id, update, text, at, reply, sentAt } = turn;
    journal.append({ kind: 'intake', id, update, text, raw: JSON.stringify({ update_id: update,
      message: { text, date: Math.floor(at / 1000), chat: { id: Number(genesis.chat), type: 'private' },
        from: { id: Number(genesis.operator) } } }), accepted: true, cursor: update + 1, at });
    journal.append({ kind: 'reserve', id, at });
    journal.append({ kind: 'answer', id, text: reply, state: 'complete', at });
    journal.append({ kind: 'intent', id, text: reply, chat: genesis.chat, update, grant: genesis.grant, at });
    if (sentAt !== null) journal.append({ kind: 'sent', id, message: update, at: sentAt });
  }
  const calls: Parameters<PreviewPorts['model']>[0][] = [];
  const ports: PreviewPorts = { now: () => now, stopped: () => stopped, sources: summaryCapFixture.sources,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', genesis.grant, now, genesis.maxBytes),
    model: async input => {
      if (input.id.startsWith('summary:index:')) return '{"concepts":[]}';
      calls.push(input);
      return options.model(input, journal);
    },
    // No fabricated Jev pass: missing Jev goes to the full-context subscription review.
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('Jev unavailable in isolated replay'); },
      escalate: async () => { throw Error('replay never answers'); },
      summaryReview: options.review ?? (async () => ({ verdict: 'unavailable', latencyMs: 0 })) },
    send: async () => { throw Error('replay never sends'); }, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, ports);
  return { get journal() { return journal; }, get worker() { return worker; }, calls,
    advance: () => { now += 600001; }, stop: () => { stopped = true; },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }); } };
}
