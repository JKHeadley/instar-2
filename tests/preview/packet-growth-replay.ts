/** Offline 500-turn packet replay. All turns and summaries use the real encrypted journal. */
import { mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(47);
const now = 1_790_000_000_000;
const facts = [
  { question: 'What is the observatory access code?', clause: 'The observatory access code is COBALT-713.' },
  { question: 'What is the ferry docket?', clause: 'The ferry docket is FERRY-Q7.' },
];

export function runPacketGrowthReplay() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-packet-growth-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1500, maxReplies: 500, maxTurns: 500, maxBytes: 1024 * 1024, cursor: 0 };
  const checkpoints: { turn: number; bytes: number; history: number; summaryThrough: number | null;
    mode: string; recall: boolean; otherAccuracy: boolean; otherRecall: boolean }[] = [];
  try {
    let journal = openPreviewJournal(path, key, genesis);
    for (let turn = 1; turn <= 500; turn++) {
      const text = turn === 1 ? facts[0]!.clause : turn === 5 ? facts[1]!.clause
        : `Ordinary update ${turn}: errands, weather and planning. ${'x'.repeat(700)}`;
      const raw = JSON.stringify({ update_id: turn, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text, date: Math.floor(now / 1000) + turn } });
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${turn}`, update: turn,
        text, raw, accepted: true, cursor: turn + 1, at: now + turn });
      if (turn % 12 === 0) {
        journal.append({ kind: 'summary-reserve', through: turn, at: now + turn });
        journal.append({ kind: 'summary', through: turn, text: facts.map(fact => fact.clause).join(' '), at: now + turn });
      }
      if (![36, 100, 500].includes(turn)) continue;
      // The last checkpoint also proves that journal replay retains every raw turn.
      if (turn === 500) { journal.close(); journal = openPreviewJournal(path, key, genesis); }
      const worker = createJournalWorker(journal, { now: () => now + turn, stopped: () => false,
        model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
      const first = worker.probe(facts[0]!.question);
      const second = worker.probe(facts[1]!.question);
      if ('reason' in first || 'reason' in second) throw Error(`packet refused at ${turn}`);
      const packet = JSON.parse(first.context) as { historyMode: string; summary?: { through: number };
        history: { user: string }[]; recalled?: { user: string }[] };
      const other = JSON.parse(second.context) as { recalled?: { user: string }[]; history: { user: string }[] };
      checkpoints.push({ turn, bytes: Buffer.byteLength(first.context), history: packet.history.length,
        summaryThrough: packet.summary?.through ?? null, mode: packet.historyMode,
        recall: (packet.recalled ?? packet.history).some(item => item.user.includes(facts[0]!.clause)),
        otherAccuracy: (other.recalled ?? other.history).some(item => item.user.includes(facts[1]!.clause)),
        otherRecall: (other.recalled ?? other.history).some(item => item.user.includes(facts[0]!.clause)) });
    }
    const durableTurns = journal.view.order.length;
    const journalBytes = statSync(path).size;
    journal.close();
    return { checkpoints, durableTurns, journalBytes };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
