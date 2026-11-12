import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { burnObservation, burnStatus } from './burn-observation.js';
import { dashboardSnapshot } from './operator-dashboard.js';
// @ts-expect-error Operator page is JavaScript.
import { renderDashboard, snapshotState } from '../../scripts/operator-dashboard.mjs';
import { statusReply } from './status-command.js';
const key = new Uint8Array(32).fill(19);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'trial',
  configurationDigest: 'sha256:trial', expires: 9999999999999, cursor: 0,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 327680 };

it('observes real writer reservations and model-call rows: low, burst, restart, recovery, later burst', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis, undefined, false, 256), now = 1_000_000, next = 0;
  const sent: string[] = [];
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async () => { throw Error('observation must make no model call'); },
    send: async ({ text }) => { sent.push(text); return sent.length; }, checkOutbound: () => {} });
  const call = () => {
    const n = ++next, id = `telegram:12345678:update:${n}`;
    const raw = { update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'work' } };
    journal.append({ kind: 'intake', id, update: n, text: 'work', raw: JSON.stringify(raw), accepted: true, cursor: n + 1, at: now });
    journal.append({ kind: 'reserve', id, at: now });
    journal.append({ kind: 'model-call', id: `call-${n}`, occurrence: id, judgment: 'answer', route: 'preview-subscription',
      model: 'recorded-shape', inputSha256: 'a'.repeat(64), input: 'work', output: 'answer', outcome: 'complete',
      latencyMs: 1, usage: null, usageException: 'subscription does not report usage', at: now });
    journal.append({ kind: 'answer', id, text: 'answer', state: 'complete', at: now });
  };
  try {
    call(); await worker().observeBurn();
    expect(burnObservation(journal.view, now).active).toBe(false); expect(sent).toEqual([]);
    for (let n = 0; n < 14; n++) call();
    const w = worker(); await Promise.all([w.observeBurn(), w.observeBurn()]);
    expect(burnObservation(journal.view, now)).toMatchObject({ callsPerHour: 180, minutesToShed: 20, active: true, episode: 1 });
    expect(sent).toHaveLength(1); expect(sent[0]).toContain('180 reserved attempts/hour');
    const snapshot = dashboardSnapshot(journal.view, { now, zone: 'UTC', statusText: statusReply(journal.view, now, 'UTC'), bot: null, stopped: false });
    const html = renderDashboard({ token: 'a'.repeat(32), view: 'allowance', state: snapshotState(JSON.stringify(snapshot), now), pending: [] });
    expect(html).toContain('180 reserved attempts/hour');
    expect(html).toContain('Allowance may run short within 30 min');
    expect(journal.view.replies).toBe(1);
    expect(statusReply(journal.view, now, 'UTC')).toContain(burnStatus(journal.view, now));
    journal.close(); journal = openPreviewJournal(path, key);
    await worker().observeBurn(); expect(sent).toHaveLength(1);
    now += 301_000; await worker().observeBurn();
    expect(journal.view.burn?.active).toBe(false); expect(burnObservation(journal.view, now).callsPerHour).toBe(0);
    for (let n = 0; n < 15; n++) call();
    await worker().observeBurn(); expect(sent).toHaveLength(2); expect(journal.view.burn?.episode).toBe(2);
    const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', root], { encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(result.status, result.stderr).toBe(0); expect(JSON.parse(result.stdout).burn).toMatchObject({ recordedActive: true, active: false });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['unknown', 'refused'] as const)('never repeats a %s notice after restart; the cap and stop still apply', async outcome => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls: 4 }), sends = 0;
  const now = 1000000;
  const w = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async () => 'unused', send: async () => { sends++; return { kind: outcome, reason: 'transport result' }; }, checkOutbound: () => {} });
  try {
    w().intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:1', at: now });
    await w().observeBurn(); expect(sends).toBe(1);
    expect(journal.view.sendOutcomes.at(-1)?.outcome).toBe(outcome);
    journal.close(); journal = openPreviewJournal(path, key);
    await w().observeBurn(); expect(sends).toBe(1);
    expect(() => journal.append({ kind: 'burn', action: 'intent', episode: 1, text: 'forged', at: now })).toThrow();
    journal.append({ kind: 'stop', reason: 'operator', at: now });
    await w().observeBurn(); expect(sends).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('uses the cap horizon continuously across the shed and labels missing snapshot evidence', () => {
  const view = { calls: 74, limits: { maxCalls: 100 }, clockFloor: 1_000_000,
    burn: { buckets: [[1000, 10]] as [number, number][], episode: 1, active: true } };
  expect(burnObservation(view, 1_000_000).active).toBe(true);
  view.calls = 75;
  expect(burnObservation(view, 1_000_000)).toMatchObject({ active: true, minutesToShed: 0 });
  expect(burnObservation(view, 1_300_000).active).toBe(false);
  expect(burnStatus({ calls: 20, limits: { maxCalls: 100 }, clockFloor: 1_000_000 }, 1_000_000)).toContain('history is unavailable');
});

it('does not push old figures after waiting for audience admission', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-stale-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 4 });
  let now = 1_000_000, sends = 0;
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, model: async () => 'unused',
    sendAdmits: true, send: async ({ admit, current }) => {
      now += 301_000;
      if (!current?.()) return { kind: 'refused', reason: 'stale' };
      admit?.(); sends++; return 1;
    }, checkOutbound: () => {} });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:1', at: now });
    await worker.observeBurn(); expect(sends).toBe(0); expect(journal.view.burn?.notice).toBeUndefined();
    await worker.observeBurn(); expect(journal.view.burn?.active).toBe(false);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([false, true])('forum allowance is operator-private; operator-only audience=%s', async allowed => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-group-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
    { ...genesis, chat: '-1007654321', forum: true, maxCalls: 4 });
  let sends = 0;
  const now = 1_000_000;
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, groupDisclosure: async () => allowed,
    model: async () => 'unused', send: async () => { sends++; return 1; }, checkOutbound: () => {} });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: -1007654321, type: 'supergroup', is_forum: true },
      from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:1', at: now });
    await worker.observeBurn(); expect(sends).toBe(Number(allowed));
    expect(statusReply(journal.view, now, 'UTC')).toContain('Call rate: available on the operator dashboard.');
    const snapshot = dashboardSnapshot(journal.view, { now, zone: 'UTC', statusText: statusReply(journal.view, now, 'UTC'), bot: null, stopped: false });
    expect(snapshot.status).toContain(burnStatus(journal.view, now));
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
