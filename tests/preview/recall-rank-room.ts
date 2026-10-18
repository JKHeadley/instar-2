/** The recorded room of unit w3-recallrank (proof room two, 2026-10-02), rebuilt from
 * tests/preview/fixtures/proofroom2-recallrank-2026-10-02.json for the recall-rank and recall-lookup tests.
 * The model and Telegram are whatever the caller binds; nothing here reaches a live root. */
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONCEPT_SOURCES_LIMIT, createJournalWorker, openPreviewJournal, proposedConceptTerms, type PreviewPorts } from './journal.js';

export const key = new Uint8Array(32).fill(57), at = 1790000000000;
export const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 };
export const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + (id - 6230000) * 60 } });
export const sourceId = (turn: number) => `telegram:12345678:update:${turn}`;

export interface Sample { label: string; raw: string }
export interface Recorded {
  recorded: { fact: { update: number; message: string; deliveredReply: string };
    question: { update: number; message: string; summaryThrough: number; meaningIndexed: number[]; pendingUpdates: number[]; recalledIds: string[];
      coverage: { disposition: string; meaningIndexed: number; summarizedMessages: number } };
    operatorMessages: Record<string, string>;
    gardenLog: { firstUpdate: number; lastUpdate: number; crops: string[]; opening: string; row: string } };
  sampledTerms: { samples: Sample[] } }
export const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/proofroom2-recallrank-2026-10-02.json'), 'utf8')) as Recorded;
export const { fact, question, operatorMessages, gardenLog } = fixture.recorded;
/** One sample as the writer returned it, parsed; nothing is filtered here. */
export const sample = (label: string) => JSON.parse(fixture.sampledTerms.samples.find(item => item.label === label)!.raw) as
  { concepts: { source: string; terms: string[] }[] };
export const updateOf = (source: string) => Number(source.slice(source.lastIndexOf(':') + 1));

/** The garden log for one update: opening and row sentence verbatim; 45 rows gives the recorded packet weight. */
const logNumber = (turn: number) => turn - gardenLog.firstUpdate + 1;
const cropOf = (turn: number) => gardenLog.crops[(logNumber(turn) - 1) % gardenLog.crops.length]!;
export const logText = (turn: number) => [gardenLog.opening.replace('{n}', String(logNumber(turn))),
  ...Array.from({ length: 45 }, (_, k) => gardenLog.row.replace('{k}', String(k + 1)).replace('{crop}', cropOf(turn)))].join(' ');

/** Sampled terms by update. The samples cover the short messages and logs 1-3; every later log reuses the
 * sampled terms of the log three places before it in the crop cycle's first pass, with the crop word swapped. */
function termsFor(label: string, turn: number): string[] | undefined {
  const direct = sample(label).concepts.find(item => updateOf(item.source) === turn);
  if (direct) return direct.terms;
  if (turn < gardenLog.firstUpdate) return undefined;
  const first = sample(label).concepts.find(item => updateOf(item.source) === gardenLog.firstUpdate)!;
  const firstCrop = cropOf(gardenLog.firstUpdate).replace(/s$/u, '');
  return first.terms.map(term => term.replaceAll(firstCrop, cropOf(turn).replace(/s$/u, '')));
}

/** The room as recorded: every turn up to the question's summary frontier is summarized, the summary text does
 * not carry the fact, and the two updates the room listed as pending carry no terms. */
export function room(path: string, label: string, extra: { turn: number; text: string; terms: string[] }[] = [], factReply = fact.deliveredReply,
  ports: Partial<PreviewPorts> = {}, limits: Partial<typeof genesis> = {}) {
  const journal = openPreviewJournal(path, key, { ...genesis, ...limits });
  const turns: { turn: number; text: string; reply: string }[] = [
    ...Object.entries(operatorMessages).map(([id, text]) => ({ turn: Number(id), text, reply: 'Noted.' })),
    ...extra.map(item => ({ turn: item.turn, text: item.text, reply: 'Noted.' })),
    ...Array.from({ length: gardenLog.lastUpdate - gardenLog.firstUpdate + 1 }, (_, index) => gardenLog.firstUpdate + index)
      .map(turn => ({ turn, text: logText(turn), reply: 'Noted.' }))].sort((a, b) => a.turn - b.turn);
  for (const { turn, text, reply } of turns) {
    const id = sourceId(turn), said = turn === fact.update ? factReply.replace(/^PREVIEW — /u, '') : reply;
    journal.append({ kind: 'intake', id, update: turn, text, raw: JSON.stringify(update(turn, text)), accepted: true, cursor: turn + 1, at: at + turn });
    journal.append({ kind: 'reserve', id, at: at + turn });
    journal.append({ kind: 'answer', id, text: said, state: 'complete', at: at + turn });
    journal.append({ kind: 'intent', id, text: `PREVIEW — ${said}`, chat: '7654321', update: turn, grant: 'grant:preview', at: at + turn });
    journal.append({ kind: 'sent', id, message: turn, at: at + turn });
  }
  const summarized = turns.filter(item => item.turn <= question.summaryThrough);
  const indexed = summarized.flatMap(item => {
    const words = question.pendingUpdates.includes(item.turn) ? undefined
      : extra.find(added => added.turn === item.turn)?.terms ?? termsFor(label, item.turn);
    // Stored as the write path stores them: through the product's own reader of a writer's proposal.
    const stored = words ? proposedConceptTerms(words) : undefined;
    return stored ? [{ source: sourceId(item.turn), terms: stored }] : [];
  });
  for (let start = 0; start < indexed.length; start += CONCEPT_SOURCES_LIMIT) {
    const batch = indexed.slice(start, start + CONCEPT_SOURCES_LIMIT);
    const through = start + CONCEPT_SOURCES_LIMIT >= indexed.length ? question.summaryThrough : updateOf(batch.at(-1)!.source);
    journal.append({ kind: 'summary-reserve', through, at: at + through });
    journal.append({ kind: 'summary', through, text: 'The operator keeps a daily garden log and asked for reminders.', concepts: batch, at: at + through });
  }
  const worker = createJournalWorker(journal, { now: () => at + 7_000_000, stopped: () => false,
    send: async input => input.update, checkOutbound: () => {}, model: async () => 'Noted.', ...ports });
  const recalled = (message: string) => {
    const result = worker.probe(message);
    if (!('context' in result)) throw Error('probe held');
    const packet = JSON.parse(result.context) as { historyMode?: string; summary?: { text?: string };
      recalled?: { id: string }[]; meaningIndexCoverage?: unknown };
    return { packet, ids: (packet.recalled ?? []).map(item => updateOf(item.id)) };
  };
  return { journal, worker, recalled };
}
export const withRoom = (label: string, extra: Parameters<typeof room>[2], body: (opened: ReturnType<typeof room>) => void, factReply?: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recallrank-')));
  try { const opened = room(join(dir, 'journal.encrypted'), label, extra, factReply); body(opened); opened.journal.close(); }
  finally { rmSync(dir, { recursive: true, force: true }); }
};

/** A reply to the fact that uses none of the question's words, so only the index terms can carry it. */
export const neutral = 'PREVIEW — Noted.';
