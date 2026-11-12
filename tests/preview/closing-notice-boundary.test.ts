import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, closingNoticeText, CLOSING_NOTICE_LEAD_MS,
  renewJournalExpiry, sendOutcomeCounts } from './journal-test-worker.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY as RENEWED } from '../../src/assembly/subscription-window.js';
const key = new Uint8Array(32).fill(17), end = 1_000_000;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(unknown = false, maxReplies = 20) {
  const root = mkdtempSync(join(tmpdir(), 'closing-boundary-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  let now = 1000, stopped = false;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'trial', configurationDigest: 'sha256:offline', expires: end,
    maxCalls: 20, maxReplies, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const sent: string[] = [];
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => stopped, timeZone: 'UTC',
    checkOutbound: () => {}, model: async () => 'Answer.', send: async input => {
      sent.push(input.expectedText);
      if (unknown && input.expectedText.startsWith('Reminder: this agent')) throw Error('connection lost after dispatch');
      return sent.length;
    } });
  let w = worker();
  w.intake([{ update_id: 1, message: { message_id: 11, chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'Hello' } }]);
  return { get journal() { return journal; }, get worker() { return w; }, sent, get notices() { return sent.filter(text => text.startsWith('Reminder: this agent')); }, advance: (at: number) => { now = at; },
    stop: () => { stopped = true; }, restart: () => { journal.compact(); journal.close(); journal = openPreviewJournal(path, key); w = worker(); },
    close: () => journal.close() };
}
it('emits exactly at the lead boundary, survives an unknown send plus compaction, and allows a later renewed end', async () => {
  const f = fixture(true);
  try {
    f.advance(end - CLOSING_NOTICE_LEAD_MS - 1); await f.worker.minimal(); expect(f.notices).toEqual([]);
    f.advance(end - CLOSING_NOTICE_LEAD_MS); await Promise.all([f.worker.minimal(), f.worker.minimal()]);
    expect(f.notices).toEqual([closingNoticeText(end)]);
    expect(f.journal.view.order[0]!.closingNotices?.[0]?.sent).toBeUndefined();
    const outcomes = sendOutcomeCounts(f.journal.view); expect(outcomes.unknown).toBe(1);
    f.restart(); await f.worker.minimal(); expect(f.notices).toHaveLength(1);
    renewJournalExpiry(f.journal, { expires: RENEWED, activation: `sha256:${'a'.repeat(64)}`, authority: 'fixture renewal', at: end - 1 });
    f.advance(RENEWED - CLOSING_NOTICE_LEAD_MS); await f.worker.minimal();
    expect(f.notices).toEqual([closingNoticeText(end), closingNoticeText(RENEWED)]);
    expect(f.journal.view.order[0]!.closingNotices).toHaveLength(2);
  } finally { f.close(); }
});
it('never sends after an operator stop', async () => {
  const f = fixture();
  try {
    f.advance(end - CLOSING_NOTICE_LEAD_MS); f.stop();
    await expect(f.worker.minimal()).rejects.toThrow('preview stopped');
    expect(f.sent).toEqual([]);
  } finally { f.close(); }
});
// activation-stop-1108: the activation end date is a reminder, never a stop.
it('past the end date the runner still answers, shows the reminder once, and latches no stop', async () => {
  const f = fixture();
  try {
    f.advance(end + 60_000); await f.worker.drain(); await f.worker.drain();
    expect(f.sent).toContain('Answer.');
    expect(f.notices).toEqual([closingNoticeText(end)]);
    expect(f.journal.view.stop).toBeNull();
    f.restart(); f.advance(end + 3_600_000); await f.worker.minimal();
    expect(f.notices).toHaveLength(1);
    f.worker.intake([{ update_id: 2, message: { message_id: 12, chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Still there?' } }]);
    await f.worker.drain();
    expect(f.sent.filter(text => text === 'Answer.')).toHaveLength(2);
    expect(f.notices).toHaveLength(1);
    expect(f.journal.view.stop).toBeNull();
    renewJournalExpiry(f.journal, { expires: RENEWED, activation: `sha256:${'b'.repeat(64)}`, authority: 'fixture renewal', at: end + 3_600_001 });
    expect(f.journal.view.expires).toBe(RENEWED);
  } finally { f.close(); }
});
it.each(['stop', 'nonblocking'])('replays a journal that recorded the earlier %s wording', wording => {
  const f = fixture();
  try {
    const j = f.journal, lead = j.view.order[0]!, at = end - 1;
    const legacy = wording === 'nonblocking' ? closingNoticeText(end).split('Nothing stops')[0]!
      + 'The agent keeps reading and answering here after that. Approving a renewed activation record keeps the approval on file current.'
      : `This agent will stop at ${new Date(end).toISOString().slice(0, 16).replace('T', ' ')} (UTC) because its activation ends then. `
      + 'After that it cannot read or answer messages here. Its activation must be renewed before it stops; '
      + 'once stopped, this installation refuses renewal.';
    const subject = { target: `closing-notice:${end}:${lead.id}`, chat: j.view.genesis.chat, body: legacy };
    j.append({ kind: 'held-notice-intent', id: lead.id, closing: { end, zone: 'UTC' }, text: legacy, chat: j.view.genesis.chat,
      update: lead.update, grant: j.view.genesis.grant, at, provenance: j.signOutbound('infrastructure', subject) });
    f.restart();
    expect(f.journal.view.order[0]!.closingNotices).toHaveLength(1);
  } finally { f.close(); }
});
it('requires the exact fixed text, current end, operator channel and infrastructure signature', () => {
  const f = fixture();
  try {
    const j = f.journal, lead = j.view.order[0]!, at = end - 1;
    const correct = closingNoticeText(end);
    const row = { kind: 'held-notice-intent' as const, id: lead.id, closing: { end, zone: 'UTC' }, text: correct,
      chat: j.view.genesis.chat, update: lead.update, grant: j.view.genesis.grant, at };
    for (const patch of [{ text: correct + ' extra instruction' }, { closing: { end: end + 1, zone: 'UTC' } },
      { chat: '9999999' }, { at: end - CLOSING_NOTICE_LEAD_MS - 1 }]) {
      const candidate = { ...row, ...patch };
      const provenance = j.signOutbound('infrastructure', { target: `closing-notice:${candidate.closing.end}:${lead.id}`, chat: candidate.chat, body: candidate.text });
      expect(() => j.append({ ...candidate, provenance })).toThrow('closing notice refused');
    }
    const subject = { target: `closing-notice:${end}:${lead.id}`, chat: row.chat, body: correct };
    expect(() => j.append({ ...row, provenance: j.signOutbound('agent', subject) })).toThrow('closing notice refused');
    j.append({ ...row, provenance: j.signOutbound('infrastructure', subject) });
    expect(j.view.order[0]!.closingNotices).toHaveLength(1);
    expect(() => j.append({ ...row, provenance: j.signOutbound('infrastructure', subject) })).toThrow('closing notice refused');
  } finally { f.close(); }
});
it('keeps inside the reply allowance like every other fixed notice: the last reply stays reserved', async () => {
  // At 2 the due acknowledgement takes the free reply while disclosure is awaited: the notice drops and the pass still completes.
  for (const [maxReplies, expected] of [[1, 0], [2, 0], [3, 1]] as const) {
    const f = fixture(false, maxReplies);
    try {
      f.advance(end - 1); await f.worker.minimal();
      expect(f.notices).toHaveLength(expected);
      expect(f.journal.view.replies).toBeLessThan(maxReplies);
      if (maxReplies === 1) {
        const j = f.journal, lead = j.view.order[0]!, body = closingNoticeText(end), target = `closing-notice:${end}:${lead.id}`;
        expect(() => j.append({ kind: 'held-notice-intent', id: lead.id, closing: { end, zone: 'UTC' }, text: body, chat: j.view.genesis.chat,
          update: lead.update, grant: j.view.genesis.grant, at: end - 1,
          provenance: j.signOutbound('infrastructure', { target, chat: j.view.genesis.chat, body }) })).toThrow('closing notice refused');
      }
    } finally { f.close(); }
  }
});
