import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createJournalWorker, openPreviewJournal, openRequests } from './journal-test-worker.js';
import { authority, key, records, scope, now, sealKey } from './group-carry-fixture.js';
import { groupCarryPacket } from './group-carry.js';
import { createRelationshipEmitter, emitRelationshipChanges } from './relationship-emitter.js';
import { resolveGroupDisclosure } from './group-disclosure.js';
import { carryOrigin } from './group-carry.js';

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

// Carryover row 40: the shipped refresh-group command applies the predecessor's relationship emits after the carry.
it.skipIf(process.platform !== 'darwin')('the shipped refresh-group command applies the predecessor\'s emits under the grant and the HTTP-verified audience, once, and refuses before a carry or with a new member', async () => {
  const root = mkdtempSync(join(tmpdir(), 'refresh-cli-')), sourceRoot = join(root, 'private'), destinationRoot = join(root, 'group');
  mkdirSync(sourceRoot); mkdirSync(destinationRoot);
  const sourcePath = join(sourceRoot, 'journal.encrypted'), destinationPath = join(destinationRoot, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, origin: 'test' as const, bot: scope.bot, operator: scope.operator, chat: scope.operator,
    grant: 'TEST-cli-refresh', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 409600, cursor: 0 };
  const carryScope = { ...scope, sourceRoot, destinationRoot }, origin = carryOrigin(carryScope);
  const permission = () => resolveGroupDisclosure(carryScope, authority({ scope: carryScope }), now, records, sealKey);
  /** The private root's people, as its summary pass would have recorded them (unit-level view rows), emitted into its journal. */
  const emitPeople = (city?: string, forgetAna = false) => {
    const source = openPreviewJournal(sourcePath, key);
    const [sam] = source.view.order.map(turn => turn.id) as [string];
    source.view.people.push({ name: 'Sam Ruiz', source: sam, quote: 'Sam Ruiz' }, { name: 'Ana Lima', source: sam, quote: 'Ana Lima' });
    source.view.personAttributes.push({ name: 'Sam Ruiz', attribute: 'job', value: 'engineer', status: 'current', source: sam, quote: 'engineer' });
    if (city) source.view.personAttributes.push({ name: 'Sam Ruiz', attribute: 'city', value: city, status: 'current', source: sam, quote: city });
    if (forgetAna) source.view.memory.push({ mode: 'forget', source: sam, trigger: sam, quote: 'Ana Lima' });
    const changes = emitRelationshipChanges(source, createRelationshipEmitter(source, { now: () => now + source.view.relationshipEmits.length * 1000 + 1, origin, permission }), now, origin);
    const seqs = source.view.relationshipEmits.map(emit => emit.seq); source.close(); return { changes, seqs };
  };
  const source = openPreviewJournal(sourcePath, key, genesis);
  const worker = createJournalWorker(source, { origin: 'test', now: () => now, stopped: () => false, timeZone: 'UTC',
    model: async () => 'Noted.', send: async () => 1, checkOutbound: () => {} });
  worker.intake([{ update_id: 1, message: { chat: { id: Number(scope.operator), type: 'private' },
    from: { id: Number(scope.operator) }, text: 'I met Sam Ruiz and Ana Lima at the arboretum; Sam is an engineer.' } }]); await worker.drain();
  source.close();
  expect(emitPeople()).toMatchObject({ changes: { puts: [expect.any(String), expect.any(String)], deletes: [] }, seqs: [1, 2] });
  openPreviewJournal(destinationPath, key, { ...genesis, chat: scope.chat, forum: true }).close();
  const authorityPath = join(root, 'authority.json');
  writeFileSync(authorityPath, JSON.stringify(authority({ scope: carryScope })));
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
  const run = (command: 'carry-group' | 'refresh-group') => promisify(execFile)(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', command, '--root', destinationRoot, ...(command === 'carry-group' ? ['--source-root', sourceRoot] : []),
    '--authority-record', authorityPath, '--operator-records', owner, '--bot-username', 'fixture_bot'], {
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex'),
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${address.port}` }, timeout: 30000, maxBuffer: 1024 * 1024 });
  try {
    // Before any carry there is no predecessor to refresh: refused, nothing written.
    const emptyGroup = readFileSync(destinationPath);
    await expect(run('refresh-group')).rejects.toThrow(/no predecessor carried/u);
    expect(readFileSync(destinationPath)).toEqual(emptyGroup);
    expect(JSON.parse((await run('carry-group')).stdout).result).toBe('carried');
    // The snapshot supersedes the two emits before it; the predecessor then changes: Sam moves to Porto, Ana is forgotten.
    expect(emitPeople('Porto', true)).toMatchObject({ changes: { puts: [expect.any(String)], deletes: [expect.any(String)] }, seqs: [1, 2, 3, 4] });
    const predecessorBytes = readFileSync(sourcePath);
    const refreshed = JSON.parse((await run('refresh-group')).stdout);
    expect(refreshed).toMatchObject({ predecessor: sourceRoot, from: 2, through: 4, remaining: 0, applied: 2, forged: 0, invalid: 0, refused: 0 });
    expect(readFileSync(sourcePath)).toEqual(predecessorBytes); // the predecessor is read, never written
    const size = readFileSync(destinationPath).length;
    expect(JSON.parse((await run('refresh-group')).stdout)).toMatchObject({ applied: 0, through: 4 });
    expect(readFileSync(destinationPath).length).toBe(size);
    count = 3; await expect(run('refresh-group')).rejects.toThrow(/operator-only audience refused/u);
    expect(readFileSync(destinationPath).length).toBe(size);
    expect(seen).toContain('getChatMember'); expect(seen).not.toContain('sendMessage');
    const replay = openPreviewJournal(destinationPath, key, undefined, undefined, true);
    expect(replay.view.groupCarryRefreshes.map(refresh => [refresh.from, refresh.through])).toEqual([[2, 4]]);
    const served = groupCarryPacket(replay.view.groupCarry!, 'Who is Sam?', now, 409600, replay.view).entries.filter(entry => entry.kind === 'person').map(entry => entry.text);
    expect(served).toHaveLength(1);
    expect(served[0]!).toContain('Name: Sam Ruiz'); expect(served[0]!).toContain('city: Porto'); expect(served[0]!).toContain(`origin="${origin}"`);
    expect(JSON.stringify(served)).not.toContain('Ana');
    replay.close();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true, force: true }); }
}, 150000);
