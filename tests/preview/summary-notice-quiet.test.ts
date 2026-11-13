// Incident shapes supplied by the desk: 969390727 / message 787 and messages 813/814.
// Construct journals with the production writer; no claim that the answer below is a captured quotation.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal, replyBody, withDisclosure } from './journal.js';
import { statusReply } from './status-command.js';
import { doorwayNotices } from './credential-reminders.js';
import { installDoorways, observeExchange, standingDoorwayCheck } from './doorway-map.js';

const key = new Uint8Array(32).fill(42), at = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 16000, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const answered = 'Note: the earlier part of our conversation is now summarized for me; your last request before that was answered.';
const pending = 'Note: the earlier part of our conversation is now summarized for me, and your last request before that is still open: no finished answer to it was confirmed.';

for (const state of ['answered', 'pending', 'unsent', 'unconfirmed', 'failed'] as const)
it(`969390727 answers first and discloses last when the previous request is ${state}`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'summary-notice-quiet-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis);
  const previous = 969390726, current = 969390727, answer = 'The most frequently changed files are listed below.';
  const sent: string[] = [];
  try {
    for (const [n, text] of [[previous, 'Check the earlier commit history.'], [current,
      'go through the last 30 commits on EchoOfDawn/instar and tell me which files changed most often']] as const) {
      journal.append({ kind: 'intake', id: id(n), update: n, text, raw: JSON.stringify({ update_id: n, message: { text } }),
        accepted: true, cursor: n + 1, at });
      if (n === previous && state !== 'pending') {
        journal.append({ kind: 'reserve', id: id(n), at });
        if (state === 'failed') journal.append({ kind: 'model-uncertain', id: id(n), state: 'uncertain', at });
        else journal.append({ kind: 'answer', id: id(n), text: 'The earlier answer.', state: 'complete', at });
        if (state === 'answered' || state === 'unconfirmed') {
          journal.append({ kind: 'intent', id: id(n), text: 'The earlier answer.', chat: genesis.chat, update: n, grant: genesis.grant, at });
          if (state === 'answered') journal.append({ kind: 'sent', id: id(n), message: 786, at });
        }
      }
    }
    journal.append({ kind: 'summary-reserve', through: previous, at });
    journal.append({ kind: 'summary', through: previous, text: 'Earlier conversation about commit history.', at });
    journal.append({ kind: 'reserve', id: id(current), grounding: { packetSha256: 'recorded-shape', summaryThrough: previous,
      compactedThrough: previous, history: [], recalled: [], people: [], commitments: [], channelItems: [],
      corrections: [], memoryChanges: [], memoryCandidates: [] }, at });
    journal.append({ kind: 'answer', id: id(current), text: answer, state: 'complete', at });
    const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
      model: async () => ({ state: 'uncertain' as const }),
      checkOutbound: text => { if (state === 'unsent' && text.includes('The earlier answer.')) throw Error('injected outbound hold'); },
      send: async input => { sent.push(input.expectedText); return 787; } });
    await worker.drain();
    const turn = journal.view.turns.get(id(current))!;
    expect(turn.intent).toBe(`${answer}\n\n${state === 'answered' ? answered : pending}`);
    expect(sent).toContain(turn.intent);
    expect(turn.continuity).toMatchObject({ prePauseInbound: id(previous), disposition: state === 'answered' ? 'addressed' : 'pending', replyDigest: sha(turn.intent!) });
    expect(replyBody(turn)).toBe(answer);
    expect(statusReply(journal.view, at, 'UTC')).toContain(`Earlier conversation summarized through update: ${previous}.`);
    expect(statusReply(journal.view, at, 'UTC')).toContain('Idle worker cleanup: 0 workers closed; accepted messages kept.');
    const cleanupStatus = statusReply({ ...journal.view, reapHistory: { main: { total: 3, last: 'private-worker-id' } } }, at, 'UTC');
    expect(cleanupStatus).toContain('Idle worker cleanup: 3 workers closed; accepted messages kept.');
    expect(cleanupStatus).not.toContain('private-worker-id');
    const recorded = turn.intent;
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.turns.get(id(current))!.intent).toBe(recorded);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('preserves an answer quoting the pending disclosure through intent, send and body extraction', async () => {
  const root = mkdtempSync(join(tmpdir(), 'summary-notice-quote-')), path = join(root, 'journal');
  const journal = openPreviewJournal(path, key, genesis), sent: string[] = [];
  const answer = `The notice you asked about reads:\n\n${pending}\n\nIt means the earlier request still needs an answer.`;
  try {
    for (const n of [1, 2]) journal.append({ kind: 'intake', id: id(n), update: n,
      text: n === 1 ? 'Check the earlier commit history.' : 'What does the notice mean?',
      raw: JSON.stringify({ update_id: n, message: { text: 'What does the notice mean?' } }), accepted: true, cursor: n + 1, at });
    journal.append({ kind: 'summary-reserve', through: 1, at });
    journal.append({ kind: 'summary', through: 1, text: 'The earlier request still needs an answer.', at });
    journal.append({ kind: 'reserve', id: id(2), grounding: { packetSha256: 'quoted-notice', summaryThrough: 1,
      compactedThrough: 1, history: [], recalled: [], people: [], commitments: [], channelItems: [],
      corrections: [], memoryChanges: [], memoryCandidates: [] }, at });
    journal.append({ kind: 'answer', id: id(2), text: answer, state: 'complete', at });
    await createJournalWorker(journal, { now: () => at, stopped: () => false,
      model: async () => ({ state: 'uncertain' as const }), checkOutbound: () => {},
      send: async input => { sent.push(input.expectedText); return 787; } }).drain();
    const turn = journal.view.turns.get(id(2))!;
    expect(turn.answer).toBe(answer);
    expect(turn.intent).toBe(`${answer}\n\n${pending}`);
    expect(sent).toContain(turn.intent);
    expect(replyBody(turn)).toBe(answer);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('replays the old prefix and its exact digest without reassembly', () => {
  const root = mkdtempSync(join(tmpdir(), 'summary-notice-old-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis);
  try {
    for (const n of [1, 2]) journal.append({ kind: 'intake', id: id(n), update: n, text: 'Commit history', raw: `raw-${n}`, accepted: true, cursor: n + 1, at });
    journal.append({ kind: 'reserve', id: id(2), grounding: { packetSha256: 'old', summaryThrough: 1, compactedThrough: 1,
      history: [], recalled: [], people: [], commitments: [], channelItems: [], corrections: [], memoryChanges: [], memoryCandidates: [] }, at });
    journal.append({ kind: 'answer', id: id(2), text: 'Here are the files.', state: 'complete', at });
    const disclosure = 'Earlier conversation is now summarized for me. Your previous request is still open; no finished answer is confirmed.';
    const text = `${disclosure} Here are the files.`;
    journal.append({ kind: 'intent', id: id(2), text, chat: genesis.chat, update: 2, grant: genesis.grant,
      continuity: { prePauseInbound: id(1), capture: sha('raw-1'), summarizedThrough: 1, grounding: 'old', disposition: 'pending',
        reference: 'no reply from me yet', disclosure, replyDigest: sha(text) }, at });
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.turns.get(id(2))!.intent).toBe(text);
    expect(replyBody(journal.view.turns.get(id(2))!)).toBe('Here are the files.');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('813/814 route health remains available to the status producer', () => {
  const installed = installDoorways(null, [{ id: 'typesafe-jev', model: 'jev-1.13.0',
    billing: 'subscription', priceReason: 'subscription' }], at);
  const map = standingDoorwayCheck(observeExchange(installed, 'typesafe-jev', 'jev-1.13.0',
    { ok: false, reason: 'exit', evidence: 'recorded-shape:813/814' }, at), at);
  const notices = doorwayNotices(map, at);
  expect(notices[0]?.line).toBe('Model route check: typesafe-jev/jev-1.13.0 is unavailable.');

});

it('preserves captured summary, uncertain verdict, review, delivered and empty bytes when presenting disclosure last', () => {
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes as { kind: string; id: string; raw: string }[];
  expect(shapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided', 'jev-unsure',
    'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  for (const row of shapes) {
    // Presentation does not parse/reinterpret these recorded bytes; the old PREVIEW marker alone is removed.
    const intent = withDisclosure(row.raw, pending);
    expect(intent.endsWith(`\n\n${pending}`), row.id).toBe(true);
    expect(replyBody({ intent, continuity: { prePauseInbound: row.id, capture: sha(row.raw), summarizedThrough: 1,
      grounding: 'shape', disposition: 'pending', reference: 'recorded shape', disclosure: pending, replyDigest: sha(intent) } }))
      .toBe(row.raw.replace(/^PREVIEW — /u, '').trimEnd());
  }
});
