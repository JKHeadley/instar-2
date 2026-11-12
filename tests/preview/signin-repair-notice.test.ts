import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, sendOutcomeCounts, KNOWN_FRAME_KINDS } from './journal-test-worker.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(unknown = false, cap = 20, forum = false, capRace = false) {
  const root = mkdtempSync(join(tmpdir(), 'signin-notice-')); roots.push(root);
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(17);
  let stopped = false;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: forum ? '-7654321' : '7654321', operator: '7654321',
    ...(forum ? { forum: true as const } : {}), grant: 'trial', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: cap, maxTurns: 20, maxBytes: 131072, cursor: 0 });
  const notices = [{ key: 'login-signin:a:1', line: 'Sign-in for a: Please approve the sign-in request on your phone.' }];
  const sent: string[] = [];
  const worker = () => createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
    checkOutbound: () => {}, model: async () => 'Answer.', signinRepairNotices: () => { if (capRace) queueMicrotask(() => { while (journal.view.replies < cap - 1) journal.append({ kind: 'legacy-reply', at: 1000 }); }); return notices; },
    send: async input => { sent.push(input.expectedText); if (unknown && input.expectedText.startsWith('Sign-in')) throw Error('unknown'); return sent.length; } });
  let w = worker();
  w.intake([{ update_id: 1, message: { chat: { id: forum ? -7654321 : 7654321, type: forum ? 'supergroup' : 'private', ...(forum ? { is_forum: true } : {}) },
    ...(forum ? { message_thread_id: 12 } : {}), from: { id: 7654321 }, text: 'Hello' } }]);
  return { get journal() { return journal; }, get worker() { return w; }, notices, sent,
    stop() { stopped = true; }, restart() { journal.compact(); journal.close(); journal = openPreviewJournal(path, key); w = worker(); }, close() { journal.close(); }, path, key };
}
it.each([false, true])('once-only action notice survives compaction and replay; unknown=%s', async unknown => {
  const f = fixture(unknown);
  try {
    await f.worker.drain(); await f.worker.drain();
    expect(f.sent.filter(s => s.startsWith('Sign-in'))).toEqual([f.notices[0]!.line]);
    expect(f.journal.view.order[0]!.signinRepairNotices).toHaveLength(1);
    expect(sendOutcomeCounts(f.journal.view)[unknown ? 'unknown' : 'accepted']).toBeGreaterThan(0);
    f.restart(); await f.worker.drain(); expect(f.sent.filter(s => s.startsWith('Sign-in'))).toHaveLength(1);
  } finally { f.close(); }
});
it('aggregates a burst in one bounded notice, without a model call for each repair', async () => {
  const f = fixture();
  try {
    for (let n = 2; n <= 8; n++) f.notices.push({ key: `login-signin:a:${n}`, line: `Sign-in for ${n}: Please approve on your phone.` });
    await f.worker.drain();
    expect(f.sent.filter(s => s.startsWith('Sign-in'))).toEqual([f.notices.map(n => n.line).join('\n')]);
  } finally { f.close(); }
});
it.each(['stop', 'cap', 'group'])('holds the %s boundary', async mode => {
  const f = fixture(false, mode === 'cap' ? 1 : 20, mode === 'group');
  try { if (mode === 'stop') { f.stop(); await f.worker.drain().catch(() => {}); }
    else await expect(f.worker.drain()).resolves.toBeUndefined();
    expect(f.sent.filter(s => s.startsWith('Sign-in'))).toEqual([]);
  } finally { f.close(); }
});
it('rejects a repeated receipt and a repeated episode intent', async () => {
  const f = fixture();
  try {
    await f.worker.drain(); const j = f.journal, turn = j.view.order[0]!, notice = turn.signinRepairNotices![0]!;
    expect(() => j.append({ kind: 'held-notice-sent', id: turn.id, signinRepair: notice.key, message: 99, at: 1000 })).toThrow();
    const subject = { target: `signin-repair:${notice.key}`, chat: j.view.genesis.chat, body: notice.text };
    expect(() => j.append({ kind: 'held-notice-intent', id: turn.id, signinRepair: notice, text: notice.text,
      chat: j.view.genesis.chat, update: turn.update, grant: j.view.genesis.grant, at: 1000,
      provenance: j.signOutbound('infrastructure', subject) })).toThrow();
  } finally { f.close(); }
});

it.each([false, true])('a reader without repair semantics refuses the retained non-additive marker; compact=%s', async compact => {
  const f = fixture();
  await f.worker.drain(); if (compact) f.journal.compact(); f.close();
  const known = KNOWN_FRAME_KINDS as Set<string>;
  known.delete('signin-repair-version');
  try { expect(() => openPreviewJournal(f.path, f.key)).toThrow('unknown frame kind "signin-repair-version"'); }
  finally { known.add('signin-repair-version'); }
});

it('rechecks the reply reserve after asynchronous send admission yields', async () => {
  const f = fixture(false, 4, false, true);
  try { await expect(f.worker.drain()).resolves.toBeUndefined();
    expect(f.sent.filter(s => s.startsWith('Sign-in'))).toEqual([]);
    expect(f.journal.view.signinRepairVersion).toBeUndefined();
  } finally { f.close(); }
});
