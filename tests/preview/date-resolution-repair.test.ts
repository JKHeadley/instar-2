import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests } from './journal-test-worker.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/date-resolve-1016.json', import.meta.url), 'utf8')) as {
  cases: { update: number; intake: { id: string; raw: string; at: number }; clock: { at: number; zone: string };
    now: number; output: string; delivered: string }[];
};
const broken = fixture.cases[1]!;
const key = new Uint8Array(32).fill(61);
const make = (record = broken, maxCalls = 10) => {
  const root = mkdtempSync(join(tmpdir(), 'date-resolution-repair-')), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8994258214', chat: '-1004367556355',
    operator: '7812716706', forum: true, grant: 'grant:date-resolution-replay', configurationDigest: 'sha256:date-resolution-replay',
    expires: record.now + 86400_000, maxCalls, maxReplies: 10, maxTurns: 10, maxBytes: 409600, cursor: 0 });
  const state = { now: record.intake.at, stopped: false, calls: [] as { context: string }[], sent: [] as string[] };
  const start = (answer: (packet: Record<string, unknown>, call: number) => string | { state: 'uncertain' }) => {
    const ports = { now: () => state.now, stopped: () => state.stopped, timeZone: record.clock.zone,
      model: async (input: { context: string }) => {
        state.calls.push(input);
        return answer(JSON.parse(input.context), state.calls.length);
      }, send: async (input: { text: string }) => { state.sent.push(input.text); return state.sent.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([JSON.parse(record.intake.raw)]); state.now = record.now;
    return { get worker() { return worker; },
      reopen() { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); } };
  };
  return { state, start, get journal() { return journal; },
    close() { journal.close(); rmSync(root, { recursive: true, force: true }); } };
};

it('replays S update 715676632 and repairs the packet-now mismatch using the original message clock', async () => {
  const original = JSON.parse(broken.output);
  expect(original.dated[0].resolution.at).toBe(broken.now);
  expect(broken.now).not.toBe(broken.clock.at);
  expect(broken.delivered).toContain('date resolution needs the original clock');
  const h = make();
  try {
    const run = h.start((packet, call) => {
      expect(packet.datedClock).toEqual(broken.clock);
      if (call === 1) return broken.output; // exact native-session Write bytes
      expect(packet.formatReminder).toContain(`at:${broken.clock.at},zone:"${broken.clock.zone}"`);
      // Counterfactual repair: only copy the original clock explicitly supplied by the re-ask.
      return JSON.stringify({ ...original, dated: [{ ...original.dated[0],
        resolution: { ...original.dated[0].resolution, at: broken.clock.at } }] });
    });
    await run.worker.drain();
    expect(h.state.calls).toHaveLength(2);
    expect(h.journal.view.dated).toMatchObject([{ day: '2026-10-16', time: '17:00', zone: broken.clock.zone,
      resolution: { at: broken.clock.at, instant: '2026-10-17T00:00:00.000Z' } }]);
    expect(h.journal.view.dated[0]!.ambiguity).toBeUndefined();
    expect(h.state.sent).toHaveLength(1);
    expect(h.state.sent[0]).not.toContain('unresolved');
    expect(h.state.sent[0]).toContain('until you explicitly approve it');
    expect(openRequests(h.journal.view)).toEqual([]); // recording a date grants no restart or reminder
    run.reopen(); await run.worker.drain();
    expect(h.state.sent).toHaveLength(1); expect(h.state.calls).toHaveLength(2);
  } finally { h.close(); }
});

it('replays the correctly bound S update 715676630 without a repair', async () => {
  const record = fixture.cases[0]!, h = make(record);
  try {
    const run = h.start(() => record.output); await run.worker.drain();
    expect(h.state.calls).toHaveLength(1);
    expect(h.journal.view.dated).toMatchObject([{ day: '2026-10-16', time: '17:00' }]);
    expect(h.state.sent[0]).not.toContain('unresolved');
    expect(openRequests(h.journal.view)).toEqual([]);
  } finally { h.close(); }
});

it.each(['clock', 'missing-clock', 'zone', 'missing-zone', 'instant', 'missing-instant'])('re-asks once for %s and preserves a repeated invalid resolution', async field => {
  const proposed = JSON.parse(broken.output), resolution = proposed.dated[0].resolution;
  resolution.at = broken.clock.at;
  if (field === 'clock') resolution.at = broken.now;
  if (field === 'missing-clock') delete resolution.at;
  if (field === 'zone') resolution.zone = 'UTC';
  if (field === 'missing-zone') delete resolution.zone;
  if (field === 'instant') resolution.instant = 'not an instant';
  if (field === 'missing-instant') delete resolution.instant;
  const h = make();
  try {
    const run = h.start(() => JSON.stringify(proposed)); await run.worker.drain();
    expect(h.state.calls).toHaveLength(2);
    expect(h.journal.view.dated[0]!.day).toBeUndefined();
    expect(h.state.sent).toHaveLength(1); expect(h.state.sent[0]).toContain('unresolved');
    expect(openRequests(h.journal.view)).toEqual([]);
  } finally { h.close(); }
});

it('keeps genuine model ambiguity without spending a repair call', async () => {
  const proposed = JSON.parse(broken.output);
  proposed.dated[0].resolution = { ambiguity: 'Which day and time do you mean?' };
  const h = make();
  try {
    const run = h.start(() => JSON.stringify(proposed)); await run.worker.drain();
    expect(h.state.calls).toHaveLength(1);
    expect(h.journal.view.dated[0]!.ambiguity).toBe('Which day and time do you mean?');
    expect(h.state.sent[0]).toContain('unresolved');
  } finally { h.close(); }
});

it('keeps the call cap when the recorded mismatch cannot be repaired', async () => {
  const h = make(broken, 1);
  try {
    const run = h.start(() => broken.output); await run.worker.drain();
    expect(h.state.calls).toHaveLength(1);
    expect(h.journal.view.dated[0]!.ambiguity).toBeDefined();
    expect(openRequests(h.journal.view)).toEqual([]);
  } finally { h.close(); }
});

it('keeps stop ahead of the repair and send', async () => {
  const h = make();
  try {
    const run = h.start(() => { h.state.stopped = true; return broken.output; });
    await expect(run.worker.drain()).rejects.toThrow('preview stopped');
    expect(h.state.calls).toHaveLength(1); expect(h.state.sent).toEqual([]);
  } finally { h.close(); }
});

const capturedShapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
  import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
it.each(capturedShapes.otherShapes)('replays the date repair followed by recorded $kind ($id) without inventing a date', async shape => {
  const h = make();
  try {
    const run = h.start((_packet, call) => call === 1 ? broken.output
      : shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) as { state: 'uncertain' } : shape.raw);
    await run.worker.drain();
    expect(h.state.calls).toHaveLength(2);
    expect(h.journal.view.order[0]!.accepted).toBe(true);
    expect(h.journal.view.dated).toEqual([]);
    expect(openRequests(h.journal.view)).toEqual([]);
    expect(h.state.sent.every(text => text.trim().length > 0)).toBe(true);
    const sent = [...h.state.sent];
    run.reopen(); await run.worker.drain();
    expect(h.state.calls).toHaveLength(2); expect(h.state.sent).toEqual(sent);
  } finally { h.close(); }
});
