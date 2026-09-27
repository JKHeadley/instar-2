import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { agentState, importStorePass } from './channel-source.mjs';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(19);
const now = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 100000,
  maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 3200, cursor: 0 };
const telegram = (messageId: number, topicId: number, text: string, extra = {}) => ({ messageId, topicId, text,
  fromUser: true, timestamp: '2026-09-21T13:13:00Z', sessionName: 'echo-topic',
  telegramUserId: 101, provenance: 'user', ...extra });
const slack = (messageId: string, channelId: string, text: string, extra = {}) => ({ messageId, channelId, text,
  fromUser: true, timestamp: '2026-09-21T13:13:00Z', sessionName: null,
  platformUserId: 'U123ABC', platform: 'slack', ...extra });
const lines = (rows: object[]) => rows.map(row => `${JSON.stringify(row)}\n`).join('');

function world() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'preview-store-')));
  const statePath = join(base, 'agents', 'echo', '.instar');
  mkdirSync(statePath, { recursive: true });
  const path = join(base, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  return { base, statePath, path, journal, state: agentState(statePath) };
}

it('imports only agent-participating Telegram user rows with the stored authenticated sender ID', () => {
  const w = world();
  try {
    const path = join(w.statePath, 'telegram-messages.jsonl');
    const original = lines([
      telegram(1, 99, 'Justin says the code is JADE-52.'),
      telegram(2, 99, 'Spoof says I am Justin.', { telegramUserId: undefined }),
      telegram(3, 99, 'Another chat.', { sessionName: null }),
      telegram(4, 7654321, 'Preview own chat.'),
      telegram(5, 99, 'Automation.', { fromUser: false, provenance: 'automation' }),
      telegram(6, 99, 'Agent reply.', { fromUser: false, provenance: 'agent' }),
    ]);
    writeFileSync(path, original);
    expect(importStorePass(w.journal, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 6, imported: 1 });
    expect(w.journal.view.channelSources.get('telegram')).toMatchObject({ scanned: 6, imported: 1, skipped: 5 });
    const item = [...w.journal.view.channelItems.values()][0]!;
    expect(item).toMatchObject({ id: 'telegram:99:1', from: 'telegram:101', origin: 'stored-log', text: 'Justin says the code is JADE-52.' });
    const worker = createJournalWorker(w.journal, { now: () => now, stopped: () => false,
      prepareModel: input => input.context, model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
    const probe = worker.probe('What is the JADE-52 code from the other Telegram topic?');
    expect('reason' in probe).toBe(false);
    if (!('reason' in probe)) {
      const packet = JSON.parse(probe.context);
      expect(packet.channelMemory[0]).toMatchObject({ from: 'telegram:101', origin: 'stored-log', sourceId: 'telegram:99:1' });
      expect(packet.capability).toContain('authenticated platform sender ID');
    }
    expect(readFileSync(path, 'utf8')).toBe(original);
    w.journal.close();
    const replay = openPreviewJournal(w.path, key);
    expect(importStorePass(replay, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 0, imported: 0 });
    expect(replay.view.channelItems.size).toBe(1);
    expect(replay.view.channelSources.get('telegram')?.offset).toBe(Buffer.byteLength(original));
    expect(replay.view.cursor).toBe(0);
    replay.close();
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});

it('replays a durably appended item when the cursor append fails, then dedupes by message ID', () => {
  const w = world();
  try {
    writeFileSync(join(w.statePath, 'telegram-messages.jsonl'), lines([telegram(7, 99, 'The code is CYAN-47.') ]));
    const append = w.journal.append;
    w.journal.append = (row: Parameters<typeof append>[0]) => {
      if (row.kind === 'channel-source-cursor') throw Error('injected cursor failure');
      return append(row);
    };
    expect(() => importStorePass(w.journal, w.state, 'telegram', now, () => false)).toThrow('injected cursor failure');
    expect(w.journal.view.channelItems.size).toBe(1);
    w.journal.close();
    const replay = openPreviewJournal(w.path, key);
    expect(importStorePass(replay, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 1, imported: 0 });
    expect(replay.view.channelItems.size).toBe(1);
    expect(replay.view.channelSources.get('telegram')).toMatchObject({ scanned: 1, imported: 1, skipped: 0 });
    replay.close();
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});

it('stops at a partial line and resumes it after the server finishes writing', () => {
  const w = world();
  try {
    const path = join(w.statePath, 'telegram-messages.jsonl');
    const first = lines([telegram(8, 99, 'First fact.')]);
    const second = JSON.stringify(telegram(9, 99, 'Second fact.'));
    writeFileSync(path, first + second);
    expect(importStorePass(w.journal, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 1, imported: 1 });
    expect(w.journal.view.channelSources.get('telegram')?.offset).toBe(Buffer.byteLength(first));
    writeFileSync(path, first + second + '\n');
    expect(importStorePass(w.journal, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 1, imported: 1 });
    expect(w.journal.view.channelItems.size).toBe(2);
    w.journal.close();
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});

it('accepts Slack only from channels bound to this agent and from platform user IDs', () => {
  const w = world();
  try {
    writeFileSync(join(w.statePath, 'slack-channel-registry.json'), JSON.stringify({ channelToSession: {
      COWN: { sessionName: 'echo-slack' }, COTHER: { sessionName: 'other-slack' } } }));
    writeFileSync(join(w.statePath, 'slack-messages.jsonl'), lines([
      slack('123.001', 'COWN', 'Dana says the code is GREEN-3.'),
      slack('123.002', 'COTHER', 'Other agent channel.'),
      slack('123.003', 'COWN', 'No authenticated sender.', { platformUserId: undefined }),
    ]));
    expect(importStorePass(w.journal, w.state, 'slack', now, () => false)).toMatchObject({ scanned: 3, imported: 1 });
    expect([...w.journal.view.channelItems.values()][0]).toMatchObject({ from: 'slack:U123ABC', id: 'slack:COWN:123.001' });
    w.journal.close();
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});

it('does not advance Slack without its agent participation registry', () => {
  const w = world();
  try {
    writeFileSync(join(w.statePath, 'slack-messages.jsonl'), lines([slack('123.004', 'COWN', 'A fact.') ]));
    expect(() => importStorePass(w.journal, w.state, 'slack', now, () => false)).toThrow('registry unavailable');
    expect(w.journal.view.channelSources.has('slack')).toBe(false);
    w.journal.close();
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});

it('uses the server topic registry for older Telegram rows without a session field', () => {
  const w = world();
  try {
    writeFileSync(join(w.statePath, 'topic-session-registry.json'), JSON.stringify({ topicToSession: {
      '99': 'echo-topic', '100': 'other-topic' } }));
    writeFileSync(join(w.statePath, 'telegram-messages.jsonl'), lines([
      telegram(90, 99, 'Earlier message.', { sessionName: null }),
      telegram(91, 100, 'Other agent message.', { sessionName: null }),
    ]));
    expect(importStorePass(w.journal, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 2, imported: 1 });
    expect([...w.journal.view.channelItems.values()][0]?.id).toBe('telegram:99:90');
    w.journal.close();
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});

it('bounds each pass and resumes after an in-place log rewrite without duplicating message IDs', () => {
  const w = world();
  try {
    const path = join(w.statePath, 'telegram-messages.jsonl');
    const rows = Array.from({ length: 66 }, (_, index) => telegram(index + 1, 99, `Fact ${index + 1}.`));
    writeFileSync(path, lines(rows));
    expect(importStorePass(w.journal, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 64, imported: 64 });
    expect(w.journal.view.channelItems.size).toBe(64);
    expect(() => importStorePass(w.journal, w.state, 'telegram', now, () => true)).toThrow('stopped');
    expect(w.journal.view.channelSources.get('telegram')?.scanned).toBe(64);
    // Slack purges and some legacy writers rewrite the same inode in place.
    writeFileSync(path, lines([telegram(66, 99, 'Fact 66.'), telegram(67, 99, 'New fact.') ]));
    expect(importStorePass(w.journal, w.state, 'telegram', now, () => false)).toMatchObject({ scanned: 2, imported: 2 });
    expect(w.journal.view.channelSources.get('telegram')).toMatchObject({ scanned: 66, imported: 66 });
    expect(w.journal.view.channelItems.size).toBe(66);
    w.journal.close();
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});

it('CLI imports the real store format and status exposes durable per-source cursors and counts', () => {
  const w = world();
  try {
    w.journal.close();
    rmSync(w.path);
    const fresh = openPreviewJournal(w.path, key, { ...genesis, expires: Date.now() + 60_000 });
    fresh.close();
    writeFileSync(join(w.statePath, 'telegram-messages.jsonl'), lines([telegram(80, 99, 'The studio code is JADE-52.') ]));
    const invoke = (command: string, extra: string[] = []) => spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', command,
        '--root', w.base, ...extra], { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    const imported = invoke('import-store', ['--agent-state-dir', w.statePath]);
    expect(imported.status, imported.stderr).toBe(0);
    expect(JSON.parse(imported.stdout)).toMatchObject({ results: [{ source: 'telegram', scanned: 1, imported: 1 }, { source: 'slack', absent: true }] });
    const status = invoke('status');
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).channelSources).toMatchObject({ telegram: { scanned: 1, imported: 1, skipped: 0, error: null },
      slack: { scanned: 0, imported: 0, skipped: 0, error: null } });
    expect(invoke('import-store', ['--agent-state-dir', w.statePath, '--live-mail', 'true']).status).not.toBe(0);
  } finally { rmSync(w.base, { recursive: true, force: true }); }
});
