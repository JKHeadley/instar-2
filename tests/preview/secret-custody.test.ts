// Rule 100: a secret handed to the agent is stored before it is spent, and a
// fixed-lifetime credential carries its expiry and escalating reminder schedule.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { createSecretCustody, dueCredentialReminders, jwtExpiry, reminderSchedule, secretRef } from './secret-custody.js';
import type { CredentialRecord } from './secret-custody.js';
import { credentialSpans } from '../../src/recall/redact.js';

const key = new Uint8Array(32).fill(23);
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'secret-custody-')));
const TOKEN = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2';
const HOUR = 3600_000, DAY = 24 * HOUR;
const jwt = (exp: number) => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: 'x', exp })).toString('base64url'),
  'c2lnbmF0dXJlLXZhbHVl'].join('.');

it('finds the exact credential spans redaction would remove', () => {
  const text = `token ${TOKEN} and Authorization: Bearer abcdefghijklmnopqrstuv and password=hunter2hunter2`;
  const spans = credentialSpans(text).map(s => [text.slice(s.start, s.end), s.kind]);
  expect(spans).toEqual([[TOKEN, 'github-token'], ['abcdefghijklmnopqrstuv', 'bearer-token'], ['hunter2hunter2', 'assigned-secret']]);
  expect(credentialSpans('no secrets here, just a 4-digit code 8637')).toEqual([]);
});

it('returns a SecretRef only after a durable, read-back vault write, and never stores the value in the registry', () => {
  const dir = root();
  try {
    const custody = createSecretCustody(dir, key, () => 5000);
    const ref = custody.store({ value: TOKEN, kind: 'github-token', source: 'telegram:1:update:9' });
    expect(ref).toMatchObject({ type: 'SecretRef', vault: 'preview' });
    expect(custody.resolve(ref)).toBe(TOKEN);
    // Idempotent: the same secret keeps the same reference.
    expect(custody.store({ value: TOKEN, kind: 'github-token', source: 'telegram:1:update:10' }).name).toBe(ref.name);
    const onDisk = readdirSync(join(dir, 'vault')).map(file => readFileSync(join(dir, 'vault', file), 'utf8')).join('')
      + readFileSync(join(dir, 'credentials.json'), 'utf8');
    expect(onDisk).not.toContain(TOKEN);
    expect(custody.records()).toEqual([expect.objectContaining({ name: ref.name, custody: 'preview-vault', expiresAt: null,
      expirySource: 'unknown', reminders: [] })]);
    expect(() => createSecretCustody(dir, new Uint8Array(32).fill(1), () => 0).resolve(ref)).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('keeps the original when custody fails: no SecretRef, no loss', () => {
  const dir = root();
  try {
    writeFileSync(join(dir, 'vault'), 'not a directory');
    const custody = createSecretCustody(dir, key, () => 5000);
    expect(() => custody.store({ value: TOKEN, kind: 'github-token', source: 's' })).toThrow();
    const raw = JSON.stringify({ message: { text: `keep ${TOKEN}` } });
    expect(custody.custody({ text: `keep ${TOKEN}`, raw, source: 's' })).toEqual({ text: `keep ${TOKEN}`, raw, custody: { state: 'failed' } });
    expect(custody.records()).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('records a known fixed expiry with escalating reminders and exposes only due stages', () => {
  const exp = 1_900_000_000;
  expect(jwtExpiry(jwt(exp))).toBe(exp * 1000);
  expect(jwtExpiry('not.a.jwt')).toBeNull();
  const expiresAt = exp * 1000, start = expiresAt - 10 * DAY;
  expect(reminderSchedule(expiresAt)).toEqual([expiresAt - 7 * DAY, expiresAt - 3 * DAY, expiresAt - DAY,
    expiresAt - 6 * HOUR, expiresAt - HOUR, expiresAt]);
  expect(reminderSchedule(null)).toEqual([]);
  const dir = root();
  try {
    const custody = createSecretCustody(dir, key, () => start);
    custody.store({ value: jwt(exp), kind: 'jwt', source: 'telegram:1:update:3' });
    const records = custody.records();
    expect(records[0]).toMatchObject({ expiresAt, expirySource: 'jwt-exp' });
    expect(dueCredentialReminders(records, start)).toEqual([]);
    expect(dueCredentialReminders(records, expiresAt - 2 * DAY)).toEqual([expect.objectContaining({ stage: 1,
      dueAt: expiresAt - 3 * DAY, remaining: expect.stringMatching(/^172800000 ms of credential-remaining /u) })]);
    expect(dueCredentialReminders(records, expiresAt + 1)[0]).toMatchObject({ stage: 5, dueAt: expiresAt });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('keeps a due reminder across restart re-registration and exposes the current stage on near-expiry registration', () => {
  const expiresAt = 2_000_000_000_000, dir = root();
  try {
    let now = expiresAt - 10 * DAY;
    const custody = createSecretCustody(dir, key, () => now);
    const register = (extra = {}) => custody.register({ name: 'preview-activation', kind: 'activation', custody: 'activation-record',
      identity: 'activation:a', recordedAt: now, expiresAt, expirySource: 'activation-record', reminders: reminderSchedule(expiresAt),
      renewal: { standing: 'none', smallestHumanAction: 'renew' }, ...extra });
    register();
    now = expiresAt - 2 * DAY;
    const before = dueCredentialReminders(custody.records(), now);
    expect(before).toEqual([expect.objectContaining({ stage: 1, dueAt: expiresAt - 3 * DAY })]);
    // A restart re-registers the same credential and expiry: the due stage survives (it used to vanish).
    register();
    expect(dueCredentialReminders(custody.records(), now)).toEqual(before);
    expect(custody.records()[0]!.recordedAt).toBe(expiresAt - 10 * DAY);
    // Delivery state a reminder driver (Build 4) adds is preserved by a same-expiry re-registration.
    const withDelivery = { ...custody.records()[0]!, delivered: [0] } as CredentialRecord;
    custody.register(withDelivery); register();
    expect(custody.records()[0]).toMatchObject({ delivered: [0] });
    // A changed expiry replaces the record and shows its currently due stage at once.
    const later = expiresAt + 2 * DAY;
    const { delivered: _delivered, ...current } = custody.records()[0] as CredentialRecord & { delivered?: unknown };
    custody.register({ ...current, recordedAt: now, expiresAt: later, reminders: reminderSchedule(later) });
    expect(dueCredentialReminders(custody.records(), now)).toEqual([expect.objectContaining({ stage: 0, dueAt: later - 7 * DAY })]);
    expect(custody.records()[0]).not.toHaveProperty('delivered');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const fresh = root();
  try {
    // First registration already inside the 7-day window: the current stage is due immediately.
    const custody = createSecretCustody(fresh, key, () => expiresAt - 5 * HOUR);
    custody.register({ name: 'late', kind: 'activation', custody: 'activation-record', identity: 'a', recordedAt: expiresAt - 5 * HOUR,
      expiresAt, expirySource: 'activation-record', reminders: reminderSchedule(expiresAt), renewal: { standing: 'none', smallestHumanAction: 'renew' } });
    expect(dueCredentialReminders(custody.records(), expiresAt - 5 * HOUR)).toEqual([expect.objectContaining({ stage: 3, dueAt: expiresAt - 6 * HOUR })]);
  } finally { rmSync(fresh, { recursive: true, force: true }); }
});

const update = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };

it.each([['with custody', true], ['without custody', false]])('intake %s: the model never receives the secret', async (_name, vaulted) => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
    const custody = createSecretCustody(dir, key, () => 1000);
    const seen: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      ...(vaulted ? { secrets: custody } : {}),
      model: async ({ question, context }) => { seen.push(question + context); return 'Noted.'; },
      send: async () => 77, checkOutbound: () => {} });
    worker.intake([update(1, `please keep my github token ${TOKEN} safe`)]);
    await worker.drain();
    const turn = journal.view.order[0]!;
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.join('')).not.toContain(TOKEN);
    if (vaulted) {
      const ref = secretRef(custody.records()[0]!.name);
      expect(turn.text).toBe(`please keep my github token [credential stored before use: SecretRef preview/${ref.name}] safe`);
      expect(turn.raw).not.toContain(TOKEN);
      expect(seen.join('')).toContain(`SecretRef preview/${ref.name}`);
      expect(custody.resolve(ref)).toBe(TOKEN);
      // Two artifacts: the original bytes sealed in custody, and this redacted row with the true bytes' arrival hash.
      const original = JSON.stringify(update(1, `please keep my github token ${TOKEN} safe`));
      expect(turn.custody).toEqual({ state: 'stored', capture: expect.stringMatching(/^capture-/u), secrets: [ref.name],
        arrival: `sha256:${createHash('sha256').update(original).digest('hex')}` });
      expect(custody.resolve(secretRef((turn.custody as { capture: string }).capture))).toBe(original);
      expect(custody.missing([(turn.custody as { capture: string }).capture, ref.name])).toEqual([]);
      // cint-L3 (Rules 28/29 with 100): the redacted row still carries its verified writer, bound to the
      // capture of the bytes that arrived (the recorded arrival hash), so the append was admitted.
      expect(turn.writer).toMatchObject({ kind: 'person', id: '7654321' });
    } else {
      expect(turn.text).toContain(TOKEN);
      expect(custody.records()).toEqual([]);
    }
    journal.close();
    const replay = openPreviewJournal(join(dir, 'journal.encrypted'), key);
    expect(replay.view.order[0]!.text).toBe(turn.text);
    expect(replay.view.order[0]!.custody).toEqual(turn.custody);
    replay.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('records a failed custody durably on the intake row and detects a lost sealed object by name', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
    writeFileSync(join(dir, 'vault'), 'not a directory');
    const failing = createSecretCustody(dir, key, () => 1000);
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, secrets: failing,
      model: async () => 'Noted.', send: async () => 77, checkOutbound: () => {} });
    worker.intake([update(1, `keep ${TOKEN}`)]);
    await worker.drain();
    journal.close();
    // The failure survives restart: it is a journal fact, not a process counter (it used to reset to 0).
    const reopened = openPreviewJournal(join(dir, 'journal.encrypted'), key);
    expect(reopened.view.order[0]).toMatchObject({ update: 1, custody: { state: 'failed' } });
    expect(reopened.view.order[0]!.text).toContain(TOKEN);
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const lost = root();
  try {
    const custody = createSecretCustody(lost, key, () => 1000);
    const ref = custody.store({ value: TOKEN, kind: 'github-token', source: 's' });
    expect(custody.missing([ref.name])).toEqual([]);
    unlinkSync(join(lost, 'vault', `${ref.name}.sealed`));
    const restarted = createSecretCustody(lost, key, () => 2000);
    // The registry still lists it; the live check reports the loss by name, never a value, and use is refused.
    expect(restarted.records().map(r => r.name)).toEqual([ref.name]);
    expect(restarted.missing([ref.name])).toEqual([ref.name]);
    expect(() => restarted.resolve(ref)).toThrow();
  } finally { rmSync(lost, { recursive: true, force: true }); }
});
