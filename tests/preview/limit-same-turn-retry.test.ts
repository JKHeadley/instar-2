// @ts-nocheck -- exercise the physical login pool and the shipped launcher conversion.
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, pendingUnknownCalls } from './journal-test-worker.js';
import { createHarnessLoginPool, loadHarnessLogins } from './harness-login-pool.mjs';
import { classifyProviderFailure } from '../../src/assembly/provider-failure.js';
import { readAnswer } from './answer-reading.js';
const capture = JSON.parse(readFileSync(new URL('./fixtures/login-swap-1112.json', import.meta.url), 'utf8'));
const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const conversion = host.split('      const providerFailure = result.failure ?')[1].split("      if (result.state !== 'complete')")[0];
const convert = Function('result', `const providerFailure = result.failure ?${conversion}`);
const roots = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const now = 1794483526193, reset = 1794517200000;
const usage = { inputTokens: 0, inputComplete: true, outputTokens: 0, charge: null };
const key = new Uint8Array(32).fill(72);
function setup(count = 2, maxCalls = 100) {
  const root = mkdtempSync(join(tmpdir(), 'same-turn-limit-')); roots.push(root);
  const logins = Array.from({ length: count }, (_, i) => {
    const profile = join(root, `login-${i}.json`);
    writeFileSync(profile, JSON.stringify({ reference: `login-${i}`, expectedAccount: `${i}@example.invalid`, organization: 'org', plan: 'max',
      home: `/profile/${i}/home`, configDirectory: `/profile/${i}/config`, workingDirectory: `/profile/${i}/work` }));
    return { profile, activation: join(root, `${i}-activation`), authority: join(root, `${i}-authority`) };
  });
  const path = join(root, 'pool.json'); writeFileSync(path, JSON.stringify({ version: 1, thresholdPercent: 95, logins }));
  const configuration = loadHarnessLogins({ 'login-pool': path, 'harness-user': '_instarharness', 'login-profile': logins[0].profile, 'activation-record': logins[0].activation });
  const settings = { configuration, statePath: join(root, 'selection.json'), now: () => now, validate: entry => { if (control.refuseB && entry.index > 0) throw Error('admission refused'); },
    usage: () => ({ version: 1, accounts: configuration.entries.map(({ profile }) => ({ email: profile.expectedAccount, configHome: profile.configDirectory,
      lastQuota: { measuredAt: new Date(now).toISOString(), fiveHour: { utilizationPct: 0, resetsAt: new Date(reset).toISOString() },
        sevenDay: { utilizationPct: 0, resetsAt: new Date(reset).toISOString() } } })) }) };
  let pool = createHarnessLoginPool(settings);
  const journalPath = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(journalPath, key, { kind: 'genesis', bot: '12345678', chat: '-1001234', operator: '7654321', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 86400000, maxCalls, maxReplies: 30, maxTurns: 30, maxBytes: 32768, cursor: 0 });
  const calls = [], sent = [], control = { stopped: false, failB: false, crash: false, stopB: false, uncertain: false, override: {}, noEffects: true };
  const ports = { now: () => control.at ?? now, stopped: () => control.stopped, checkOutbound: () => {},
    retryCapacity: (id, from, excluded) => { if (control.crash) throw Error('restart boundary'); return pool.retry(id, from, excluded); },
    model: async ({ id }) => {
      const target = journal.view.turns.get(id)?.capacityNextLogin;
      const selected = target ? pool.selected(target, false) : pool.select();
      calls.push(selected.profile.reference);
      if (control.ack && calls.length === 1) {
        control.at = now + 8000;
        journal.append({ kind: 'held-notice-intent', id, text: 'Checking that now.', chat: '-1001234', thread: 3, update: 1,
          grant: 'grant:preview', acknowledgement: true, acknowledgementMode: 'reaction-or-text', at: control.at });
        journal.append({ kind: 'held-notice-sent', id, message: 101, acknowledgementPath: 'reaction', at: control.at });
      }
      if (selected.index > 0 && !control.failB) {
        if (control.stopB) control.stopped = true;
        const reading = readAnswer(capture.answer, { wrapped: 'allow', evidence: [id] });
        expect(reading.ok).toBe(true);
        return { state: 'complete', text: reading.value, usage: { ...usage, inputTokens: 28993, outputTokens: 543 } };
      }
      // Provider prose and 429 are copied from the measured record; envelope is reconstructed explicitly.
      const failure = classifyProviderFailure({ code: 1, limited: false, now, localClockResetAt: () => selected.index ? reset - 3600000 : reset,
        stdout: JSON.stringify({ type: 'result', is_error: true, api_error_status: capture.limited.apiErrorStatus, result: capture.limited.result }) });
      const result = { state: control.uncertain ? 'uncertain' : 'rejected', bytes: null, usage, failure, limitedLogin: selected.profile.reference,
        noToolEffects: control.noEffects, ...control.override };
      pool.observe(selected, result);
      const outage = pool.outage();
      if (outage?.resetAt) result.failure = { ...failure, resetHint: null, resetAt: outage.resetAt };
      return convert(result);
    },
    send: async input => { sent.push(input.text); return sent.length; } };
  let worker = createJournalWorker(journal, ports);
  worker.intake([{ update_id: 1, message: { message_id: 1, chat: { id: -1001234, type: 'supergroup', is_forum: true }, from: { id: 7654321 },
    message_thread_id: 3, text: 'What is 17 times 23, and how did you work it out?' } }]);
  return { control, calls, sent, get pool() { return pool; }, get journal() { return journal; }, get worker() { return worker; },
    reopen() { journal.compact(); journal.close(); journal = openPreviewJournal(journalPath, key); pool = createHarnessLoginPool(settings); worker = createJournalWorker(journal, ports); } };
}
it('answers the recorded limited turn on B once without a limit notice or a resend', async () => {
  const f = setup(); await f.worker.drain();
  expect(f.calls).toEqual(['login-0', 'login-1']); expect(f.sent).toHaveLength(1);
  expect(f.sent[0]).toContain('391'); expect(f.sent[0]).not.toContain('usage limit');
  expect(f.journal.view.calls).toBe(2); expect(pendingUnknownCalls(f.journal.view)).toEqual([]);
  expect(f.pool.state.holds[0].reason).toBe('provider-limit');
  f.reopen(); await f.worker.drain(); expect(f.sent).toHaveLength(1); expect(f.calls).toHaveLength(2); f.journal.close();
});
it('all limited: one notice names the earliest reset, each remaining login tried once', async () => {
  const f = setup(); f.control.failB = true; await f.worker.drain();
  expect(f.calls).toEqual(['login-0', 'login-1']); expect(f.sent).toHaveLength(1);
  expect(f.journal.view.order[0].capacity.resetAt).toBe(reset - 3600000);
  expect(f.sent[0]).toContain('usage limit'); f.reopen(); await f.worker.drain(); expect(f.sent).toHaveLength(1); f.journal.close();
});
it('restart after the durable limit, before selection, resumes the same turn exactly once', async () => {
  const f = setup(); f.control.crash = true; await expect(f.worker.drain()).rejects.toThrow('restart boundary');
  expect(f.sent).toEqual([]); expect(f.journal.view.order[0].capacity.retryLogin).toBe('login-0');
  f.reopen(); f.control.crash = false; await f.worker.minimal(); expect(f.sent).toEqual([]); await f.worker.drain();
  expect(f.calls).toEqual(['login-0', 'login-1']); expect(f.sent).toHaveLength(1); f.journal.close();
});
it.each([{ uncertain: true }, { noEffects: false }, { override: { bytes: 'partial output' } }, { override: { failure: undefined } },
  { override: { usage: { ...usage, outputTokens: 1 } } }, { override: { usage: { ...usage, inputComplete: false } } }])('never replays without exact effect-free proof: %j', async control => {
  const f = setup(); Object.assign(f.control, control); await f.worker.drain(); expect(f.calls).toEqual(['login-0']); f.journal.close();
});
it('honors stop during the replacement and never sends it', async () => {
  const f = setup(); f.control.stopB = true; await f.worker.drain().catch(() => {});
  expect(f.calls).toEqual(['login-0', 'login-1']); expect(f.sent).toEqual([]); f.journal.close();
});
it('spend cap prevents the replacement without refunding the rejected call', async () => {
  const f = setup(2, 1); await f.worker.drain(); expect(f.calls).toEqual(['login-0']); expect(f.journal.view.calls).toBe(1); f.journal.close();
});
it('the durable five-attempt brake bounds an eight-login pool across restart', async () => {
  const f = setup(8); f.control.failB = true; await f.worker.drain();
  expect(f.calls).toHaveLength(6); expect(new Set(f.calls).size).toBe(6); expect(f.pool.state.handoffAttempts).toHaveLength(5);
  f.reopen(); await f.worker.drain(); expect(f.calls).toHaveLength(6); f.journal.close();
});
it('replays the recorded empty tool trace through the shipped proof gate and refuses effects or earlier model output', () => {
  // Use the exact host block including its destructuring, with the enclosing function terminator removed.
  const prove = Function('completed', 'const { result, trace } = completed;' + host.split('      const { result, trace } = completed;')[1].split('      return result;')[0] + 'return result;');
  const trace = { consistent: capture.trace.consistent, calls: capture.trace.calls, children: capture.trace.edges };
  for (const variation of [{}, { trace: { ...trace, consistent: false } }, { trace: { ...trace, calls: [{}] } },
    { trace: { ...trace, children: [{}] } }, { native: { models: 2 } }]) {
    const result = { capacity: { resetHint: null, resetAt: reset }, limitedLogin: 'login-0', ...(variation.native ? { native: variation.native } : {}) };
    const actual = prove({ result, trace: variation.trace ?? trace });
    expect(actual.capacity.retryLogin).toBe(Object.keys(variation).length === 0 ? 'login-0' : undefined);
  }
});
it('replays recorded summary, uncertain/undecided Jev, review and delivered/empty shapes without turning them into retry evidence', async () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  for (const row of corpus.otherShapes) {
    const f = setup(); await f.worker.drain();
    expect(f.calls, row.id).toEqual(['login-0', 'login-1']);
    const returned = { state: row.kind === 'summary-uncertain' ? 'uncertain' : 'complete', bytes: row.raw };
    const before = JSON.stringify(returned), holds = JSON.stringify(f.pool.state.holds);
    f.pool.observe(f.pool.select(), returned);
    expect(JSON.stringify(returned), row.id).toBe(before); expect(JSON.stringify(f.pool.state.holds), row.id).toBe(holds);
    expect(convert(returned)?.capacity, row.id).toBeUndefined(); f.journal.close();
  }
});
it('restart after successor selection but before its reservation never repeats A or the send', async () => {
  const f = setup(), append = f.journal.append;
  f.journal.append = row => { append(row); if (row.kind === 'capacity-retry') throw Error('after move'); };
  await expect(f.worker.drain()).rejects.toThrow('after move'); expect(f.sent).toEqual([]);
  f.journal.append = append; f.reopen(); await f.worker.drain();
  expect(f.calls).toEqual(['login-0', 'login-1']); expect(f.sent).toHaveLength(1); f.journal.close();
});
it('rechecks admission on B and does not dispatch a refused login', async () => {
  const f = setup(); f.control.refuseB = true; await f.worker.drain();
  expect(f.calls).toEqual(['login-0']); expect(f.sent).toHaveLength(1); expect(f.sent[0]).toContain('usage limit'); f.journal.close();
});

it.each([true, false])('a prior reaction preserves one final answer or all-limited notice (B limited=%s)', async failB => {
  const f = setup(); f.control.ack = true; f.control.failB = failB; await f.worker.drain();
  expect(f.calls).toEqual(['login-0', 'login-1']); expect(f.sent).toHaveLength(1);
  expect(f.sent[0]).toContain(failB ? 'usage limit' : '391'); f.journal.close();
});
