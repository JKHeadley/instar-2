/** Offline depth-at-scale fixture. Every fact is in an encrypted journal turn. */
import { mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const now = 1_790_000_000_000;
const key = new Uint8Array(32).fill(41);
const fields = ['venue', 'contact', 'budget', 'status', 'handoff'] as const;
const values = [
  ['north hall', 'west annex', 'library room', 'garden studio', 'main office'],
  ['Mara', 'Jules', 'Robin', 'Tessa', 'Nico'],
  ['forty credits', 'sixty credits', 'eighty credits', 'one hundred credits', 'one hundred twenty credits'],
  ['reviewed', 'scheduled', 'approved', 'awaiting notes', 'ready for handoff'],
  ['blue folder', 'signed form', 'shared ledger', 'printed map', 'review packet'],
] as const;
const firstNames = ['Avery', 'Jordan', 'Morgan', 'Taylor', 'Riley', 'Casey', 'Quinn', 'Jamie', 'Alex', 'Devon'];
const lastNames = ['Stone', 'Rivera', 'Patel', 'Kim', 'Brooks', 'Bennett', 'Reed', 'Singh', 'Chen', 'Morris'];
const domains = ['studio', 'travel', 'family', 'research', 'garden', 'finance', 'health', 'school', 'housing', 'community',
  'archives', 'events', 'music', 'repairs', 'volunteer', 'design', 'writing', 'transport', 'legal', 'planning'];
const areas = ['schedule', 'budget', 'access', 'supplies', 'people', 'records', 'review', 'handoff', 'venue', 'status'];
const percentile = (values: number[], share: number) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * share) - 1] ?? 0;
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: Math.floor(now / 1000) - 86400 + id } });

interface Question { entity: string; project: string; field: string; fact: string; source: string; question: string }
export interface ScaleResult { facts: number; people: number; topics: number; turns: number; questions: number;
  recallAccuracy: number; packetSelectionAccuracy: number; journalBytes: number; seedMs: number; replayMs: number;
  probeP50Ms: number; probeP95Ms: number; turnP50Ms: number; turnP95Ms: number; packetBytesMax: number;
  failures: { question: string; wanted: string; selected: boolean; answered: boolean;
    recalled: string[]; dropped: unknown }[] }

export async function runMemoryScale10k(): Promise<ScaleResult> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-scale-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:offline-scale', configurationDigest: 'sha256:offline-scale', expires: now + 1_000_000,
    maxCalls: 2200, maxReplies: 2200, maxTurns: 2200, maxBytes: 24000, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  const questions: Question[] = [];
  const seenPackets = new Map<string, string>();
  const ports = { now: () => now, stopped: () => false,
    model: async (input: { question: string; context: string }) => {
      seenPackets.set(input.question, input.context);
      const match = questions.find(item => item.question === input.question);
      // The answer stub can copy only a clause from its packet, never consult fixture facts.
      const packet = JSON.parse(input.context) as { recalled?: { user: string }[]; history?: { user: string }[] };
      const visible = [...packet.recalled ?? [], ...packet.history ?? []].map(item => item.user).join(' ');
      const clause = match ? visible.split(/(?<=\.)\s+/u).find(item => item.includes(`${match.project} ${match.field} is `)) : undefined;
      return JSON.stringify({ reply: clause ?? 'UNKNOWN', memory: [] });
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    const seedStart = performance.now();
    let turnId = 0, facts = 0;
    // A long tail: 20 frequent people x 100 facts, 80 other people x 50,
    // and 200 topics x 20. Five related facts per project make 2,000 turns.
    for (let entityId = 1; entityId <= 300; entityId++) {
      if (entityId % 5 === 0) await new Promise<void>(resolve => setImmediate(resolve));
      const count = entityId <= 20 ? 100 : entityId <= 100 ? 50 : 20;
      const entity = entityId <= 100
        ? `${firstNames[(entityId - 1) % 10]} ${lastNames[Math.floor((entityId - 1) / 10)]}`
        : `${domains[Math.floor((entityId - 101) / 10)]} ${areas[(entityId - 101) % 10]} topic`;
      for (let projectId = 1; projectId <= count / fields.length; projectId++) {
        turnId++;
        const project = `${entityId <= 100 ? 'person' : 'topic'}-${entityId}-project-${String(projectId).padStart(2, '0')}`;
        const clauses = fields.map((field, index) => `${entity} ${project} ${field} is ${values[index]![(entityId + projectId + index) % 5]} ${entityId}-${projectId}.`);
        const text = clauses.join(' '), id = `telegram:12345678:update:${turnId}`;
        journal.append({ kind: 'intake', id, update: turnId, text, raw: JSON.stringify(update(turnId, text)),
          accepted: true, cursor: turnId + 1, at: now });
        journal.append({ kind: 'reserve', id, at: now });
        journal.append({ kind: 'answer', id, text: 'Noted.', state: 'complete', at: now });
        journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: genesis.chat,
          update: turnId, grant: genesis.grant, at: now });
        journal.append({ kind: 'sent', id, message: turnId, at: now });
        facts += fields.length;
        if ([1, Math.ceil(count / fields.length / 2), count / fields.length].includes(projectId)
          && [1, 10, 20, 21, 60, 100, 101, 150, 200, 250, 300].includes(entityId)) {
          for (const fieldIndex of [0, 3]) {
            const field = fields[fieldIndex]!;
            questions.push({ entity, project, field, fact: clauses[fieldIndex]!, source: id,
              question: `What is the ${field} for ${entity} on ${project}?` });
          }
        }
      }
    }
    if (facts !== 10000 || turnId !== 2000) throw Error('scale fixture cardinality differs');
    journal.append({ kind: 'summary-reserve', through: turnId, at: now });
    journal.append({ kind: 'summary', through: turnId, text: 'The operator discussed many people and topics. Look up original turns for exact facts.', at: now });
    const seedMs = performance.now() - seedStart;
    const journalBytes = statSync(path).size;
    journal.close();
    const replayStart = performance.now();
    journal = openPreviewJournal(path, key);
    const replayMs = performance.now() - replayStart;
    const worker = createJournalWorker(journal, ports);
    const probeTimes: number[] = [], turnTimes: number[] = [], failures: ScaleResult['failures'] = [];
    let selected = 0, answered = 0, packetBytesMax = 0;
    for (const [index, item] of questions.entries()) {
      const probeStart = performance.now();
      const probe = worker.probe(item.question);
      probeTimes.push(performance.now() - probeStart);
      if ('reason' in probe) throw Error(`scale probe held: ${probe.reason}`);
      const turnStart = performance.now();
      worker.intake([update(turnId + index + 1, item.question)]);
      await worker.drain();
      turnTimes.push(performance.now() - turnStart);
      const context = seenPackets.get(item.question);
      if (!context) throw Error(`scale model did not see ${item.question}`);
      packetBytesMax = Math.max(packetBytesMax, Buffer.byteLength(context));
      const packet = JSON.parse(context) as { recalled?: { id: string; user: string }[] };
      const correctSelection = packet.recalled?.some(source => source.id === item.source && source.user.includes(item.fact)) ?? false;
      const reply = journal.view.order.at(-1)?.answer ?? '';
      const correctAnswer = reply.includes(item.fact);
      selected += Number(correctSelection); answered += Number(correctAnswer);
      if (!correctSelection || !correctAnswer) failures.push({ question: item.question, wanted: item.fact,
        selected: correctSelection, answered: correctAnswer,
        recalled: packet.recalled?.map(source => source.id) ?? [],
        dropped: journal.view.order.at(-1)?.packetDropped ?? [] });
      // Keep later question turns behind the same bounded summary frontier used
      // by the runner. The fixture does not pretend these stub summaries were
      // produced by a model; the recall questions still read original turns.
      if ((index + 1) % 8 === 0) {
        const through = turnId + index + 1;
        journal.append({ kind: 'summary-reserve', through, at: now });
        journal.append({ kind: 'summary', through,
          text: 'The operator asked about earlier project facts; original turns hold exact details.', at: now });
      }
    }
    journal.close();
    return { facts, people: 100, topics: 200, turns: turnId, questions: questions.length,
      recallAccuracy: answered / questions.length, packetSelectionAccuracy: selected / questions.length,
      journalBytes, seedMs, replayMs, probeP50Ms: percentile(probeTimes, .5), probeP95Ms: percentile(probeTimes, .95),
      turnP50Ms: percentile(turnTimes, .5), turnP95Ms: percentile(turnTimes, .95), packetBytesMax, failures };
  } finally { try { journal.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}
