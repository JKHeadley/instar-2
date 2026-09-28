import { expect, it } from 'vitest';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';
import { createJournalWorker, openPreviewJournal, renewJournalExpiry } from './journal-test-worker.js';
import { readRuns, selfState } from './self-state.js';

const key = new Uint8Array(32).fill(46);
const firstExpiry = 1790628000000;
const middleExpiry = firstExpiry + 3 * 24 * 60 * 60 * 1000;
const now = 1790520000000;
const authority = 'reviewed renewal for continuity test';
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: firstExpiry,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const digest = `sha256:${'a'.repeat(64)}`;
const id = 'telegram:12345678:update:1';
const question = 'What do you remember about the cedar lantern code I gave you?';
const fact = 'For this test, the cedar lantern code is 731.';

// This authenticated historical frame represents a renewal written by an older
// reviewed build. New writes remain restricted to this build's reviewed expiry.
function appendHistoricalExpiry(path: string, expires: number, at: number): void {
  const row = { kind: 'expiry', genesisHash: createHash('sha256').update(JSON.stringify(genesis)).digest('hex'),
    expires, activation: digest, authority: 'earlier reviewed renewal', at };
  const offset = readFileSync(path).length;
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
  const sealed = Buffer.concat([cipher.update(JSON.stringify(row)), cipher.final()]);
  const body = Buffer.concat([nonce, cipher.getAuthTag(), sealed]);
  const length = Buffer.alloc(4); length.writeUInt32BE(body.length);
  appendFileSync(path, Buffer.concat([length, body]));
}

function status(root: string) {
  const result = spawnSync(process.execPath, ['--no-warnings', '--import', `data:text/javascript,Date.now=()=>${now}`,
    '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
    encoding: 'utf8', timeout: 30000 });
  expect(result.status, result.stderr).toBe(0);
  // Ages and observation times are measured against the running clock (seeded from the journal's
  // floor, advanced by elapsed process time); this test compares replayed state, not measurements.
  return JSON.parse(result.stdout, (name, value) => /AgeMs$|^observedAt$/u.test(name) ? undefined : value) as Record<string, unknown>;
}

function evidence(root: string, path: string) {
  const journal = openPreviewJournal(path, key);
  try {
    const worker = createJournalWorker(journal, { now: () => now + 1000, stopped: () => false,
      model: async () => { throw Error('probe must not call a provider'); },
      send: async () => { throw Error('probe must not send'); }, checkOutbound: () => {} });
    const probe = worker.probe(question);
    expect('reason' in probe).toBe(false);
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context);
    // Complete history carries a short journal verbatim (Rule 96); search is offered by structure, not wording.
    const answer = [...(packet.memorySearch?.items ?? []).map((item: { quote: string }) => item.quote),
      ...packet.history.map((item: { user: string }) => item.user)].find((quote: string) => quote.includes('cedar lantern'));
    expect(answer).toContain('731');
    const report = status(root);
    expect(report.expires).toBe(journal.view.expires);
    expect(report.expiryAuthority).toBe(journal.view.expiryAuthority);
    return { memory: packet.memory, memorySearch: packet.memorySearch, answer,
      view: { cursor: journal.view.cursor, order: journal.view.order, memory: journal.view.memory,
        summaries: journal.view.summaries, calls: journal.view.calls, replies: journal.view.replies,
        expires: journal.view.expires, expiryAuthority: journal.view.expiryAuthority },
      self: selfState(journal.view, readRuns(join(root, 'runs.jsonl')), now + 1000, 'America/Los_Angeles'),
      status: report };
  } finally { journal.close(); }
}

it.each([1, 2])('keeps facts, recall answer, status and expiry through replay and compaction with %i renewal frame(s)', frames => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-continuity-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    journal.append({ kind: 'intake', id, update: 1, text: fact, raw: JSON.stringify({ update_id: 1,
      message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: fact,
        date: 1790520000 } }), accepted: true, cursor: 2, at: now });
    journal.close();
    const before = evidence(root, path);
    if (frames === 2) appendHistoricalExpiry(path, middleExpiry, now + 1);
    const renewed = openPreviewJournal(path, key);
    expect(renewed.view.expires).toBe(frames === 2 ? middleExpiry : firstExpiry);
    renewJournalExpiry(renewed, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: digest,
      authority, at: now + 2 });
    renewed.close();
    const replayed = evidence(root, path);
    expect(replayed.answer).toBe(before.answer);
    expect(replayed.memorySearch).toEqual(before.memorySearch);
    expect(replayed.memory).toEqual(before.memory);
    expect(replayed.view).toMatchObject({ expires: SUBSCRIPTION_PREVIEW_EXPIRY, expiryAuthority: authority });
    const compacted = openPreviewJournal(path, key);
    compacted.compact(); compacted.close();
    const reopened = evidence(root, path);
    expect(reopened).toEqual(replayed);
    const again = openPreviewJournal(path, key);
    again.compact(); again.close();
    expect(evidence(root, path)).toEqual(replayed);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([firstExpiry, middleExpiry])('refuses stale or earlier expiry %i without changing the journal', expires => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-refuse-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    renewJournalExpiry(journal, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: digest,
      authority, at: now });
    const before = readFileSync(path);
    expect(() => renewJournalExpiry(journal, { expires, activation: digest, authority, at: now + 1 }))
      .toThrow('expiry renewal refused');
    expect(readFileSync(path)).toEqual(before);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view).toMatchObject({ expires: SUBSCRIPTION_PREVIEW_EXPIRY, expiryAuthority: authority });
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([firstExpiry, middleExpiry])('refuses an authenticated stale or earlier expiry frame during replay (%i)', expires => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-replay-refuse-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    renewJournalExpiry(journal, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: digest,
      authority, at: now });
    journal.close();
    appendHistoricalExpiry(path, expires, now + 1);
    expect(() => openPreviewJournal(path, key)).toThrow('expiry renewal refused');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
