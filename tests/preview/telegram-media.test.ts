import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { telegramInboundMedia, createTelegramMediaCustody, MEDIA_MAX_BYTES, MEDIA_STORE_MAX_BYTES, journalMediaSource } from './telegram-media.js';
import { createMediaAdmission, DEFAULT_EFFECT_POLICY, MEDIA_OPERATION } from './media-admission.js';
import { createSecretCustody } from './secret-custody.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

type Update = { _fixture: string; update_id: number; message: { from: { id: number }; chat: { id: number; type: string; is_forum: boolean };
  message_thread_id: number; photo?: unknown; voice?: unknown; audio?: unknown; document?: unknown; caption?: string } };
const fixture = (kind: string): Update => JSON.parse(readFileSync(new URL(`./fixtures/telegram-media/${kind}.json`, import.meta.url), 'utf8')) as Update;
const key = new Uint8Array(32).fill(19), token = `123456789:${'synthetic_'.repeat(4)}`;
const genesis = { kind: 'genesis' as const, bot: '123456789', chat: '-1004367556355', operator: '7812716706', forum: true as const,
  origin: 'test' as const, grant: 'grant:media-test', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 };
const withRoot = async (run: (root: string) => Promise<void>) => {
  const root = mkdtempSync(join(tmpdir(), 'telegram-media-'));
  try { await run(root); } finally { rmSync(root, { recursive: true, force: true }); }
};
// Synthetic admission source; the integration below also checks retained intake at dispatch.
const admissionFor = (root: string, overrides: Partial<Parameters<typeof createMediaAdmission>[0]> = {}) => createMediaAdmission({
  root, incarnation: 'test:media', now: () => 1000, monotonic: () => 100, stopped: () => false,
  source: () => ({ grant: genesis.grant, account: genesis.bot, conversation: `${genesis.chat}:3`, intakeDigest: 'sha256:synthetic' }),
  claimed: () => false, retainClaim: () => {}, policy: () => DEFAULT_EFFECT_POLICY, ...overrides });
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
function transport(fileId: string, bytes: Buffer, urls: string[] = []): typeof fetch {
  return async (input, options) => {
    const url = String(input); urls.push(url);
    expect(options?.redirect).toBe('error'); expect(options?.signal).toBeDefined();
    if (url.endsWith('/getFile')) {
      expect(JSON.parse(String(options?.body))).toEqual({ file_id: fileId });
      return response({ ok: true, result: { file_id: fileId, file_path: 'documents/file.bin', file_size: bytes.length } });
    }
    return new Response(new Uint8Array(bytes));
  };
}

it.each(['photo', 'voice', 'document'])('observer #207 %s fixture reaches the model after durable encrypted custody, once across restart', kind => withRoot(async root => {
  const update = fixture(kind), media = telegramInboundMedia(update.message)!;
  expect(update._fixture).toContain('not recorded'); expect(media.kind).toBe(kind);
  if (kind === 'photo') expect(media.fileId).toBe('AgACAgEAAxkBAAIB-large');
  const secret = `ghp_${'A7'.repeat(18)}`, bytes = Buffer.alloc(media.size!, 42); bytes.write(secret);
  const urls: string[] = [], physical = transport(media.fileId!, bytes, urls);
  const custody = createTelegramMediaCustody(root, key, { admission: admissionFor(root, {
    source: (source, media) => journalMediaSource(journal.view, source, media),
    claimed: id => journal.view.turns.get(id)?.mediaClaim !== undefined,
    retainClaim: (id, digest) => journal.append({ kind: 'media-claim', id, digest, at: 1000 }) }), token: () => token, stopped: () => false,
    fetch: async (url, options) => {
      // The consumer opens the actual journal at the download boundary: EDITED is not DURABLE.
      const reader = openPreviewJournal(join(root, 'journal.encrypted'), key, undefined, undefined, true);
      expect(reader.view.cursor).toBe(update.update_id + 1);
      expect(reader.view.order[0]?.raw).toContain(media.fileId);
      expect(reader.view.order[0]?.mediaClaim).toMatch(/^[a-f0-9]{64}$/u); reader.close();
      const directories = readdirSync(join(root, 'media-claims'));
      expect(directories).toHaveLength(1);
      const facts = JSON.parse(readFileSync(join(root, 'media-claims', directories[0]!, 'facts.json'), 'utf8')) as {
        body: { request?: string; record?: { type: string; state?: string; digest?: string } } }[];
      const request = JSON.parse(facts.find(row => row.body.request)!.body.request!) as { plan: Record<string, unknown> };
      expect(request.plan).toMatchObject({ operation: 'fetch-inbound-media', source: journal.view.order[0]!.id,
        account: genesis.bot, conversation: `${genesis.chat}:3`, maxBytes: MEDIA_MAX_BYTES, requests: 2 });
      expect(facts.filter(row => row.body.record?.type === 'AdmissionReservation').at(-1)?.body.record?.state).toBe('consumed');
      return physical(url, options);
    } });
  let journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const questions: string[] = [], sends: number[] = [];
  const worker = () => createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false, media: custody,
    secrets: createSecretCustody(root, key, () => 1000),
    model: async input => { questions.push(input.question); return 'I received it.'; }, checkOutbound: () => {},
    send: async input => { expect(input.thread).toBe(3); sends.push(input.update); return 99; } });
  const first = worker(); first.intake([update]); expect(urls).toHaveLength(0); await first.drain();
  expect(urls).toHaveLength(2); expect(questions).toHaveLength(1); expect(sends).toEqual([update.update_id]);
  expect(questions[0]).toContain(media.name); expect(questions[0]).toContain(`${media.size} bytes`);
  expect(questions[0]).toContain('saved in encrypted custody'); expect(questions[0]).not.toContain(secret);
  if (update.message.caption) expect(questions[0]).toContain(update.message.caption);
  if (kind === 'photo') expect(questions[0]).toContain('cannot see');
  if (kind === 'voice') expect(questions[0]).toContain('cannot listen');
  const saved = journal.view.order[0]!.media!; expect(custody.verify(saved)).toBe(true);
  for (const file of readdirSync(join(root, 'media'))) {
    const sealed = readFileSync(join(root, 'media', file));
    expect(sealed.includes(secret)).toBe(false); expect(sealed.includes(token)).toBe(false); expect(sealed.includes(media.fileId!)).toBe(false);
  }
  journal.close(); journal = openPreviewJournal(join(root, 'journal.encrypted'), key);
  const second = worker(); second.intake([update]); await second.drain();
  expect(questions).toHaveLength(1); expect(urls).toHaveLength(2); expect(sends).toHaveLength(1);
  expect(journal.view.order[0]?.media).toEqual(saved);
  if (saved.state === 'stored') {
    writeFileSync(join(root, 'media', `${saved.reference}.sealed`), 'corrupted');
    expect(custody.verify(saved)).toBe(false);
  }
  journal.close();
}));

it('audio, malformed metadata and unsupported media stay distinguishable', () => {
  expect(telegramInboundMedia({ audio: { file_id: 'audio-id', file_name: 'talk.mp3', file_size: 20 } })).toEqual({
    kind: 'audio', fileId: 'audio-id', name: 'talk.mp3', size: 20 });
  expect(telegramInboundMedia({ voice: { file_id: '../secret', file_size: -1 } })).toMatchObject({ kind: 'voice', fileId: null, size: null });
  expect(telegramInboundMedia({ photo: [] })).toMatchObject({ kind: 'photo', fileId: null });
  expect(telegramInboundMedia({ sticker: {} })).toBeNull();
});

it('wrong sender, chat, sender-chat and a service event cause no file fetch or model call', () => withRoot(async root => {
  const original = fixture('document');
  const foreign = [
    { ...original, update_id: 1, message: { ...original.message, from: { id: 1 } } },
    { ...original, update_id: 2, message: { ...original.message, chat: { ...original.message.chat, id: -1001 } } },
    { ...original, update_id: 3, message: { ...original.message, sender_chat: { id: Number(genesis.chat) } } },
    { update_id: 4, message: { from: original.message.from, chat: original.message.chat, pinned_message: {} } },
  ];
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let calls = 0;
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false,
    media: { receive: async () => { calls++; return { state: 'failed' }; } }, model: async () => { calls++; return 'no'; },
    send: async () => { calls++; return 1; }, checkOutbound: () => {} });
  worker.intake(foreign); await worker.drain();
  expect(journal.view.cursor).toBe(5); expect(journal.view.order.every(turn => !turn.accepted)).toBe(true); expect(calls).toBe(0);
  journal.close();
}));

it('file size boundaries, unknown size streaming, hostile paths and transport errors are bounded and secret-safe', () => withRoot(async root => {
  let calls = 0;
  const base = telegramInboundMedia(fixture('document').message)!;
  const reject = createTelegramMediaCustody(root, key, { admission: admissionFor(root), token: () => token, stopped: () => false,
    fetch: async () => { calls++; throw Error(`https://api.telegram.org/bot${token}`); } });
  expect(await reject.receive('too-big', { ...base, size: MEDIA_MAX_BYTES + 1 })).toEqual({ state: 'file-limit' });
  expect(await reject.receive('bad', { ...base, fileId: null })).toEqual({ state: 'malformed' });
  expect(calls).toBe(0); expect(await reject.receive('failure', base)).toEqual({ state: 'failed' }); expect(calls).toBe(1);
  const exact = createTelegramMediaCustody(root, key, { admission: admissionFor(root), token: () => token, stopped: () => false,
    fetch: transport(base.fileId!, Buffer.alloc(MEDIA_MAX_BYTES)) });
  const atLimit = await exact.receive('exact', { ...base, size: MEDIA_MAX_BYTES }); expect(atLimit.state).toBe('stored');
  expect(exact.verify(atLimit)).toBe(true);
  for (const filePath of ['../token', 'documents/../token', 'https://evil.invalid/steal', 'documents/%2e%2e/token']) {
    let requests = 0;
    const badPath = createTelegramMediaCustody(root, key, { admission: admissionFor(root), token: () => token, stopped: () => false,
      fetch: async () => { requests++; return response({ ok: true, result: { file_id: base.fileId, file_path: filePath } }); } });
    expect(await badPath.receive(filePath, base)).toEqual({ state: 'failed' }); expect(requests).toBe(1);
  }
  let requests = 0, cancelled = false;
  const streaming = createTelegramMediaCustody(root, key, { admission: admissionFor(root), token: () => token, stopped: () => false, fetch: async () => {
    if (++requests === 1) return response({ ok: true, result: { file_id: base.fileId, file_path: 'documents/file.bin' } });
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MEDIA_MAX_BYTES + 1)); },
      cancel() { cancelled = true; } }));
  } });
  expect(await streaming.receive('oversized-stream', { ...base, size: null })).toEqual({ state: 'failed' }); expect(cancelled).toBe(true);
  writeFileSync(join(root, 'media', 'capacity-test'), Buffer.alloc(MEDIA_STORE_MAX_BYTES));
  expect(await reject.receive('full', base)).toEqual({ state: 'store-limit' }); expect(calls).toBe(1);
}));

it('download recovery reuses the encrypted file after a crash before its journal disposition', () => withRoot(async root => {
  const media = telegramInboundMedia(fixture('document').message)!, urls: string[] = [];
  const custody = createTelegramMediaCustody(root, key, { admission: admissionFor(root), token: () => token, stopped: () => false,
    fetch: transport(media.fileId!, Buffer.alloc(media.size!), urls) });
  const first = await custody.receive('captured-turn', media);
  expect(first.state).toBe('stored'); expect(await custody.receive('captured-turn', media)).toEqual(first); expect(urls).toHaveLength(2);
  expect(await custody.receive('captured-turn', { ...media, fileId: 'different' })).toEqual({ state: 'failed' });
  expect(urls).toHaveLength(2);
}));

it('the shipped status command detects a missing media file without exposing bytes or credentials', () => withRoot(async root => {
  const update = fixture('document'), media = telegramInboundMedia(update.message)!;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const custody = createTelegramMediaCustody(root, key, { admission: admissionFor(root, {
    source: (source, media) => journalMediaSource(journal.view, source, media),
    claimed: id => journal.view.turns.get(id)?.mediaClaim !== undefined,
    retainClaim: (id, digest) => journal.append({ kind: 'media-claim', id, digest, at: 1000 }) }), token: () => token, stopped: () => false,
    fetch: transport(media.fileId!, Buffer.alloc(media.size!)) });
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false, media: custody,
    model: async () => 'Received.', send: async () => 1, checkOutbound: () => {} });
  worker.intake([update]); await worker.drain(); const result = journal.view.order[0]!.media!; journal.close();
  const status = () => {
    const child = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', root], { encoding: 'utf8', timeout: 30000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(child.status, child.stderr).toBe(0); expect(child.stdout).not.toContain(token);
    return JSON.parse(child.stdout) as { media: { stored: number; missing: number[] } };
  };
  const agreement = () => {
    const child = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'check-agreements', '--root', root, '--conversation-owners', join(root, 'owners')],
    { encoding: 'utf8', timeout: 30000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(child.status, child.stderr).toBe(0);
    return (JSON.parse(child.stdout) as { records: { id: string; agree: boolean | null }[] }).records
      .find(row => row.id === 'media-custody')!.agree;
  };
  expect(agreement()).toBe(true);
  const claimRoot = join(root, 'media-claims'), claimDir = join(claimRoot, result.state === 'stored' ? result.reference : 'invalid');
  const claimFile = join(claimDir, 'facts.json'), original = readFileSync(claimFile);
  // Parseable substitution, truncation and total directory loss are all detected
  // by the shipped consumer, while the attachment and original intake survive.
  for (const corrupt of ['[]', '{}', original.subarray(0, original.length - 1)]) {
    writeFileSync(claimFile, corrupt); expect(agreement()).toBe(false);
    expect(status().media).toMatchObject({ stored: 1, missing: [] });
    writeFileSync(claimFile, original); expect(agreement()).toBe(true);
  }
  rmSync(claimRoot, { recursive: true }); expect(agreement()).toBe(false);
  expect(existsSync(claimRoot)).toBe(false); // The detector must not recreate evidence.
  mkdirSync(claimDir, { recursive: true }); writeFileSync(claimFile, original);
  expect(agreement()).toBe(true);
  expect(status().media).toMatchObject({ stored: 1, missing: [] });
  if (result.state !== 'stored') throw Error('fixture failed');
  rmSync(join(root, 'media', `${result.reference}.sealed`));
  expect(status().media).toMatchObject({ stored: 1, missing: [update.update_id] });
  expect(agreement()).toBe(false);
}));

it.each(['cap', 'stop'])('%s prevents download while keeping the accepted turn', mode => withRoot(async root => {
  let stopped = mode === 'stop', calls = 0;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: mode === 'cap' ? 1 : 20 });
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => stopped,
    media: { receive: async () => { calls++; throw Error(token); } }, model: async () => { calls++; return 'seen'; },
    send: async () => 1, checkOutbound: () => {} });
  stopped = false;
  if (mode === 'cap') {
    worker.intake([{ update_id: 1, message: { from: { id: Number(genesis.operator) },
      chat: { id: Number(genesis.chat), type: 'supergroup', is_forum: true }, text: 'Hello' } }]);
    await worker.drain(); expect(calls).toBe(1); calls = 0;
  }
  worker.intake([fixture('voice')]); stopped = mode === 'stop';
  if (stopped) await expect(worker.drain()).rejects.toThrow('stopped'); else await worker.drain();
  expect(calls).toBe(0); expect(journal.view.order[0]?.accepted).toBe(true); journal.close();
}));

it('a failed host download is a durable plain-language result and still gets one answer', () => withRoot(async root => {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let question = '', sent = 0;
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false,
    media: { receive: async () => { throw Error(`https://api.telegram.org/bot${token}/getFile`); } },
    model: async input => { question = input.question; return 'I received your file, but could not save it.'; },
    send: async () => ++sent, checkOutbound: () => {} });
  worker.intake([fixture('document')]); await worker.drain(); await worker.drain();
  expect(journal.view.order[0]?.media).toEqual({ state: 'failed' }); expect(question).toContain('storage failed');
  expect(question).not.toContain(token); expect(sent).toBe(1); journal.close();
}));

it('an injected slow download aborts on stop without delaying intake or starting the model', () => withRoot(async root => {
  let stopped = false, began!: () => void, cancelled = false;
  const started = new Promise<void>(resolve => { began = resolve; });
  const custody = createTelegramMediaCustody(root, key, { admission: admissionFor(root), token: () => token, stopped: () => stopped,
    fetch: async (_url, options) => { began(); return await new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => { cancelled = true; reject(Error('aborted')); }, { once: true });
    }); } });
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let models = 0;
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => stopped, media: custody,
    model: async () => { models++; return 'seen'; }, send: async () => 1, checkOutbound: () => {} });
  worker.intake([fixture('photo')]); const draining = worker.drain(); await started; stopped = true;
  await expect(draining).rejects.toThrow('stopped'); expect(cancelled).toBe(true); expect(models).toBe(0);
  expect(journal.view.order[0]?.accepted).toBe(true); expect(journal.view.order[0]?.media).toBeUndefined(); journal.close();
}));

// Observer #106: exact recorded model/output bytes, under the explicitly
// synthetic media transport from #207. Empty context is not a delivery receipt.
const recorded = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(recorded.otherShapes.filter(row => ['delivered-reply', 'empty-reply-in-recorded-context'].includes(row.kind)))
('recorded $kind ($id) keeps the media intake and never sends an empty bubble', sample => withRoot(async root => {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const sends: string[] = []; let calls = 0;
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false,
    media: createTelegramMediaCustody(root, key, { token: () => token, stopped: () => false,
      admission: admissionFor(root, { source: (source, media) => journalMediaSource(journal.view, source, media),
        policy: () => ({ ...DEFAULT_EFFECT_POLICY, policySensitive: [MEDIA_OPERATION.effect] }) }),
      fetch: async () => { throw Error('refused recorded replay must not fetch'); } }),
    model: async input => { calls++; expect(input.question).toContain('Received document');
      expect(input.question).toContain('refused by operation admission'); return sample.raw; },
    send: async input => { sends.push(input.expectedText); return 1; }, checkOutbound: () => {} });
  worker.intake([fixture('document')]); await worker.drain();
  expect(calls).toBeGreaterThan(0); expect(journal.view.order[0]?.media).toEqual({ state: 'failed', reason: 'admission-refused' });
  expect(sends.every(text => text.trim().length > 0)).toBe(true);
  if (sample.kind === 'delivered-reply') expect(sends[0]).toBe(sample.raw.replace(/^PREVIEW — /u, ''));
  else expect(sample.raw).toBe('');
  journal.close();
}));

it.each(['missing', 'refused', 'revoked', 'unreadable'] as const)
('%s media admission makes zero requests, retains intake, and records an honest outcome', mode => withRoot(async root => {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let requests = 0, policyReads = 0, question = '';
  const denied = { ...DEFAULT_EFFECT_POLICY, policySensitive: [MEDIA_OPERATION.effect] };
  const admission = admissionFor(root, {
    source: (source, media) => journalMediaSource(journal.view, source, media),
    policy: () => {
      policyReads++;
      if (mode === 'unreadable') throw Error('policy unavailable');
      return mode === 'revoked' && policyReads === 1 ? DEFAULT_EFFECT_POLICY : denied;
    } });
  const custody = createTelegramMediaCustody(root, key, { token: () => token, stopped: () => false,
    ...(mode === 'missing' ? {} : { admission }), fetch: async () => { requests++; throw Error('must not fetch'); } });
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false, media: custody,
    model: async input => { question = input.question; return 'I received the message; the file download was refused.'; },
    send: async () => 1, checkOutbound: () => {} });
  const update = fixture('document'); worker.intake([update]); await worker.drain();
  expect(requests).toBe(0); expect(journal.view.order[0]?.accepted).toBe(true);
  expect(journal.view.order[0]?.raw).toContain('BQACAgE');
  expect(journal.view.order[0]?.media).toEqual({ state: 'failed', reason: 'admission-refused' });
  expect(question).toContain('refused by operation admission');
  journal.close();
  const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
  expect(reopened.view.order[0]?.media).toEqual({ state: 'failed', reason: 'admission-refused' }); reopened.close();
}));

it('a policy revoked after metadata prevents the binary request', () => withRoot(async root => {
  let revoked = false, requests = 0;
  const media = telegramInboundMedia(fixture('document').message)!;
  const custody = createTelegramMediaCustody(root, key, { admission: admissionFor(root, {
    policy: () => revoked ? { ...DEFAULT_EFFECT_POLICY, policySensitive: [MEDIA_OPERATION.effect] } : DEFAULT_EFFECT_POLICY }),
  token: () => token, stopped: () => false, fetch: async () => {
    requests++; revoked = true;
    return response({ ok: true, result: { file_id: media.fileId, file_path: 'documents/file.bin' } });
  } });
  expect(await custody.receive('revoked-after-metadata', media)).toEqual({ state: 'failed', reason: 'admission-refused' });
  expect(requests).toBe(1);
}));

it('a prepared claim is bound to the retained source and is one-use across reconstruction', () => withRoot(async root => {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false,
    model: async () => 'received', send: async () => 1, checkOutbound: () => {} });
  const update = fixture('document'); worker.intake([update]);
  const source = journal.view.order[0]!.id, media = telegramInboundMedia(update.message)!;
  const options = { source: (id: string, value: typeof media) => journalMediaSource(journal.view, id, value) };
  const admission = admissionFor(root, options);
  expect(() => admission.admit('other-turn', media)).toThrow('intake');
  expect(() => admission.admit(source, { ...media, fileId: 'other-file' })).toThrow('exact retained file');
  const claim = admission.admit(source, media); let requests = 0;
  expect(() => claim.request('bytes', () => requests++)).toThrow('consumed');
  claim.request('metadata', () => requests++);
  expect(() => claim.request('metadata', () => requests++)).toThrow('consumed');
  claim.request('bytes', () => requests++);
  expect(() => claim.request('bytes', () => requests++)).toThrow('consumed');
  expect(requests).toBe(2);
  expect(() => admissionFor(root, options).admit(source, media)).toThrow('no retry');
  journal.close();
}));

it('an uncertain fetch without complete bytes never issues another request after restart', () => withRoot(async root => {
  let requests = 0;
  const media = telegramInboundMedia(fixture('document').message)!;
  const open = () => createTelegramMediaCustody(root, key, { admission: admissionFor(root), token: () => token,
    stopped: () => false, fetch: async () => { requests++; throw Error('connection lost'); } });
  expect(await open().receive('uncertain-fetch', media)).toEqual({ state: 'failed' });
  expect(await open().receive('uncertain-fetch', media)).toEqual({ state: 'failed', reason: 'admission-refused' });
  expect(requests).toBe(1);
}));

it.each(['failed', 'interrupted'])('claim loss after %s download is visible through check-agreements', outcome => withRoot(async root => {
  const update = fixture('document'), media = telegramInboundMedia(update.message)!;
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), requests = 0;
  const custody = createTelegramMediaCustody(root, key, { token: () => token, stopped: () => false,
    admission: admissionFor(root, { source: (source, media) => journalMediaSource(journal.view, source, media),
      claimed: id => journal.view.turns.get(id)?.mediaClaim !== undefined,
    retainClaim: (id, digest) => journal.append({ kind: 'media-claim', id, digest, at: 1000 }) }),
    fetch: async () => { requests++; throw Error('offline transport failure'); } });
  const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false, media: custody,
    model: async () => 'Received.', send: async () => 1, checkOutbound: () => {} });
  worker.intake([update]);
  if (outcome === 'failed') await worker.drain();
  else expect(await custody.receive(journal.view.order[0]!.id, media)).toEqual({ state: 'failed' });
  const claim = journal.view.order[0]!.mediaClaim; expect(claim).toMatch(/^[a-f0-9]{64}$/u);
  journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
  expect(journal.view.order[0]!.mediaClaim).toBe(claim);
  if (outcome === 'interrupted') expect(journal.view.order[0]!.media).toBeUndefined();
  journal.close();
  const agreement = () => {
    const child = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'check-agreements', '--root', root, '--conversation-owners', join(root, 'owners')],
    { encoding: 'utf8', timeout: 30000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(child.status, child.stderr).toBe(0);
    return (JSON.parse(child.stdout) as { records: { id: string; agree: boolean | null; detail: string }[] }).records
      .find(row => row.id === 'media-custody')!;
  };
  expect(agreement()).toMatchObject({ agree: true });
  rmSync(join(root, 'media-claims'), { recursive: true });
  expect(agreement()).toMatchObject({ agree: false });
  expect(agreement().detail).toContain('1 missing or corrupt causal records');
  if (outcome === 'interrupted') {
    journal = openPreviewJournal(path, key);
    let sent = 0;
    const resumed = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false, media: custody,
      model: async () => 'Received; file could not be saved.', send: async () => ++sent, checkOutbound: () => {} });
    await resumed.drain(); await resumed.drain();
    expect(requests).toBe(1); expect(sent).toBe(1);
    expect(journal.view.order[0]!.media?.state).toBe('failed');
    expect(journal.view.order[0]!.mediaClaim).toBe(claim);
    journal.close();
    expect(agreement().agree).toBe(false);
  }
}));

it('a journal expectation that cannot be retained prevents physical dispatch', () => withRoot(async root => {
  let requests = 0;
  const custody = createTelegramMediaCustody(root, key, { token: () => token, stopped: () => false,
    admission: admissionFor(root, { retainClaim: () => { throw Error('journal full'); } }),
    fetch: async () => { requests++; throw Error('must not dispatch'); } });
  expect(await custody.receive('journal-unavailable', telegramInboundMedia(fixture('document').message)!)).toEqual({ state: 'failed' });
  expect(requests).toBe(0);
}));

it('the journal admits a source-bound claim once and rejects malformed or orphan claims', () => withRoot(async root => {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  try {
    const worker = createJournalWorker(journal, { origin: 'test', now: () => 1000, stopped: () => false,
      model: async () => 'Received.', send: async () => 1, checkOutbound: () => {} });
    worker.intake([fixture('document')]);
    const id = journal.view.order[0]!.id;
    expect(() => journal.append({ kind: 'media-claim', id, digest: 'bad', at: 1000 })).toThrow('media claim refused');
    expect(() => journal.append({ kind: 'media-claim', id: 'missing', digest: 'a'.repeat(64), at: 1000 })).toThrow('media claim refused');
    journal.append({ kind: 'media-claim', id, digest: 'a'.repeat(64), at: 1000 });
    expect(journal.view.order[0]!.mediaClaim).toBe('a'.repeat(64));
    expect(() => journal.append({ kind: 'media-claim', id, digest: 'b'.repeat(64), at: 1000 })).toThrow('media claim refused');
  } finally { journal.close(); }
}));
