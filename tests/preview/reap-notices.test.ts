import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { openReplyNotices, validAnswerNotices, type NoticeTurn } from './credential-reminders.js';
import { reapNotices, recordIdleReap, type ReapHistory } from './reap-notices.js';

// Real recorded process-edge shape; only identities/topic and idle-close outcome
// are varied here. The integration test obtains the close from the actual reaper.
const captured = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8'));
const process = captured.workerRecords.find((row: { record: SessionWorkEdge }) =>
  row.record.type === 'SessionWorkEdge' && row.record.id.endsWith(':process')).record as SessionWorkEdge;
const occurrence = (n: number, topic: string | null = '7'): (SessionWorkEdge | SessionWorkEdgeClose)[] => {
  const { topic: _topic, ...base } = process;
  return [{ ...base, id: `worker-${n}:process`, ...(topic === null ? {} : { topic }) },
    { type: 'SessionWorkEdgeClose', schemaVersion: 1, id: `worker-${n}:idle-close`, edge: `worker-${n}:process`,
      child: `launch-${n}`, state: 'complete', evidence: 'fresh-adapter-idle', detail: 'retained work', closedAt: n + 1, resultBytes: null }];
};

function project(records: readonly (SessionWorkEdge | SessionWorkEdgeClose)[]) {
  let history: ReapHistory | undefined;
  const active = new Map<string, SessionWorkEdge>();
  for (const row of records) {
    if (row.type === 'SessionWorkEdge') active.set(row.id, row);
    else { history = recordIdleReap(history, active.get(row.edge), row); active.delete(row.edge); }
  }
  return history;
}

it('aggregates a burst into one short line, without leaking raw process or reason fields', () => {
  const records = Array.from({ length: 500 }, (_, i) => occurrence(i)).flat();
  const notices = reapNotices(project(records), [], 'answer', '7');
  expect(notices).toHaveLength(1);
  expect(notices[0]!.line).toContain('closed 500 workers in this conversation');
  expect(notices[0]!.line.length).toBeLessThan(600);
  expect(notices[0]!.line).not.toContain(process.scope);
  expect(validAnswerNotices(notices, notices[0]!.line)).toBe(true);
  expect(reapNotices(project([...records, ...records.filter(row => row.type === 'SessionWorkEdgeClose')]), [], 'answer', '7')).toEqual(notices);
});

it.each(['sent', 'unknown', 'held'] as const)('keeps the last aggregate’s occurrence boundary after %s delivery and restart', state => {
  const first = [...occurrence(1), ...occurrence(2)];
  const notices = reapNotices(project(first), [], 'first', '7');
  const turn: NoticeTurn = { id: 'first', answerNotices: notices,
    ...(state === 'held' ? {} : { intent: `Answer.\n\n${notices[0]!.line}` }),
    ...(state === 'sent' ? { sent: 42 } : {}) };
  const replay = JSON.parse(JSON.stringify([turn])) as NoticeTurn[];
  expect(reapNotices(project(first), replay, 'second', '7')).toEqual([]);
  const next = reapNotices(project([...first, ...occurrence(3)]), replay, 'second', '7');
  expect(next).toHaveLength(1); expect(next[0]!.line).toContain('closed 1 worker in this conversation');
  expect(openReplyNotices(replay, next, 'second')).toEqual(next);
  expect(reapNotices(project(first), replay, 'first', '7')).toEqual(notices);
});

it('offers a notice again when the final send intent did not include it', () => {
  const records = occurrence(1), notices = reapNotices(project(records), [], 'first', '7');
  expect(reapNotices(project(records), [{ id: 'first', answerNotices: notices, intent: 'Held reply without the note.' }], 'second', '7'))
    .toEqual(notices);
});

it('does not lose an older held batch when a newer batch sends before the older notice is removed', () => {
  const history = project([...occurrence(1), ...occurrence(2), ...occurrence(3)]);
  const first = reapNotices(project([...occurrence(1), ...occurrence(2)]), [], 'first', '7');
  const held: NoticeTurn = { id: 'first', answerNotices: first };
  const second = reapNotices(history, [held], 'second', '7');
  const sent: NoticeTurn = { id: 'second', answerNotices: second, intent: second[0]!.line, sent: 42 };
  const repaired = reapNotices(history, [{ ...held, intent: 'The held answer was replaced without a notice.' }, sent], 'third', '7');
  expect(repaired).toEqual(first);
});

it('keeps other topics and unknown legacy topic bindings private', () => {
  const records = [...occurrence(1, '8'), ...occurrence(2, 'main'), ...occurrence(3, null)];
  expect(reapNotices(project(records), [], 'answer', '7')).toEqual([]);
  expect(reapNotices(project(records), [], 'answer', '8')[0]!.line).toContain('closed 1 worker');
  expect(reapNotices(project(records), [], 'answer', 'main')[0]!.line).toContain('closed 1 worker');
});

it.each(['uncertain', 'failed', 'ordinary-close', 'missing-edge', 'no-evidence'] as const)('does not report a confirmed idle reap for %s', mode => {
  const records = occurrence(1), close = records[1] as SessionWorkEdgeClose;
  if (mode === 'missing-edge') records.shift();
  else records[1] = { ...close, ...(mode === 'uncertain' || mode === 'failed' ? { state: mode } : {}),
    ...(mode === 'ordinary-close' ? { id: 'worker-1:close' } : {}), ...(mode === 'no-evidence' ? { evidence: '' } : {}) };
  expect(reapNotices(project(records), [], 'answer', '7')).toEqual([]);
});

it('the shipped runner obtains notices from journal occurrences and this turn’s topic', () => {
  const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  expect(source).toContain("import { reapNotices } from './reap-notices.js'");
  const block = source.split('// Reply-only delivery:')[1]!.split('return notices;')[0]!;
  const records = occurrence(1);
  const invoke = Function('turn', 'journal', 'reapNotices', 'notices', `// ${block} return notices;`);
  const journal = { sessionWorkRecords: () => { throw Error('hot path must not read the log'); }, view: { reapHistory: project(records), turns: new Map([['answer', { thread: 7 }], ['other', { thread: 8 }]]), order: [] } };
  expect(invoke('answer', journal, reapNotices, [])).toHaveLength(1);
  expect(invoke('other', journal, reapNotices, [])).toEqual([]);
  expect(invoke(undefined, journal, reapNotices, [])).toEqual([]);
});
