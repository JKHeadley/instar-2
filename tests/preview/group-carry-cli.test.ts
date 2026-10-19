import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createJournalWorker, openPreviewJournal, openRequests } from './journal-test-worker.js';
import { authority, key, records, scope, now } from './group-carry-fixture.js';

// The shipped process-limit shim is a macOS launch contract; the desk runs this whole CLI case there.
it.skipIf(process.platform !== 'darwin')('the shipped carry-group command reads actual HTTP membership through the confined bridge, carries once, and refuses a new member', async () => {
  const root = mkdtempSync(join(tmpdir(), 'carry-cli-')), sourceRoot = join(root, 'private'), destinationRoot = join(root, 'group');
  mkdirSync(sourceRoot); mkdirSync(destinationRoot);
  const sourcePath = join(sourceRoot, 'journal.encrypted'), destinationPath = join(destinationRoot, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, origin: 'test' as const, bot: scope.bot, operator: scope.operator, chat: scope.operator,
    grant: 'TEST-cli-carry', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 409600, cursor: 0 };
  const source = openPreviewJournal(sourcePath, key, genesis);
  const ask = 'remind me Friday at 9 am to call Priya';
  const worker = createJournalWorker(source, { origin: 'test', now: () => now, stopped: () => false, timeZone: 'UTC',
    model: async ({ question }) => question === ask
      ? JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: ask, when: 'Friday at 9 am', remind: true }] }) : 'Noted.',
    send: async () => 1, checkOutbound: () => {} });
  worker.intake([{ update_id: 1, message: { chat: { id: Number(scope.operator), type: 'private' },
    from: { id: Number(scope.operator) }, text: 'I keep the itinerary in the blue folder.' } }]); await worker.drain();
  worker.intake([{ update_id: 2, message: { chat: { id: Number(scope.operator), type: 'private' },
    from: { id: Number(scope.operator) }, text: ask, date: Math.floor(now / 1000) } }]); await worker.drain();
  expect(openRequests(source.view)).toHaveLength(1);
  source.close();
  openPreviewJournal(destinationPath, key, { ...genesis, chat: scope.chat, forum: true }).close();
  const untouched = readFileSync(sourcePath);
  const authorityPath = join(root, 'authority.json');
  writeFileSync(authorityPath, JSON.stringify(authority({ scope: { ...scope, sourceRoot, destinationRoot } })));
  const owner = join(root, 'operator'); mkdirSync(join(owner, 'state'), { recursive: true });
  writeFileSync(join(owner, 'telegram-messages.jsonl'), records.messages.map(r => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(owner, 'asp-classifications.jsonl'), records.provenance.map(r => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(owner, 'state', 'topic-operators.json'), JSON.stringify(records.bindings));
  let count = 2; const seen: string[] = [];
  const server = createServer(async (request, response) => {
    let bytes = ''; for await (const part of request) bytes += part;
    const body = JSON.parse(bytes), method = request.url!.split('/').at(-1)!; seen.push(method);
    const result = method === 'getChat' ? { id: Number(scope.chat), type: 'supergroup', is_forum: true }
      : method === 'getMe' ? { id: Number(scope.bot), is_bot: true, username: 'fixture_bot' }
        : method === 'getChatMemberCount' ? count
          : method === 'getChatMember' ? { status: 'member', user: { id: Number(body.user_id), is_bot: body.user_id === scope.bot } }
            : null;
    response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ ok: result !== null, result }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('listener unavailable');
  const run = () => promisify(execFile)(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'carry-group', '--root', destinationRoot, '--source-root', sourceRoot,
    '--authority-record', authorityPath, '--operator-records', owner, '--bot-username', 'fixture_bot'], {
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex'),
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${address.port}` }, timeout: 30000, maxBuffer: 1024 * 1024 });
  try {
    // A live private runner holds the predecessor's writer lease: the carry refuses and writes nothing to either root.
    const lease = join(sourceRoot, '.writer', '.boot-lease'); mkdirSync(lease, { recursive: true });
    writeFileSync(join(lease, 'owner.json'), JSON.stringify({ pid: process.pid, machine: 'preview-local-machine', nonce: 'live-private-runner' }));
    const emptyGroup = readFileSync(destinationPath);
    await expect(run()).rejects.toThrow(/preparation failed/u);
    expect(readFileSync(destinationPath)).toEqual(emptyGroup); expect(readFileSync(sourcePath)).toEqual(untouched);
    rmSync(lease, { recursive: true });
    const carried = await run(); expect(JSON.parse(carried.stdout).result).toBe('carried');
    const size = readFileSync(destinationPath).length;
    expect(JSON.parse((await run()).stdout).result).toBe('already-carried');
    expect(readFileSync(destinationPath).length).toBe(size);
    count = 3; await expect(run()).rejects.toThrow(/operator-only audience refused/u);
    expect(readFileSync(destinationPath).length).toBe(size);
    // The predecessor keeps every earlier byte and gains exactly its one transfer record.
    const after = readFileSync(sourcePath);
    expect(after.subarray(0, untouched.length)).toEqual(untouched); expect(after.length).toBeGreaterThan(untouched.length);
    expect(seen).toContain('getChatMember'); expect(seen).not.toContain('sendMessage');
    const replay = openPreviewJournal(destinationPath, key, undefined, undefined, true);
    expect(replay.view.groupCarry!.entries.some(e => e.text.includes('blue folder'))).toBe(true);
    expect(replay.view.groupCarry!.scope.sourceRoot).toBe(sourceRoot);
    expect(openRequests(replay.view).map(item => item.quote)).toEqual([ask]); replay.close();
    const predecessor = openPreviewJournal(sourcePath, key, undefined, undefined, true);
    expect(openRequests(predecessor.view)).toEqual([]);
    expect(predecessor.view.requestTransfer).toMatchObject({ destinationRoot, chat: scope.chat }); predecessor.close();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true, force: true }); }
}, 90000);

it.each(['production', 'test'] as const)('checks %s origin before taking the carry writer lease', async origin => {
  const root = mkdtempSync(join(tmpdir(), 'carry-origin-')), path = join(root, 'journal.encrypted');
  openPreviewJournal(path, key, { kind: 'genesis', ...(origin === 'test' ? { origin } : {}), bot: scope.bot, operator: scope.operator, chat: scope.chat, forum: true,
    grant: 'TEST-origin-refusal', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 409600, cursor: 0 }).close();
  const before = readFileSync(path);
  try {
    await expect(promisify(execFile)(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'carry-group', '--root', root], {
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex'),
        INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:1' }, timeout: 30000,
    })).rejects.toThrow();
    expect(readFileSync(path)).toEqual(before);
    // Matching TEST origin reaches the writer, then refuses the deliberately absent source/grant.
    // Production origin must refuse earlier, so it cannot repair a tail or touch the writer files.
    expect(existsSync(join(root, '.writer'))).toBe(origin === 'test');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 40000);
