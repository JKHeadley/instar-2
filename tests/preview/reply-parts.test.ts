import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, sendOutcomeCounts, TOO_LONG_REPLY_NOTICE, type JournalView } from './journal.js';
import { encodeReply, fitsOneMessage, MAX_REPLY_PARTS, splitReply, TELEGRAM_MESSAGE_LIMIT } from './reply-parts.js';
import { RETRO_FOLLOWUP_PREDATES, dutiesLeftUninspected, retrospectiveStatusBrief, retrospectiveStatusLine, type RetrospectiveDuty } from './retrospective.js';

/** Plan row #466 (w4-statuslen). Live L45 group I (I-proofroom2-20261003-232346): "What is your status?" got the too-long
 * notice instead of its answer, twice (updates 6232050 and 6232056), once the fixed status pull carried the full
 * retrospective line. Every replay below starts from the RECORDED shapes in status-reply-split-live-2026-10-03.json:
 * the three status answers the root's journal holds (one sent, two refused as too long), the notice that was sent,
 * and the root's two recorded retrospective passes. */
const LIVE = JSON.parse(readFileSync(new URL('./fixtures/status-reply-split-live-2026-10-03.json', import.meta.url), 'utf8')) as {
  statusAnswers: { update: number; outcome: string; answer: string }[]; noticeSent: string;
  retroPasses: { pass: number; at: number; reason: string | null; dutyFollowUp: unknown; efficiency: { summary: string }; inspected: string[];
    duties: { duty: RetrospectiveDuty; disposition: 'inspected' | 'unavailable'; note: string }[] }[] };
const answerOf = (update: number) => LIVE.statusAnswers.find(row => row.update === update)!.answer;
const reassembled = (parts: readonly string[]) => parts.map((part, index) => index === 0 ? part.replace(/ \(1\/\d+\)$/u, '')
  : part.replace(/^PREVIEW \(\d+\/\d+\) — /u, '')).join('\n');
/** The I.sh I1d predicate on a reply text. */
const i1d = (text: string) => text.includes('Retrospective review') && text.includes('inspected') && text.includes('efficiency duty ran');

const key = new Uint8Array(32).fill(23);
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });

describe('splitReply: at, and just over, the Telegram limit', () => {
  it('a reply exactly at the limit is one message, unchanged; one byte over is two, in order, losing nothing', () => {
    const at = `PREVIEW — ${'a'.repeat(TELEGRAM_MESSAGE_LIMIT - Buffer.byteLength('PREVIEW — '))}`;
    expect(Buffer.byteLength(at)).toBe(TELEGRAM_MESSAGE_LIMIT);
    expect(splitReply(at)).toEqual([at]);
    const over = `${at}a`;
    const parts = splitReply(over)!;
    expect(parts).toHaveLength(2);
    expect(parts[0]!.endsWith(' (1/2)')).toBe(true);
    expect(parts[1]!.startsWith('PREVIEW (2/2) — ')).toBe(true);
    expect(parts.every(fitsOneMessage)).toBe(true);
    expect(reassembled(parts).replaceAll('\n', '')).toBe(over);
  });

  it('measures the HTML body Telegram receives: 1200 "<" (4800 encoded bytes) is split, not refused', () => {
    const reply = `PREVIEW — ${'<'.repeat(1200)}`;
    expect(fitsOneMessage(reply)).toBe(false);
    const parts = splitReply(reply)!;
    expect(parts.length).toBe(2);
    for (const part of parts) expect(Buffer.byteLength(encodeReply(part))).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
  });

  it('keeps a request tail whole in the last message', () => {
    const body = Array.from({ length: 80 }, (_, index) => `Line ${String(index)}: ${'detail '.repeat(10)}`).join('\n');
    const tail = '\n\nApprove raising the reply cap to 40? Reply yes to approve.';
    const parts = splitReply(`PREVIEW — ${body}${tail}`, tail)!;
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.at(-1)!.endsWith(tail.trim())).toBe(true);
    expect(parts.slice(0, -1).some(part => part.includes('Approve raising'))).toBe(false);
  });

  it('the other side: past MAX_REPLY_PARTS messages it is null (the notice remains, for that alone)', () => {
    const words = 'word '.repeat(Math.ceil(TELEGRAM_MESSAGE_LIMIT * MAX_REPLY_PARTS / 5) + 100);
    expect(splitReply(`PREVIEW — ${words}`)).toBeNull();
    expect(splitReply(`PREVIEW — ${'word '.repeat(Math.floor(TELEGRAM_MESSAGE_LIMIT * (MAX_REPLY_PARTS - 1) / 5))}`)).not.toBeNull();
  });

  it('replays the three recorded status answers: 3240 bytes is one message; 4139 and 4184 are two, cut at a line break', () => {
    expect(splitReply(`PREVIEW — ${answerOf(6232038)}`)).toHaveLength(1);
    for (const update of [6232050, 6232056]) {
      const reply = `PREVIEW — ${answerOf(update)}`;
      expect(fitsOneMessage(reply), String(update)).toBe(false);
      const parts = splitReply(reply)!;
      expect(parts, String(update)).toHaveLength(2);
      expect(reassembled(parts), String(update)).toBe(reply);
      // The cut falls between whole status lines: every line of the answer arrives intact.
      const lines = new Set(reassembled(parts).split('\n'));
      for (const line of reply.split('\n')) expect(lines.has(line), line.slice(0, 40)).toBe(true);
    }
  });
});

function world(answer: (text: string) => string, path?: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-parts-')));
  const file = path ?? join(root, 'journal.encrypted');
  const journal = path ? openPreviewJournal(file, key) : openPreviewJournal(file, key, genesis());
  const sent: { text: string; target: string }[] = [];
  let refuse: (target: string) => 'unknown' | 'refused' | 'throw' | null = () => null;
  let stopped = false, message = 100;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
    model: async (input: { context: string }) => answer(input.context), checkOutbound: () => {},
    send: async ({ expectedText, target }) => {
      const verdict = refuse(target ?? '');
      if (verdict === 'throw') throw Error('process died mid-send');
      sent.push({ text: expectedText, target: target ?? '' });
      return verdict === null ? message++ : { kind: verdict, reason: `transport ${verdict}` };
    } });
  return { root, file, journal, worker, sent,
    refuse: (fn: typeof refuse) => { refuse = fn; }, stop: (value: boolean) => { stopped = value; },
    done: () => { try { journal.close(); } catch { /* closed by the test */ } rmSync(root, { recursive: true, force: true }); } };
}

describe('the worker sends a long answer as several messages, in order, once each', () => {
  it('the recorded 4139-byte status answer, as an answer: two sends in order, never the too-long notice', async () => {
    const recorded = answerOf(6232050);
    const w = world(() => recorded);
    try {
      w.worker.intake([update(1, 'Tell me everything.')]); await w.worker.drain();
      const turn = w.journal.view.order[0]!;
      expect(turn.intent).toBe(`PREVIEW — ${recorded}`);
      expect(turn.intent).not.toBe(TOO_LONG_REPLY_NOTICE);
      expect(w.sent.map(item => item.target)).toEqual([`reply:${turn.id}`, `reply-part:2:${turn.id}`]);
      expect(reassembled(w.sent.map(item => item.text))).toBe(turn.intent);
      expect(turn.sent).toBe(100);
      expect(turn.replyParts).toEqual([expect.objectContaining({ started: true, sent: 101 })]);
      expect(sendOutcomeCounts(w.journal.view)).toMatchObject({ accepted: 2, unknown: 0 });
      // One reply against the reply cap, and nothing is sent again on a later drain or a reopen.
      expect(w.journal.view.replies).toBe(1);
      await w.worker.drain();
      w.journal.close();
      const reopened = openPreviewJournal(w.file, key);
      expect(reopened.view.order[0]!.replyParts).toEqual(turn.replyParts);
      reopened.close();
      expect(w.sent).toHaveLength(2);
    } finally { w.done(); }
  });

  it('the other side: an answer that fits is one message with no parts', async () => {
    const w = world(() => answerOf(6232038));
    try {
      w.worker.intake([update(1, 'status please, in prose')]); await w.worker.drain();
      expect(w.sent).toHaveLength(1);
      expect(w.journal.view.order[0]!.replyParts).toBeUndefined();
    } finally { w.done(); }
  });

  it('a later part whose outcome is UNKNOWN is never re-sent, and the parts after it are not sent out of order', async () => {
    const long = Array.from({ length: 300 }, (_, index) => `Point ${String(index)} of the answer, with some detail.`).join('\n');
    const w = world(() => long);
    try {
      w.refuse(target => target.startsWith('reply-part:2:') ? 'unknown' : null);
      w.worker.intake([update(1, 'Explain.')]); await w.worker.drain();
      const turn = w.journal.view.order[0]!;
      expect(turn.replyParts!.length).toBeGreaterThanOrEqual(2);
      expect(w.sent.map(item => item.target.split(':')[0])).toEqual(['reply', 'reply-part']);
      w.refuse(() => null);
      await w.worker.drain();
      w.journal.close();
      const reopened = world(() => long, w.file);
      try { await reopened.worker.drain(); expect(reopened.sent).toEqual([]); } finally { reopened.journal.close(); }
      expect(sendOutcomeCounts(openPreviewJournal(w.file, key, undefined, undefined, true).view)).toMatchObject({ accepted: 1, unknown: 1 });
    } finally { w.done(); }
  });

  it('a refused part stops the rest; a crash after its start leaves it UNKNOWN, not re-sent', async () => {
    const long = 'Sentence of the answer. '.repeat(600);
    const refused = world(() => long);
    try {
      refused.refuse(target => target.startsWith('reply-part:2:') ? 'refused' : null);
      refused.worker.intake([update(1, 'Explain.')]); await refused.worker.drain();
      expect(refused.sent.map(item => item.target.split(':')[0])).toEqual(['reply', 'reply-part']);
      expect(sendOutcomeCounts(refused.journal.view)).toMatchObject({ accepted: 1, refused: 1 });
    } finally { refused.done(); }
    const crashed = world(() => long);
    try {
      // The process dies during part 2's dispatch: its start row is durable, and no receipt or outcome ever follows.
      const copy = join(crashed.root, 'mid-send.encrypted');
      crashed.refuse(target => { if (target.startsWith('reply-part:2:')) copyFileSync(crashed.file, copy); return null; });
      crashed.worker.intake([update(1, 'Explain.')]); await crashed.worker.drain();
      const resumed = world(() => long, copy);
      try {
        expect(resumed.journal.view.order[0]!.replyParts![0]).toMatchObject({ started: true });
        expect(resumed.journal.view.order[0]!.replyParts![0]!.sent).toBeUndefined();
        await resumed.worker.drain();
        expect(resumed.sent).toEqual([]);
        expect(sendOutcomeCounts(resumed.journal.view)).toMatchObject({ accepted: 1, unknown: 1 });
      } finally { resumed.journal.close(); }
    } finally { crashed.done(); }
  });

  it('parts not yet started when the process stopped are sent on resume, in order, exactly once; stop holds them', async () => {
    const long = Array.from({ length: 400 }, (_, index) => `Item ${String(index)}: kept in order.`).join('\n');
    const w = world(() => long);
    try {
      // The first message is accepted; the stop latches before any later part starts.
      w.refuse(target => { if (target.startsWith('reply:')) w.stop(true); return null; });
      w.worker.intake([update(1, 'List them.')]);
      await expect(w.worker.drain()).rejects.toThrow('preview stopped');
      const turn = w.journal.view.order[0]!;
      expect(turn.sent).toBeDefined();
      expect(turn.replyParts!.length).toBeGreaterThanOrEqual(2);
      expect(turn.replyParts!.every(part => !part.started)).toBe(true);
      // While stopped, nothing more is sent.
      await expect(w.worker.drain()).rejects.toThrow('preview stopped');
      expect(w.sent).toHaveLength(1);
      w.journal.close();
      const resumed = world(() => long, w.file);
      try {
        await resumed.worker.drain();
        expect(resumed.sent.map(item => item.target)).toEqual(turn.replyParts!.map((_, index) => `reply-part:${String(index + 2)}:${turn.id}`));
        expect(reassembled([w.sent[0]!.text, ...resumed.sent.map(item => item.text)])).toBe(turn.intent);
        await resumed.worker.drain();
        expect(resumed.sent).toHaveLength(turn.replyParts!.length);
      } finally { resumed.journal.close(); }
    } finally { w.done(); }
  });
});

describe('a split reply settles what it carries only when its last message is accepted', () => {
  const KEPT = 'Count on me to bring up the tomato watering at the top of my next reply.';
  const DONE = 'As promised: water the tomatoes this evening.';
  const longReply = `${'Here is the long part of the answer, line by line.\n'.repeat(120)}${DONE}`;
  const run = async (lastPart: 'accepted' | 'refused') => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-parts-settle-')));
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    try {
      const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
        prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
          { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
        model: async ({ question }) => question.startsWith('Promise')
          ? JSON.stringify({ reply: `Sure. ${KEPT}`, memory: [], promises: [{ quote: KEPT }] })
          : JSON.stringify({ reply: longReply, memory: [], promises: [], fulfilled: [{ id: 0, quote: DONE }] }),
        checkOutbound: () => {},
        send: async ({ target }) => target?.startsWith('reply-part:') && lastPart === 'refused'
          ? { kind: 'refused' as const, reason: 'transport refused' } : 1 });
      worker.intake([update(1, 'Promise to mention the tomato watering next time.')]); await worker.drain();
      expect(journal.view.commitments[0]?.agentPromise?.quote).toBe(KEPT);
      worker.intake([update(2, 'Tell me everything about the garden.')]); await worker.drain();
      const turn = journal.view.order[1]!;
      expect(turn.replyParts?.length).toBe(1);
      expect(turn.replyParts![0]!.text).toContain(DONE);
      return { sentFirst: turn.sent, closed: journal.view.closed.has(0) };
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  };

  it('every message accepted: the promise the reply carries out closes', async () => {
    expect(await run('accepted')).toEqual({ sentFirst: 1, closed: true });
  });

  it('the other side: the first message accepted but the last refused: the promise stays open', async () => {
    expect(await run('refused')).toEqual({ sentFirst: 1, closed: false });
  });
});

describe('the status reply carries the retrospective line in brief (I1d), and one message holds it', () => {
  const recordedPass = LIVE.retroPasses.at(-1)!;
  const legacyView = { retroPasses: [{ pass: recordedPass.pass, at: recordedPass.at, turnsSeen: 38, cases: recordedPass.inspected,
    omitted: Array.from({ length: 28 }, (_, index) => ({ case: `answer:omitted-${String(index)}`, reason: 'bound' })), eligible: 38,
    packetSha256: 'sha256:recorded', contextDigest: 'sha256:recorded', state: 'complete', completedAt: recordedPass.at,
    result: { inspected: recordedPass.inspected, omitted: [], duties: recordedPass.duties, findings: [], grades: [], feedback: [],
      authorizations: [], comparisons: [], closures: [], gravityWells: [], efficiency: recordedPass.efficiency } }],
  dated: [], turns: new Map(), order: [] } as unknown as JournalView;

  it('the recorded pass ran before the follow-up existed: it names the nine duties the follow-up would ask, and says why they stand', () => {
    expect(recordedPass.dutyFollowUp).toBeNull();
    expect(recordedPass.reason).toBeNull();
    expect(dutiesLeftUninspected({ duties: recordedPass.duties })).toEqual(['unsupported-reversal', 'recurrence', 'removable-attention',
      'workaround', 'standing-grant', 'refuted-reason', 'process-tier', 'proportionality', 'benchmark-divergence']);
    const brief = retrospectiveStatusBrief(legacyView);
    expect(i1d(brief)).toBe(true);
    expect(brief).toContain(`9 of 14 duties not inspected although their evidence was present (${RETRO_FOLLOWUP_PREDATES})`);
    expect(retrospectiveStatusLine(legacyView)).toContain(`benchmark-divergence (${RETRO_FOLLOWUP_PREDATES})`);
    expect(brief.length).toBeLessThan(400);
  });

  it('with the brief line in place of the full one, both refused recorded status answers fit one message', () => {
    const brief = retrospectiveStatusBrief(legacyView);
    for (const update of [6232050, 6232056]) {
      const lines = answerOf(update).split('\n');
      const full = lines.findIndex(line => line.startsWith('Retrospective review:'));
      expect(i1d(lines[full]!), String(update)).toBe(true);
      lines[full] = brief;
      const reply = `PREVIEW — ${lines.join('\n')}`;
      expect(fitsOneMessage(reply), String(update)).toBe(true);
      expect(i1d(reply), String(update)).toBe(true);
    }
    // The recorded notice was the other side: it carried no retrospective line at all.
    expect(i1d(LIVE.noticeSent)).toBe(false);
  });

  it('the status pull itself carries the brief line and never the notice', async () => {
    const w = world(() => 'unused');
    try {
      w.worker.intake([update(1, 'What is your status?')]); await w.worker.drain();
      const reply = w.journal.view.order[0]!.intent!;
      expect(reply).toContain('Retrospective review: not run yet.');
      expect(reply).not.toBe(TOO_LONG_REPLY_NOTICE);
    } finally { w.done(); }
  });
});
