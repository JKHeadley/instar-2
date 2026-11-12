import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { sendOutcomeCounts } from './journal.js';
import { BURN_WINDOW_MS, burnNoticeReady, burnObservation, burnStatus, recordBurnCalls } from './burn-observation.js';
import { dashboardSnapshot } from './operator-dashboard.js';
// @ts-expect-error Operator page is JavaScript.
import { renderDashboard, snapshotState } from '../../scripts/operator-dashboard.mjs';
import { statusReply } from './status-command.js';
const key = new Uint8Array(32).fill(19);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'trial',
  configurationDigest: 'sha256:trial', expires: 9999999999999, cursor: 0,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 327680 };

// A completed reservation in the preceding window establishes observation age through real
// journal replay. It has no send intent, so delivery accounting remains about the notices.
function warm(journal: ReturnType<typeof openPreviewJournal>, now = 1_000_000) {
  const at = now - BURN_WINDOW_MS, id = 'telegram:12345678:update:0';
  journal.append({ kind: 'intake', id, update: 0, text: 'earlier work', raw: '{}', accepted: true, cursor: 1, at });
  journal.append({ kind: 'reserve', id, at });
  journal.append({ kind: 'answer', id, text: 'earlier result', state: 'complete', at });
}

it('keeps a startup forecast on pull until a whole window, across raw replay and compaction', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-startup-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls: 4 }), now = 1_000_000, sends = 0;
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async () => 'unused', send: async () => ++sends, checkOutbound: () => {} });
  const reserve = (n: number) => {
    worker().intake([{ update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: `telegram:12345678:update:${n}`, at: now });
  };
  try {
    reserve(1); await worker().observeBurn();
    expect(burnObservation(journal.view, now).active).toBe(true);
    expect(burnStatus(journal.view, now)).toContain('12 reserved attempts/hour');
    expect(sends).toBe(0); expect(journal.view.replies).toBe(0);
    journal.close(); journal = openPreviewJournal(path, key);
    now += BURN_WINDOW_MS - 1; reserve(2); await worker().observeBurn();
    expect(sends).toBe(0);
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    now++; await worker().observeBurn(); expect(sends).toBe(1);
    await worker().observeBurn(); expect(sends).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('warms an old snapshot from newly observed evidence and never infers missing history', () => {
  const view = { calls: 2, limits: { maxCalls: 10 }, clockFloor: 1_000_000,
    burn: { buckets: [[1000, 2]] as [number, number][], episode: 1, active: true } };
  expect(burnNoticeReady(view, 1_000_000)).toBe(false);
  view.calls++; recordBurnCalls(view, 1_000_000, 1);
  expect(burnNoticeReady(view, 1_299_999)).toBe(false);
  view.calls++; recordBurnCalls(view, 1_299_999, 1);
  expect(burnNoticeReady(view, 1_300_000)).toBe(true);
  expect(burnNoticeReady(view, 1_600_000)).toBe(false);
});

it('observes real writer reservations and model-call rows: low, burst, restart, recovery, later burst', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls: 101 }, undefined, false, 256), now = 1_000_000, next = 0;
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
    warm(journal);
    call(); await worker().observeBurn();
    expect(burnObservation(journal.view, now).active).toBe(false); expect(sent).toEqual([]);
    for (let n = 0; n < 14; n++) call();
    const w = worker(); await Promise.all([w.minimal(), w.observeBurn()]);
    expect(burnObservation(journal.view, now)).toMatchObject({ callsPerHour: 180, minutesToShed: 20, active: true, episode: 1 });
    expect(sent).toHaveLength(1); expect(sent[0]).toContain('180 reserved attempts/hour');
    const snapshot = dashboardSnapshot(journal.view, { now, zone: 'UTC', statusText: statusReply(journal.view, now, 'UTC'), bot: null, stopped: false });
    const html = renderDashboard({ token: 'a'.repeat(32), view: 'allowance', state: snapshotState(JSON.stringify(snapshot), now), pending: [] });
    expect(html).toContain('180 reserved attempts/hour');
    expect(html).toContain('Allowance may run short within 30 min');
    expect(journal.view.replies).toBe(1);
    expect(sendOutcomeCounts(journal.view)).toMatchObject({ accepted: 1, refused: 0, unknown: 0 });
    expect(statusReply(journal.view, now, 'UTC')).toContain(burnStatus(journal.view, now));
    journal.close(); journal = openPreviewJournal(path, key);
    await worker().observeBurn(); expect(sent).toHaveLength(1);
    now += 301_000; await worker().observeBurn();
    expect(journal.view.burn?.active).toBe(false); expect(burnObservation(journal.view, now).callsPerHour).toBe(0);
    for (let n = 0; n < 15; n++) call();
    await worker().observeBurn(); expect(sent).toHaveLength(1);
    now += BURN_WINDOW_MS;
    for (let n = 0; n < 15; n++) call();
    await worker().observeBurn(); expect(sent).toHaveLength(2); expect(journal.view.burn?.episode).toBe(2);
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    expect(sendOutcomeCounts(journal.view)).toMatchObject({ accepted: 2, refused: 0, unknown: 0 });
    const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', root], { encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ unknownSends: 0, sendOutcomes: { accepted: 2, refused: 0, unknown: 0 } }); expect(JSON.parse(result.stdout).burn).toMatchObject({ recordedActive: true, active: false });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['unknown', 'refused'] as const)('never repeats a %s notice after restart; the cap and stop still apply', async outcome => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls: 4 }), sends = 0;
  const now = 1000000;
  const w = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async () => 'unused', send: async () => { sends++; return { kind: outcome, reason: 'transport result' }; }, checkOutbound: () => {} });
  try {
    warm(journal);
    w().intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:1', at: now });
    await w().observeBurn(); expect(sends).toBe(1);
    expect(journal.view.sendOutcomes.at(-1)?.outcome).toBe(outcome);
    expect(sendOutcomeCounts(journal.view)[outcome]).toBe(1);
    journal.compact();
    journal.close(); journal = openPreviewJournal(path, key);
    await w().observeBurn(); expect(sends).toBe(1);
    expect(sendOutcomeCounts(journal.view)[outcome]).toBe(1);
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
    warm(journal);
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
    warm(journal);
    worker.intake([{ update_id: 1, message: { chat: { id: -1007654321, type: 'supergroup', is_forum: true },
      from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:1', at: now });
    await worker.observeBurn(); expect(sends).toBe(Number(allowed));
    expect(statusReply(journal.view, now, 'UTC')).toContain('Call rate: available on the operator dashboard.');
    const snapshot = dashboardSnapshot(journal.view, { now, zone: 'UTC', statusText: statusReply(journal.view, now, 'UTC'), bot: null, stopped: false });
    expect(snapshot.status).toContain(burnStatus(journal.view, now));
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([1, 2, 3])('past the reminder end date observation stays alive, preserving both owed reply slots (allowance %s)', async maxReplies => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-allowance-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, expires: 999_100, maxCalls: 4, maxReplies });
  let sends = 0;
  const worker = createJournalWorker(journal, { now: () => 1_000_000, stopped: () => false, model: async () => 'unused',
    send: async () => { sends++; return 1; }, checkOutbound: () => {} });
  try {
    warm(journal);
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:1', at: 1_000_000 });
    await worker.observeBurn(); expect(sends).toBe(Number(maxReplies === 3));
    expect(journal.view.replies).toBe(Number(maxReplies === 3));
    expect(journal.view.burn?.active).toBe(true);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([3, 4])('rechecks reply room for intake arriving during warning admission (allowance %s)', async maxReplies => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-intake-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 4, maxReplies });
  const now = 1_000_000;
  let sends = 0;
  const message = (update_id: number) => ({ update_id, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'work' } });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, model: async () => 'unused',
    sendAdmits: true, send: async ({ current, admit }) => {
      worker.intake([message(2)]);
      if (!current?.()) return { kind: 'refused', reason: 'reply room needed' };
      admit?.();
      expect(current?.()).toBe(true); // its own intent must not consume the room twice
      sends++; return 1;
    }, checkOutbound: () => {} });
  try {
    warm(journal); worker.intake([message(1)]);
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:1', at: now });
    await worker.observeBurn();
    expect(sends).toBe(Number(maxReplies === 4));
    expect(journal.view.limits.maxReplies - journal.view.replies).toBe(3);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['accepted', 'refused', 'unknown', 'crash'] as const)('keeps %s delivery accounting across compaction and another episode', async outcome => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'burn-history-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls: 6 }), now = 1_000_000, sends = 0;
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async () => 'unused', checkOutbound: () => {}, send: async () => {
      sends++; return outcome === 'accepted' ? sends : { kind: outcome === 'crash' ? 'unknown' : outcome, reason: 'transport result' };
    } });
  const reserve = (n: number) => {
    worker().intake([{ update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'work' } }]);
    journal.append({ kind: 'reserve', id: `telegram:12345678:update:${n}`, at: now });
  };
  const expected = { accepted: outcome === 'accepted' ? 2 : 0, refused: outcome === 'refused' ? 2 : 0,
    unknown: outcome === 'unknown' || outcome === 'crash' ? 2 : 0 };
  try {
    if (outcome !== 'crash') warm(journal);
    for (let episode = 1; episode <= 2; episode++) {
      reserve(episode);
      if (episode === 2 && outcome !== 'crash') {
        await worker().observeBurn(); expect(sends).toBe(1);
        now += BURN_WINDOW_MS; reserve(100 + episode);
      }
      if (outcome === 'crash') {
        journal.append({ kind: 'burn', action: 'open', episode, at: now });
        const text = `Infrastructure allowance warning. ${burnStatus(journal.view, now)} You can ask me to pause optional work. Existing limits are unchanged.`;
        const provenance = journal.signOutbound('infrastructure', { target: `burn:${episode}`, chat: genesis.chat, body: text });
        journal.append({ kind: 'burn', action: 'intent', episode, text, provenance, at: now });
        // Historical startup notices remain valid under raw replay, though new dispatch would wait.
        journal.close(); journal = openPreviewJournal(path, key);
      } else await worker().observeBurn();
      journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
      await worker().observeBurn();
      expect(sends).toBe(outcome === 'crash' ? 0 : episode);
      expect(sendOutcomeCounts(journal.view)[outcome === 'crash' ? 'unknown' : outcome]).toBe(episode);
      now += 301_000; await worker().observeBurn();
    }
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    expect(sendOutcomeCounts(journal.view)).toMatchObject(expected);
    const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', root], { encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ unknownSends: expected.unknown, sendOutcomes: expected });
    if (outcome === 'crash') expect(sendOutcomeCounts(journal.view).unknownReasons).toEqual({ 'no recorded reason': 2 });
    if (outcome === 'unknown') expect(sendOutcomeCounts(journal.view).unknownReasons).toEqual({ 'transport result': 2 });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
