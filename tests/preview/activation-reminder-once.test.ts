import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closingNoticeText, CLOSING_NOTICE_LEAD_MS, createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { credentialNotices, dueWithDelivery, openReplyNotices, type ReplyNotice } from './credential-reminders.js';
import { createSecretCustody, dueCredentialReminders, reminderSchedule } from './secret-custody.js';
import { dashboardSnapshot } from './operator-dashboard.js';
import { selfState, selfStateBrief } from './self-state.js';

const key = new Uint8Array(32).fill(71), end = 1794519600000, HOUR = 3_600_000;
const roots: string[] = [];
const recorded = JSON.parse(readFileSync(new URL('./fixtures/conversation-session-userwalk-2026-10-13.json', import.meta.url), 'utf8')).records[0];
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(at: number, legacy?: ReplyNotice) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'activation-once-'))); roots.push(root);
  const path = join(root, 'journal.encrypted');
  let now = at, next = 1;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'trial', configurationDigest: 'sha256:offline', expires: end,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
  const custody = createSecretCustody(root, key, () => now);
  custody.register({ name: 'preview-activation', kind: 'activation', identity: 'activation', custody: 'activation-record',
    recordedAt: now, expiresAt: end, expirySource: 'activation-record', reminders: reminderSchedule(end),
    renewal: { standing: 'none', smallestHumanAction: 'approve a renewed activation record' } });
  const sent: string[] = [];
  const makeWorker = () => createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context, model: async () => recorded.output, checkOutbound: () => {},
    replyNotices: () => legacy ? [legacy] : credentialNotices(dueCredentialReminders(custody.records(), now), now),
    send: async input => { sent.push(input.text); return sent.length; } });
  let worker = makeWorker();
  return { sent, custody, get journal() { return journal; }, get now() { return now; },
    advance: (at: number) => { now = at; },
    say: async () => {
      worker.intake([{ update_id: next++, message: { message_id: next, chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: JSON.parse(recorded.output).dated[0].quote, date: Math.floor(now / 1000) } }]);
      await worker.drain();
    },
    restart: () => { legacy = undefined; journal.compact(); journal.close(); journal = openPreviewJournal(path, key); worker = makeWorker(); },
    close: () => journal.close() };
}

it.each([-CLOSING_NOTICE_LEAD_MS, 0, HOUR])('mentions once starting at end %i ms, stays quiet across replies and restart, and retains status', async offset => {
  expect(recorded.id).toBe('telegram:8989505249:update:6233124');
  const f = fixture(end + offset);
  try {
    await f.say();
    expect(f.sent.filter(text => text.startsWith('Reminder:'))).toEqual([closingNoticeText(end)]);
    expect(closingNoticeText(end)).toBe("Reminder: this agent's activation record ends at 2026-11-12 21:40 (UTC). Nothing stops at that date: the agent keeps reading and answering here. You don't need to do anything.");
    expect(f.sent.join("\n")).toContain(JSON.parse(recorded.output).reply);
    expect(f.sent.join('\n')).not.toContain('Smallest step for you');
    await f.say();
    f.restart(); f.advance(end + 2 * HOUR); await f.say();
    expect(f.sent.filter(text => text.startsWith('Reminder:'))).toHaveLength(1);
    expect(f.journal.view.stop).toBeNull();
    const due = dueCredentialReminders(f.custody.records(), f.now);
    expect(dueWithDelivery(due, f.journal.view.order)).toMatchObject([{ expirySource: 'activation-record', expiresAt: end }]);
    expect(credentialNotices(due, f.now)).toEqual([]);
    const statusText = selfState(f.journal.view, { launches: [], unreadable: 0 }, f.now, 'UTC');
    expect(statusText).toContain("Activation record ends 2026-11-12 21:40 UTC. Nothing stops at that date; you don't need to do anything.");
    expect(dashboardSnapshot(f.journal.view, { now: f.now, zone: 'UTC', statusText, bot: null, stopped: false }).status.join('\n'))
      .toContain("Nothing stops at that date; you don't need to do anything.");
    for (const compact of [false, true]) expect(selfStateBrief(f.journal.view, { launches: [], unreadable: 0 }, f.now, 'UTC', undefined, false, compact))
      .toContain(compact ? "no stop/action." : "Nothing stops at that date; you don't need to do anything.");
  } finally { f.close(); }
});

it('all six activation stages stay on status, while a real expiring credential retains every stage and wording', () => {
  const f = fixture(end - 8 * 24 * HOUR);
  try {
    const activation = f.custody.records()[0]!;
    for (const at of reminderSchedule(end)) {
      const due = dueCredentialReminders([activation, { ...activation, name: 'real-login', kind: 'api-key',
        expirySource: 'jwt-exp', custody: 'cli-custody', renewal: { standing: 'none', smallestHumanAction: 'supply a replacement credential' } }], at);
      expect(due).toHaveLength(2);
      const lines = credentialNotices(due, at);
      expect(lines).toHaveLength(1);
      expect(lines[0]!.key).toBe(`credential:real-login:${end}:${due[1]!.stage}`);
      expect(lines[0]!.line).toMatch(/^Reminder: your API key (expires in .+|has expired)\. Smallest step for you: supply a replacement credential\.$/u);
    }
  } finally { f.close(); }
});

it('an old appended activation notice spends that end date after upgrade, without rewriting its journal', async () => {
  const line = 'Reminder: your activation expires in 10 h. Smallest step for you: approve a renewed activation record.';
  const f = fixture(end - 10 * HOUR, { key: `credential:preview-activation:${end}:2`, line });
  try {
    await f.say(); expect(f.sent.some(text => text.includes(line))).toBe(true);
    f.restart(); f.advance(end); await f.say();
    expect(f.sent.filter(text => text.includes('activation'))).toHaveLength(1);
    expect(f.journal.view.order[0]!.intent).toContain(line);
  } finally { f.close(); }
});

it('replays every recorded shape with old notice metadata and offers no activation line at later stages', () => {
  expect(shapes.map((row: { kind: string }) => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  const f = fixture(end);
  try {
    const notice = { key: `credential:preview-activation:${end}:2`,
      line: 'Reminder: your activation expires in 10 h. Smallest step for you: approve a renewed activation record.' };
    for (const row of shapes) {
      const prior = { id: row.id, intent: `${row.raw}\n${notice.line}`, answerNotices: [notice] };
      expect(openReplyNotices([prior], credentialNotices(dueCredentialReminders(f.custody.records(), end), end), 'next')).toEqual([]);
      expect(prior.intent).toContain(row.raw);
    }
  } finally { f.close(); }
});
