import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical launchd watcher is JavaScript.
import * as hostWatch from '../../scripts/host-watch.mjs';
// @ts-expect-error Physical launchd watcher is JavaScript.
import { INCIDENT_NOTICE_SEAMS, JOURNAL_INCIDENT_LIMITS, superviseJournal } from '../../scripts/host-watch.mjs';

// Rules 15/88 and P-14: an independent supervisor heals the journal runner first. When self-heal is
// exhausted it records ONE evidenced incident on the pull surface. It never sends: an internal-issue
// notice must be Part Eight's admitted infrastructure-notice effect through Part Ten's confined driver,
// and until both exist the outward notice stays inhibited, naming them (Rules 53, 95).
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const journalAgent = fileURLToPath(new URL('../preview/journal-agent.mjs', import.meta.url));
const fixture = (alerts?: { grant: string }) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'host-watch-journal-'))); roots.push(root);
  return { root, config: { mode: 'journal', root, cwd: process.cwd(), agent: [process.execPath, journalAgent, 'run', '--root', root],
    ...(alerts ? { alerts } : {}) } };
};
type Outcome = { code: number | null; signal: string | null };
const script = (root: string, outcomes: Outcome[], end: 'stop' | 'crash' = 'stop') => async () => {
  const next = outcomes.shift();
  if (next) return next;
  // 'crash' ends the supervisor process itself mid-episode, as a launchd relaunch would see it.
  if (end === 'crash') throw Error('supervisor killed');
  writeFileSync(join(root, 'preview-stop.json'), JSON.stringify({ reason: 'operator' })); return { code: 0, signal: null };
};
const fail = { code: 1, signal: null }, ok = { code: 0, signal: null };
const episode = (root: string) => JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8'));

it('records one evidenced incident after self-heal is exhausted, inhibited for want of the notice owners, preserved across relaunch', async () => {
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  const clock = { at: Date.parse('2026-09-28T01:00:00Z') };
  await expect(superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail, fail], 'crash'),
    now: () => clock.at++, wait: async () => {} })).rejects.toThrow('supervisor killed');
  const saved = episode(root);
  expect(saved).toMatchObject({ open: true, phase: 'inhibited', failedAttempts: 4, alertsGrant: 'deployment:alerts-dm' });
  expect(saved.inhibitedBy).toEqual([...INCIDENT_NOTICE_SEAMS]);
  expect(saved.failures).toHaveLength(4);
  expect(saved.incidentAt).toBe(saved.failures[JOURNAL_INCIDENT_LIMITS.incidentAfter - 1].at);
  // No send path exists at all: the supervisor exports no notifier and the runner has no direct-send command.
  expect(Object.keys(hostWatch).filter(name => /notif|send|incident.?text/iu.test(name))).toEqual([]);
  // A relaunched supervisor reads the durable episode: same incident, same phase, closed by a clean run.
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail]), now: () => clock.at++, wait: async () => {} });
  expect(episode(root)).toMatchObject({ id: saved.id, phase: 'inhibited', failedAttempts: 6, open: false });
});

it('stays quiet when a restart heals, and closes the episode on a clean run', async () => {
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail, ok, fail]), now: () => Date.now(), wait: async () => {} });
  expect(episode(root)).toMatchObject({ failedAttempts: 1, phase: 'recovering' });
});

it('keeps an incident local when no alerts grant is recorded, and refuses an empty grant', async () => {
  const { root, config } = fixture();
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail]), now: () => Date.now(), wait: async () => {} });
  expect(episode(root).phase).toBe('unbound');
  const blank = fixture({ grant: '  ' });
  await expect(superviseJournal(blank.config, { spawnRunner: script(blank.root, [fail]), now: () => Date.now(), wait: async () => {} }))
    .rejects.toThrow('invalid journal configuration');
});

it('preserves an earlier uncertain delivery across relaunch and never repeats it', async () => {
  // An episode left by the earlier build: its one notice was dispatched and its outcome is UNKNOWN.
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  const opened = Date.parse('2026-09-28T01:00:00Z');
  writeFileSync(join(root, 'host-watch.json'), JSON.stringify({ version: 1, mode: 'journal', open: true,
    id: '0f1e2d3c-aaaa-bbbb-cccc-000000000000', openedAt: opened, phase: 'unknown', failedAttempts: 3,
    failures: [{ at: opened, code: 1, signal: null, runReason: 'error (details suppressed)' }], notices: [opened], text: 'earlier notice' }));
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail]), now: () => opened + 1, wait: async () => {} });
  expect(episode(root)).toMatchObject({ id: '0f1e2d3c-aaaa-bbbb-cccc-000000000000', phase: 'unknown', failedAttempts: 5,
    open: false, text: 'earlier notice' });
  expect(episode(root).inhibitedBy).toBeUndefined();
});

it('the runner refuses the removed direct incident send before any network or journal access', () => {
  const { root } = fixture();
  const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
    'incident-notice', '--root', root, '--episode', join(root, 'host-watch.json'), '--alerts-grant', 'deployment:alerts-dm'],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 20000,
    env: { ...process.env, INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:9' } });
  expect(run.status).toBe(1);
  expect(existsSync(join(root, 'journal.encrypted'))).toBe(false);
}, 30000);
