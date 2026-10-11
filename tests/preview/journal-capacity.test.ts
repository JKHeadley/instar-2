import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { classifyProviderFailure } from '../../src/assembly/provider-failure.js';
import { createJournalWorker, openPreviewJournal, MODEL_CAPACITY_HOLD, modelCapacityReply, pendingUnknownCalls,
  capacityAlerts, ModelNotStarted, MODEL_NOT_STARTED_HOLD, MODEL_NOT_STARTED_REPLY, type CallOutcome, type JournalRecord, type PreviewPorts } from './journal-test-worker.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const key = new Uint8Array(32).fill(72);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-1001234', operator: '7654321', forum: true as const,
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 30, maxTurns: 30, maxBytes: 32768, cursor: 0 };
const message = (id: number, thread = 3) => ({ update_id: id, message: { message_id: id,
  chat: { id: -1001234, type: 'supergroup', is_forum: true }, from: { id: 7654321 },
  message_thread_id: thread, text: 'Please answer my question.' } });
const captured = readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8');
// The session wording is the operator's recorded 2026-10-10 incident; its envelope is the captured weekly result.
const session = JSON.stringify({ ...JSON.parse(captured), result: "You've hit your session limit · resets 6pm (America/Los_Angeles)" });
const usage = { inputTokens: 0, inputComplete: true as const, outputTokens: 0, charge: null };

// Execute the shipped launcher conversion, not a hand-written substitute for its rejected-result branch.
const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const conversion = host.split('      if (result.state === \'uncertain\') return')[1]!.split("      if (result.state !== 'complete')")[0]!;
const convert = Function('result', `if (result.state === 'uncertain') return${conversion}`);
function limit(stdout = session, overrides: object = {}) {
  return convert({ state: 'rejected', bytes: null, usage,
    failure: classifyProviderFailure({ code: 1, limited: false, stdout, now: 1000 }), ...overrides }) as Awaited<ReturnType<PreviewPorts['model']>>;
}
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'capacity-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  return { path, journal: openPreviewJournal(path, key, genesis) };
}
const alerts = (journal: ReturnType<typeof openPreviewJournal>) => journal.view.operatorEvents.filter(e => e.detail.startsWith('provider usage limit;'));

it('renders a provider calendar or relative reset from the bounded timestamp, without provider prose', () => {
  expect(modelCapacityReply({ resetHint: null, resetAt: Date.parse('2026-10-11T01:00:00Z') }, 'America/Los_Angeles'))
    .toContain('after 2026-10-10 18:00 (America/Los_Angeles)');
  expect(modelCapacityReply({ resetHint: null, resetAt: null })).toContain('when capacity returns');
});

it('preserves the spend cap: a launched capacity refusal still consumes the last allowed call', async () => {
  const { journal } = setup(); journal.view.limits.maxCalls = 1;
  let calls = 0;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => { calls++; return limit(); }, send: async () => 1 });
  worker.intake([message(1), message(2)]); await worker.drain();
  expect(calls).toBe(1); expect(journal.view.calls).toBe(1);
  expect(journal.view.order[1]?.held).toBe('call cap'); journal.close();
});

it('replays the recorded limit through the shipped conversion: one topic notice, one alert, restart/compaction dedupe and an answered resend', async () => {
  const opened = setup(); let journal = opened.journal, available = false, attempts = 0;
  const sent: { text: string; thread?: number }[] = [];
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => { attempts++; return available ? 'Capacity returned; here is the answer.' : limit(); },
    send: async (input: { text: string; thread?: number }) => { sent.push(input); return sent.length; } };
  let worker = createJournalWorker(journal, ports);
  worker.intake([message(1)]); await worker.drain();
  expect(sent).toEqual([expect.objectContaining({ thread: 3,
    text: "I've hit my usage limit; I can answer again after 6pm. Your messages are saved; please resend them then to get an answer." })]);
  expect(journal.view.order[0]).toMatchObject({ held: MODEL_CAPACITY_HOLD, reserved: true, failureClass: 'capacity' });
  expect(journal.view.calls).toBe(1); expect(pendingUnknownCalls(journal.view)).toEqual([]);
  expect(journal.view.tokenTotals.answer).toMatchObject({ inputTokens: 0, outputTokens: 0, unknownCalls: 0 });
  expect(alerts(journal)).toHaveLength(1);
  journal.compact(); journal.close(); journal = openPreviewJournal(opened.path, key);
  const status = JSON.parse(execFileSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', dirname(realpathSync(opened.path))], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } }));
  expect(status.capacityAlerts).toEqual(alerts(journal));
  expect(status.modelFailureClasses.capacity).toBe(1);
  expect(status.unknownCalls).toBe(0);
  worker = createJournalWorker(journal, ports);
  worker.intake([message(2)]); await worker.drain();
  expect(sent).toHaveLength(1); expect(alerts(journal)).toHaveLength(1); expect(attempts).toBe(2);
  expect(journal.view.calls).toBe(2); // Launched attempts are never refunded as not-run.
  available = true; worker.intake([message(3)]); await worker.drain();
  expect(sent.at(-1)?.text).toContain('Capacity returned; here is the answer.');
  expect(journal.view.order[2]?.sent).toBeDefined();
  available = false; worker.intake([message(4)]); await worker.drain();
  expect(sent.filter(s => s.text.includes("I've hit my usage limit"))).toHaveLength(2);
  expect(alerts(journal)).toHaveLength(2); journal.close();
});

it('one notice per topic and one desk alert per episode; a lost receipt stays non-repeatable', async () => {
  const { journal, path } = setup(); let sends = 0;
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {}, model: async () => limit(captured),
    send: async () => { sends++; throw Error('receipt lost'); } };
  const worker = createJournalWorker(journal, ports);
  worker.intake([message(1), message(2), message(3, 4)]); await worker.drain();
  expect(sends).toBe(2); expect(alerts(journal)).toHaveLength(1);
  expect(journal.view.order[0]?.limited?.text).toContain('when capacity returns');
  journal.close(); const reopened = openPreviewJournal(path, key);
  const next = createJournalWorker(reopened, ports); next.intake([message(4)]); await next.drain();
  expect(sends).toBe(2); expect(alerts(reopened)).toHaveLength(1); reopened.close();
});

it.each([
  { state: 'uncertain' }, { failure: { failureClass: 'policy', resetHint: null, resetAt: null } },
  { usage: { ...usage, outputTokens: 1 } }, { usage: { ...usage, inputTokens: null } },
  { usage: { ...usage, inputComplete: false } }, { usage: { ...usage, charge: 1 } },
])('never declares capacity from unknown, policy, partial, unmetered or charged work: %j', overrides => {
  expect(limit(session, overrides)).not.toHaveProperty('capacity');
});

it('stop and outbound refusal prevent capacity delivery', async () => {
  for (const floor of ['stop', 'secret']) {
    const { journal } = setup(); let stopped = false, sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
      model: async () => { stopped = floor === 'stop'; return limit(); },
      checkOutbound: () => { if (floor === 'secret') throw Error('outbound secret refused'); }, send: async () => ++sends });
    worker.intake([message(1)]); await worker.drain().catch(() => {});
    expect(sends).toBe(0); expect(journal.view.order).toHaveLength(1); journal.close();
  }
});

it('retains recorded uncertain summaries, Jev/reply reviews and deliveries while the capacity path fires', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as {
    genesis: typeof genesis; rows: JournalRecord[] };
  const root = mkdtempSync(join(tmpdir(), 'capacity-recorded-')); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
    { ...capture.genesis, kind: 'genesis', expires: genesis.expires, cursor: 0 });
  for (const row of capture.rows) journal.append(row);
  const unknown = pendingUnknownCalls(journal.view).length, last = journal.view.order.at(-1)!;
  const id = `telegram:${journal.view.genesis.bot}:update:${last.update + 1}`;
  journal.append({ kind: 'intake', id, update: last.update + 1, text: 'Please answer.', raw: '{}', accepted: true, cursor: last.update + 2, at: last.at + 1 });
  journal.append({ kind: 'reserve', id, at: last.at + 2 });
  const answer = limit(); if (typeof answer === 'string' || !('capacity' in answer) || !answer.capacity) throw Error('capacity branch did not fire');
  journal.append({ kind: 'hold', id, reason: MODEL_CAPACITY_HOLD, capacity: { ...answer.capacity, usage }, at: last.at + 3 });
  const sent: string[] = [];
  await createJournalWorker(journal, { now: () => last.at + 4, stopped: () => false, checkOutbound: () => {},
    model: async () => { throw Error('minimal path must not call model'); }, send: async input => { sent.push(input.text); return 21; } }).minimal();
  expect(sent.some(text => text.includes('after 6pm'))).toBe(true);
  expect(pendingUnknownCalls(journal.view)).toHaveLength(unknown); expect(alerts(journal)).toHaveLength(1);
  journal.close();
});

// The recorded local timeout for live update 6230665 exercises replacement without real load.
const timeoutCapture = JSON.parse(readFileSync(new URL('./fixtures/lostanswer-live-2026-10-02.json', import.meta.url), 'utf8'));
const { id: _id, role: _role, at: _at, ...timeoutOutcome } = timeoutCapture.lostFirstCall.callOutcomes[0];

it.each(['capacity', 'not-started', 'unknown', 'success'] as const)(
  'handles a format retry ending in %s without refunding the first call', async outcome => {
    const { journal, path } = setup(); let calls = 0; const sent: string[] = [];
    const ports: PreviewPorts = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
      model: async ({ id }) => {
        calls++;
        // Each invocation may reserve tool liability. Only the unlaunched invocation's share is released.
        journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: calls - 1, calls: 3, at: 1000 });
        journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: calls - 1, calls: [], consistent: true, workspaceBytes: null, at: 1000 });
        if (calls === 1) return { state: 'complete', failureClass: 'malformed', usage: { ...usage, inputTokens: 20, outputTokens: 10 } };
        if (outcome === 'not-started') throw new ModelNotStarted();
        if (outcome === 'unknown') throw Error('receipt lost after launch');
        return outcome === 'capacity' ? limit() : { state: 'complete', text: 'Recovered answer', usage: { ...usage, inputTokens: 5, outputTokens: 2 } };
      }, send: async input => { sent.push(input.text); return sent.length; } };
    const worker = createJournalWorker(journal, ports);
    worker.intake([message(1)]); await worker.drain();
    expect(calls).toBe(2);
    expect(journal.view.calls).toBe(outcome === 'not-started' ? 4 : 8);
    expect(journal.view.toolTurns?.reservedCalls).toBe(outcome === 'not-started' ? 3 : 6);
    expect(journal.view.tokenCalls[0]).toMatchObject({ input: 20, output: 10, observedInput: true, observedOutput: true });
    if (outcome === 'capacity') {
      expect(sent).toHaveLength(1); expect(sent[0]).toContain('after 6pm');
      expect(journal.view.order[0]?.held).toBe(MODEL_CAPACITY_HOLD); expect(capacityAlerts(journal.view)).toHaveLength(1);
    } else if (outcome === 'not-started') {
      expect(sent).toEqual([MODEL_NOT_STARTED_REPLY]); expect(journal.view.order[0]?.held).toBe(MODEL_NOT_STARTED_HOLD);
      expect(journal.view.tokenTotals.answer).toMatchObject({ inputTokens: 20, outputTokens: 10, unknownCalls: 0 });
    } else if (outcome === 'success') expect(sent[0]).toContain('Recovered answer');
    else expect(sent).toEqual([]);
    expect(pendingUnknownCalls(journal.view)).toHaveLength(outcome === 'unknown' ? 1 : 0);
    journal.compact(); journal.close(); const reopened = openPreviewJournal(path, key);
    await createJournalWorker(reopened, ports).drain(); expect(calls).toBe(2);
    expect(reopened.view.calls).toBe(outcome === 'not-started' ? 4 : 8); reopened.close();
  });

it.each(['capacity', 'not-started'] as const)('handles %s on the replacement of the recorded timeout while retaining UNKNOWN', async outcome => {
  const { journal } = setup(); let calls = 0; const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async ({ id }) => {
      if (++calls === 1) {
        journal.append({ kind: 'call-outcome', id, role: 'model', outcome: timeoutOutcome as CallOutcome, at: 1000 });
        return { state: 'uncertain' };
      }
      if (outcome === 'not-started') throw new ModelNotStarted();
      return limit(captured);
    }, send: async input => { sent.push(input.text); return sent.length; } });
  worker.intake([message(1)]); await worker.drain();
  expect(calls).toBe(2); expect(journal.view.calls).toBe(outcome === 'capacity' ? 2 : 1);
  expect(journal.view.order[0]?.answerReplaced).toBe(true);
  expect(pendingUnknownCalls(journal.view)).toEqual([`answer-replaced:${journal.view.order[0]!.id}`]);
  expect(journal.view.tokenTotals.answer.unknownCalls).toBe(1);
  expect(sent).toHaveLength(1); expect(sent[0]).toContain(outcome === 'capacity' ? 'usage limit' : "couldn't start my model");
  journal.close();
});

it('keeps the active desk alert after eight other events, compaction and restart, until a successful answer', async () => {
  const opened = setup(); let journal = opened.journal;
  let outcome: 'capacity' | 'not-started' | 'success' = 'capacity';
  const ports: PreviewPorts = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => { if (outcome === 'not-started') throw new ModelNotStarted(); return outcome === 'capacity' ? limit() : 'Recovered'; },
    send: async () => 1 };
  let worker = createJournalWorker(journal, ports);
  worker.intake([message(1)]); await worker.drain(); const active = capacityAlerts(journal.view);
  outcome = 'not-started';
  for (let id = 2; id <= 9; id++) { worker.intake([message(id)]); await worker.drain(); }
  expect(alerts(journal)).toEqual([]); expect(capacityAlerts(journal.view)).toEqual(active);
  outcome = 'capacity'; worker.intake([message(10)]); await worker.drain();
  expect(alerts(journal)).toEqual([]); expect(capacityAlerts(journal.view)).toEqual(active);
  journal.compact(); journal.close(); journal = openPreviewJournal(opened.path, key);
  const status = JSON.parse(execFileSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', dirname(realpathSync(opened.path))], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } }));
  expect(status.capacityAlerts).toEqual(active);
  worker = createJournalWorker(journal, ports); outcome = 'success'; worker.intake([message(11)]); await worker.drain();
  expect(capacityAlerts(journal.view)).toEqual([]);
  outcome = 'capacity'; worker.intake([message(12)]); await worker.drain();
  expect(capacityAlerts(journal.view)).toEqual([expect.objectContaining({ update: 12 })]); journal.close();
});
