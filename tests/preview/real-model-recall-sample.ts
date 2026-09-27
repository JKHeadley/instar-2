/** Fixed synthetic recall sample. The caller supplies the only provider doorway. */
import { createHash } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const NOW = 1_790_000_000_000;
const BOT = '12345678';
const CHAT = '7654321';
const key = new Uint8Array(32).fill(87);
const sourceId = (turn: number) => `telegram:${BOT}:update:${turn}`;
const slot = (n: number) => String(n).padStart(2, '0');
const oldValue = (n: number) => `ORIGINAL-${slot(n)}`;
const newValue = (n: number) => `REVISED-${slot(n)}`;
const statement = (n: number, value: string) => `The catalog label for slot ${slot(n)} is ${value}.`;
const current = (n: number) => n <= 8 ? newValue(n) : oldValue(n);
export const RECALL_CASES = Object.freeze([
  ...Array.from({ length: 12 }, (_, i) => i + 14).map(n => ({ id: `stable-${slot(n)}`, kind: 'fact', slot: n, expected: oldValue(n) })),
  ...Array.from({ length: 5 }, (_, i) => i + 1).map(n => ({ id: `corrected-${slot(n)}`, kind: 'correction', slot: n, expected: newValue(n) })),
  ...Array.from({ length: 3 }, (_, i) => i + 9).map(n => ({ id: `forgotten-${slot(n)}`, kind: 'forget', slot: n, expected: null })),
]);

const update = (n: number, text: string) => ({ update_id: n, message: { chat: { id: Number(CHAT), type: 'private' },
  from: { id: Number(CHAT) }, text, date: Math.floor(NOW / 1000) - 3600 + n } });

export interface RecallMiss { id: string; kind: string; expected: string | null; answer: string | null;
  rawOutput: string | null; state: string; packet: { sha256: string; bytes: number; mode: string; summaryThrough: number | null;
    expectedVisible: boolean; staleVisible: boolean; evidence: unknown; raw: string } }
export interface RecallReport { fixture: { turns: number; facts: number; corrections: number; forgets: number;
  sha256: string }; model: string; calls: number; total: number; correct: number; accuracy: number;
  misses: RecallMiss[]; cases: Array<{ id: string; kind: string; expected: string | null; answer: string | null;
    rawOutput: string | null; state: string; correct: boolean; packetSha256: string; packet: string;
    usage: { inputTokens: number; outputTokens: number; charge: number | null } | null }> }

function seed(journal: ReturnType<typeof openPreviewJournal>) {
  for (let n = 1; n <= 120; n++) {
    const index = n <= 30 ? n : n <= 38 ? n - 30 : n <= 43 ? n - 30 : null;
    const text = n <= 30 ? statement(n, oldValue(n))
      : n <= 38 ? `Correction: ${statement(index!, newValue(index!))} The old ${oldValue(index!)} label is superseded.`
      : n <= 43 ? `Forget the catalog label for slot ${slot(index!)}.`
      : `Routine turn ${n}: catalog maintenance continues.`;
    const id = sourceId(n), raw = JSON.stringify(update(n, text));
    journal.append({ kind: 'intake', id, update: n, text, raw, accepted: true, cursor: n + 1, at: NOW + n });
    journal.append({ kind: 'reserve', id, at: NOW + n });
    const change = n >= 31 && n <= 43 ? { mode: n <= 38 ? 'correct' as const : 'forget' as const,
      source: sourceId(index!), quote: statement(index!, oldValue(index!)), trigger: id,
      ...(n <= 38 ? { replacement: statement(index!, newValue(index!)) } : {}) } : null;
    journal.append({ kind: 'answer', id, text: 'Noted.', state: 'complete',
      ...(change ? { memory: [change] } : {}), at: NOW + n });
    journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: CHAT, update: n,
      grant: journal.view.genesis.grant, at: NOW + n });
    journal.append({ kind: 'sent', id, message: n, at: NOW + n });
  }
  // A fixture-written rolling summary stands in for the model's earlier summary.
  // Its current values and explicit memory changes are both projected by the real packet builder.
  journal.append({ kind: 'summary-reserve', through: 120, at: NOW + 121 });
  journal.append({ kind: 'summary', through: 120,
    text: Array.from({ length: 30 }, (_, i) => i + 1).filter(n => n < 9 || n > 13)
      .map(n => statement(n, current(n))).join('\n'), at: NOW + 122 });
  if (journal.view.order.length !== 120 || journal.view.memory.filter(item => item.mode === 'correct').length !== 8
    || journal.view.memory.filter(item => item.mode === 'forget').length !== 5)
    throw Error('recall sample: seeded fixture counts differ');
}

function packetEvidence(packet: Record<string, unknown>, slotNumber: number) {
  const needle = `slot ${slot(slotNumber)}`;
  const entries = [packet.summary, ...(Array.isArray(packet.history) ? packet.history : []),
    ...(Array.isArray(packet.recalled) ? packet.recalled : []),
    ...(Array.isArray(packet.memory) ? packet.memory : [])];
  return entries.filter(item => [needle, oldValue(slotNumber), newValue(slotNumber)]
    .some(value => JSON.stringify(item).includes(value)));
}

/** Keep process signals observable until the physical provider has been reaped. */
export function installRecallStopSignals() {
  let signalled = false;
  const signal = () => { signalled = true; };
  process.once('SIGINT', signal); process.once('SIGTERM', signal); process.once('SIGHUP', signal);
  return { stopped: () => signalled, close: () => {
    process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal); process.removeListener('SIGHUP', signal);
  } };
}

/** One fresh journal per run. No live journal path is accepted or opened. */
export async function runRealModelRecallSample(model: string,
  invoke: (prepared: string, id: string) => Promise<{ state: 'complete' | 'rejected' | 'uncertain';
    text?: string; usage?: { inputTokens: number; outputTokens: number; charge: number | null } }>,
  grant = 'grant:real-recall-sample', stopped: () => boolean = () => false): Promise<RecallReport> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-real-recall-')));
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: BOT, chat: CHAT, operator: CHAT,
    grant, configurationDigest: 'sha256:real-recall-sample', expires: NOW + 1_000_000_000,
    maxCalls: 141, maxReplies: 140, maxTurns: 140, maxBytes: 32768, cursor: 0 });
  try {
    seed(journal);
    const fixtureHash = createHash('sha256').update(JSON.stringify({
      turns: journal.view.order.map(turn => turn.text), memory: journal.view.memory,
      summary: journal.view.summaries.at(-1)?.text })).digest('hex');
    journal.close(); journal = openPreviewJournal(path, key);
    let calls = 0;
    const seen = new Map<string, { packet: string; state: string; rawOutput: string | null;
      usage: { inputTokens: number; outputTokens: number; charge: number | null } | null }>();
    const worker = createJournalWorker(journal, { now: Date.now, stopped,
      prepareModel: input => prepareJournalEnvelope(input, model, journal.view.genesis.grant, Date.now(), journal.view.limits.maxBytes),
      model: async input => {
        if (input.id.startsWith('summary:')) throw Error('recall sample: unexpected summary call');
        if (!input.prepared || calls >= 20 || seen.has(input.id)) throw Error('recall sample: call bound');
        seen.set(input.id, { packet: input.context, state: 'reserved', rawOutput: null, usage: null });
        calls++;
        try {
          const result = await invoke(input.prepared, input.id);
          seen.get(input.id)!.state = result.state;
          seen.get(input.id)!.rawOutput = result.text ?? null;
          seen.get(input.id)!.usage = result.usage ?? null;
          if (result.state === 'uncertain') return { state: 'uncertain' as const };
          if (result.state === 'rejected') return { state: 'rejected' as const, failureClass: 'rejected' as const };
          return result.text ?? '';
        } catch {
          seen.get(input.id)!.state = 'uncertain';
          return { state: 'uncertain' as const };
        }
      }, send: async () => 1, checkOutbound: () => {} });
    const rows: RecallReport['cases'] = [], misses: RecallMiss[] = [];
    for (let i = 0; i < RECALL_CASES.length; i++) {
      if (stopped()) throw Error('recall sample: stopped; report remains incomplete');
      const item = RECALL_CASES[i]!;
      const question = `What is the current catalog label for slot ${slot(item.slot)}? Reply with only the exact label, or UNKNOWN if the label was forgotten.`;
      const n = 121 + i, id = sourceId(n);
      worker.intake([update(n, question)]);
      await worker.drain();
      if (stopped()) throw Error('recall sample: stopped; report remains incomplete');
      const observed = seen.get(id);
      if (!observed) throw Error(`recall sample: question ${item.id} had no model call`);
      const packet = JSON.parse(observed.packet) as Record<string, unknown>;
      const turn = journal.view.turns.get(id);
      const answer = turn?.answer ?? null;
      const expected = item.expected;
      const stale = item.slot <= 8 ? oldValue(item.slot) : item.slot <= 13 ? oldValue(item.slot) : '';
      const correct = observed.state === 'complete' && answer?.trim() === (expected ?? 'UNKNOWN');
      const sha256 = createHash('sha256').update(observed.packet).digest('hex');
      rows.push({ id: item.id, kind: item.kind, expected, answer, rawOutput: observed.rawOutput, state: observed.state, correct,
        packetSha256: sha256, packet: observed.packet, usage: observed.usage });
      if (!correct) misses.push({ id: item.id, kind: item.kind, expected, answer, rawOutput: observed.rawOutput, state: observed.state,
        packet: { sha256, bytes: Buffer.byteLength(observed.packet), mode: String(packet.historyMode),
          summaryThrough: (packet.summary as { through?: number } | undefined)?.through ?? null,
          expectedVisible: expected !== null && observed.packet.includes(expected),
          staleVisible: Boolean(stale && observed.packet.includes(stale)), evidence: packetEvidence(packet, item.slot),
          raw: observed.packet } });
    }
    if (calls !== 20 || journal.view.order.length !== 140) throw Error('recall sample: call or turn count differs');
    const correct = rows.filter(row => row.correct).length;
    return { fixture: { turns: 120, facts: 30, corrections: 8, forgets: 5, sha256: fixtureHash },
      model, calls, total: rows.length, correct, accuracy: correct / rows.length, misses, cases: rows };
  } finally { try { journal.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}
