import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
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
  const worker = createJournalWorker(source, { origin: 'test', now: () => now, stopped: () => false,
    model: async () => 'Noted.', send: async () => 1, checkOutbound: () => {} });
  worker.intake([{ update_id: 1, message: { chat: { id: Number(scope.operator), type: 'private' },
    from: { id: Number(scope.operator) }, text: 'I keep the itinerary in the blue folder.' } }]); await worker.drain();
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
    const carried = await run(); expect(JSON.parse(carried.stdout).result).toBe('carried');
    const size = readFileSync(destinationPath).length;
    expect(JSON.parse((await run()).stdout).result).toBe('already-carried');
    expect(readFileSync(destinationPath).length).toBe(size);
    count = 3; await expect(run()).rejects.toThrow(/operator-only audience refused/u);
    expect(readFileSync(destinationPath).length).toBe(size);
    expect(readFileSync(sourcePath)).toEqual(untouched);
    expect(seen).toContain('getChatMember'); expect(seen).not.toContain('sendMessage');
    const replay = openPreviewJournal(destinationPath, key, undefined, undefined, true);
    expect(replay.view.groupCarry!.entries.some(e => e.text.includes('blue folder'))).toBe(true);
    expect(replay.view.groupCarry!.scope.sourceRoot).toBe(sourceRoot); replay.close();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true, force: true }); }
}, 90000);
