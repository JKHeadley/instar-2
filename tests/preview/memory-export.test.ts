import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { memoryReport } from './memory-export.js';
import { openPreviewJournal, type JournalView, type MemoryChange } from './journal.js';

const key = new Uint8Array(32).fill(12);
const at = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 100000,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('shows sourced active categories while withholding forgotten content and credentials', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'memory-export-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const intake = (id: number, text: string) => journal.append({ kind: 'intake', id: `telegram:${id}`, update: id,
      text, raw: JSON.stringify(update(id, text)), accepted: true, cursor: id + 1, at: at + id });
    intake(1, 'Sam said the locker code is 3310.');
    intake(2, 'Actually the locker code is 4412.');
    intake(3, 'Forget the locker code is 4412.');
    intake(4, 'Please use concise replies.');
    intake(5, 'My notebook is blue.');
    intake(6, 'Actually my notebook is green.');
    journal.view.people.push({ name: 'Sam', source: 'telegram:1', quote: 'Sam said the locker code is 3310.' });
    journal.view.memory.push({ mode: 'correct', source: 'telegram:1', quote: 'the locker code is 3310',
      trigger: 'telegram:2', replacement: 'the locker code is 4412' });
    journal.view.memory.push({ mode: 'forget', source: 'telegram:2', quote: 'the locker code is 4412', trigger: 'telegram:3' });
    journal.view.memory.push({ mode: 'correct', source: 'telegram:5', quote: 'notebook is blue',
      trigger: 'telegram:6', replacement: 'notebook is green' });
    const withPreference = journal.view.memory as (MemoryChange | { mode: 'prefer'; source: string; quote: string; trigger: string })[];
    withPreference.push({ mode: 'prefer', source: 'telegram:4', quote: 'Please use concise replies.', trigger: 'telegram:4' });
    Object.assign(journal.view, { dated: [{ source: 'telegram:4', quote: 'Review the design tomorrow', when: 'tomorrow',
      day: '2026-09-22', zone: 'UTC' }] });
    const imported = { source: 'conversation' as const, account: 'agent@example.test', id: 'm-1', from: 'sam@example.test',
      at, text: 'Imported note: the locker code is 3310; password: abcdefghijklmnop' };
    journal.view.channelItems.set(JSON.stringify([imported.source, imported.account, imported.id]), imported);
    const output = memoryReport(journal.view);
    expect(output).toContain('## People notes');
    expect(output).toContain('## Forgotten markers (1)');
    expect(output).toContain('## Corrections (1)');
    expect(output).toContain('## Dated items (1)');
    expect(output).toContain('## Preferences (1)');
    expect(output).toContain('## Channel items (1)');
    expect(output).toContain('Telegram update 4');
    expect(output).toContain('conversation m-1');
    expect(output).toContain('Review the design tomorrow');
    expect(output).toContain('notebook is green');
    expect(output).not.toContain('notebook is blue');
    expect(output).toContain('Please use concise replies.');
    expect(output).not.toContain('3310');
    expect(output).not.toContain('4412');
    expect(output).not.toContain('abcdefghijklmnop');
    expect(output).toContain('redacted credential');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('exports through the read-only CLI without changing journal bytes or making a root', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'memory-export-cli-')));
  try {
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis);
    journal.append({ kind: 'intake', id: 'telegram:1', update: 1, text: 'A harmless note',
      raw: JSON.stringify(update(1, 'A harmless note')), accepted: true, cursor: 2, at });
    journal.close();
    const before = readFileSync(path), size = statSync(path).size;
    const call = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'export-memory', '--root', root], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(call.status, call.stderr).toBe(0);
    expect(call.stdout).toContain('# Preview memory review');
    expect(call.stdout).toContain('## Preferences (0)');
    expect(call.stdout).toContain('## Dated items (0)');
    expect(Buffer.byteLength(call.stdout)).toBeLessThanOrEqual(16384);
    expect(statSync(path).size).toBe(size);
    expect(readFileSync(path)).toEqual(before);
    const absent = join(root, 'absent');
    const missing = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'export-memory', '--root', absent], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(missing.status).not.toBe(0);
    expect(missing.stdout).toBe('');
    expect(existsSync(absent)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('replays redaction, restored corrections, and exact forgetting through the CLI', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'memory-export-replay-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const messages = [
      'My color is blue.', 'My color is green.', 'My color is blue.',
      'I label this field password.', 'Ada shared password: abcdefghijklmnop',
      'Forget I label this field password.', 'I use Rust.', 'Forget I use Rust.',
      'Ada says Trust matters.', 'My shape is round.', 'My shape is square.', 'Forget my shape.',
    ];
    messages.forEach((message, index) => journal.append({ kind: 'intake', id: `telegram:${index + 1}`,
      update: index + 1, text: message, raw: JSON.stringify(update(index + 1, message)),
      accepted: true, cursor: index + 2, at: at + index + 1 }));
    journal.append({ kind: 'summary-reserve', through: 12, at });
    journal.append({ kind: 'summary', through: 12, text: 'Recorded memory decisions.', at,
      people: [
        { name: 'Ada', source: 'telegram:5', quote: messages[4]! },
        { name: 'Operator', source: 'telegram:7', quote: messages[6]! },
        { name: 'Ada', source: 'telegram:9', quote: messages[8]! },
      ],
      memory: [
        { mode: 'correct', source: 'telegram:1', quote: 'My color is blue.', trigger: 'telegram:2', replacement: 'My color is green.' },
        { mode: 'correct', source: 'telegram:2', quote: 'My color is green.', trigger: 'telegram:3', replacement: 'My color is blue.' },
        { mode: 'forget', source: 'telegram:4', quote: 'I label this field password.', trigger: 'telegram:6' },
        { mode: 'forget', source: 'telegram:7', quote: 'I use Rust.', trigger: 'telegram:8' },
        { mode: 'correct', source: 'telegram:10', quote: 'My shape is round.', trigger: 'telegram:11', replacement: 'My shape is square.' },
        { mode: 'forget', source: 'telegram:11', quote: 'shape is square', trigger: 'telegram:12' },
      ] });
    journal.close();
    const call = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'export-memory', '--root', root], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(call.status, call.stderr).toBe(0);
    expect(call.stdout).toContain('## Corrections (1)');
    expect(call.stdout).toContain('My color is blue.');
    expect(call.stdout).not.toContain('My color is green.');
    expect(call.stdout).toContain('Ada shared password: \\[redacted credential\\]');
    expect(call.stdout).not.toContain('abcdefghijklmnop');
    expect(call.stdout).toContain('Ada says Trust matters.');
    expect(call.stdout).not.toContain('T[withheld]');
    expect(call.stdout).not.toContain('I use Rust.');
    expect(call.stdout).not.toContain('My shape is square.');
    expect(call.stdout).toContain('## Forgotten markers (3)');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20_000);

it('bounds a large import and reports omissions', () => {
  const view = { people: [], memory: [], dated: [], turns: new Map(), channelItems: new Map() } as unknown as JournalView;
  for (let i = 0; i < 2000; i++) {
    const item = { source: 'conversation' as const, account: 'agent@example.test', id: `m-${i}`, from: 'sender@example.test',
      at, text: `Message ${i} ${'word '.repeat(100)}` };
    view.channelItems.set(JSON.stringify([item.source, item.account, item.id]), item);
  }
  const output = memoryReport(view);
  expect(Buffer.byteLength(output)).toBeLessThanOrEqual(16384);
  expect(output).toContain('## Channel items (2000)');
  expect(output).toContain('omitted.');
  expect(output).toContain('m-1999');
  expect(output).not.toContain('m-0 ');
});

it('shows only active preferences and dated items after a targeted retirement', () => {
  const view = { people: [], memory: [
    { mode: 'prefer', source: 'first', quote: 'Use blue headings.', trigger: 'first' },
    { mode: 'prefer', source: 'second', quote: 'Use short paragraphs.', trigger: 'second' },
    { mode: 'forget', source: 'first', quote: 'Use blue headings.', trigger: 'third' },
  ], dated: [
    { source: 'first', quote: 'Use blue headings.', when: 'tomorrow', zone: 'UTC' },
    { source: 'second', quote: 'Review the outline tomorrow.', when: 'tomorrow', zone: 'UTC' },
  ], turns: new Map(), channelItems: new Map() } as unknown as JournalView;
  const output = memoryReport(view);
  expect(output).toContain('## Preferences (1)');
  expect(output).toContain('Use short paragraphs.');
  expect(output).toContain('## Dated items (1)');
  expect(output).toContain('Review the outline tomorrow.');
  expect(output).toContain('## Forgotten markers (1)');
  expect(output).not.toContain('blue');
});
