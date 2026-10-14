import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal.js';
import { readJournalHistory } from './journal-history-adapter.js';
import * as historyAdapter from './journal-history-adapter.js';
import { factsFixture, value, refused } from '../facts/fixtures.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const captured = JSON.parse(readFileSync(new URL('./fixtures/journal-read-userwalk-1013.json', import.meta.url), 'utf8')) as {
  frames: (JournalRecord & { frame: number; offset: number })[] };
const key = new Uint8Array(32).fill(61);
const chat = '7812716706', conversation = `telegram:${chat}:main`;
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'journal-read-port-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', origin: 'test',
    bot: '8989505249', chat, operator: chat, grant: 'fixture', configurationDigest: 'sha256:fixture',
    expires: 9_999_999_999_999, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 });
  return { journal, path, context: factsFixture().c };
}
function replay(journal: ReturnType<typeof openPreviewJournal>, stopBeforeSent = false, through = Infinity) {
  for (const row of captured.frames) {
    if ('update' in row && row.update > through) continue;
    if (row.kind === 'intake') {
      journal.append(row);
    } else if ('id' in row && journal.view.turns.has(row.id)) {
      if (row.kind === 'answer') {
        journal.append({ kind: 'reserve', id: row.id, at: row.at });
        journal.append({ kind: 'answer', id: row.id, text: row.text, at: row.at });
      } else if (row.kind === 'intent') {
        journal.append({ kind: 'intent', id: row.id, text: row.text, chat, update: row.update, grant: 'fixture', at: row.at });
      } else if (row.kind === 'sent' && !stopBeforeSent) journal.append(row);
    }
  }
}

it('reads recorded queued requests and actual sent text from an encrypted journal, identically after reopen', () => {
  const { journal, path, context } = fixture();
  try {
    replay(journal);
    const beforeBytes = readFileSync(path);
    const first = value(readJournalHistory(journal.view, 'owner-a', context));
    const latest = value(first.latest(conversation, 50));
    const inputs = captured.frames.filter(row => row.kind === 'intake');
    expect(latest.filter(row => row.speakerRole === 'user').map(row => row.text).sort()).toEqual(inputs.map(row => row.text).sort());
    const intents = captured.frames.filter(row => row.kind === 'intent').filter(row => journal.view.turns.has(row.id));
    expect(latest.filter(row => row.speakerRole === 'agent').map(row => row.text).sort()).toEqual(intents.map(row => row.text).sort());
    expect(first.work(conversation)).toEqual([]);
    // The second queued message arrived before the first answer was sent. A
    // coverage read ending there must not include that later reply.
    const queued = value(first.coverage(conversation, 'telegram:8989505249:update:6233126'));
    expect(queued.messages.some(row => row.messageId === 'telegram:8989505249:update:6233125:reply')).toBe(false);
    const target = 'telegram:8989505249:update:6233133:reply';
    expect(value(first.coverage(conversation, target)).messages).toHaveLength(latest.length);
    expect(readFileSync(path)).toEqual(beforeBytes);
    journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    try {
      const second = value(readJournalHistory(reopened.view, 'owner-a', context));
      expect(second.revision).toBe(first.revision);
      expect(value(second.latest(conversation, 50))).toEqual(latest);
      expect(value(second.coverage(conversation, target))).toEqual(value(first.coverage(conversation, target)));
      expect(readFileSync(path)).toEqual(beforeBytes);
    } finally { reopened.close(); }
  } finally { journal.close(); }
});

it('isolates topics and keeps full raw coverage when a root-wide summary cannot cover one topic', () => {
  const { journal, context } = fixture();
  try {
    replay(journal);
    journal.view.genesis.forum = true;
    journal.view.order[0]!.thread = 7;
    const read = value(readJournalHistory(journal.view, 'owner-a', context));
    const topic = `telegram:${chat}:7`;
    expect(value(read.latest(topic, 50))).toHaveLength(2);
    expect(value(read.latest(conversation, 50))).toHaveLength(10);
    expect(read.summaries(topic)).toEqual([]);
    expect(value(read.coverage(topic, `${journal.view.order[0]!.id}:reply`)).covered).toHaveLength(2);
    refused(read.coverage(conversation, journal.view.order[0]!.id), 'target absent');
  } finally { journal.close(); }
});

it('keeps empty delivered text, excludes retracted turns and preserves only received split parts', () => {
  const { journal, context } = fixture();
  try {
    replay(journal);
    const first = journal.view.order[0]!, second = journal.view.order[1]!;
    first.intent = '';
    second.intent = 'full reply including unsent words';
    second.intentBody = 'first &lt;part&gt; &amp; (1/2)';
    second.replyParts = [{ text: 'unsent words', body: 'unsent words', provenance: {} as never }];
    const read = value(readJournalHistory(journal.view, 'owner-a', context));
    const rows = value(read.latest(conversation, 50));
    expect(rows.find(row => row.messageId === `${first.id}:reply`)?.text).toBe('');
    expect(rows.find(row => row.messageId === `${second.id}:reply`)?.text).toBe('first <part> & (1/2)');
    expect(rows.some(row => row.text.includes('unsent words'))).toBe(false);
    expect(read.work(conversation)).toMatchObject([{ kind: 'reply', source: second.id }]);
    first.heldNoticeIntent = 'Acknowledgement'; first.heldNoticeSent = 123; first.heldNoticeSentAt = first.at + 1;
    const acknowledged = value(readJournalHistory(journal.view, 'owner-a', context));
    expect(value(acknowledged.latest(conversation, 50)).find(row => row.messageId === `${first.id}:ack`))
      .toMatchObject({ text: 'Acknowledgement', speakerRole: 'system' });
    journal.view.retracted = [first.id];
    const retracted = value(readJournalHistory(journal.view, 'owner-a', context));
    expect(value(retracted.latest(conversation, 50)).some(row => row.messageId.startsWith(first.id))).toBe(false);
  } finally { journal.close(); }
});

it('does not confuse prepared replies with delivery and preserves unknown work', () => {
  const { journal, context } = fixture();
  try {
    replay(journal, true);
    const read = value(readJournalHistory(journal.view, 'owner-b', context));
    expect(value(read.latest(conversation, 50)).every(row => row.speakerRole === 'user')).toBe(true);
    expect(read.work(conversation)).toHaveLength(journal.view.order.length);
    expect(read.work(conversation).every(row => (row.detail as { state: string }).state === 'unknown')).toBe(true);
    refused(read.coverage(conversation, 'telegram:8989505249:update:6233133:reply'), 'target absent');
  } finally { journal.close(); }
});

it('reads the recorded dated request as open work until its owner records cancellation', () => {
  const { journal, context } = fixture();
  try {
    replay(journal);
    const answer = captured.frames.find(row => row.kind === 'answer' && row.id.endsWith(':6233129'));
    if (!answer || answer.kind !== 'answer') throw Error('recorded reminder answer absent');
    const note = answer.dated![0]!;
    journal.view.dated.push(note);
    const open = value(readJournalHistory(journal.view, 'owner-a', context));
    expect(open.work(conversation)).toMatchObject([{ kind: 'request', source: note.source, detail: note }]);
    journal.view.reminderCancels.push(JSON.stringify([note.source, note.quote, note.when]));
    expect(value(readJournalHistory(journal.view, 'owner-a', context)).work(conversation)).toEqual([]);
    expect(open.work(conversation)).toHaveLength(1);
  } finally { journal.close(); }
});

it('uses raw coverage if a reply arriving after summary acceptance would create a hole', () => {
  const { journal, context } = fixture();
  try {
    replay(journal);
    const first = journal.view.order[0]!, second = journal.view.order[1]!;
    // A historical accepted frontier before the first reply's receipt; the next
    // covered input comes after that reply, so there is no contiguous prefix.
    journal.view.summaries.push({ kind: 'summary', through: second.update, text: 'old summary', at: first.at + 1 });
    first.sentAt = first.at + 10;
    second.at = first.at + 5;
    const read = value(readJournalHistory(journal.view, 'owner-a', context));
    // Never shrink the declared coverage while keeping prose about a wider span.
    expect(read.summaries(conversation)).toEqual([]);
    expect(value(read.coverage(conversation, `${first.id}:reply`)).messages.map(row => row.messageId)).toEqual([first.id, second.id, `${first.id}:reply`]);
    // An edit received after acceptance makes the old prose stale even if the
    // replacement would otherwise happen to occupy the same prefix position.
    first.editOf = 'old-provider-message'; first.at = journal.view.clockFloor + 1;
    expect(value(readJournalHistory(journal.view, 'owner-a', context)).summaries(conversation)).toEqual([]);
  } finally { journal.close(); }
});

it('reads only accepted live summaries and owner-folded commitments; candidates do not move coverage', () => {
  const { journal, context } = fixture();
  try {
    replay(journal);
    const through = 6233126, at = journal.view.clockFloor + 1;
    const source = 'telegram:8989505249:update:6233124';
    journal.append({ kind: 'summary-reserve', through, at });
    journal.append({ kind: 'summary-candidate', through, state: 'pending candidate', at });
    expect(value(readJournalHistory(journal.view, 'owner-a', context)).summaries(conversation)).toEqual([]);
    journal.append({ kind: 'summary', through, text: 'Recorded requests and delivered replies.', at,
      commitments: [{ in: 'message', source, quote: 'take the bread out of the freezer', owner: 'agent', waitsOn: 'date' }] });
    const accepted = value(readJournalHistory(journal.view, 'owner-a', context));
    expect(accepted.summaries(conversation)).toHaveLength(1);
    expect(accepted.work(conversation)).toMatchObject([{ kind: 'commitment', source }]);
    const covered = value(accepted.coverage(conversation, 'telegram:8989505249:update:6233133:reply'));
    expect(covered.summary?.covers).toHaveLength(6);
    expect(covered.messages).toHaveLength(6);
    journal.view.retiredSummaries = [0];
    journal.view.closed.set(0, { id: 0, source, quote: 'closed' });
    const retired = value(readJournalHistory(journal.view, 'owner-a', context));
    expect(retired.summaries(conversation)).toEqual([]);
    expect(retired.work(conversation)).toEqual([]);
    expect(accepted.summaries(conversation)).toHaveLength(1);
  } finally { journal.close(); }
});

// The input and received replies are the recorded walk, not invented equivalents.
// Writer/reviewer decisions here are boundary neighbors; the captured complete
// writer/Jev/subscription outputs run separately in summary-cascade-stall.test.ts.
it.each(['accepted', 'stale', 'missing-coverage', 'faithful-uncertainty'] as const)
  ('produces through the recorded walk and reopens exact coverage: %s', async mode => {
    const { journal, path, context } = fixture();
    try {
      replay(journal, false, 6233126);
      const last = journal.view.order.at(-1)!;
      const target = `${last.id}:reply`;
      const original = value(value(readJournalHistory(journal.view, 'owner-a', context)).coverage(conversation, target));
      const source = historyAdapter.journalSummarySource;
      const spy = mode === 'missing-coverage' ? vi.spyOn(historyAdapter, 'journalSummarySource')
        .mockImplementation((view, through) => ({ ...source(view, through), covers: [] })) : undefined;
      let calls = 0;
      const worker = createJournalWorker(journal, {
        now: () => 1792000000000, stopped: () => false, checkOutbound: () => {},
        send: async () => { throw Error('summary must never send'); },
        model: async input => {
          calls++;
          expect(input.id).toBe(`summary:${last.update}`);
          const packet = JSON.parse(input.context) as { history: { user: string; answer?: string }[] };
          const text = packet.history.flatMap(row => [row.user, row.answer ?? '']).join('\n');
          if (mode === 'stale') journal.view.order[0]!.text += ' Edited during the call.';
          return JSON.stringify({ summary: text + (mode === 'faithful-uncertainty'
            ? '\nThe initial bread-reminder response did not confirm the reminder.' : ''),
            people: [], commitments: [], closed: [], memory: [], memoryItems: [], questions: [] });
        },
        summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
        replyCheck: { elapsedMs: () => 0,
          jev: async () => ({ value: { model: 'jev-1.13.0', answers: { summary_integrity: { type: 'noul', noul: 0.01 } } }, latencyMs: 1 }),
          escalate: async () => { throw Error('no reply review'); } }
      });
      try { await worker.summarizeIfNeeded(true); } finally { spy?.mockRestore(); }
      const accepted = mode === 'accepted' || mode === 'faithful-uncertainty';
      expect(calls).toBe(mode === 'missing-coverage' ? 0 : 1);
      expect(journal.view.summaries).toHaveLength(accepted ? 1 : 0);
      if (accepted) {
        expect(journal.view.summaries[0]).toMatchObject({ through: last.update, covers: original.covered, faithfulness: { verdict: 'pass' } });
        if (mode === 'faithful-uncertainty') expect(journal.view.summaries[0]!.text).toContain('did not confirm');
      } else expect(journal.view.lastSummaryFailure?.reason).toContain(mode === 'stale' ? 'revision changed' : 'coverage missing');
      journal.close();
      const reopened = openPreviewJournal(path, key, undefined, undefined, true);
      try {
        const coverage = value(value(readJournalHistory(reopened.view, 'owner-a', context)).coverage(conversation, target));
        expect(coverage.covered).toEqual(original.covered);
        expect(coverage.summary !== null).toBe(accepted);
        if (!accepted) expect(coverage.messages).toEqual(original.messages);
      } finally { reopened.close(); }
    } finally { journal.close(); vi.restoreAllMocks(); }
  });

it.each([{ covers: [] }, { covers: ['not-a-source'] }])('refuses malformed persisted coverage before changing encrypted bytes: $covers', ({ covers }) => {
  const { journal, path } = fixture();
  try {
    replay(journal, false, 6233126);
    const through = journal.view.order.at(-1)!.update;
    journal.append({ kind: 'summary-reserve', through, at: 1792000000000 });
    const before = readFileSync(path);
    expect(() => journal.append({ kind: 'summary', through, covers, text: 'invalid coverage',
      at: 1792000000000 })).toThrow('summary coverage missing or malformed');
    expect(readFileSync(path)).toEqual(before);
    expect(journal.view.summaries).toEqual([]);
  } finally { journal.close(); }
});
