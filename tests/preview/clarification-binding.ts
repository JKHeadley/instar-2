/** Offline measurement: can a terse answer to the agent's clarifying question
 * still be bound to that question, over the real encrypted journal, replay and
 * rolling summary? No provider, Telegram or live journal is opened.
 *
 * The answer stub is an ideal reader limited to what its packet shows: it binds
 * a terse reply to the newest clarification it can see verbatim that has no
 * visible answer yet, and it asks again only when a disagreement's resolution is
 * missing from the packet. It therefore measures packet evidence, never how a
 * real model reads that evidence. */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(71);
const now = 1_790_000_000_000;
const operator = 7654321;
const turnId = (update: number) => `telegram:12345678:update:${String(update)}`;
const updateOf = (id: string) => Number(/update:(\d+)$/u.exec(id)?.[1] ?? -1);
const bound = 'Got it: ';
const asksAgain = 'Which ';

export interface Fixture { id: 'homonym' | 'disagreement'; facts: [string, string]; question: string;
  clarification: string; options: [string, string]; oldClause?: string; keptClause?: string }
export const fixtures: readonly Fixture[] = [
  { id: 'homonym', facts: ['Sarah, my dentist, moved her office to Elm Street.', 'My sister Sarah just moved to Portland.'],
    question: 'Where did Sarah move?', clarification: 'Which Sarah do you mean, your dentist or your sister?',
    options: ['dentist', 'sister'] },
  { id: 'disagreement', facts: ['The Atlas launch is on October 8.', 'The Atlas launch is on November 12.'],
    question: 'When is the Atlas launch?', clarification: 'Which Atlas launch date is right, October 8 or November 12?',
    options: ['October', 'November'], oldClause: 'The Atlas launch is on October 8.', keptClause: 'The Atlas launch is on November 12.' },
];
/** Terse replies and the option each selects: an option name, an ordinal, or neither. */
export const terse: Readonly<Record<Fixture['id'], readonly { text: string; choice: 0 | 1 | 'neither' }[]>> = {
  homonym: [{ text: 'the dentist one', choice: 0 }, { text: 'second', choice: 1 }, { text: 'neither, a new one', choice: 'neither' }],
  disagreement: [{ text: 'the November one', choice: 1 }, { text: 'first', choice: 0 }, { text: 'neither, it moved to December 3', choice: 'neither' }],
};
export type Condition = 'next-turn' | 'restart' | 'rolling-summary' | 'interleaved' | 'interleaved-summary' | 'interleaved-twice-summary';
export const conditions: readonly { condition: Condition; long: boolean }[] = [
  { condition: 'next-turn', long: false }, { condition: 'restart', long: false }, { condition: 'interleaved', long: false },
  { condition: 'next-turn', long: true }, { condition: 'restart', long: true }, { condition: 'rolling-summary', long: true },
  { condition: 'interleaved', long: true }, { condition: 'interleaved-summary', long: true },
  // Beyond the carried continuation: the question is three turns back and compacted.
  { condition: 'interleaved-twice-summary', long: true },
];
const unrelated = 'Can you remind me what a good stretch after running is?';

type Exchange = { update: number; user: string; answer: string | null };
function visibleExchanges(context: string): Exchange[] {
  const packet = JSON.parse(context) as { history?: { id: string; user: string; answer: string | null }[];
    recalled?: { id: string; user: string; answer: string | null }[] };
  const rows = [...packet.history ?? [], ...packet.recalled ?? []].map(item => ({ update: updateOf(item.id),
    user: item.user, answer: item.answer === null ? null : item.answer.replace(/^PREVIEW — /u, '') }));
  return [...new Map(rows.map(row => [row.update, row])).values()].sort((a, b) => a.update - b.update);
}
const choiceOf = (text: string): 0 | 1 | 'neither' | null => {
  for (const list of Object.values(terse)) for (const item of list) if (item.text === text) return item.choice;
  if (/^(?:first|second)$/u.test(text)) return text === 'first' ? 0 : 1;
  return null;
};

/** The stub's own sent forms are recognisable: a clarification starts with the fixture
 * text; a binding starts with `Got it:` and names the clarification it answered. */
export function stubAnswer(question: string, context: string, fixture: Fixture): { reply: string; memory: unknown[] } {
  const seen = visibleExchanges(context);
  const packet = JSON.parse(context) as { memory?: { mode: string }[]; memoryCandidates?: { id: string; message: string }[] };
  if (question === fixture.question) {
    const resolved = seen.some(row => row.answer?.startsWith(`${bound}${fixture.clarification}`))
      || packet.memory?.some(item => item.mode === 'corrected');
    if (fixture.id === 'disagreement' && resolved) return { reply: 'The Atlas launch is on the date you confirmed.', memory: [] };
    return { reply: fixture.clarification, memory: [] };
  }
  if (question === unrelated) return { reply: 'A gentle hamstring stretch works well.', memory: [] };
  if (question === 'Can you draft the invite?') return { reply: 'Should the invite be formal or casual?', memory: [] };
  const choice = choiceOf(question);
  if (choice === null) return { reply: 'Noted.', memory: [] };
  const answered = new Set(seen.filter(row => row.answer?.startsWith(bound)).map(row => row.answer!.slice(bound.length)));
  const open = seen.filter(row => row.answer !== null && !row.answer.startsWith(bound) && row.answer.includes(' or ')
    && row.answer.endsWith('?') && !answered.has(row.answer)).at(-1);
  if (!open) return { reply: 'I am not sure what that refers to.', memory: [] };
  // A disagreement resolved to one existing statement is a correction of the other.
  const memory: unknown[] = [];
  if (open.answer === fixture.clarification && fixture.oldClause && fixture.keptClause && choice !== 'neither') {
    const [oldClause, keptClause] = choice === 1 ? [fixture.oldClause, fixture.keptClause] : [fixture.keptClause, fixture.oldClause];
    const source = packet.memoryCandidates?.find(item => item.message === oldClause);
    const kept = packet.memoryCandidates?.find(item => item.message === keptClause);
    if (source) memory.push({ mode: 'correct', source: source.id, quote: oldClause, replacement: keptClause,
      ...(kept ? { replacementSource: kept.id } : {}) });
  }
  return { reply: `${bound}${open.answer}`, memory };
}

/** A conservative rolling summary: operator fact statements and people, not the agent's own questions. */
function summarize(context: string, fixture: Fixture): string {
  const packet = JSON.parse(context) as { summary?: { text: string }; history: { user: string }[] };
  const facts = new Set((packet.summary?.text ?? '').split('\n').filter(line => fixture.facts.includes(line)));
  for (const item of packet.history) if (fixture.facts.includes(item.user)) facts.add(item.user);
  const people = packet.history.filter(item => item.user.includes('Sarah')).map(item => ({ name: 'Sarah', quote: item.user }));
  return JSON.stringify({ summary: [...facts].join('\n') || 'Routine exchanges.', people, commitments: [], closed: [], memory: [] });
}

export type Binding = 'bound-correct' | 'bound-wrong' | 'dropped';
export type FollowUp = 'resolved' | 'asks-again' | 'free-standing' | null;
export interface CaseResult { fixture: Fixture['id']; condition: Condition; long: boolean; reply: string;
  binding: Binding; followUp: FollowUp; historyMode: string; pendingVisible: boolean; pendingRecalled: boolean; corrected: boolean; held: string | null }

export async function runCase(fixture: Fixture, reply: { text: string; choice: 0 | 1 | 'neither' },
  condition: Condition, long: boolean): Promise<CaseResult> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-clarify-bind-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: String(operator), operator: String(operator),
    grant: 'grant:offline-clarify', configurationDigest: 'sha256:offline-clarify', expires: now + 1_000_000,
    maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 9000, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  const packets = new Map<string, string>();
  const ports = { now: () => now, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) return summarize(input.context, fixture);
      packets.set(input.id, input.context);
      return JSON.stringify(stubAnswer(input.question, input.context, fixture));
    }, send: async () => 1, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, ports);
  let id = 1;
  const update = (text: string) => ({ update_id: id, message: { chat: { id: operator, type: 'private' },
    from: { id: operator }, text, date: Math.floor(now / 1000) - 86_400 + id * 30 } });
  const say = async (text: string, forceSummary = false) => {
    worker.intake([update(text)]); id++; await worker.drain(); await worker.summarizeIfNeeded(forceSummary);
    return turnId(id - 1);
  };
  try {
    if (long) {
      // Mundane exchanges fixtured as valid journal frames make complete history exceed the packet bound.
      for (; id <= 60; id++) {
        const text = `Routine turn ${String(id)}: equipment and scheduling update ${'z'.repeat(80)}.`;
        journal.append({ kind: 'intake', id: turnId(id), update: id, text, raw: JSON.stringify(update(text)),
          accepted: true, cursor: id + 1, at: now });
        journal.append({ kind: 'reserve', id: turnId(id), at: now });
        journal.append({ kind: 'answer', id: turnId(id), text: 'Noted.', state: 'complete', at: now });
        journal.append({ kind: 'intent', id: turnId(id), text: 'PREVIEW — Noted.', chat: genesis.chat, update: id, grant: genesis.grant, at: now });
        journal.append({ kind: 'sent', id: turnId(id), message: id, at: now });
      }
      await worker.summarizeIfNeeded(true);
    }
    for (const fact of fixture.facts) await say(fact);
    const pending = await say(fixture.question, condition === 'rolling-summary');
    if (condition.startsWith('interleaved')) await say(unrelated, condition === 'interleaved-summary');
    if (condition === 'interleaved-twice-summary') await say('Thanks, that helps.', true);
    if (condition === 'restart') { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); }
    const answerId = await say(reply.text);
    const context = packets.get(answerId);
    const answerTurn = journal.view.turns.get(answerId)!;
    const sent = answerTurn.intent?.replace(/^PREVIEW — /u, '') ?? '';
    const binding: Binding = !context || !sent.startsWith(bound) ? 'dropped'
      : sent === `${bound}${fixture.clarification}` ? 'bound-correct' : 'bound-wrong';
    const pendingVisible = context ? visibleExchanges(context).some(row => row.update === updateOf(pending)) : false;
    const pendingRecalled = context ? ((JSON.parse(context) as { recalled?: { id: string }[] }).recalled ?? [])
      .some(item => item.id === pending) : false;
    const corrected = journal.view.memory.some(change => change.trigger === answerId);
    let followUp: FollowUp = null;
    if (fixture.id === 'disagreement' && reply.choice !== 'neither') {
      // Two later turns and the ordinary summary cadence, then the same question again.
      await say(unrelated); await say('Thanks, that helps.', true);
      const again = await say(fixture.question);
      const later = packets.get(again);
      const answer = journal.view.turns.get(again)?.intent?.replace(/^PREVIEW — /u, '') ?? '';
      const shown = later ? visibleExchanges(later) : [];
      const terseShown = shown.some(row => row.update === updateOf(answerId));
      const questionShown = shown.some(row => row.update === updateOf(pending));
      followUp = !answer.startsWith(asksAgain) ? 'resolved' : terseShown && !questionShown ? 'free-standing' : 'asks-again';
    }
    return { fixture: fixture.id, condition, long, reply: reply.text, binding, followUp,
      historyMode: context ? (JSON.parse(context) as { historyMode: string }).historyMode : 'none',
      pendingVisible, pendingRecalled, corrected, held: answerTurn.held ?? null };
  } finally { try { journal.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}

/** Controls: a terse reply that is NOT an answer to the Sarah question. */
export interface ControlResult { id: string; reply: string; expected: string; ok: boolean }
export async function runControl(control: 'later-question' | 'already-answered', long: boolean): Promise<ControlResult> {
  const fixture = fixtures[0]!;
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-clarify-control-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: String(operator), operator: String(operator),
    grant: 'grant:offline-clarify', configurationDigest: 'sha256:offline-clarify', expires: now + 1_000_000,
    maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 9000, cursor: 0 };
  const journal = openPreviewJournal(path, key, genesis);
  const packets = new Map<string, string>();
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) return summarize(input.context, fixture);
      packets.set(input.id, input.context);
      return JSON.stringify(stubAnswer(input.question, input.context, fixture));
    }, send: async () => 1, checkOutbound: () => {} });
  let id = 1;
  const say = async (text: string, force = false) => {
    worker.intake([{ update_id: id, message: { chat: { id: operator, type: 'private' }, from: { id: operator }, text,
      date: Math.floor(now / 1000) - 86_400 + id * 30 } }]); id++;
    await worker.drain(); await worker.summarizeIfNeeded(force);
    return journal.view.turns.get(turnId(id - 1))!.intent?.replace(/^PREVIEW — /u, '') ?? '';
  };
  try {
    if (long) for (let i = 0; i < 40; i++) await say(`Routine turn ${String(i)}: equipment and scheduling update ${'z'.repeat(80)}.`);
    for (const fact of fixture.facts) await say(fact);
    await say(fixture.question);
    if (control === 'later-question') {
      await say('Can you draft the invite?', long);
      const sent = await say('second');
      return { id: `${control}${long ? '-long' : ''}`, reply: 'second', expected: `${bound}Should the invite be formal or casual?`,
        ok: sent === `${bound}Should the invite be formal or casual?` };
    }
    await say('the dentist one');
    await say(unrelated, long);
    const sent = await say('second');
    return { id: `${control}${long ? '-long' : ''}`, reply: 'second', expected: 'no binding', ok: !sent.startsWith(bound) };
  } finally { try { journal.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}

export async function runClarificationBinding() {
  const cases: CaseResult[] = [];
  // Stub calls resolve as microtasks; yield between cases so the test runner's own messages are not starved.
  const yieldTurn = () => new Promise<void>(resolve => { setImmediate(resolve); });
  for (const fixture of fixtures) for (const reply of terse[fixture.id]) for (const { condition, long } of conditions) {
    cases.push(await runCase(fixture, reply, condition, long)); await yieldTurn();
  }
  const controls = [await runControl('later-question', false), await runControl('later-question', true),
    await runControl('already-answered', false), await runControl('already-answered', true)];
  const count = <T extends string>(values: readonly (T | null)[]) => values.reduce<Record<string, number>>((all, value) =>
    value === null ? all : { ...all, [value]: (all[value] ?? 0) + 1 }, {});
  return { cases, controls, binding: count(cases.map(item => item.binding)),
    followUp: count(cases.map(item => item.followUp)), controlsPassed: controls.filter(item => item.ok).length };
}
