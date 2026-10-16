import { describe, expect, it } from 'vitest';
import { readSelfAccess, selfStateSource } from './self-state.js';
import { SELF_UNBLOCK_GUIDE } from './guidance.js';

const inputs = () => ({
  credentials: () => [{ name: 'library-login', identity: 'agent library account', custody: 'preview-vault', expiresAt: null }],
  connectors: () => ({ servers: { library: { args: ['--user-data-dir', '/private/browser'] } },
    secrets: { library: { PASSWORD: 'library-login' } } }),
  held: () => ['opaque-secret-value'], missing: () => [], bot: 'agent bot', now: 1000,
});
describe('self-unblock access inventory at the answer consumer', () => {
  it('offers an already held credential and its configured connector without exposing a value or profile path', () => {
    const state = readSelfAccess(inputs());
    expect(state.credentials).toMatchObject({ status: 'read', entries: [{ name: 'library-login' }] });
    expect(state.connectors).toMatchObject({ status: 'read', entries: [{ name: 'library', credentials: ['library-login'], browserProfile: true }] });
    const source = selfStateSource('current state', state);
    expect(source.text).toContain('library-login');
    expect(source.text).toContain(SELF_UNBLOCK_GUIDE);
    expect(source.text).not.toContain('opaque-secret-value');
    expect(source.text).not.toContain('/private/browser');
  });
  it('keeps missing, unreadable and filtered access distinct; an unreadable source cannot prove absence', () => {
    expect(readSelfAccess({ ...inputs(), credentials: () => [] }).credentials).toEqual({ status: 'read', entries: [], omitted: 0 });
    expect(readSelfAccess({ ...inputs(), credentials: () => { throw Error('opaque-secret-value'); } }).credentials?.status).toBe('unknown');
    const state = readSelfAccess({ ...inputs(), credentials: () => [{ name: 'opaque-secret-value', identity: 'agent', custody: 'preview-vault', expiresAt: null }] });
    expect(state.credentials).toEqual({ status: 'read', entries: [], omitted: 1 });
    expect(JSON.stringify(state)).not.toContain('opaque-secret-value');
  });
  it('reports enrollment, not login health or authority, and refreshes revoked configuration on the next read', () => {
    const read = inputs();
    expect(readSelfAccess(read).connectors?.entries).toHaveLength(1);
    expect(readSelfAccess({ ...read, connectors: () => null }).connectors?.entries).toEqual([]);
    expect(SELF_UNBLOCK_GUIDE).toContain('Outside granted scope, refuse');
    expect(SELF_UNBLOCK_GUIDE).toContain('ask once');
    expect(SELF_UNBLOCK_GUIDE).toContain('configured is not authenticated');
  });
});

it('verifies the custody object, distinguishes expiry, bounds context, and withholds encoded held material', () => {
  expect(readSelfAccess({ ...inputs(), missing: () => ['library-login'] }).credentials?.entries[0]?.custodyPresent).toBe(false);
  expect(readSelfAccess({ ...inputs(), credentials: () => [{ ...inputs().credentials()[0]!, expiresAt: 999 }] }).credentials?.entries[0]?.expiry).toBe('expired');
  const many = readSelfAccess({ ...inputs(), credentials: () => Array.from({ length: 100 }, (_, n) => ({
    name: `account-${n}`, identity: 'x'.repeat(150), custody: 'preview-vault', expiresAt: null })) });
  expect(Buffer.byteLength(JSON.stringify(many.credentials?.entries))).toBeLessThanOrEqual(1536);
  expect(many.credentials?.omitted).toBeGreaterThan(0);
  const encoded = readSelfAccess({ ...inputs(), credentials: () => [{ ...inputs().credentials()[0]!, name: Buffer.from('opaque-secret-value').toString('base64') }] });
  expect(encoded.credentials?.entries).toEqual([]);
  expect(readSelfAccess({ ...inputs(), held: () => { throw Error('custody unavailable'); } })).toEqual({ status: 'unknown' });
});

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSecretCustody } from './secret-custody.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { selfStateBrief } from './self-state.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { replyReviewContext, parseReplyReviewVerdict, substantiveReply } from './reply-check.js';
import { conclusionText } from './model-json.js';
// @ts-expect-error existing physical connector boundary
import { readRootMcp } from './tool-turn.mjs';
// @ts-expect-error existing physical connector boundary
import { admitSessionConnector } from './session-connectors.mjs';
// @ts-expect-error existing effect policy boundary
import { admitToolCallEffect } from './tool-admission.mjs';
import recordedBlocker from './fixtures/blocker-refusal-recorded-46039927.json' with { type: 'json' };
import recordedShapes from './fixtures/retrospective-duty-followup-train-1-2026-10-08.json' with { type: 'json' };

it('replays the recorded library refusal into the real answer packet with current custody; scoped connector proceeds, outside scope refuses', async () => {
  const root = mkdtempSync(join(tmpdir(), 'self-unblock-'));
  const key = new Uint8Array(32).fill(71), now = recordedBlocker.at;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 86400000,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 65536, cursor: 0 });
  try {
    const custody = createSecretCustody(root, key, () => now);
    const secret = 'synthetic-only-library-credential';
    const ref = custody.store({ value: secret, kind: 'password', source: 'offline' });
    const mcp = readRootMcp(root, () => JSON.stringify({ mcpServers: { library: { command: '/fake',
      args: ['--user-data-dir', '/private/browser'], env: { PASSWORD: { secretRef: ref.name } } } }, reads: ['mcp__library__read'] }));
    const access = () => readSelfAccess({ credentials: custody.records, missing: custody.missing, connectors: () => mcp,
      held: () => [secret], bot: 'Telegram bot 12345678', now });
    const briefing = sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS,
      { providerAttempts: 100, expiresAt: journal.view.expires, tools: true, mcp: 1 }).sources;
    const sources = () => [...briefing, selfStateSource(selfStateBrief(journal.view, { launches: [], unreadable: 0 }, now, 'UTC', undefined, false, true), access())];
    const writer = JSON.parse(recordedBlocker.writer) as { reply: string };
    const id = 'telegram:12345678:update:46039927';
    journal.append({ kind: 'intake', id, update: 46039927, text: 'Renew my library card.', raw: '{}', accepted: true, cursor: 46039928, at: now });
    journal.append({ kind: 'reserve', id, at: now });
    journal.append({ kind: 'answer', id, text: writer.reply, at: now });
    journal.append({ kind: 'intent', id, text: writer.reply, chat: '7654321', update: 46039927, grant: 'grant:preview', at: now });
    journal.append({ kind: 'sent', id, message: 1, at: now });
    let answerPacket = '';
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, sources, toolRoute: () => true,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', 'grant:preview', now, 65536),
      // Injected answer judgment; real capture above supplies the failure history. Live semantic acceptance belongs to the desk.
      model: async input => {
        answerPacket = input.context;
        expect(answerPacket).toContain(ref.name);
        expect(answerPacket).toContain('custodyPresent');
        expect(answerPacket).toContain(SELF_UNBLOCK_GUIDE);
        expect(answerPacket).not.toContain(secret);
        const verdict = admitSessionConnector({ tool: 'mcp__library__read', input: {}, config: { operations: [] },
          mcp, enabled: false, now, decide: admitToolCallEffect });
        expect(verdict.admitted).toBe(true);
        expect(custody.resolve(ref)).toBe(secret);
        return JSON.stringify({ reply: 'I checked my stored access and library connector; the account lookup is available without another credential request.' });
      }, send: async text => { sent.push(text.expectedText); return 2; }, checkOutbound: () => {} });
    worker.intake([{ update_id: 46039928, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Check my library account using the access you already hold.', date: Math.floor(now / 1000) } }]);
    await worker.drain();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('without another credential request');
    expect(answerPacket).toContain(writer.reply.slice(0, 30));
    const input = { tool: 'mcp__other__read', input: {}, config: { operations: [] }, mcp, enabled: true, now, decide: admitToolCallEffect };
    expect(admitSessionConnector(input)).toMatchObject({ admitted: false, reason: 'connector is outside the currently granted account set' });
    expect(admitSessionConnector({ ...input, tool: 'mcp__library__write' }).admitted).toBe(false);
    // Already held credentials do not grant account writes or permit a fallback identity.
    const prepared = prepareJournalEnvelope({ question: 'Check access', context: answerPacket, id: 'offline' }, 'claude-opus-5-5', 'grant:preview', now, 65536);
    const reviewed = JSON.parse(replyReviewContext(prepared, writer.reply, ['parks_on_user']));
    expect(reviewed.sources.find((s: { id: string }) => s.id === 'self-state').text).toContain(ref.name);
    expect(reviewed.candidateReply).toBe(writer.reply);
    expect(journal.view.order.at(-1)?.prompt).toContain(ref.name);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps recorded uncertain/undecided summaries, reviews and empty replies as history, never as access inventory', () => {
  const inventory = readSelfAccess({ ...inputs(), credentials: () => [], connectors: () => null });
  for (const shape of recordedShapes.otherShapes) {
    const source = selfStateSource('current state', inventory);
    const packet = { audience: { surface: 'private' }, history: [{ id: shape.id, answer: shape.raw }], sources: [source] };
    const envelope = prepareJournalEnvelope({ question: 'Check existing access', context: JSON.stringify(packet), id: 'offline' },
      'claude-opus-5-5', 'grant:preview', 1000, 65536);
    const review = JSON.parse(replyReviewContext(envelope, shape.kind === 'empty-reply-in-recorded-context' ? '' : 'Checking current access.', ['parks_on_user']));
    expect(review.history[0].answer).toBe(shape.raw);
    expect(review.sources[0].text).toContain(SELF_UNBLOCK_GUIDE);
    expect(inventory.credentials?.entries).toEqual([]);
    expect(inventory.connectors?.entries).toEqual([]);
    if (shape.kind === 'reply-review') expect(parseReplyReviewVerdict(conclusionText(JSON.parse(shape.raw).conclusion.value)!)).not.toBeNull();
    if (shape.kind === 'empty-reply-in-recorded-context') expect(substantiveReply(shape.raw)).toBe(false);
  }
});
