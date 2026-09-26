import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal, PREVIEW_RECALL_LIMIT } from './journal.js';
import { bm25, terms } from '../../src/recall/lexical.js';

const key = new Uint8Array(32).fill(9);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-people-')));
const genesis = (maxBytes = 2400) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes, cursor: 0 });
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1790000000 + id * 60 } });
const filler = (i: number) => `ordinary turn ${i}: the launch budget, errands and plans ${'x'.repeat(40)}`;

/** An honest summarizer: it names people by quoting operator messages exactly. Extra
 * proposals exercise the verbatim floor: a paraphrase, a name absent from its quote,
 * the agent's own answer as a source, and a turn the packet never showed. */
const summarizer = (names: readonly string[], bad = true) => (context: string) => {
  const packet = JSON.parse(context) as { history: { user: string }[] };
  const people = packet.history.flatMap(turn => names.filter(name => turn.user.includes(name))
    .map(name => ({ name, quote: turn.user })));
  if (bad) people.push({ name: 'Sam', quote: 'Sam personally told the agent the launch is cancelled.' },
    { name: 'Priya', quote: packet.history[0]?.user ?? '' }, { name: 'Sam', quote: 'Sam agrees with you.' },
    { name: 'Sam', quote: 'My cofounder Sam thinks the launch should slip to November.' });
  // Fenced, as real models often answer; the runner reads the JSON inside.
  return `\`\`\`json\n${JSON.stringify({ summary: 'Earlier turns covered the launch, errands and some people.', people })}\n\`\`\``;
};

function world(root: string, options: { names?: readonly string[]; bad?: boolean; plain?: boolean;
  prepare?: (context: string) => void } = {}) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const asked = new Map<string, string>();
  const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
    prepareModel: input => { options.prepare?.(input.context); return input.context; },
    model: async input => {
      if (input.id.startsWith('summary:')) return options.plain ? 'A plain summary.' : summarizer(options.names ?? ['Sam', 'Priya'], options.bad ?? true)(input.context);
      asked.set(input.question, input.context); return 'Noted. Sam agrees with you.';
    },
    send: async () => 1, checkOutbound: () => {} });
  const say = async (id: number, text: string, from?: number) => {
    worker.intake([update(id, text, from)]); await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, asked, say };
}

it('writes person notes only after replies, verbatim from operator messages, inside the shared attempt cap', async () => {
  const root = origin();
  try {
    const w = world(root);
    await w.say(1, 'My cofounder Sam thinks the launch should slip to November.');
    expect(w.journal.view.people).toEqual([]);
    for (let i = 2; i <= 12; i++) await w.say(i, filler(i));
    const view = w.journal.view;
    expect(view.summaries.length).toBeGreaterThan(0);
    expect(view.people).toEqual([{ name: 'Sam', source: 'telegram:12345678:update:1',
      quote: 'My cofounder Sam thinks the launch should slip to November.' }]);
    expect(view.calls).toBe(12 + view.summaries.length);
    expect(view.order.every(turn => turn.sent === 1)).toBe(true);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('recalls every note about a named person after compaction, keeps the operator as speaker, and survives restart', async () => {
  const root = origin();
  try {
    let w = world(root);
    await w.say(1, 'My cofounder Sam thinks the launch should slip to November.');
    await w.say(2, 'Priya said she disagrees with Sam about the launch date.');
    for (let i = 3; i <= 14; i++) await w.say(i, filler(i));
    w.journal.close();
    w = world(root);
    expect(w.journal.view.people.map(note => note.name)).toEqual(['Sam', 'Sam', 'Priya']);
    const question = "What is Sam's view on the launch budget, errands and plans?";
    await w.say(15, question);
    const packet = JSON.parse(w.asked.get(question)!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.history.some((turn: { user: string }) => turn.user.includes('Sam'))).toBe(false);
    expect(packet.people).toEqual([
      { person: 'Sam', from: 'the operator (verified sender)', date: '2026-09-21T14:14Z',
        quote: 'My cofounder Sam thinks the launch should slip to November.' },
      { person: 'Sam', from: 'the operator (verified sender)', date: '2026-09-21T14:15Z',
        quote: 'Priya said she disagrees with Sam about the launch date.' }]);
    expect(packet.capability).toContain('did not say it unless from is that person');
    // The named failure: word-match recall alone ranks the many launch-budget turns above both turns about Sam.
    const covered = w.journal.view.order.filter(turn => turn.update <= packet.summary.through);
    const ranked = bm25(terms(question), covered.map(turn => terms(`${turn.text} ${turn.answer ?? ''}`)))
      .sort((a, b) => b.matched - a.matched || b.score - a.score).slice(0, PREVIEW_RECALL_LIMIT);
    expect(ranked.map(hit => covered[hit.index]!.text).some(text => text.includes('Sam'))).toBe(false);
    await w.say(16, 'Remind me about the weather plans.');
    expect(JSON.parse(w.asked.get('Remind me about the weather plans.')!).people).toBeUndefined();
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('says who really spoke: a person\'s own authenticated message is theirs, a report about them is the operator\'s', async () => {
  const root = origin();
  try {
    const w = world(root);
    await w.say(1, 'Sam thinks the budget is fine.');
    // A future group turn authenticated as Sam's own account (not admitted by this preview's intake).
    w.journal.append({ kind: 'intake', id: 'telegram:12345678:update:2', update: 2, text: 'Sam here: the budget is too small.',
      raw: JSON.stringify(update(2, 'Sam here: the budget is too small.', 555)), accepted: true, cursor: 3, at: 1790000000000 });
    await w.worker.drain();
    for (let i = 3; i <= 14; i++) await w.say(i, filler(i));
    await w.say(15, 'What has Sam said?');
    const people = JSON.parse(w.asked.get('What has Sam said?')!).people;
    expect(people.map((note: { from: string; quote: string }) => [note.from, note.quote])).toEqual([
      ['the operator (verified sender)', 'Sam thinks the budget is fine.'],
      ['Telegram user 555 (authenticated sender, not the operator)', 'Sam here: the budget is too small.']]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps same-name people apart for the model and gives an unknown person nothing to invent from', async () => {
  const root = origin();
  try {
    const w = world(root, { names: ['Sam Patel', 'Sam Ruiz', 'Sam'], bad: false });
    await w.say(1, 'Sam Patel from accounting approved the budget.');
    await w.say(2, 'Sam Ruiz, my neighbour, lent me a ladder.');
    for (let i = 3; i <= 14; i++) await w.say(i, filler(i));
    await w.say(15, 'What did Sam do?');
    const packet = JSON.parse(w.asked.get('What did Sam do?')!);
    // Only notes filed under the name as asked are candidates; their quotes show two different Sams.
    expect(packet.people.map((note: { person: string; quote: string }) => [note.person, note.quote])).toEqual([
      ['Sam', 'Sam Patel from accounting approved the budget.'], ['Sam', 'Sam Ruiz, my neighbour, lent me a ladder.']]);
    expect(w.journal.view.people.map(note => note.name).slice(0, 4)).toEqual(['Sam Patel', 'Sam', 'Sam Ruiz', 'Sam']);
    expect(packet.capability).toContain('The same name can mean different people');
    await w.say(16, 'What did Oliver say about the launch?');
    const unknown = JSON.parse(w.asked.get('What did Oliver say about the launch?')!);
    expect(unknown.people).toBeUndefined();
    expect(JSON.stringify(unknown)).not.toContain('Oliver said');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a plain summary and reports the missing people record; person notes give way before the context bound', async () => {
  const root = origin();
  try {
    const w = world(root, { plain: true });
    await w.say(1, 'My cofounder Sam thinks the launch should slip to November.');
    for (let i = 2; i <= 12; i++) await w.say(i, filler(i));
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    expect(w.journal.view.people).toEqual([]);
    expect(w.journal.view.order[0]?.text).toContain('Sam');
    w.journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    expect(status.status).toBe(0);
    const report = JSON.parse(status.stdout);
    expect(report.summaries.every((summary: { people: number | null }) => summary.people === null)).toBe(true);
    expect(report.people).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
  const tight = origin();
  try {
    // A prompt bound that cannot hold recalled turns drops them first; one that cannot hold person notes drops those next.
    let refuse = '"recalled"';
    const w = world(tight, { prepare: context => { if (context.includes(refuse)) throw Error('overflow'); } });
    await w.say(1, 'My cofounder Sam thinks the launch should slip to November.');
    for (let i = 2; i <= 12; i++) await w.say(i, filler(i));
    await w.say(13, 'What does Sam think about the launch budget?');
    const first = JSON.parse(w.asked.get('What does Sam think about the launch budget?')!);
    expect(first.recalled).toBeUndefined();
    expect(first.people.length).toBeGreaterThan(0);
    refuse = '"people"';
    await w.say(14, 'What does Sam think, again?');
    const second = JSON.parse(w.asked.get('What does Sam think, again?')!);
    expect(second.people).toBeUndefined();
    expect(second.historyMode).toBe('summary-plus-recent');
    expect(w.journal.view.order.every(turn => turn.sent === 1)).toBe(true);
    w.journal.close();
  } finally { rmSync(tight, { recursive: true, force: true }); }
});

it('keeps per-turn non-model overhead flat through 200 turns with person notes and a restart', async () => {
  const root = origin(), samples: number[] = [];
  try {
    let w = world(root, { bad: false });
    for (let i = 1; i <= 200; i++) {
      if (i === 100) { w.journal.close(); w = world(root, { bad: false }); }
      const text = i % 10 === 1 ? `Sam ${i} reported that Priya wants item ${i} reviewed.`
        : i === 199 ? 'What have Sam and Priya said?' : filler(i);
      const start = performance.now();
      await w.say(i, text);
      samples.push(performance.now() - start);
    }
    const view = w.journal.view;
    expect(view.order.every(turn => turn.sent === 1)).toBe(true);
    expect(view.people.length).toBeGreaterThan(10);
    expect(JSON.parse(w.asked.get('What have Sam and Priya said?')!).people.length).toBeGreaterThan(0);
    const p95 = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]!;
    const first = p95(samples.slice(0, 10)), last = p95(samples.slice(190));
    process.stdout.write(`journal people 200 turns: non-model p95=${p95(samples).toFixed(1)} ms, first-ten=${first.toFixed(1)} ms, final-ten=${last.toFixed(1)} ms\n`);
    expect(p95(samples)).toBeLessThanOrEqual(5000);
    expect(last - first).toBeLessThanOrEqual(1000);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
