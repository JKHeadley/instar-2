/** Offline, deterministic packet-recall measurement. No provider or transport is opened. */
import { mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createJournalWorker, importChannelItems, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(63);
const now = 1_790_000_000_000;
const account = 'agent@example.test';
const clauses = {
  observatory: 'The observatory access color is cobalt.',
  person: 'Mira Patel prefers the north entrance.',
  dated: 'On Tuesday, the archive opens at 09:20.',
  topic: 'The migration marker is violet.',
  doorOld: 'The studio door code is 2718.',
  doorNew: 'the studio door code is 6194.',
  keyOld: 'The spare key is under the cedar pot.',
  channel: 'The ferry docket ID is FERRY-Q7.',
  samPatel: 'Sam Patel in accounting approved the blue budget.',
  samRuiz: 'Sam Ruiz, my neighbour, lent me the red ladder.',
  jon: 'Jon Moss from design chose the amber cover.',
  john: 'John Vale from legal chose the green contract.',
} as const;
type Case = { id: string; question: string; wanted?: string; alsoWanted?: string; absent?: string; kind: string };
const cases: Case[] = [
  { id: 'observatory', kind: 'fact', question: 'What is the observatory access color?', wanted: clauses.observatory },
  { id: 'person', kind: 'person', question: 'Which entrance does Mira Patel prefer?', wanted: clauses.person },
  { id: 'dated', kind: 'dated', question: 'When does the archive open on Tuesday?', wanted: clauses.dated },
  { id: 'topic', kind: 'cross-topic', question: 'What is the migration marker in topic 42?', wanted: clauses.topic },
  { id: 'channel', kind: 'channel-import', question: 'What is the ferry docket ID?', wanted: clauses.channel },
  { id: 'corrected', kind: 'correction', question: 'What is the studio door code?', wanted: clauses.doorNew, absent: clauses.doorOld },
  { id: 'forgotten', kind: 'forget', question: 'Where is the spare key?', absent: clauses.keyOld },
  { id: 'sam-ambiguous', kind: 'overlapping-name', question: 'What did Sam do?', wanted: clauses.samPatel, alsoWanted: clauses.samRuiz },
  { id: 'sam-accounting', kind: 'overlapping-name', question: 'What did Sam in accounting approve?', wanted: clauses.samPatel },
  { id: 'sam-neighbour', kind: 'overlapping-name', question: 'What did my neighbour Sam lend me?', wanted: clauses.samRuiz },
  { id: 'john-ambiguous', kind: 'overlapping-name', question: 'What did John choose?', wanted: clauses.john, alsoWanted: clauses.jon },
  { id: 'jon-design', kind: 'overlapping-name', question: 'What did Jon from design choose?', wanted: clauses.jon },
  { id: 'john-legal', kind: 'overlapping-name', question: 'What did John from legal choose?', wanted: clauses.john },
];

const update = (id: number, text: string, thread?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    date: Math.floor(now / 1000) - 86400 + id * 30, ...(thread === undefined ? {} : { message_thread_id: thread }) } });

/** The stub only copies a clause present in its packet. It has no journal or fixture oracle. */
function packetAnswer(question: string, context: string): string {
  const packet = JSON.parse(context) as Record<string, unknown>;
  const visible = JSON.stringify({ summary: packet.summary, history: packet.history, recalled: packet.recalled,
    people: packet.people, channelMemory: packet.channelMemory, memory: packet.memory });
  if (question === 'What did Sam do?') return visible.includes(clauses.samPatel) && visible.includes(clauses.samRuiz)
    ? 'Which Sam do you mean, Sam Patel in accounting or Sam Ruiz your neighbour?' : 'UNKNOWN';
  if (question === 'What did John choose?') return visible.includes(clauses.john) && visible.includes(clauses.jon)
    ? 'Which person do you mean, John Vale from legal or Jon Moss from design?' : 'UNKNOWN';
  if (question.includes('Sam in accounting')) return visible.includes(clauses.samPatel) ? clauses.samPatel : 'UNKNOWN';
  if (question.includes('neighbour Sam')) return visible.includes(clauses.samRuiz) ? clauses.samRuiz : 'UNKNOWN';
  if (question.includes('Jon from design')) return visible.includes(clauses.jon) ? clauses.jon : 'UNKNOWN';
  if (question.includes('John from legal')) return visible.includes(clauses.john) ? clauses.john : 'UNKNOWN';
  const pattern = question.includes('observatory') ? /The observatory access color is [^.]+\./u
    : question.includes('Mira') ? /Mira Patel prefers the [^.]+\./u
    : question.includes('archive') ? /On Tuesday, the archive opens at [^.]+\./u
    : question.includes('migration') ? /The migration marker is [^.]+\./u
    : question.includes('ferry') ? /The ferry docket ID is [^.]+\./u
    : question.includes('door') ? /the studio door code is [^.]+\./iu
    : /The spare key is [^.]+\./u;
  return pattern.exec(visible)?.[0] ?? 'UNKNOWN';
}

/** Keep only exact planted clauses already in the summary or shown in this summary packet. */
function summarize(context: string): string {
  const packet = JSON.parse(context) as { summary?: { text: string }; history: { user: string }[];
    memoryRequest?: { message: string }; memoryCandidates?: { id: string; message: string }[] };
  const found = new Set<string>();
  const input = [packet.summary?.text ?? '', ...packet.history.map(item => item.user)].join('\n');
  // The overlapping-name set must be recovered from source-backed people notes, not a verbatim summary.
  const personClauses = new Set<string>([clauses.samPatel, clauses.samRuiz, clauses.jon, clauses.john]);
  for (const clause of Object.values(clauses)) if (!personClauses.has(clause) && input.includes(clause)) found.add(clause);
  const message = packet.memoryRequest?.message ?? '';
  const mode = message.startsWith('Actually,') ? 'correct' : message.startsWith('Forget ') ? 'forget' : null;
  const old = mode === 'correct' ? clauses.doorOld : mode === 'forget' ? clauses.keyOld : '';
  const source = packet.memoryCandidates?.find(item => item.message.includes(old));
  const memory = mode && source ? [{ mode, source: source.id, quote: old,
    ...(mode === 'correct' ? { replacement: clauses.doorNew } : {}),
    ...(packet.summary?.text.includes(old) ? { summaryPassages: [old] } : {}) }] : [];
  if (mode) found.delete(old);
  if (mode === 'correct') found.add(clauses.doorNew);
  const names = ['Mira Patel', 'Sam Patel', 'Sam Ruiz', 'Jon Moss', 'John Vale'];
  const people = packet.history.flatMap(item => names.filter(name => item.user.includes(name))
    .map(name => ({ name, quote: item.user })));
  return JSON.stringify({ summary: [...found].join('\n') || 'No planted fact in this interval.', people,
    commitments: [], closed: [], memory, ...(mode && !source ? { memoryDisposition: 'unresolved' } : {}) });
}

export interface RecallCaseResult { id: string; kind: string; packetBytes: number; containsWanted: boolean | null;
  excludesAbsent: boolean | null; answer: string; historyMode: string; probePreparationMs: number }
export interface RecallSetResult { turns: number; recall: number; precision: number; packetBytesMean: number;
  packetBytesMax: number; historyBuildNonModelMs: number; cases: RecallCaseResult[]; summaries: number; journalBytes: number }

export async function runRecallSet(turns: 200 | 1000 | 2000): Promise<RecallSetResult> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `preview-recall-${turns}-`)));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:offline-recall', configurationDigest: 'sha256:offline-recall', expires: now + 1_000_000,
    maxCalls: turns * 3, maxReplies: turns + cases.length + 4, maxTurns: turns + cases.length + 4,
    maxBytes: 24000, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  let historyBuildNonModelMs = 0;
  let stubModelMs = 0;
  const packets = new Map<string, string>();
  const ports = { now: () => now, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      const started = performance.now();
      try {
        if (input.id.startsWith('summary:')) return summarize(input.context);
        packets.set(input.question, input.context);
        return JSON.stringify({ reply: packetAnswer(input.question, input.context), memory: [] });
      } finally { stubModelMs += performance.now() - started; }
    }, send: async () => 1, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, ports);
  try {
    importChannelItems(journal, [{ source: 'conversation', account, id: 'ferry-archive-1', from: 'clerk@example.test',
      at: now - 86_400_000, text: clauses.channel }], account, now);
    const plants = new Map<number, { text: string; thread?: number }>([
      [3, { text: clauses.observatory }], [10, { text: clauses.samPatel }], [11, { text: clauses.samRuiz }],
      [12, { text: clauses.jon }], [13, { text: clauses.john }], [Math.floor(turns * .25), { text: clauses.person }],
      [Math.floor(turns * .5), { text: clauses.dated }],
      [Math.floor(turns * .75), { text: clauses.topic, thread: 42 }],
      [turns - 15, { text: clauses.doorOld }], [turns - 14, { text: `Actually, ${clauses.doorNew}` }],
      [turns - 10, { text: clauses.keyOld }], [turns - 9, { text: `Forget ${clauses.keyOld}` }],
    ]);
    for (let id = 1; id <= turns; id++) {
      const plant = plants.get(id);
      const text = plant?.text ?? `Routine turn ${id}: equipment and scheduling update.`;
      const started = performance.now();
      const modelBefore = stubModelMs;
      if (text.startsWith('Actually,') || text.startsWith('Forget ')) {
        worker.intake([update(id, text, plant?.thread)]);
        await worker.drain();
      } else {
        // Fixture a mundane accepted exchange through the real encrypted journal.
        // Only the two memory decisions and later questions need model calls.
        const item = update(id, text, plant?.thread), turnId = `telegram:12345678:update:${id}`;
        journal.append({ kind: 'intake', id: turnId, update: id, text, raw: JSON.stringify(item),
          accepted: true, cursor: id + 1, at: now, ...(plant?.thread === undefined ? {} : { thread: plant.thread }) });
        journal.append({ kind: 'reserve', id: turnId, at: now });
        journal.append({ kind: 'answer', id: turnId, text: 'Noted.', state: 'complete', at: now });
        journal.append({ kind: 'intent', id: turnId, text: 'PREVIEW — Noted.', chat: genesis.chat,
          ...(plant?.thread === undefined ? {} : { thread: plant.thread }), update: id, grant: genesis.grant, at: now });
        journal.append({ kind: 'sent', id: turnId, message: id, at: now });
      }
      if (id % 32 === 0 || text.startsWith('Actually,') || text.startsWith('Forget '))
        await worker.summarizeIfNeeded(true);
      historyBuildNonModelMs += performance.now() - started - (stubModelMs - modelBefore);
    }
    await worker.summarizeIfNeeded(true);
    // Reopen the real journal: questions must use replayed state, not a live fixture cache.
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    const results: RecallCaseResult[] = [];
    for (let index = 0; index < cases.length; index++) {
      const item = cases[index]!;
      const started = performance.now();
      const probe = worker.probe(item.question);
      if ('reason' in probe) throw Error(`packet ${item.id}: ${probe.reason}`);
      const probePreparationMs = performance.now() - started;
      // The scored packet is the one actually handed to the stub model.
      worker.intake([update(turns + index + 1, item.question)]);
      await worker.drain();
      const context = packets.get(item.question);
      if (!context) throw Error(`model did not receive ${item.id}`);
      const answer = packetAnswer(item.question, context);
      results.push({ id: item.id, kind: item.kind, packetBytes: Buffer.byteLength(context),
        containsWanted: item.wanted === undefined ? null : context.includes(item.wanted)
          && (item.alsoWanted === undefined || context.includes(item.alsoWanted)),
        excludesAbsent: item.absent === undefined ? null : !context.includes(item.absent),
        answer, historyMode: (JSON.parse(context) as { historyMode: string }).historyMode, probePreparationMs });
    }
    const wanted = results.filter(item => item.containsWanted !== null);
    const absent = results.filter(item => item.excludesAbsent !== null);
    const output = { turns, recall: wanted.filter(item => item.containsWanted).length / wanted.length,
      precision: absent.filter(item => item.excludesAbsent).length / absent.length,
      packetBytesMean: Math.round(results.reduce((sum, item) => sum + item.packetBytes, 0) / results.length),
      packetBytesMax: Math.max(...results.map(item => item.packetBytes)),
      historyBuildNonModelMs: Math.round(historyBuildNonModelMs),
      cases: results, summaries: journal.view.summaries.length, journalBytes: statSync(path).size };
    journal.close(); return output;
  } finally { try { journal.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}
