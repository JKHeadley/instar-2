/** Constitutional build 2: memory and instructions survive every conversation boundary.
 * Rules 3, 10, 11, 17, 47, 96 and 110, each proved at the prepared provider input or the
 * journal record the live worker writes. The model and Telegram are stubs. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { continuityDisclosure, createJournalWorker, MODEL_FAILURE_REPLY, openPreviewJournal, withDisclosure } from './journal.js';
import { HOLDING_REPLY } from './reply-check.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { ANSWER_INSTRUCTIONS, MIND_RULES, verifyMindRules } from './briefing.js';

const key = new Uint8Array(32).fill(52), at = 1790000000000;
const genesis = (maxBytes = 1024 * 1024) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-boundaries-')));
type Packet = Record<string, unknown> & { historyMode: string; history: unknown[] };

/** Appends accepted operator turns without answering them (the replay-test pattern). */
function seed(journal: ReturnType<typeof openPreviewJournal>, texts: readonly string[]) {
  texts.forEach((text, index) => {
    const turn = journal.view.order.length + 1;
    journal.append({ kind: 'intake', id: `telegram:12345678:update:${turn}`, update: turn, text,
      raw: JSON.stringify({ update_id: turn, message: { from: { id: 7654321 }, text } }),
      accepted: true, cursor: turn + 1, at: at + turn + index * 0 });
  });
}
/** Appends accepted operator turns already answered and delivered (the clarification-harness pattern). */
function seedAnswered(journal: ReturnType<typeof openPreviewJournal>, texts: readonly string[]) {
  for (const text of texts) {
    const turn = journal.view.order.length + 1, id = `telegram:12345678:update:${turn}`;
    journal.append({ kind: 'intake', id, update: turn, text, raw: JSON.stringify({ update_id: turn, message: { from: { id: 7654321 }, text } }),
      accepted: true, cursor: turn + 1, at: at + turn });
    journal.append({ kind: 'reserve', id, at: at + turn });
    journal.append({ kind: 'answer', id, text: 'Noted.', state: 'complete', at: at + turn });
    journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: '7654321', update: turn, grant: 'grant:preview', at: at + turn });
    journal.append({ kind: 'sent', id, message: turn, at: at + turn });
  }
}
function summarize(journal: ReturnType<typeof openPreviewJournal>, through: number, text: string,
  concepts?: { source: string; terms: string[] }[]) {
  journal.append({ kind: 'summary-reserve', through, at: at + through });
  journal.append({ kind: 'summary', through, text, ...(concepts ? { concepts } : {}), at: at + through });
}
const probe = (worker: ReturnType<typeof createJournalWorker>, text: string) => {
  const result = worker.probe(text);
  if (!('context' in result)) throw Error(`probe held: ${JSON.stringify(result)}`);
  return JSON.parse(result.context) as Packet;
};

describe('Rules 3 and 17: the body/mind and agency instructions are delivered as instructions', () => {
  it('every prepared envelope carries the mind-held rules outside the quoted context', () => {
    const prepared = JSON.parse(prepareJournalEnvelope({ question: 'hello', context: JSON.stringify({ history: [] }), id: 'x' },
      'claude-opus-5-5', 'grant:preview', at, 131072)) as { messages: { role: string; content: string }[] };
    expect(prepared.messages.map(item => item.role)).toEqual(['user', 'context', 'instructions']);
    const instructions = prepared.messages[2]!.content;
    expect(instructions).toBe(ANSWER_INSTRUCTIONS);
    expect(instructions).toContain('promises:[{quote:exact reply sentence');
    expect(instructions).toContain('If packet.continuity is present');
    expect(instructions).toContain('Rule 3 — The Body and the Mind: The agent is two intelligences');
    expect(instructions).toContain('Rule 17 — Architectural Agency in the Gap: Between what the model is biased to do');
    expect(instructions).toContain('not an operator message, not quoted data');
    expect(instructions).toContain('secrets, the spend cap, stop, no duplicate sends and durable intake');
    for (const [rule] of MIND_RULES) expect(instructions).toContain(`Rule ${rule} — `);
    // The quoted data channel does not carry it: the instruction is not an excerpt among sources.
    expect(prepared.messages[1]!.content).not.toContain('The Body and the Mind');
  });

  it('launch refuses when the rule book no longer states a delivered rule', () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
    expect(() => verifyMindRules(read)).not.toThrow();
    expect(() => verifyMindRules(path => read(path).replace('The body informs; the mind has final say.', 'The body decides.')))
      .toThrow('mind rule 3 changed');
  });
});

// Rule 47's parity assertion lives in the existing live-script compaction fixture
// (journal-commitments.test.ts, 'the live script reaches compaction ...'), at prepared provider input.

describe('Rule 96: fitting complete history is never replaced by a summary because of wording', () => {
  it('a commitment question below the allowance receives every original turn, like any other question', () => {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
      seed(journal, ['Please remember my gym locker code is 4417.', 'Remind me to call the dentist before Friday.',
        ...Array.from({ length: 10 }, (_, i) => `Ordinary update ${i + 3}: errands and weather.`)]);
      summarize(journal, 12, 'Early summary: locker code and dentist call.');
      const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
        model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
      for (const question of ['What colour is my bike?', 'What commitments do I have?', 'Anything open? What did I promise?']) {
        const packet = probe(worker, question);
        expect(packet.historyMode, question).toBe('complete');
        expect(packet.history, question).toHaveLength(12);
      }
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('Rule 10: meaning decides which intentions reach judgment, never a keyword list', () => {
  it('offers the summary-scheduling decision and bounded memory search whatever the wording', () => {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
      seed(journal, ['My bicycle is vermilion.', ...Array.from({ length: 30 }, (_, i) => `Update ${i}: ${'x'.repeat(2500)}`)]);
      summarize(journal, 31, 'The operator owns a vermilion bicycle.');
      const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
        model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
      // A paraphrase with none of the old keywords (summar/recap/digest/brief).
      expect(probe(worker, 'Send me a rundown tomorrow at noon').summaryDecision).toEqual(expect.any(String));
      // No remember/recall/memory/know/learned word, yet the compacted history is searchable.
      const packet = probe(worker, 'What colour is my bicycle?');
      expect(packet.historyMode).toBe('summary-plus-recent');
      expect(packet.memorySearch).toBeDefined();
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('records a model-proposed promise in any wording and closes it on the reply that carries it out', async () => {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
      const promise = 'Tomorrow morning the dentist call goes back in front of you.';
      const contexts: Packet[] = [];
      const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
        model: async ({ question, context }) => {
          contexts.push(JSON.parse(context) as Packet);
          if (question.startsWith('Keep')) return JSON.stringify({ reply: `Done. ${promise}`, memory: [], promises: [{ quote: promise, when: 'Tomorrow morning' }] });
          const offered = (JSON.parse(context) as { commitments?: { items: { id: number; owner?: string }[] }[] }).commitments
            ?.flatMap(group => group.items).find(item => item.owner === 'agent');
          return JSON.stringify({ reply: 'Here it is: call the dentist about the crown.', memory: [],
            fulfilled: offered ? [{ id: offered.id, quote: 'call the dentist about the crown' }] : [] });
        }, send: async () => 1, checkOutbound: () => {} });
      worker.intake([update(1, 'Keep the dentist call in view for me.')]); await worker.drain();
      const recorded = journal.view.commitments.find(item => item.agentPromise);
      expect(recorded).toMatchObject({ in: 'reply', quote: promise, agentPromise: { action: 'promised', owner: 'agent' } });
      const id = journal.view.commitments.indexOf(recorded!);
      expect(journal.view.closed.has(id)).toBe(false);
      worker.intake([update(2, 'Bring it up now please.')]); await worker.drain();
      expect(journal.view.closed.has(id)).toBe(true);
      journal.close();
      // Durable: the closure replays from the journal.
      const reopened = openPreviewJournal(join(dir, 'journal.encrypted'), key);
      expect(reopened.view.closed.has(id)).toBe(true);
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a reply without a proposal opens no promise, whatever it says', async () => {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
      const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
        model: async () => 'I’ll remind you to call the dentist tomorrow.', send: async () => 1, checkOutbound: () => {} });
      worker.intake([update(1, 'Hello')]); await worker.drain();
      expect(journal.view.commitments.some(item => item.agentPromise)).toBe(false);
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});


describe('Rule 11 and G6: recall reaches a paraphrase by meaning through the recall owner', () => {
  const target = 'My bicycle lock code is 4471.';
  const targetId = 'telegram:12345678:update:1';
  const cues = ['bike', 'combination', 'padlock', 'lock combination'];
  const note = (i: number) => `Bike ride notes ${i}: hills and flats. ${'Long climb, steady pace. '.repeat(24)}`;
  /** The live worker end to end: answers and rolling summaries go through the real paths; the model is a stub. */
  const live = (concepts: (context: string) => { source: string; terms: string[] }[]) => {
    const dir = root();
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(12 * 1024));
    const summaryContexts: string[] = [];
    const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false, send: async () => 1, checkOutbound: () => {},
      // The summary's faithfulness check passes (a stand-in for Jev), so rolling summaries advance normally.
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0 } } }),
      model: async input => {
        if (!input.id.startsWith('summary:')) return 'Noted.';
        summaryContexts.push(input.context);
        return JSON.stringify({ summary: 'The operator rides often and keeps ride notes.', people: [], questions: [], memory: [],
          concepts: concepts(input.context) });
      } });
    return { dir, journal, worker, summaryContexts };
  };
  const drive = async (worker: ReturnType<typeof createJournalWorker>, count: number) => {
    worker.intake([update(1, target)]); await worker.drain();
    for (let i = 0; i < count; i++) { worker.intake([update(i + 2, note(i))]); await worker.drain(); }
  };
  /** What reached the prepared answer input as recalled originals. */
  const recalledIds = (packet: Packet) => (packet.recalled as { id?: string; user?: string }[] ?? []).map(item => `${item.id} ${item.user ?? ''}`);

  it('a source indexed by the real summary pass is reached later through the real doorway under lexical-slot pressure', async () => {
    for (const indexed of [true, false]) {
      const { dir, journal, worker } = live(context => indexed && context.includes(targetId) ? [{ source: targetId, terms: cues }] : []);
      try {
        await drive(worker, 24);
        expect(journal.view.summaries.length).toBeGreaterThan(0);
        expect(journal.view.summaries.some(item => item.concepts?.some(c => c.source === targetId))).toBe(indexed);
        const packet = probe(worker, 'What is the combination for my bike?');
        expect(packet.historyMode).toBe('summary-plus-recent');
        // Pressure: the word ranker alone fills every slot with newer "Bike ride notes".
        const ride = recalledIds(packet).filter(text => text.includes('Bike ride notes')).length;
        expect(ride).toBeGreaterThanOrEqual(2);
        expect(recalledIds(packet).some(text => text.includes('4471')), `indexed=${indexed}`).toBe(indexed);
        expect(packet.meaningIndexCoverage).toMatchObject({ meaningIndexed: indexed ? 1 : 0, disposition: 'degraded' });
        journal.close();
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  });

  it('messages summarized before they had meaning terms are offered again and converge', async () => {
    let backlogSeen = false;
    const { dir, journal, worker, summaryContexts } = live(context => {
      const packet = JSON.parse(context) as { indexBacklog?: { id: string }[] };
      if (!packet.indexBacklog?.some(item => item.id === targetId)) return [];
      backlogSeen = true;
      return [{ source: targetId, terms: cues }];
    });
    try {
      await drive(worker, 24);
      expect(backlogSeen).toBe(true);
      // The first summary covered the target with no terms; a later pass indexed it from the backlog.
      const first = journal.view.summaries.findIndex(item => item.through >= 1);
      expect(journal.view.summaries[first]!.concepts ?? []).toEqual([]);
      expect(journal.view.summaries.slice(first + 1).some(item => item.concepts?.some(c => c.source === targetId))).toBe(true);
      expect(summaryContexts.some(context => context.includes('"indexBacklog"'))).toBe(true);
      const packet = probe(worker, 'What is the combination for my bike?');
      expect(recalledIds(packet).some(text => text.includes('4471'))).toBe(true);
      journal.close();
      const reopened = openPreviewJournal(join(dir, 'journal.encrypted'), key);
      expect(reopened.view.summaries.some(item => item.concepts?.some(c => c.source === targetId))).toBe(true);
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a charging semantic reranker is refused by the ordinary zero helper budget; a zero-charge one is used', () => {
    for (const charge of [1, 0]) {
      const dir = root();
      try {
        const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(12 * 1024));
        seed(journal, [target, ...Array.from({ length: 24 }, (_, i) => note(i))]);
        summarize(journal, 25, 'The operator rides often and keeps ride notes.');
        let calls = 0;
        const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
          model: async () => 'ok', send: async () => 1, checkOutbound: () => {},
          recallReranker: { id: 'test-semantic', chargePerCall: charge, rerank: (_query, candidates) => {
            calls++;
            return { kind: 'Success', value: candidates.flatMap((text, index) => text.includes('bicycle') ? [index] : []) } as never;
          } } });
        const packet = probe(worker, 'What is the combination for my bike?');
        expect(calls).toBe(charge ? 0 : 2);
        expect(recalledIds(packet).some(text => text.includes('4471'))).toBe(!charge);
        journal.close();
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  });

  it('refuses invalid meaning terms at replay', () => {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
      seed(journal, [target]);
      journal.append({ kind: 'summary-reserve', through: 1, at });
      expect(() => journal.append({ kind: 'summary', through: 1, text: 's',
        concepts: [{ source: 'telegram:12345678:update:9', terms: ['bike'] }], at })).toThrow('meaning terms');
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('Rule 110: the first reply sent from a compacted context discloses it and accounts for the last message', () => {
  const plumber = `Can you check the plumber quote? ${'Line item detail. '.repeat(260)}`;
  const setup = (maxBytes: number, texts: readonly string[], reply: (packet: Packet) => string,
    extra: Partial<Parameters<typeof createJournalWorker>[1]> = {}) => {
    const dir = root();
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(maxBytes));
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
      model: async ({ context }) => reply(JSON.parse(context) as Packet), send: async input => { sent.push(input.expectedText); return sent.length + 100; },
      checkOutbound: () => {}, ...extra });
    seedAnswered(journal, texts);
    return { dir, journal, worker, sent };
  };
  const garden = [...Array.from({ length: 29 }, (_, i) => `Update ${i}: ${'garden '.repeat(240)}`), 'The latest short message.'];
  const errands = [...Array.from({ length: 29 }, (_, i) => `Update ${i}: errands.`), plumber];
  const disclosure = /^PREVIEW — Earlier conversation up to #29 is now summarized for me; your previous message \(#30, [^)]+\) was answered\. /u;

  it('a context reduced to summary-plus-recent is a compaction even while the last message is still verbatim', async () => {
    const { dir, journal, worker, sent } = setup(7000, garden, () => 'Hi!');
    try {
      summarize(journal, 29, 'Twenty-nine garden updates.');
      const packet = probe(worker, 'Hello again');
      expect(packet.historyMode).toBe('summary-plus-recent');
      expect(JSON.stringify(packet.history)).toContain('The latest short message.');
      expect(packet.continuity).toEqual({ through: 29, lastInbound: 'telegram:12345678:update:30', state: 'addressed' });
      worker.intake([update(31, 'Hello again')]); await worker.drain();
      expect(sent[0]).toMatch(disclosure);
      expect(sent[0]!.endsWith(' Hi!')).toBe(true);
      const turn = journal.view.turns.get('telegram:12345678:update:31')!;
      expect(turn.continuity).toMatchObject({ prePauseInbound: 'telegram:12345678:update:30', summarizedThrough: 29,
        disposition: 'addressed', reference: 'Telegram message 30', grounding: turn.grounding!.packetSha256 });
      expect(sent[0]!.startsWith(`PREVIEW — ${turn.continuity!.disclosure} `)).toBe(true);
      // The next reply from the same frontier owes nothing more.
      worker.intake([update(32, 'And one more thing')]); await worker.drain();
      expect(sent[1]).toBe('PREVIEW — Hi!');
      expect(probe(worker, 'Hello').continuity).toBeUndefined();
      journal.close();
      const reopened = openPreviewJournal(join(dir, 'journal.encrypted'), key);
      expect(reopened.view.turns.get('telegram:12345678:update:31')!.continuity?.disposition).toBe('addressed');
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('complete history is not a compaction, even when a summary exists', () => {
    const { dir, journal, worker } = setup(1024 * 1024, garden, () => 'Hi!');
    try {
      summarize(journal, 29, 'Twenty-nine garden updates.');
      const packet = probe(worker, 'Hello again');
      expect(packet.historyMode).toBe('complete');
      expect(packet.continuity).toBeUndefined();
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('the disclosure survives a size notice and a holding reply, and is bound to the text actually sent', async () => {
    const tooLong = setup(7000, errands, () => 'x'.repeat(4100));
    try {
      summarize(tooLong.journal, 30, 'Errands and a plumber quote question.');
      tooLong.worker.intake([update(31, 'Hello again')]); await tooLong.worker.drain();
      expect(tooLong.sent[0]).toMatch(/^PREVIEW — Earlier conversation up to #30 is now summarized for me; your previous message \(#30, [^)]+\) was answered\. I produced an answer, but it was too long/u);
      const turn = tooLong.journal.view.turns.get('telegram:12345678:update:31')!;
      expect(turn.continuity?.replyDigest).toBe(createHash('sha256').update(turn.intent!).digest('hex'));
      tooLong.journal.close();
    } finally { rmSync(tooLong.dir, { recursive: true, force: true }); }
    const held = setup(7000, errands, () => 'An answer the review holds.', {
      replyCheck: { elapsedMs: () => 1, jev: async () => { throw Error('Jev unavailable'); },
        // cint-2: an ordinary objection is advisory (build 3); an untracked deferral still holds (build 4).
        escalate: async () => ({ verdict: 'violation' as const, ruleIds: ['defers_work'], confidence: null, latencyMs: 1 }) } });
    try {
      summarize(held.journal, 30, 'Errands and a plumber quote question.');
      held.worker.intake([update(31, 'Hello again')]); await held.worker.drain();
      const turn = held.journal.view.turns.get('telegram:12345678:update:31')!;
      expect(held.sent[0]).toBe(withDisclosure(HOLDING_REPLY, turn.continuity!.disclosure));
      held.journal.close();
      const reopened = openPreviewJournal(join(held.dir, 'journal.encrypted'), key);
      expect(reopened.view.turns.get('telegram:12345678:update:31')!.continuity).toBeDefined();
      reopened.close();
    } finally { rmSync(held.dir, { recursive: true, force: true }); }
    // cint-2: build 3's one revision round replaces the draft; the disclosure is re-applied by code to the
    // revised text actually sent, never handed to the model to reproduce, and the account replays.
    const drafts: string[] = [];
    const revised = setup(32768, garden, () => 'Look in /Users/me/notes for it.', {
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', at + 100_000, 32768),
      replyCheck: { elapsedMs: () => 1, jev: async () => { throw Error('Jev unavailable'); },
        escalate: async () => ({ verdict: 'violation' as const, ruleIds: ['raw_path'], confidence: null, latencyMs: 1 }),
        revise: async (input: { text: string }) => { drafts.push(input.text);
          return { state: 'complete' as const, text: 'It is in your notes folder.' }; } } });
    try {
      summarize(revised.journal, 29, 'Twenty-nine garden updates.');
      revised.worker.intake([update(31, 'Hello again')]); await revised.worker.drain();
      const turn = revised.journal.view.turns.get('telegram:12345678:update:31')!;
      expect(drafts).toEqual(['PREVIEW — Look in /Users/me/notes for it.']);
      expect(turn.release).toMatchObject({ review: 'violation', objections: ['raw_path'], revised: true });
      expect(revised.sent[0]).toBe(withDisclosure('PREVIEW — It is in your notes folder.', turn.continuity!.disclosure));
      expect(turn.continuity?.replyDigest).toBe(createHash('sha256').update(turn.intent!).digest('hex'));
      revised.journal.close();
      const reopened = openPreviewJournal(join(revised.dir, 'journal.encrypted'), key);
      expect(reopened.view.turns.get('telegram:12345678:update:31')!.continuity).toBeDefined();
      reopened.close();
    } finally { rmSync(revised.dir, { recursive: true, force: true }); }
  }, 30_000);

  it('an unanswered last message is accounted as pending, never as answered', async () => {
    const { dir, journal, worker, sent } = setup(7000, garden.slice(0, 29), () => 'Hi!');
    try {
      seed(journal, ['The latest short message.']);
      journal.append({ kind: 'hold', id: 'telegram:12345678:update:30', reason: 'call cap', at });
      summarize(journal, 29, 'Twenty-nine garden updates.');
      const packet = probe(worker, 'Hello again');
      expect(packet.continuity).toEqual({ through: 29, lastInbound: 'telegram:12345678:update:30', state: 'pending' });
      expect(continuityDisclosure('#30, x', 29, 'pending', 'held: call cap')).toBe(
        'Earlier conversation up to #29 is now summarized for me; your previous message (#30, x) is still open (held: call cap).');
      expect(sent).toEqual([]);
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('only a delivered disclosure retires the obligation: an UNKNOWN send carries its pre-pause message forward across restart', async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis(7000));
    try {
      seedAnswered(journal, garden);
      summarize(journal, 29, 'Twenty-nine garden updates.');
      const sent: string[] = [];
      const ports = { now: () => at + 100_000, stopped: () => false, model: async () => 'Hi!', checkOutbound: () => {},
        send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length === 1 ? null : sent.length + 100; } };
      let worker = createJournalWorker(journal, ports);
      worker.intake([update(31, 'Hello again')]); await worker.drain();
      const first = journal.view.turns.get('telegram:12345678:update:31')!;
      expect(first.sent).toBeUndefined();
      expect(first.continuity?.prePauseInbound).toBe('telegram:12345678:update:30');
      journal.close();
      journal = openPreviewJournal(path, key);
      worker = createJournalWorker(journal, ports);
      worker.intake([update(32, 'And one more thing')]); await worker.drain();
      // The UNKNOWN send is never replayed; the next reply discloses the same episode, for #30.
      expect(sent).toHaveLength(2);
      expect(sent[1]).toMatch(disclosure);
      const second = journal.view.turns.get('telegram:12345678:update:32')!;
      expect(second.sent).toBe(102);
      expect(second.continuity).toMatchObject({ prePauseInbound: 'telegram:12345678:update:30', summarizedThrough: 29, disposition: 'addressed' });
      // Once delivered, the same frontier owes nothing more (the accepted-send positive).
      worker.intake([update(33, 'Thanks')]); await worker.drain();
      expect(sent[2]).toBe('PREVIEW — Hi!');
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a delivered failure notice is accounted as still open with its real outcome, never as answered', async () => {
    const { dir, journal, worker, sent } = setup(7000, garden.slice(0, 29), () => 'Hi!');
    try {
      const id = 'telegram:12345678:update:30';
      seed(journal, ['Please answer my plumber question']);
      journal.append({ kind: 'reserve', id, at });
      journal.append({ kind: 'answer', id, text: MODEL_FAILURE_REPLY, state: 'complete', failureClass: 'empty', at });
      journal.append({ kind: 'intent', id, text: `PREVIEW — ${MODEL_FAILURE_REPLY}`, chat: '7654321', update: 30, grant: 'grant:preview', at });
      journal.append({ kind: 'sent', id, message: 30, at });
      summarize(journal, 29, 'Twenty-nine garden updates.');
      expect(probe(worker, 'Hello again').continuity).toEqual({ through: 29, lastInbound: id, state: 'pending' });
      worker.intake([update(31, 'Hello again')]); await worker.drain();
      expect(sent[0]).not.toContain('was answered');
      expect(sent[0]).toMatch(/your previous message \(#30, [^)]+\) is still open \(model failure notice delivered \(empty\) as Telegram message 30, not an answer\)\. Hi!$/u);
      journal.close();
      const reopened = openPreviewJournal(join(dir, 'journal.encrypted'), key);
      expect(reopened.view.turns.get('telegram:12345678:update:31')!.continuity).toMatchObject({ disposition: 'pending',
        reference: 'model failure notice delivered (empty) as Telegram message 30, not an answer' });
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('replay refuses an account whose disclosure is not the sent text', () => {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(7000));
      seedAnswered(journal, garden);
      summarize(journal, 29, 'Garden.');
      const id = 'telegram:12345678:update:31';
      seed(journal, ['Hello again']);
      journal.append({ kind: 'reserve', id, grounding: { packetSha256: 'p', summaryThrough: 29, compactedThrough: 29, history: [], recalled: [],
        people: [], commitments: [], channelItems: [], corrections: [], memoryChanges: [], memoryCandidates: [] }, at });
      journal.append({ kind: 'answer', id, text: 'Hi!', state: 'complete', at });
      const before = journal.view.turns.get('telegram:12345678:update:30')!;
      const account = { prePauseInbound: before.id, capture: createHash('sha256').update(before.raw).digest('hex'), summarizedThrough: 29,
        grounding: 'p', disposition: 'addressed' as const, reference: 'Telegram message 30',
        disclosure: continuityDisclosure('#30, x', 29, 'addressed', 'Telegram message 30') };
      const text = 'PREVIEW — Everything is fine today.';
      expect(() => journal.append({ kind: 'intent', id, text, chat: '7654321', update: 31, grant: 'grant:preview',
        continuity: { ...account, replyDigest: createHash('sha256').update(text).digest('hex') }, at })).toThrow('continuity account refused');
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
