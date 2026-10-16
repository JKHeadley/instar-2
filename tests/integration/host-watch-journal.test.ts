import { appendFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical launchd watcher is JavaScript.
import { JOURNAL_INCIDENT_LIMITS, NOTICE_LEDGER_FILE, resumeJournal, superviseJournal } from '../../scripts/host-watch.mjs';

// Rules 15/53/88 and P-14: an independent supervisor heals the journal runner first, including a runner that
// is alive but no longer progressing. When self-heal is exhausted it records ONE evidenced incident on the
// pull surface and sends ONE Part Eight infrastructure-notice through Part Ten's confined driver to the
// alerts destination, never to the conversation, and never twice for the same episode.
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const journalAgent = fileURLToPath(new URL('../preview/journal-agent.mjs', import.meta.url));
const CONVERSATION = '7812716706';
const fixture = (alerts?: { grant: string; chat?: string; topic?: number }, launcher: string[] = []) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'host-watch-journal-'))); roots.push(root);
  return { root, config: { mode: 'journal', root, cwd: process.cwd(),
    agent: [process.execPath, ...launcher, journalAgent, 'run', '--root', root, '--chat-id', CONVERSATION],
    ...(alerts ? { alerts } : {}) } as Record<string, unknown> };
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

it('records one evidenced incident after self-heal is exhausted, inhibited without an alerts destination, preserved across relaunch', async () => {
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  const clock = { at: Date.parse('2026-09-28T01:00:00Z') };
  let notices = 0;
  await expect(superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail, fail], 'crash'), notify: () => { notices++; },
    now: () => clock.at++, wait: async () => {} })).rejects.toThrow('supervisor killed');
  const saved = episode(root);
  expect(saved).toMatchObject({ open: true, phase: 'inhibited', failedAttempts: 4, alertsGrant: 'deployment:alerts-dm',
    inhibitedBy: ['alerts destination not configured'] });
  expect(saved.failures).toHaveLength(4);
  expect(saved.incidentAt).toBe(saved.failures[JOURNAL_INCIDENT_LIMITS.incidentAfter - 1].at);
  expect(notices).toBe(0);
  // A relaunched supervisor reads the durable episode: same incident, same phase, closed by a clean run.
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail]), notify: () => { notices++; }, now: () => clock.at++, wait: async () => {} });
  expect(episode(root)).toMatchObject({ id: saved.id, phase: 'inhibited', failedAttempts: 6, open: false });
  expect(notices).toBe(0);
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

// A physical stand-in for the journal runner: beats like the real one, then follows its per-launch plan.
const RUNNER = `import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[process.argv.indexOf('--root') + 1], plans = JSON.parse(process.env.FAKE_RUNNER_PLAN);
const count = join(root, 'launches'); appendFileSync(count, 'x'); const plan = plans[readFileSync(count, 'utf8').length - 1];
let seq = 0; const beat = () => { writeFileSync(join(root, '.b'), JSON.stringify({ v: 1, pid: process.pid, seq: ++seq })); renameSync(join(root, '.b'), join(root, 'runner-beat.json')); };
if (plan === 'stop-self') { beat(); beat(); process.kill(process.pid, 'SIGSTOP'); }
else { const timer = setInterval(beat, 50); beat();
  setTimeout(() => { clearInterval(timer); writeFileSync(join(root, 'preview-stop.json'), JSON.stringify({ reason: 'operator' })); process.exit(0); },
    plan === 'slow-healthy' ? 1200 : 10); }
`;
const runner = (root: string, plans: string[]) => {
  const path = join(root, 'fake-runner.mjs'); writeFileSync(path, RUNNER); process.env.FAKE_RUNNER_PLAN = JSON.stringify(plans); return path;
};

it('relaunches a runner that is alive but stopped (SIGSTOP), with the hang as failed-attempt evidence', async () => {
  const setup = fixture({ grant: 'deployment:alerts-dm' });
  const path = runner(setup.root, ['stop-self', 'serve']);
  const { config } = { config: { ...setup.config, agent: [process.execPath, path, ...(setup.config.agent as string[]).slice(1)], hangAfterMs: 400 } };
  const started = Date.now();
  expect(await superviseJournal(config, { wait: async () => {} })).toBe(0);
  expect(readFileSync(join(setup.root, 'launches'), 'utf8')).toBe('xx');
  expect(Date.now() - started).toBeLessThan(15000);
  expect(episode(setup.root)).toMatchObject({ open: false, failedAttempts: 1, phase: 'recovering',
    failures: [{ code: null, signal: 'SIGKILL', hung: true }] });
}, 30000);

it('never kills a runner whose beat keeps advancing past the hang window', async () => {
  const setup = fixture();
  const path = runner(setup.root, ['slow-healthy']);
  const config = { ...setup.config, agent: [process.execPath, path, ...(setup.config.agent as string[]).slice(1)], hangAfterMs: 400 };
  expect(await superviseJournal(config, { wait: async () => {} })).toBe(0);
  expect(readFileSync(join(setup.root, 'launches'), 'utf8')).toBe('x');
  expect(existsSync(join(setup.root, 'host-watch.json'))).toBe(false);
}, 30000);

// A fake Telegram Bot API in its OWN process (the driver child runs while the supervisor waits synchronously).
const TELEGRAM = `import { createServer } from 'node:http'; import { appendFileSync, writeFileSync } from 'node:fs';
const [log, portFile, mode] = process.argv.slice(2); let id = 100;
const server = createServer((request, response) => { let body = ''; request.on('data', c => { body += c; }); request.on('end', () => {
  appendFileSync(log, JSON.stringify({ method: request.url.split('/').at(-1), body: JSON.parse(body || '{}') }) + '\\n');
  if (mode === 'lost') { request.socket.destroy(); return; }
  response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: true, result: { message_id: ++id } })); }); });
server.listen(0, '127.0.0.1', () => writeFileSync(portFile, String(server.address().port)));
`;
const servers: ChildProcess[] = [];
afterEach(() => { servers.splice(0).forEach(server => server.kill('SIGKILL')); delete process.env.INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT;
  delete process.env.INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN; });
async function telegram(root: string, mode: 'ok' | 'lost') {
  const script = join(root, 'telegram.mjs'), log = join(root, 'telegram.jsonl'), portFile = join(root, 'telegram.port');
  writeFileSync(script, TELEGRAM); appendFileSync(log, '');
  servers.push(spawn(process.execPath, [script, log, portFile, mode], { stdio: 'ignore' }));
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await new Promise(done => setTimeout(done, 25));
  process.env.INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT = `http://127.0.0.1:${readFileSync(portFile, 'utf8')}`;
  process.env.INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  return () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}
const ALERTS = { grant: 'desk:alerts-2026-09-28', chat: '-1001234567890', topic: 42 };

it('after three failed restarts sends exactly one incident notice to the alerts topic, with the evidence, and nothing to the conversation', async () => {
  const { root, config } = fixture(ALERTS);
  const requests = await telegram(root, 'ok');
  const clock = { at: Date.parse('2026-09-28T01:00:00Z') };
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail, fail, fail]), now: () => clock.at += 1000, wait: async () => {} });
  const sent = requests();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ method: 'sendMessage', body: { chat_id: ALERTS.chat, message_thread_id: 42 } });
  expect(sent.some(row => row.body.chat_id === CONVERSATION)).toBe(false);
  const text: string = sent[0].body.text;
  expect(text).toMatch(/^Infrastructure notice \(host-watch, not the agent\): the journal runner did not recover after 3 restart attempts/u);
  expect(text.match(/exited with code 1/gu)).toHaveLength(3);
  expect(text).toContain('3. 2026-09-28T01:00:06Z: exited with code 1.');
  const saved = episode(root);
  expect(saved).toMatchObject({ phase: 'notified', noticeMessageId: 101, failedAttempts: 5, open: false });
  expect(JSON.parse(readFileSync(join(root, NOTICE_LEDGER_FILE), 'utf8')).entries[`host-watch:${saved.id}`]).toMatchObject({ state: 'delivered', messageId: 101 });
  // A later failure in a new episode is a new incident; this episode never sends again, even after a relaunch.
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail]), now: () => clock.at += 1000, wait: async () => {} });
  expect(requests()).toHaveLength(1);
}, 60000);

it('a lost answer leaves the notice uncertain and it is never repeated', async () => {
  const { root, config } = fixture(ALERTS);
  const requests = await telegram(root, 'lost');
  await expect(superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail, fail, fail], 'crash'), now: () => Date.now(),
    wait: async () => {} })).rejects.toThrow('supervisor killed');
  expect(episode(root)).toMatchObject({ phase: 'notice-uncertain', open: true });
  expect(requests()).toHaveLength(1);
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail]), now: () => Date.now(), wait: async () => {} });
  expect(requests()).toHaveLength(1);
}, 60000);

it('refuses an alerts destination that is the conversation itself: nothing is sent', async () => {
  const { root, config } = fixture({ grant: 'desk:alerts', chat: CONVERSATION });
  const requests = await telegram(root, 'ok');
  await superviseJournal(config, { spawnRunner: script(root, [fail, fail, fail]), now: () => Date.now(), wait: async () => {} });
  expect(episode(root)).toMatchObject({ phase: 'notice-refused', noticeDetail: 'the alerts destination is the conversation route' });
  expect(requests()).toHaveLength(0);
}, 60000);


it('pauses across supervisor relaunches and mixed crash sources until an exact manual resume', async () => {
  const { root, config } = fixture({ grant: 'deployment:alerts-dm' });
  Object.assign(config, { maxRestarts: 3, crashWindowMs: 1000 });
  let at = 100, launches = 0;
  const io = { now: () => at++, wait: async () => {}, spawnRunner: async () => {
    launches++;
    if (launches === 2) throw Error('supervisor killed');
    return fail;
  } };
  await expect(superviseJournal(config, io)).rejects.toThrow('supervisor killed');
  await superviseJournal(config, { ...io, spawnRunner: script(root, [
    { code: null, signal: 'launch-error' }, { code: null, signal: 'SIGKILL', hung: true } as Outcome,
  ], 'crash') });
  const saved = episode(root);
  expect(saved.crashLoop).toMatchObject({ pausedAt: expect.any(Number), failures: expect.any(Array) });
  expect(saved.crashLoop.failures).toHaveLength(3);
  const bytes = readFileSync(join(root, 'host-watch.json'), 'utf8');
  at += 10000;
  await superviseJournal(config, { ...io, spawnRunner: () => { throw Error('paused runner must not launch'); } });
  expect(readFileSync(join(root, 'host-watch.json'), 'utf8')).toBe(bytes);
  expect(resumeJournal(config, 'wrong-episode', at)).toBe(false);
  expect(resumeJournal(config, saved.id, at)).toBe(true);
  expect(resumeJournal(config, saved.id, at)).toBe(false);
  expect(episode(root).crashLoop.pausedAt).toBeNull();
  expect(episode(root).resumed).toMatchObject({ episode: saved.id, at });
  await superviseJournal(config, { ...io, spawnRunner: script(root, [ok]) });
});

it('replays recorded runner exits without interpreting worker text as a crash', async () => {
  const capture = JSON.parse(readFileSync(new URL('../preview/fixtures/installation-relaunch-live-2026-10-07.json', import.meta.url), 'utf8'));
  const { root, config } = fixture();
  Object.assign(config, { maxRestarts: 2 });
  const refusal = capture.runLog.find((row: { reason?: string }) => row.reason === 'refused before launch');
  expect(refusal).toBeTruthy();
  const rows = capture.runLog.filter((row: { launch: number }) => row.launch === refusal.launch);
  writeFileSync(join(root, 'runs.jsonl'), rows.map((row: unknown) => JSON.stringify(row)).join('\n') + '\n');
  let at = refusal.exit;
  await superviseJournal(config, { now: () => at++, wait: async () => {}, spawnRunner: script(root, [fail, fail], 'crash') });
  expect(episode(root).crashLoop.pausedAt).not.toBeNull();
  expect(episode(root).failures[0].runReason).toBe('refused before launch');
});


it('keeps the stop latch authoritative over manual resume and exposes the paused episode through the real CLI', async () => {
  const { root, config } = fixture();
  Object.assign(config, { maxRestarts: 1 });
  await superviseJournal(config, { now: () => 100, wait: async () => {}, spawnRunner: script(root, [fail], 'crash') });
  const saved = episode(root);
  const file = join(root, 'config.json'); writeFileSync(file, JSON.stringify(config));
  const status = spawnSync(process.execPath, ['scripts/host-watch.mjs', file, 'status'], { encoding: 'utf8' });
  expect(status.status).toBe(0);
  expect(JSON.parse(status.stdout)).toMatchObject({ paused: true, episode: saved.id, resume: `resume ${saved.id}` });
  writeFileSync(join(root, 'preview-stop.json'), JSON.stringify({ reason: 'operator' }));
  expect(resumeJournal(config, saved.id, 101)).toBe(false);
  expect(episode(root).crashLoop.pausedAt).toBe(100);
  expect(spawnSync(process.execPath, ['scripts/host-watch.mjs', file, 'resume', saved.id]).status).toBe(1);
});

it('carries pre-update failure evidence into the window before granting another launch', async () => {
  const { root, config } = fixture();
  Object.assign(config, { maxRestarts: 2 });
  writeFileSync(join(root, 'host-watch.json'), JSON.stringify({ version: 1, mode: 'journal', open: true,
    id: 'legacy-episode', phase: 'notice-uncertain', failedAttempts: 2,
    failures: [{ at: 1, code: 1, signal: null }, { at: 2, code: null, signal: 'launch-error' }] }));
  await superviseJournal(config, { now: () => 3, spawnRunner: () => { throw Error('must stay paused'); } });
  expect(episode(root)).toMatchObject({ id: 'legacy-episode', phase: 'notice-uncertain', crashLoop: { pausedAt: 2 } });
});

it('keeps healthy recorded work completion outside the host crash population', async () => {
  const capture = JSON.parse(readFileSync(new URL('../preview/fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8'));
  const completed = capture.workerRecords.find((row: { record: { type: string } }) => row.record.type === 'SessionWorkEdgeClose');
  expect(completed.record.state).toBe('complete');
  const { root, config } = fixture();
  Object.assign(config, { maxRestarts: 1 });
  let at = completed.record.closedAt;
  await superviseJournal(config, { now: () => at++, wait: async () => {}, spawnRunner: async () => {
    // Recorded worker result and durable work result are not failed host-launch evidence.
    appendFileSync(join(root, 'runs.jsonl'), JSON.stringify({ v: 1, launch: at, exit: at + 1, revival: 'none',
      work: [capture.workResult, completed] }) + '\n');
    return ok;
  } });
  expect(existsSync(join(root, 'host-watch.json'))).toBe(false);
});

it('does not revive expired pre-update failure pressure and retains restart backoff before launching', async () => {
  const { root, config } = fixture();
  Object.assign(config, { maxRestarts: 2, crashWindowMs: 100 });
  writeFileSync(join(root, 'host-watch.json'), JSON.stringify({ version: 1, mode: 'journal', open: true,
    id: 'legacy-old', phase: 'unbound', failedAttempts: 2,
    failures: [{ at: 1, code: 1, signal: null }, { at: 2, code: 1, signal: null }] }));
  let at = 200;
  await expect(superviseJournal(config, { now: () => at, wait: async () => {},
    spawnRunner: script(root, [fail], 'crash') })).rejects.toThrow('supervisor killed');
  expect(episode(root).crashLoop.failures).toHaveLength(1);
  const due = episode(root).nextLaunchAt;
  let waited = 0;
  await superviseJournal(config, { now: () => at, wait: async (_root: string, ms: number) => { waited += ms; at += ms; },
    spawnRunner: script(root, [], 'stop') });
  expect(waited).toBe(due - 200);
});
