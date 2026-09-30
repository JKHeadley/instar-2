/** Fixed, offline live-shaped recall scorecard. The scored evidence is the packet
 * the journal worker actually offers its reply model after encrypted replay. */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(82);
const now = 1_790_500_000_000;
const bot = '12345678';
const chat = '7654321';
const marker = (n: number) => `The project marker is M-${String(n).padStart(2, '0')}.`;
const gymOld = 'My gym locker code is 3310.';
const gymNew = 'my gym locker code is 4412';
const bike = 'My bike lock code is 6284.';
const dentist = 'My dentist visit is October 1 at 3 pm.';
const cofounder = 'Sam Ortiz is my cofounder and prefers the October launch.';
const samPatel = 'Sam Patel from accounting approved the budget.';
const samRuiz = 'Sam Ruiz, my neighbour, lent me a ladder.';

interface Case { id: string; category: string; question: string; wanted: string; absent?: string }
const cases: Case[] = [
  { id: 'first-marker', category: 'markers', question: 'What was the first project marker?', wanted: marker(1) },
  { id: 'latest-marker', category: 'markers', question: 'What is the latest project marker?', wanted: marker(8) },
  { id: 'cofounder', category: 'cofounders', question: 'Which Sam is my cofounder?', wanted: cofounder },
  { id: 'sam-accounting', category: 'two-Sams', question: 'What did Sam Patel approve?', wanted: samPatel },
  { id: 'sam-neighbour', category: 'two-Sams', question: 'What did Sam Ruiz lend me?', wanted: samRuiz },
  { id: 'gym-corrected', category: 'codes', question: 'What is my gym locker code?', wanted: gymNew, absent: gymOld },
  { id: 'bike', category: 'codes', question: 'What is my bike lock code?', wanted: bike },
  { id: 'dentist', category: 'dentist', question: 'When is my dentist visit?', wanted: dentist },
  { id: 'correction', category: 'corrections', question: 'Which gym code did I correct to?', wanted: gymNew, absent: gymOld },
];

const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: Number(chat), type: 'private' }, from: { id: Number(chat) }, text,
    date: Math.floor(now / 1000) - 86_400 + id * 30 } });

function summarize(context: string): string {
  const packet = JSON.parse(context) as { history: { user: string }[];
    memoryRequest?: { message: string }; memoryCandidates?: { id: string; message: string }[] };
  const people = packet.history.flatMap(({ user }) =>
    ['Sam Ortiz', 'Sam Patel', 'Sam Ruiz'].filter(name => user.includes(name))
      .map(name => ({ name, quote: user })));
  const correction = packet.memoryRequest?.message.includes('Actually, my gym locker code')
    ? packet.memoryCandidates?.find(item => item.message.includes(gymOld)) : undefined;
  return JSON.stringify({ summary: 'The operator discussed project markers, people, codes and a dentist visit.', people,
    commitments: [], closed: [], memory: correction ? [{ mode: 'correct', source: correction.id,
      quote: gymOld, replacement: gymNew }] : [],
    ...(packet.memoryRequest?.message.includes('Actually, my gym locker code') && !correction
      ? { memoryDisposition: 'unresolved' } : {}) });
}

export interface ScorecardCase { id: string; category: string; pass: boolean; wantedVisible: boolean;
  absentExcluded: boolean | null; evidenceSurfaces: string[]; packetBytes: number; historyMode: string }
export interface Scorecard { base: string; turns: number; cases: ScorecardCase[];
  categories: Record<string, { passed: number; total: number; score: number }>;
  overall: number; summaries: number }

export async function runRecallScorecard(): Promise<Scorecard> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recall-scorecard-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot, chat, operator: chat, grant: 'grant:offline-scorecard',
    configurationDigest: 'sha256:offline-scorecard', expires: now + 1_000_000,
    maxCalls: 240, maxReplies: 130, maxTurns: 130, maxBytes: 12000, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  const ports = { now: () => now, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) return summarize(input.context);
      if (input.question === dentist) return JSON.stringify({ reply: 'I saved that date.', memory: [],
        dated: [{ quote: dentist, when: 'October 1 at 3 pm' }] });
      return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
    }, send: async () => 1, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, ports);
  try {
    const plants = new Map<number, string>([
      [1, marker(1)], [2, cofounder], [3, samPatel], [4, samRuiz], [5, gymOld],
      [6, bike], [7, dentist], [12, marker(2)], [20, marker(3)], [28, marker(4)],
      [36, marker(5)], [44, marker(6)], [52, marker(7)], [60, marker(8)],
      [65, 'Actually, my gym locker code is 4412, not 3310.'],
    ]);
    for (let id = 1; id <= 80; id++) {
      const message = plants.get(id) ?? `Routine turn ${id}: launch planning and errands.`;
      if (id === 7 || id === 65) {
        worker.intake([update(id, message)]); await worker.drain();
      } else {
        const turnId = `telegram:${bot}:update:${id}`;
        journal.append({ kind: 'intake', id: turnId, update: id, text: message,
          raw: JSON.stringify(update(id, message)), accepted: true, cursor: id + 1, at: now });
        journal.append({ kind: 'reserve', id: turnId, at: now });
        journal.append({ kind: 'answer', id: turnId, text: 'Noted.', state: 'complete', at: now });
        journal.append({ kind: 'intent', id: turnId, text: 'PREVIEW — Noted.', chat,
          update: id, grant: genesis.grant, at: now });
        journal.append({ kind: 'sent', id: turnId, message: id, at: now });
      }
      if (id % 16 === 0 || id === 65) await worker.summarizeIfNeeded(true);
    }
    await worker.summarizeIfNeeded(true);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    const results: ScorecardCase[] = cases.map(item => {
      const probe = worker.probe(item.question);
      if ('reason' in probe) throw Error(`${item.id}: ${probe.reason}`);
      const packet = JSON.parse(probe.context) as Record<string, unknown> & { historyMode: string };
      const wantedVisible = probe.context.includes(item.wanted);
      const absentExcluded = item.absent === undefined ? null : !probe.context.includes(item.absent);
      const evidenceSurfaces = ['summary', 'history', 'recalled', 'people', 'dated', 'memory', 'memorySearch', 'inventory']
        .filter(field => (JSON.stringify(packet[field]) ?? '').includes(item.wanted));
      return { id: item.id, category: item.category, pass: wantedVisible && absentExcluded !== false,
        wantedVisible, absentExcluded, evidenceSurfaces, packetBytes: Buffer.byteLength(probe.context),
        historyMode: packet.historyMode };
    });
    const categories: Scorecard['categories'] = {};
    for (const item of results) {
      const current = categories[item.category] ?? { passed: 0, total: 0, score: 0 };
      current.total++; if (item.pass) current.passed++;
      current.score = current.passed / current.total; categories[item.category] = current;
    }
    const output = { base: '3695117d', turns: 80, cases: results, categories,
      overall: results.filter(item => item.pass).length / results.length,
      summaries: journal.view.summaries.length };
    journal.close(); return output;
  } finally { try { journal.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}
