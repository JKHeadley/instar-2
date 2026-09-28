import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal.js';

const now = 1_790_000_000_000;
const facts = [
  'My dentist appointment is at the Oak Street clinic.',
  'My dental insurance card is in the blue folder.',
  'My passport is in the kitchen drawer.',
  'My passport expires next spring.',
  'The flight confirmation code is H7Q9.',
  'The flight leaves from terminal three.',
  'Mira likes ranunculus flowers for her birthday.',
  'Mira moved to the west side of town.',
  'The tomato seedlings belong in the north bed.',
  'The tomato sauce recipe uses smoked paprika.',
  'The dog takes one tablet with dinner.',
  "The dog's tablets are collected at the pharmacy.",
  'The tailor pickup is booked for 2026-09-25.',
  'The library hold expires on 2026-09-26.',
  'The bike inspection is scheduled for 2026-09-27.',
  'The museum reservation is for 2026-09-28.',
  'The utility meter visit is on 2026-09-29.',
  'The vet records are due on 2026-09-30.',
];
/** Each expected index is the smallest source set needed to answer that question. */
const corpus = [
  { question: 'Which clinic is my dentist appointment at?', ideal: [0] },
  { question: 'Where did I put my dental insurance card?', ideal: [1] },
  { question: 'Where is my passport?', ideal: [2] },
  { question: 'When does my passport expire?', ideal: [3] },
  { question: 'What is the flight confirmation code?', ideal: [4] },
  { question: 'Which terminal does my flight leave from?', ideal: [5] },
  { question: 'What flowers does Mira like for her birthday?', ideal: [6] },
  { question: 'Where did Mira move?', ideal: [7] },
  { question: 'Where should the tomato seedlings go?', ideal: [8] },
  { question: 'What spice goes in my tomato sauce?', ideal: [9] },
  { question: 'How many tablets does the dog take with dinner?', ideal: [10] },
  { question: 'Where do I collect the dog tablets?', ideal: [11] },
];

it('measures labelled minimal recall on the actual bounded model packets', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'packet-selection-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(29), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
    configurationDigest: 'sha256:offline', expires: now + 1_000_000, maxCalls: 100,
    maxReplies: 100, maxTurns: 100, maxBytes: 18000, cursor: 0 });
  try {
    const add = (id: number, text: string) => {
      const raw = JSON.stringify({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text, date: Math.floor(now / 1000) - 86400 + id } });
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${id}`, update: id,
        text, raw, accepted: true, cursor: id + 1, at: now });
    };
    facts.forEach((fact, index) => add(index + 1, fact));
    for (let id = facts.length + 1; id <= 52; id++) add(id,
      `Ordinary check-in ${id} about errands and the weekly schedule. ${'Routine notes. '.repeat(32)}`);
    journal.append({ kind: 'summary-reserve', through: 52, at: now });
    journal.append({ kind: 'summary', through: 52,
      text: 'Earlier conversations covered a dentist visit, travel documents, a flight, Mira, gardening and the dog.', at: now });
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    let truePositive = 0, selected = 0, expected = 0, bytes = 0;
    const rows = corpus.map(({ question, ideal }) => {
      const probe = worker.probe(question);
      if ('reason' in probe) throw Error(`${question}: ${probe.reason}`);
      const packet = JSON.parse(probe.context) as { historyMode: string; recalled?: { id: string }[] };
      expect(packet.historyMode).toBe('summary-plus-recent');
      const picked = (packet.recalled ?? []).map(item => Number(item.id.split(':').at(-1)) - 1);
      const wanted = new Set(ideal);
      const hits = picked.filter(index => wanted.has(index)).length;
      truePositive += hits; selected += picked.length; expected += ideal.length;
      const packetBytes = Buffer.byteLength(probe.context); bytes += packetBytes;
      return { question, ideal, picked, precision: picked.length ? hits / picked.length : 0,
        recall: hits / ideal.length, packetBytes };
    });
    const result = { precision: truePositive / selected, recall: truePositive / expected,
      packetBytesMean: Math.round(bytes / corpus.length), rows };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    expect(result.recall).toBe(1);
    // int13: the two turns before a terse follow-up stay recalled; one question gains one such turn (measured 12/61).
    expect(result.precision).toBeGreaterThanOrEqual(12 / 61);
    // int12: other pieces add fixed reply instructions, plus conflict/fact-update and exact-unit guidance
    // that ride here because memoryCandidates are offered and recalled facts carry units (measured mean 8598).
    // cbuild-2: every verified operator packet is offered the summary-scheduling decision and bounded
    // memory search (Rules 10 and 11, no keyword prerequisite); search uses only leftover room (measured mean 9486).
    // cbuild-2 repair: a probe from a not-yet-accounted summary frontier carries the Rule 110 continuity note
    // and the meaning index's disposition (measured mean 9601).
    expect(result.packetBytesMean).toBeLessThanOrEqual(9728);
    expect(rows.find(row => row.question.startsWith('Which clinic'))?.picked).toContain(0);
    const agenda = worker.probe('What should I know about upcoming plans?');
    if ('reason' in agenda) throw Error(agenda.reason);
    expect((JSON.parse(agenda.context) as { recalled: { id: string }[] }).recalled
      .some(item => item.id.endsWith(':18'))).toBe(true);
    const account = 'agent@example.test';
    importChannelFixture(journal, [
      { source: 'email', account, id: 'ferry-booking', from: 'ferry@example.test',
        at: now - 86_400_000, text: 'The ferry booking number is FQ-17.' },
      ...Array.from({ length: 5 }, (_, index) => ({ source: 'email', account,
        id: `dated-${index}`, from: 'calendar@example.test', at: now - 86_400_000,
        text: `An unrelated visit is on 2026-09-${25 + index}.` })),
    ], account, now);
    const ferry = worker.probe('What is the ferry booking number?');
    if ('reason' in ferry) throw Error(ferry.reason);
    expect((JSON.parse(ferry.context) as { channelMemory: { quote: string }[] }).channelMemory
      .map(item => item.quote)).toEqual(['The ferry booking number is FQ-17.']);
    const channelAgenda = worker.probe('What should I know about upcoming plans?');
    if ('reason' in channelAgenda) throw Error(channelAgenda.reason);
    expect((JSON.parse(channelAgenda.context) as { channelMemory: unknown[] }).channelMemory.length).toBeGreaterThan(0);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 30000);

it.each([
  { question: 'Where is my passport and when does it expire?',
    sources: ['My passport is in the kitchen drawer.', 'My passport expires next spring.'],
    summary: 'The operator discussed passport storage and expiry.' },
  { question: "What's the cabinet code at the gym?",
    sources: ['The gym office code is 1111.', 'The locker combination is QUASAR-7731.'],
    summary: 'The gym cabinet code is the locker combination.' },
])('keeps complementary answer sources in a bounded packet: $question', ({ question, sources, summary }) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'packet-complementary-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(30), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
    configurationDigest: 'sha256:offline', expires: now + 1_000_000, maxCalls: 100,
    maxReplies: 100, maxTurns: 100, maxBytes: 18000, cursor: 0 });
  try {
    const turns = [...sources, ...Array.from({ length: 50 }, (_, index) =>
      `Routine turn ${index}: weather and errands. ${'Routine notes. '.repeat(32)}`)];
    turns.forEach((text, index) => {
      const id = index + 1;
      const raw = JSON.stringify({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text, date: Math.floor(now / 1000) - 86400 + id } });
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${id}`, update: id,
        text, raw, accepted: true, cursor: id + 1, at: now });
    });
    journal.append({ kind: 'summary-reserve', through: turns.length, at: now });
    journal.append({ kind: 'summary', through: turns.length, text: summary, at: now });
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    const probe = worker.probe(question);
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context) as { historyMode: string; recalled?: { id: string }[]; dropped?: unknown[] };
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect((packet.recalled ?? []).map(item => item.id)).toEqual(expect.arrayContaining([
      'telegram:12345678:update:1', 'telegram:12345678:update:2',
    ]));
    for (const source of sources) expect(probe.context).toContain(source);
    expect(Buffer.byteLength(probe.context)).toBeLessThanOrEqual(18000);
    expect(packet.dropped ?? []).toEqual([]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 30000);
