// @ts-nocheck -- execute the launcher's actual host functions without starting its CLI.
import { expect, it } from 'vitest';
import { appendFileSync, chmodSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { authoritySealKey, resolveActivationAuthority, sealAuthorityRecord } from './activation-authority.js';
import { OFFLINE_STORAGE_KEY, successiveWorld, writeOperatorRecords } from './successive-fixture.js';

const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('let operatorRecordsCache = null;'),
  source.indexOf('/** Part Thirteen §9:'));
function host(read = readFileSync, stat = statSync) {
  return runInNewContext(`${functions}\n({ operatorRecords, requireAuthority })`, {
    JSON, readFileSync: read, statSync: stat, join, dirname, resolve, resolveActivationAuthority,
    authoritySealKey, key: () => OFFLINE_STORAGE_KEY,
  });
}
function fixture() {
  const world = successiveWorld();
  const directory = join(world.directory, 'operator-records');
  const authorityPath = join(world.directory, 'activation-authority.json');
  const activation = world.activation();
  const record = JSON.parse(readFileSync(authorityPath, 'utf8'));
  const view = { genesis: { operator: world.configuration.operatorSenderId, expires: activation.expiresAt } };
  const now = activation.observedAt;
  const options = { 'operator-records': directory, 'authority-record': authorityPath };
  const seal = value => writeFileSync(authorityPath, JSON.stringify(sealAuthorityRecord(value, authoritySealKey(OFFLINE_STORAGE_KEY))));
  return { world, directory, authorityPath, activation, record, now, seal,
    check: h => h.requireAuthority(options, activation, join(world.directory, 'activation.json'), view, now),
    at: (h, time) => h.requireAuthority(options, activation, join(world.directory, 'activation.json'), view, time) };
}

it('reuses unchanged parsed records across the packet-fitting ladder but resolves authority every time', () => {
  const f = fixture(); let reads = 0;
  const h = host((...args) => { if (String(args[0]).startsWith(f.directory)) reads++; return readFileSync(...args); });
  const first = h.operatorRecords(f.directory);
  for (let n = 0; n < 1252; n++) expect(h.operatorRecords(f.directory)).toBe(first);
  expect(reads).toBe(3);
  expect(f.check(h).kind).toBe('resolved');
  // The owner files stay unchanged; a freshly sealed revocation between preparations must win.
  const { seal: _, ...record } = f.record;
  f.seal({ ...record, revocations: [{ grantId: record.grants[0].id, at: f.now,
    by: record.grants[0].grantor, source: 'offline revocation' }] });
  expect(() => f.check(h)).toThrow(/revoked or expired/u);
  f.seal(record);
  expect(f.check(h).kind).toBe('resolved');
  expect(reads).toBe(3);
});

it('checks expiry at the current time even when all file identities stay unchanged', () => {
  const f = fixture(); const { seal: _, ...record } = f.record;
  f.seal({ ...record, grants: record.grants.map(g => ({ ...g, expiresAt: f.now + 1 })) });
  const h = host(); expect(f.check(h).kind).toBe('resolved');
  expect(() => f.at(h, f.now + 2)).toThrow(/revoked or expired/u);
});

it.each(['telegram-messages.jsonl', 'asp-classifications.jsonl', 'state/topic-operators.json'])(
  'invalidates %s when replaced with equal-size bytes and preserved mtime', name => {
    const f = fixture(); const h = host(); expect(f.check(h).kind).toBe('resolved');
    const path = join(f.directory, name), before = statSync(path);
    const bytes = readFileSync(path, 'utf8');
    const replacement = name.endsWith('topic-operators.json')
      ? bytes.replace(/("uid":")[0-9]/u, '$19')
      : name === 'asp-classifications.jsonl' ? bytes.replace('"human"', '"agent"')
        : bytes.replace('offline approval', 'changed approval');
    // Keep size exactly equal; inode and ctime detect replacement despite restored mtime.
    writeFileSync(`${path}.next`, replacement.padEnd(bytes.length).slice(0, bytes.length));
    utimesSync(`${path}.next`, before.atime, before.mtime);
    renameSync(`${path}.next`, path);
    expect(statSync(path).size).toBe(before.size);
    expect(() => f.check(h)).toThrow();
    writeOperatorRecords(f.directory);
    expect(f.check(h).kind).toBe('resolved');
  });

it('detects same-size in-place edits with restored mtime through ctime', () => {
  const f = fixture(); const h = host(); expect(f.check(h).kind).toBe('resolved');
  const path = join(f.directory, 'telegram-messages.jsonl'), before = statSync(path);
  writeFileSync(path, readFileSync(path, 'utf8').replace('offline approval', 'changed approval'));
  utimesSync(path, before.atime, before.mtime);
  expect(statSync(path).ino).toBe(before.ino);
  expect(statSync(path).size).toBe(before.size);
  expect(() => f.check(h)).toThrow(/authenticated operator message/u);
});

it('keeps trailing-fragment semantics, then refuses a completed malformed or duplicate row', () => {
  const f = fixture(); const h = host(); expect(f.check(h).kind).toBe('resolved');
  const path = join(f.directory, 'telegram-messages.jsonl');
  appendFileSync(path, '{fragment');
  expect(f.check(h).kind).toBe('resolved');
  appendFileSync(path, '\n');
  expect(h.operatorRecords(f.directory)).toBeNull();
  writeOperatorRecords(f.directory);
  expect(f.check(h).kind).toBe('resolved');
  appendFileSync(path, `${readFileSync(path, 'utf8').split('\n')[0]}\n`);
  expect(() => f.check(h)).toThrow(/authenticated operator message/u);
});

it('discards missing or unreadable records and recovers without retaining stale authority', () => {
  const f = fixture(); let unreadable = false;
  const h = host(readFileSync, (...args) => {
    if (unreadable) throw Error('EACCES'); return statSync(...args);
  });
  expect(f.check(h).kind).toBe('resolved');
  unreadable = true; expect(h.operatorRecords(f.directory)).toBeNull();
  unreadable = false; expect(f.check(h).kind).toBe('resolved');
  const path = join(f.directory, 'asp-classifications.jsonl');
  unlinkSync(path); expect(h.operatorRecords(f.directory)).toBeNull();
  writeOperatorRecords(f.directory); expect(f.check(h).kind).toBe('resolved');
  chmodSync(path, 0o600); expect(f.check(h).kind).toBe('resolved');
  expect(h.operatorRecords(undefined)).toBeNull();
  expect(f.check(h).kind).toBe('resolved');
});

it('does not cache a snapshot whose files changed during the read', () => {
  const f = fixture(); let changed = false;
  const h = host((...args) => {
    const bytes = readFileSync(...args);
    if (!changed) { changed = true; appendFileSync(join(f.directory, 'telegram-messages.jsonl'), '\n'); }
    return bytes;
  });
  expect(h.operatorRecords(f.directory)).toBeNull();
  expect(f.check(h).kind).toBe('resolved');
});

it('never reuses one directory\'s evidence for another or caches a failed parse', () => {
  const a = fixture(), b = fixture(), h = host();
  const first = h.operatorRecords(a.directory);
  expect(h.operatorRecords(b.directory)).not.toBe(first);
  const path = join(b.directory, 'state/topic-operators.json');
  writeFileSync(path, '{'); expect(h.operatorRecords(b.directory)).toBeNull();
  writeOperatorRecords(b.directory); expect(b.check(h).kind).toBe('resolved');
  expect(a.check(h).kind).toBe('resolved');
});
