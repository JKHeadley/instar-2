/** Constitutional build 2: memory and instructions survive every conversation boundary.
 * Rules 3, 10, 11, 17, 47, 96 and 110, each proved at the prepared provider input or the
 * journal record the live worker writes. The model and Telegram are stubs. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
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
    expect(instructions).toContain('If packet.compaction is present');
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

describe('Rule 11 and G6: recall reaches a paraphrase by meaning, with honest coverage', () => {
  const target = 'My bicycle lock code is 4471.';
  const build = (withConcepts: boolean) => {
    const dir = root();
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
    // Newer turns share a word with the question and would fill every lexical recall slot.
    seed(journal, [target, ...Array.from({ length: 24 }, (_, i) => `Bike ride notes ${i}: hills and flats. ${'y'.repeat(3000)}`)]);
    summarize(journal, 25, 'The operator rides often and keeps ride notes.', withConcepts
      ? [{ source: 'telegram:12345678:update:1', terms: ['bike', 'combination', 'padlock', 'lock combination'] }] : undefined);
    const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    return { dir, journal, worker };
  };
  it('a question sharing no word with the original reaches it through the summary-maintained meaning terms', () => {
    for (const withConcepts of [true, false]) {
      const { dir, journal, worker } = build(withConcepts);
      try {
        const packet = probe(worker, 'What is the combination for my bike?');
        expect(packet.historyMode).toBe('summary-plus-recent');
        expect(JSON.stringify(packet.recalled ?? []).includes('4471'), `concepts=${withConcepts}`).toBe(withConcepts);
        expect(packet.meaningIndexCoverage).toMatchObject({ summarizedMessages: 25, meaningIndexed: withConcepts ? 1 : 0 });
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

describe('Rule 110: the first reply after a model-context compaction discloses it and accounts for the last message', () => {
  const plumber = `Can you check the plumber quote? ${'Line item detail. '.repeat(260)}`;
  const setup = (maxBytes: number, reply: (packet: Packet) => string) => {
    const dir = root();
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(maxBytes));
    const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
      model: async ({ context }) => reply(JSON.parse(context) as Packet), send: async () => 1, checkOutbound: () => {} });
    seedAnswered(journal, Array.from({ length: 30 }, (_, i) => i === 29 ? plumber : `Update ${i}: errands.`));
    return { dir, journal, worker };
  };
  const accounted = (packet: Packet) => {
    const last = (packet.compaction as { lastInbound: { id: string } } | undefined)?.lastInbound.id;
    return JSON.stringify({ reply: 'Earlier conversation is summarized now. You asked about the plumber quote; it looks fair.',
      memory: [], ...(last ? { compactionAccount: { lastInbound: last, disposition: 'answering-now', disclosure: 'Earlier conversation is summarized now.' } } : {}) });
  };
  it('is not a compaction while the last message is still verbatim in history or recalled', async () => {
    const { dir, journal, worker } = setup(1024 * 1024, accounted);
    try {
      expect(probe(worker, 'Hello again').compaction).toBeUndefined();
      summarize(journal, 30, 'Thirty updates, ending with a plumber quote question.');
      const packet = probe(worker, 'Hello again');
      expect(packet.historyMode).toBe('complete');
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('carries the exact last inbound id once it is out of verbatim view, and records the model account', async () => {
    const { dir, journal, worker } = setup(7000, accounted);
    try {
      summarize(journal, 30, 'Thirty updates, ending with a plumber quote question.');
      const packet = probe(worker, 'Hello again');
      expect(packet.historyMode).toBe('summary-plus-recent');
      expect(JSON.stringify(packet.recalled ?? [])).not.toContain('Line item detail');
      expect(packet.compaction).toMatchObject({ lastInbound: { id: 'telegram:12345678:update:30' }, summarizedThrough: 30 });
      worker.intake([update(31, 'Hello again')]); await worker.drain();
      const turn = journal.view.turns.get('telegram:12345678:update:31')!;
      expect(turn.compaction).toEqual({ lastInbound: 'telegram:12345678:update:30', summarizedThrough: 30,
        disposition: 'answering-now', by: 'model' });
      expect(turn.intent).toContain('Earlier conversation is summarized now.');
      journal.close();
      // The account is durable: it replays from the journal.
      const reopened = openPreviewJournal(join(dir, 'journal.encrypted'), key);
      expect(reopened.view.turns.get('telegram:12345678:update:31')!.compaction?.by).toBe('model');
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('an unaccounted first reply gets a fixed disclosure naming the exact last message', async () => {
    const { dir, journal, worker } = setup(7000, () => 'Hi!');
    try {
      summarize(journal, 30, 'Thirty updates.');
      worker.intake([update(31, 'Hello again')]); await worker.drain();
      const turn = journal.view.turns.get('telegram:12345678:update:31')!;
      expect(turn.compaction).toMatchObject({ lastInbound: 'telegram:12345678:update:30', by: 'fixed', disposition: 'answered' });
      expect(turn.intent).toMatch(/Earlier conversation is now summarized for me\. Your last message before this one \(.+\) was answered\. Hi!/u);
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
