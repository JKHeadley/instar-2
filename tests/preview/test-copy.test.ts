// @ts-nocheck -- worker fixtures and the real launcher process.
import { afterEach, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { makeTestCopy } from './test-copy.js';

// The source is a forum group root (Justin's shape): bot 87654321, group -7654321, operator 7654321. The copy is the
// operator's own private chat (chat = operator) with a different, test bot (12345678: the offline endpoint's getMe).
const key = new Uint8Array(32).fill(47), start = Date.UTC(2026, 9, 20, 15, 0);
const sourceBot = '87654321', testBot = '12345678', operator = '7654321', group = '-7654321';
const genesis = { kind: 'genesis' as const, origin: 'test' as const, bot: sourceBot, chat: group, operator, forum: true as const,
  grant: 'grant:fixture', configurationDigest: 'sha256:fixture', expires: start + 30 * 86400000,
  maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const quote = 'the desk test word is lantern-4817';
const request = 'remind me Oct 20 at 9:00 am to call Priya';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const groupUpdate = (update: number, text: string, at: number, topic = 3) => ({ update_id: update,
  message: { message_id: update, message_thread_id: topic, chat: { id: Number(group), type: 'supergroup', is_forum: true },
    from: { id: Number(operator) }, text, date: Math.floor(at / 1000) } });
const privateUpdate = (update: number, text: string, at: number) => ({ update_id: update,
  message: { message_id: update, chat: { id: Number(operator), type: 'private' }, from: { id: Number(operator) }, text, date: Math.floor(at / 1000) } });

function ports(clock: { now: number }, packets: string[], sends: { chat: string; thread?: number; text: string }[]) {
  return { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles', origin: 'test', groupDisclosure: async () => true,
    prepareModel: (input: { question: string; context: string; id: string }) => prepareJournalEnvelope(input, 'fixture-model', genesis.grant, clock.now, 32768),
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator saved a fact and asked for a reminder.', people: [], memory: [] });
      packets.push(input.context);
      if (input.question === `remember ${quote}`) return JSON.stringify({ reply: 'Noted.', memory: [{ mode: 'remember', source: input.id, quote }] });
      if (input.question === request) return JSON.stringify({ reply: 'I will remind you.', memory: [], dated: [{ quote: request, when: 'Oct 20 at 9:00 am', remind: true }] });
      if (input.question === 'what is the desk test word?') {
        const found = JSON.parse(input.context).memory?.find((item: { mode: string }) => item.mode === 'remembered');
        return JSON.stringify({ reply: found?.replacement ?? 'No saved fact.', memory: [] });
      }
      return JSON.stringify({ reply: 'Time to call Priya.', memory: [] });
    },
    checkOutbound: () => {},
    send: async (input: { chat: string; thread?: number; expectedText: string }) => {
      sends.push({ chat: input.chat, ...(input.thread === undefined ? {} : { thread: input.thread }), text: input.expectedText });
      return sends.length;
    } };
}

/** A source root with a saved fact (topic 3) and an open reminder for 9:00 am, built through the real worker. */
async function sourceRoot() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-test-copy-'))); dirs.push(directory);
  const root = join(directory, 'source');
  const clock = { now: start - 3 * 3600000 }, packets: string[] = [], sends = [];
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const worker = createJournalWorker(journal, ports(clock, packets, sends));
  worker.intake([groupUpdate(1, `remember ${quote}`, clock.now)]); await worker.drain();
  clock.now += 60000;
  worker.intake([groupUpdate(2, request, clock.now, 5)]); await worker.drain();
  expect(journal.view.memory).toMatchObject([{ mode: 'remember', quote }]);
  expect(journal.view.dated).toMatchObject([{ remind: true, quote: request }]);
  journal.close();
  return { directory, root, sends };
}
const digestOf = (root: string) => Object.fromEntries(readdirSync(root, { recursive: true }).map(String).sort()
  .filter(name => statSync(join(root, name)).isFile())
  .map(name => [name, createHash('sha256').update(readFileSync(join(root, name))).digest('hex')]));

it('copies history, memory and open work into a new root bound to a test bot, leaving every source byte unchanged', async () => {
  const source = await sourceRoot();
  const before = digestOf(source.root), copyRoot = join(source.directory, 'copy');
  const result = makeTestCopy({ sourceRoot: source.root, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now: start - 3600000 });
  expect(digestOf(source.root)).toEqual(before);
  const sourceBytes = readFileSync(join(source.root, 'journal.encrypted'));
  expect(result).toMatchObject({ source: source.root, bytes: sourceBytes.length, copiedRequests: 1, bot: testBot, chat: operator,
    journal: `sha256:${createHash('sha256').update(sourceBytes).digest('hex')}` });
  // Only the journal is copied; no staging file is left; nothing else of the source (logins, custody, owners) comes along.
  expect(readdirSync(copyRoot)).toEqual(['journal.encrypted']);
  for (const reopened of [false, true]) {
    const copy = openPreviewJournal(join(copyRoot, 'journal.encrypted'), key, undefined, undefined, true);
    try {
      expect(copy.view.genesis).toMatchObject({ bot: testBot, chat: operator, operator, grant: genesis.grant });
      expect(copy.view.genesis.forum).toBeUndefined();
      expect(copy.view.testCopy).toMatchObject({ at: start - 3600000,
        source: { root: source.root, journal: result.journal, bytes: result.bytes, frontier: result.frontier },
        lineage: { bot: sourceBot, chat: group, forum: true },
        copied: { requests: [expect.stringContaining('call Priya')], waiting: 0 } });
      expect(copy.view.memory).toMatchObject([{ mode: 'remember', quote }]);
      expect(copy.view.order.map(turn => turn.text)).toEqual([`remember ${quote}`, request]);
    } finally { copy.close(); }
    if (!reopened) expect(reopened).toBe(false);
  }
});

it('the copy recalls the real history on the test chat, and a copied reminder fires only into the test chat', async () => {
  const source = await sourceRoot();
  const copyRoot = join(source.directory, 'copy');
  makeTestCopy({ sourceRoot: source.root, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now: start - 3600000 });
  const clock = { now: start - 1800000 }, packets: string[] = [], sends = [];
  let journal = openPreviewJournal(join(copyRoot, 'journal.encrypted'), key);
  try {
    let worker = createJournalWorker(journal, ports(clock, packets, sends));
    worker.intake([privateUpdate(1, 'what is the desk test word?', clock.now)]); await worker.drain();
    expect(sends).toMatchObject([{ chat: operator, text: expect.stringContaining(quote) }]);
    expect(sends[0].thread).toBeUndefined();
    // A message from the source group, or from anyone but the operator, is not the copy's conversation.
    worker.intake([groupUpdate(2, 'what is the desk test word?', clock.now)]); await worker.drain();
    expect(sends).toHaveLength(1);
    journal.close(); journal = openPreviewJournal(join(copyRoot, 'journal.encrypted'), key);
    worker = createJournalWorker(journal, ports(clock, packets, sends));
    clock.now = start + 3600000 + 60000;
    await worker.sendRequested();
    const due = journal.view.order.filter(turn => turn.requestedAction);
    expect(due).toHaveLength(1);
    expect(sends.slice(1).map(send => send.chat)).toEqual([operator]);
    expect(sends.at(-1).text).toContain('Time to call Priya.');
    expect(sends.every(send => send.chat === operator)).toBe(true);
  } finally { journal.close(); }
  // The source never fires it from here: its own journal is unchanged, and its reminder is still its own.
  const after = openPreviewJournal(join(source.root, 'journal.encrypted'), key, undefined, undefined, true);
  try { expect(after.view.order.filter(turn => turn.requestedAction)).toEqual([]); } finally { after.close(); }
});

it('keeps the rebind across compaction of the copy', async () => {
  const source = await sourceRoot();
  const copyRoot = join(source.directory, 'copy');
  makeTestCopy({ sourceRoot: source.root, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now: start - 3600000 });
  const path = join(copyRoot, 'journal.encrypted');
  const clock = { now: start - 1800000 }, sends = [];
  let journal = openPreviewJournal(path, key);
  const worker = createJournalWorker(journal, ports(clock, [], sends));
  worker.intake([privateUpdate(1, 'what is the desk test word?', clock.now)]); await worker.drain();
  const digest = JSON.stringify(journal.view.testCopy);
  journal.compact(); journal.close();
  journal = openPreviewJournal(path, key);
  try {
    expect(journal.view.genesis).toMatchObject({ bot: testBot, chat: operator });
    expect(JSON.stringify(journal.view.testCopy)).toBe(digest);
    const again = createJournalWorker(journal, ports(clock, [], sends));
    again.intake([privateUpdate(2, 'what is the desk test word?', clock.now)]); await again.drain();
    expect(sends.map(send => send.text)).toEqual([expect.stringContaining(quote), expect.stringContaining(quote)]);
    expect(sends.every(send => send.chat === operator)).toBe(true);
  } finally { journal.close(); }
});

it.each([
  ['a chat that is not the operator\'s private chat', { bot: testBot, chat: '5555' }, 'test copy refused'],
  ['the source bot', { bot: sourceBot, chat: operator }, 'test copy refused'],
  ['a malformed bot', { bot: 'bot', chat: operator }, 'binding malformed'],
])('refuses a rebind to %s and leaves no launchable copy', async (_name, binding, reason) => {
  const source = await sourceRoot();
  const copyRoot = join(source.directory, 'copy');
  expect(() => makeTestCopy({ sourceRoot: source.root, root: copyRoot, key, binding, now: start })).toThrow(reason);
  expect(existsSync(join(copyRoot, 'journal.encrypted'))).toBe(false);
});

it('refuses a copy root that is not new, and a copy of a copy', async () => {
  const source = await sourceRoot();
  const used = join(source.directory, 'used'); mkdirSync(used); writeFileSync(join(used, 'x'), 'x');
  expect(() => makeTestCopy({ sourceRoot: source.root, root: used, key, binding: { bot: testBot, chat: operator }, now: start }))
    .toThrow('copy root is not new');
  const copyRoot = join(source.directory, 'copy');
  makeTestCopy({ sourceRoot: source.root, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now: start });
  expect(() => makeTestCopy({ sourceRoot: copyRoot, root: join(source.directory, 'copy2'), key, binding: { bot: '23456789', chat: operator }, now: start }))
    .toThrow('test copy refused');
});

const launch = (root: string, bot: string, chat: string, extra: string[] = []) => spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
  'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', bot, '--chat-id', chat, '--operator-sender-id', operator,
  '--grant-reference', genesis.grant, '--configuration-digest', genesis.configurationDigest, '--expires-at', String(genesis.expires),
  '--max-calls', '100', '--max-replies', '60', '--max-turns', '60', ...extra],
{ cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env: { ...process.env,
  INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex'),
  INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:9', INSTAR_CONVERSATION_OWNERS: join(root, '..', 'owners') } });
const refusal = (root: string) => readFileSync(join(root, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).at(-1).refused;

it('the genesis check still refuses every mismatched plain launch, on the source and on the copy', async () => {
  const source = await sourceRoot();
  const copyRoot = join(source.directory, 'copy');
  makeTestCopy({ sourceRoot: source.root, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now: start });
  // The source keeps refusing the test bot and chat, exactly as before there were copies.
  expect(launch(source.root, testBot, group, ['--forum', 'true']).status).toBe(1);
  expect(refusal(source.root)).toBe('preview: bot-id differs from journal');
  expect(launch(source.root, sourceBot, operator, ['--forum', 'true']).status).toBe(1);
  expect(refusal(source.root)).toBe('preview: chat-id differs from journal');
  // The copy refuses the source's bot, group and forum mode.
  expect(launch(copyRoot, sourceBot, operator).status).toBe(1);
  expect(refusal(copyRoot)).toBe('preview: bot-id differs from journal');
  expect(launch(copyRoot, testBot, group).status).toBe(1);
  expect(refusal(copyRoot)).toBe('preview: chat-id differs from journal');
  expect(launch(copyRoot, testBot, operator, ['--forum', 'true']).status).toBe(1);
  expect(refusal(copyRoot)).toContain('forum mode differs from journal');
});

it('the test-copy command makes the copy from the command line, reading the source only', async () => {
  const source = await sourceRoot();
  const before = digestOf(source.root), copyRoot = join(source.directory, 'cli-copy');
  const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'test-copy', '--source-root', source.root, '--root', copyRoot,
    '--bot-id', testBot, '--chat-id', operator], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
  expect(run.status, run.stderr).toBe(0);
  const report = JSON.parse(run.stdout);
  expect(report).toMatchObject({ testCopy: { root: copyRoot, source: source.root, bot: testBot, chat: operator, copiedRequests: 1 } });
  expect(digestOf(source.root)).toEqual(before);
  const refused = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'test-copy', '--source-root', source.root, '--root', copyRoot,
    '--bot-id', testBot, '--chat-id', operator], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
  expect(refused.status).toBe(1);
  expect(refused.stderr).toContain('test copy: copy root is not new');
});

// The real launcher on the copy: the copy's launch line is the test room's (test bot, operator's private chat, the
// room's own login profile), and a reminder copied from a forum topic of the source fires into the test chat only.
it('launches the copy on the test bot and fires a copied reminder only into the test chat', async () => {
  const { spawn } = await import('node:child_process');
  const { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY, OPERATOR } = await import('./successive-fixture.js');
  const world = successiveWorld(), trial = world.state().read().trial;
  const sourceRoot = join(world.directory, 'source-group'), copyRoot = join(world.directory, 'copy');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates, '[]');
  const due = Math.floor(Date.now() / 3600_000) * 3600_000 - 3600_000, at = due - 3 * 3600_000;
  const part = (type: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(due).find(item => item.type === type)!.value;
  const when = `${part('month')} ${part('day')} at ${part('hour')}:00 ${part('dayPeriod').toLowerCase()}`;
  const ask = `remind me ${when} to call Priya`, chat = `-100${String(OPERATOR)}`;
  let journal = openPreviewJournal(join(sourceRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test',
    bot: sourceBot, chat, operator: String(OPERATOR), forum: true, grant: trial.id, configurationDigest: trial.configurationDigest,
    expires: trial.expiresAt, maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => at, stopped: () => false, timeZone: 'America/Los_Angeles', origin: 'test',
    groupDisclosure: async () => true, checkOutbound: () => {}, send: async () => 100,
    model: async () => JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: ask, when, remind: true }] }) });
  worker.intake([{ update_id: 7, message: { message_id: 7, message_thread_id: 9, chat: { id: Number(chat), type: 'supergroup', is_forum: true },
    from: { id: OPERATOR }, text: ask, date: Math.floor(at / 1000) } }]);
  await worker.drain();
  expect(journal.view.dated).toMatchObject([{ remind: true }]);
  journal.close();
  makeTestCopy({ sourceRoot, root: copyRoot, key: OFFLINE_STORAGE_KEY, binding: { bot: testBot, chat: String(OPERATOR) }, now: at + 60000 });
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
    });
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      '--loader', './tests/preview/model-failure-loader.mjs', 'tests/preview/journal-agent.mjs', 'run', '--root', copyRoot,
      '--bot-id', testBot, '--chat-id', String(OPERATOR), '--operator-sender-id', String(OPERATOR), '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '2', '--max-poll-seconds', '1',
      '--conversation-owners', join(world.directory, 'owners')],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env: { ...process.env,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_SIMULATE_UNKNOWN_ANSWER: '1', INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` } });
    expect(run.status, run.stderr).toBe(0);
    const sends = readFileSync(`${log}.sends`, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    expect(sends.filter(body => body.text.includes('You asked on'))).toHaveLength(1);
    expect(sends.find(body => body.text.includes('You asked on')).text).toContain('call Priya');
    expect(sends.every(body => body.chat_id === String(OPERATOR) && body.message_thread_id === undefined)).toBe(true);
    // The source is untouched by the copy's run: its reminder was never fired there.
    journal = openPreviewJournal(join(sourceRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
    try { expect(journal.view.order.filter(turn => turn.requestedAction)).toEqual([]); } finally { journal.close(); }
  } finally { endpoint.kill('SIGTERM'); }
}, 30000);
