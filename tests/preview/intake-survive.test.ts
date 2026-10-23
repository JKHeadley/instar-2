import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { GROUP_DISCLOSURE_HOLD, ModelPending, type PreviewPorts } from './journal.js';
import { projectionSections } from './proofs.js';
import { loopHealth } from './obligations.js';

// Exact test-origin ingress from the real socket-loss proof, not Justin's journal.
const recorded = JSON.parse(readFileSync(new URL('./fixtures/socket-drop-worker-1016101-2026-10-16.json', import.meta.url), 'utf8'));
const inputs: { raw: string; text: string; update: number }[] = recorded.runs.map((run: { journal: { kind: string }[] }) =>
  run.journal.find(row => row.kind === 'intake'));
const answer = JSON.parse(readFileSync(new URL('./fixtures/context-recovery-answer-1016104-2026-10-16.json', import.meta.url), 'utf8')).output as string;
const observation = JSON.parse(readFileSync(new URL('./fixtures/intake-survive-2026-10-22.json', import.meta.url), 'utf8'));
const key = new Uint8Array(32).fill(53), roots: string[] = [];
const start = 1792168532728;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7812716706', operator: '7812716706', grant: 'grant:fixture',
  configurationDigest: 'sha256:fixture', expires: 9999999999999, maxCalls: 50, maxReplies: 50, maxTurns: 50, maxBytes: 32768, cursor: 0 };
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

function world(extra: Partial<PreviewPorts> = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'intake-survive-'))); roots.push(root);
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), now = start;
  const sent: string[] = [], calls: string[] = [];
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    prepareModel: input => input.context,
    model: async input => { if (input.id.startsWith('summary:')) return { state: 'uncertain' as const };
      calls.push(input.id); return answer; },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {}, ...extra });
  const replay = () => { const copy = openPreviewJournal(path, key, undefined, undefined, true);
    try { return projectionSections(copy.view); } finally { copy.close(); } };
  return { get journal() { return journal; }, worker, sent, calls, replay,
    intake: () => worker().intake(inputs.map(input => JSON.parse(input.raw))),
    restart: () => { journal.close(); journal = openPreviewJournal(path, key); },
    age: () => { now += observation.drain.observed.oldestUnfinishedAgeMs; }, health: () => loopHealth(journal.view, now), close: () => journal.close() };
}

it.each([GROUP_DISCLOSURE_HOLD, 'earlier turn pending', 'prompt overflow', 'context overflow', 'summary unavailable: prompt overflow'])(
  'keeps the durable %s projection identical while preparing a recovered input', async reason => {
  const observations: boolean[] = [];
  const w = world({ prepareModel: input => {
    observations.push(JSON.stringify(projectionSections(w.journal.view)) === JSON.stringify(w.replay()));
    return input.context;
  } });
  try {
    w.intake();
    w.journal.append({ kind: 'hold', id: w.journal.view.order[0]!.id, reason, at: start });
    w.restart();
    await w.worker().drain();
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.every(Boolean)).toBe(true);
    expect(projectionSections(w.journal.view)).toEqual(w.replay());
  } finally { w.close(); }
});

it.each([false, true])('retains two exact accepted inputs through loss and finishes each once (snapshot=%s)', async compact => {
  const w = world();
  try {
    w.intake(); w.age();
    expect(w.health()).toMatchObject(observation.drain.observed);
    const accepted = w.journal.view.order.map(turn => ({ raw: turn.raw, text: turn.text, writer: turn.writer, id: turn.id }));
    expect(accepted.map(turn => turn.raw)).toEqual(inputs.map(input => input.raw));
    if (compact) w.journal.compact();
    w.restart(); w.intake();
    expect(w.journal.view.order.map(turn => ({ raw: turn.raw, text: turn.text, writer: turn.writer, id: turn.id }))).toEqual(accepted);
    await w.worker().drain();
    expect(w.sent).toHaveLength(2);
    expect(w.sent.every(text => text.includes('You prefer tea to coffee.'))).toBe(true);
    expect(w.journal.view.order.every(turn => turn.sent !== undefined)).toBe(true);
    expect(w.health()).toMatchObject({ unfinished: 0, backlogOverdue: false });
    w.restart(); w.intake(); await w.worker().drain();
    expect(w.sent).toHaveLength(2);
    expect(w.calls).toHaveLength(2);
    expect(projectionSections(w.journal.view)).toEqual(w.replay());
  } finally { w.close(); }
});

it('collects an interrupted harness result under its original reservation without launching again', async () => {
  const pending = new Map<string, { context: string; prepared: string; answer: string }>();
  let ready = false, launches = 0;
  const w = world({ model: async input => {
    if (input.id.startsWith('summary:')) return { state: 'uncertain' as const };
    launches++;
    pending.set(input.id, { context: input.context, prepared: input.prepared!, answer });
    throw new ModelPending();
  }, collectModel: async id => {
    if (!ready) throw new ModelPending();
    return pending.get(id) ?? null;
  } });
  try {
    w.intake(); await w.worker().drain();
    expect(launches).toBe(1);
    const reserved = w.journal.view.order[0]!.prompt;
    w.journal.append({ kind: 'hold', id: w.journal.view.order[0]!.id, reason: GROUP_DISCLOSURE_HOLD, at: start });
    w.restart(); await w.worker().drain();
    expect(launches).toBe(1); expect(w.sent).toEqual([]);
    expect(projectionSections(w.journal.view)).toEqual(w.replay());
    ready = true;
    await w.worker().drain(); await w.worker().drain();
    expect(launches).toBe(2);
    expect(w.sent).toHaveLength(2);
    expect(w.journal.view.order[0]!.prompt).toBe(reserved);
    w.restart(); w.intake(); await w.worker().drain();
    expect(launches).toBe(2); expect(w.sent).toHaveLength(2);
  } finally { w.close(); }
});

it('keeps an unknown send fenced after restart instead of repeating the answer', async () => {
  const attempted: string[] = [];
  const w = world({ send: async input => { attempted.push(input.target!); return null; } });
  try {
    w.intake(); await w.worker().drain();
    const replies = () => attempted.filter(target => target.startsWith('reply:'));
    expect(replies()).toHaveLength(2);
    w.restart(); w.intake(); await w.worker().drain();
    expect(replies()).toHaveLength(2);
    expect(w.journal.view.order.every(turn => turn.sent === undefined)).toBe(true);
    expect(w.calls).toHaveLength(2);
  } finally { w.close(); }
});

it.each(['call cap', 'reply cap'] as const)('a persisted %s keeps both accepted inputs and sends only one bounded notice', async floor => {
  const w = world();
  try {
    w.intake();
    for (const turn of w.journal.view.order)
      w.journal.append({ kind: 'hold', id: turn.id, reason: floor, at: start });
    w.restart(); await w.worker().drain();
    expect(w.journal.view.order.map(turn => turn.raw)).toEqual(inputs.map(input => input.raw));
    expect(w.calls).toEqual([]); expect(w.sent).toHaveLength(1);
    expect(w.sent[0]).toContain('I got your 2 messages and saved them');
    w.restart(); await w.worker().drain();
    expect(w.calls).toEqual([]); expect(w.sent).toHaveLength(1);
    expect(projectionSections(w.journal.view)).toEqual(w.replay());
  } finally { w.close(); }
});

it('stop preserves accepted inputs and prevents recovery dispatch', async () => {
  let stopped = false;
  const w = world({ stopped: () => stopped });
  try {
    w.intake(); stopped = true; w.restart();
    await expect(w.worker().drain()).rejects.toThrow('preview stopped');
    expect(w.journal.view.order.map(turn => turn.raw)).toEqual(inputs.map(input => input.raw));
    expect(w.calls).toEqual([]); expect(w.sent).toEqual([]);
    expect(projectionSections(w.journal.view)).toEqual(w.replay());
  } finally { w.close(); }
});
