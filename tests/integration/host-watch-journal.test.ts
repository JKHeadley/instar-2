import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical launchd watcher is JavaScript.
import { JOURNAL_INCIDENT_LIMITS, journalIncidentText, superviseJournal } from '../../scripts/host-watch.mjs';

// Rules 15/53/88 and P-14: an independent supervisor heals the journal runner first, and only
// after self-heal is exhausted sends one evidenced incident notice to the one granted destination.
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const journalAgent = fileURLToPath(new URL('../preview/journal-agent.mjs', import.meta.url));
const fixture = (alerts?: { grant: string; thread?: number }) => {
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

it('restarts after failures and sends one evidenced notice only after self-heal is exhausted, never again for the episode', async () => {
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  const notices: unknown[] = [];
  const clock = { at: Date.parse('2026-09-28T01:00:00Z') };
  await expect(superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail, fail], 'crash'),
    notify: ({ episode: prepared }: { episode: unknown }) => notices.push(prepared), now: () => clock.at++, wait: async () => {} }))
    .rejects.toThrow('supervisor killed');
  expect(notices).toHaveLength(1);
  const saved = episode(root);
  expect(saved).toMatchObject({ open: true, phase: 'prepared', failedAttempts: 4 });
  expect(saved.failures).toHaveLength(4);
  expect(saved.text).toBe(journalIncidentText(saved));
  expect(saved.text).toContain(`after ${JOURNAL_INCIDENT_LIMITS.noticeAfter} automatic restarts`);
  // A relaunched supervisor reads the durable episode: the unchanged incident is never re-pushed.
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail]), notify: () => notices.push('again'),
    now: () => clock.at++, wait: async () => {} });
  expect(notices).toHaveLength(1);
  expect(episode(root)).toMatchObject({ id: saved.id, failedAttempts: 6, open: false });
});

it('stays silent when a restart heals, and closes the episode on a clean run', async () => {
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  const notices: unknown[] = [];
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail, ok, fail]), notify: () => notices.push(1),
    now: () => Date.now(), wait: async () => {} });
  expect(notices).toHaveLength(0);
  expect(episode(root)).toMatchObject({ failedAttempts: 1, phase: 'recovering' });
});

it('keeps an incident local when no alerts destination is granted', async () => {
  const { root, config } = fixture();
  const notices: unknown[] = [];
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail]), notify: () => notices.push(1),
    now: () => Date.now(), wait: async () => {} });
  expect(notices).toHaveLength(0);
  expect(episode(root).phase).toBe('unbound');
});

it('holds P-14: at most two pushed incidents per rolling hour', async () => {
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  const notices: unknown[] = [];
  const clock = { at: 1_790_000_000_000 };
  const burst = [fail, fail, fail, ok, fail, fail, fail, ok, fail, fail, fail, ok];
  await superviseJournal(config, { spawnRunner: script(root, burst), notify: () => notices.push(1),
    now: () => (clock.at += 1000), wait: async () => {} });
  expect(notices).toHaveLength(JOURNAL_INCIDENT_LIMITS.perHour);
});

it('sends the prepared incident once to the granted destination through the real command, then refuses a repeat', async () => {
  const { root } = fixture();
  const log = join(root, 'poll.log');
  const opened = Date.parse('2026-09-28T01:00:00Z');
  const prepared = { version: 1, mode: 'journal', open: true, id: '0f1e2d3c-aaaa-bbbb-cccc-000000000000', openedAt: opened,
    phase: 'prepared', failedAttempts: 3, failures: [{ at: opened, code: 1, signal: null, runReason: 'error (details suppressed)' }],
    notices: [opened] };
  writeFileSync(join(root, 'host-watch.json'), JSON.stringify({ ...prepared, text: journalIncidentText(prepared) }));
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise<number>((done, reject) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', reject); });
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const notice = () => spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
      'incident-notice', '--root', root, '--bot-id', '8820318295', '--bot-username', '@echo_mmtest_seam_b27x_bot',
      '--chat-id', '7812716706', '--operator-sender-id', '7812716706', '--episode', join(root, 'host-watch.json'),
      '--alerts-grant', 'deployment:alerts-dm', '--alerts-thread', '42'], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env });
    expect(notice().status).toBe(0);
    const sends = readFileSync(`${log}.sends`, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(sends).toEqual([{ chat_id: '7812716706', text: journalIncidentText(prepared), message_thread_id: 42 }]);
    expect(episode(root)).toMatchObject({ phase: 'notified', message: 1, alertsGrant: 'deployment:alerts-dm', alertsThread: 42 });
    expect(notice().status).toBe(1);
    expect(readFileSync(`${log}.sends`, 'utf8').trim().split('\n')).toHaveLength(1);
    expect(existsSync(join(root, 'journal.encrypted'))).toBe(false);
  } finally { endpoint.kill('SIGTERM'); }
}, 30000);
