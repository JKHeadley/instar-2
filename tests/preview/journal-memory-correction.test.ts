import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(17);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1790000000 + id * 60 } });

function world(root: string, malformedMemory: false | 'missing' | 'invalid' | 'unresolved' | 'normal-summary' | 'normal-summary-unresolved' = false) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const prompts = new Map<string, string>();
  const summaryPrompts: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
    prepareModel: input => JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
    model: async input => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) {
        summaryPrompts.push(input.context);
        const request = packet.memoryRequest?.message as string | undefined;
        if (request && malformedMemory === 'missing') return JSON.stringify({ summary: 'No decision recorded.', people: [] });
        if (request && malformedMemory === 'invalid') return JSON.stringify({ summary: 'No decision recorded.', people: [],
          memory: [{ mode: 'forget', source: 'not-offered', quote: 'My gym locker code is 3310' }] });
        if (request && malformedMemory === 'unresolved') return JSON.stringify({ summary: 'No decision recorded.', people: [],
          memory: [], memoryDisposition: 'unresolved' });
        if (request && malformedMemory === 'normal-summary-unresolved') return JSON.stringify({ summary: 'No decision recorded.', people: [],
          memory: [], memoryDisposition: 'unresolved' });
        if (request === 'Please stop remembering my gym locker code.' && malformedMemory === 'normal-summary') {
          const old = (packet.memoryCandidates ?? []).find((item: { message: string }) => item.message.includes('My gym locker code is 3310'));
          return JSON.stringify({ summary: 'The operator asked to withhold a locker code.', people: [],
            memory: old ? [{ mode: 'forget', source: old.id, quote: 'My gym locker code is 3310' }] : [] });
        }
        if (request?.includes('Sam is my cousin')) {
          const old = (packet.memoryCandidates ?? []).find((item: { message: string }) => item.message.includes('Sam is my cofounder'));
          return JSON.stringify({ summary: 'Sam is the operator\'s cousin.', people: [], commitments: [], closed: [],
            memory: old ? [{ mode: 'correct', source: old.id, quote: 'Sam is my cofounder', replacement: 'Sam is my cousin' }] : [] });
        }
        const candidate = (packet.memoryCandidates ?? []).find((item: { message: string }) =>
          request?.includes('4412') ? item.message.includes('My gym locker code is 3310')
            : item.message.includes('my gym locker code is 4412') || item.message.includes('My gym locker code is 3310'));
        const replies = (packet.memoryCandidates ?? []).filter((item: { reply?: string }) =>
          item.reply === (request?.includes('4412') ? 'Your gym locker code is 3310.' : 'Your gym locker code is 4412.'))
          .map((item: { id: string }) => item.id);
        const memory = request && candidate ? [request.includes('4412')
          ? { mode: 'correct', source: candidate.id, quote: 'My gym locker code is 3310',
            replacement: 'my gym locker code is 4412', replies }
          : { mode: 'forget', source: candidate.id, quote: candidate.message.includes('4412')
            ? 'my gym locker code is 4412' : 'My gym locker code is 3310', replies }] : [];
        const summary = request?.includes('Forget') || packet.memory?.some((item: { mode: string }) => item.mode === 'forgotten')
          ? "Riley's gym locker code is 3310."
          : request?.includes('4412') || packet.memory?.some((item: { mode: string }) => item.mode === 'corrected')
            ? "The operator corrected their locker code to 4412. Riley's gym locker code is 3310."
            : "The operator said My gym locker code is 3310. Riley's gym locker code is 3310.";
        return JSON.stringify({ summary,
          people: [{ name: 'Sam', quote: 'Sam knows My gym locker code is 3310.' },
            { name: 'Riley', quote: "Riley's gym locker code is 3310." }],
          commitments: [{ in: 'message', quote: 'locker code is 3310' }], closed: [], memory });
      }
      prompts.set(input.question, input.context);
      if (malformedMemory === 'normal-summary' || malformedMemory === 'normal-summary-unresolved') return 'Acknowledged.';
      if (input.question === 'Please stop remembering my gym locker code.') {
        const old = (packet.memoryCandidates ?? []).find((item: { message: string }) => item.message.includes('My gym locker code is 3310'));
        return JSON.stringify({ reply: 'I will stop using that code.', memory: old
          ? [{ mode: 'forget', source: old.id, quote: 'My gym locker code is 3310' }] : [] });
      }
      if (input.question.includes('Who is Sam')) return packet.memory?.some((item: { replacement?: string }) =>
        item.replacement?.includes('Sam is my cousin')) ? 'Sam is your cousin.' : 'I do not know.';
      return packet.memory?.some((item: { mode: string }) => item.mode === 'forgotten') ? 'I do not have that code.'
        : packet.memory?.some((item: { mode: string; replacement?: string }) => item.mode === 'corrected'
          && item.replacement?.includes('4412')) ? 'Your gym locker code is 4412.'
          : input.question === 'What is my gym locker code?' ? 'Your gym locker code is 3310.' : 'I do not have that code.';
    }, send: async () => 1, checkOutbound: () => {} });
  const say = async (id: number, text: string, from?: number) => {
    worker.intake([update(id, text, from)]); await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, prompts, summaryPrompts, say };
}

it.each(['3310.', 'Sure, your gym locker code is 3310.'])('withholds the source reply %s while retaining unrelated memory', async answer => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-source-reply-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const prompts = new Map<string, string>();
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        prompts.set(input.question, input.context);
        if (input.question === 'Please stop remembering my gym locker code.') {
          const source = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('My gym locker code is 3310'));
          return JSON.stringify({ reply: 'Understood.', memory: [{ mode: 'forget', source: source.id,
            quote: 'My gym locker code is 3310' }] });
        }
        return input.question === 'My gym locker code is 3310.' ? answer : 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    for (const [id, message] of ['My gym locker code is 3310.', "Riley's gym locker code is 3310.",
      'Please stop remembering my gym locker code.', 'What is my gym locker code?'].entries()) {
      worker.intake([update(id + 1, message)]); await worker.drain();
    }
    const later = prompts.get('What is my gym locker code?')!;
    expect(JSON.parse(later).history[0].answer).toBe('[withheld: operator correction or forgetting]');
    expect(later).toContain("Riley's gym locker code is 3310.");
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('uses the bounded decision to remove an affected summary passage while keeping Riley', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-summary-passage-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let laterSummaryInput = '';
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          laterSummaryInput = input.context;
          return JSON.stringify({ summary: "Riley's locker code is 3310.", people: [], memory: [] });
        }
        if (input.question === 'Please stop remembering my gym locker code.') {
          const source = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('My gym locker code is 3310'));
          return JSON.stringify({ reply: 'Understood.', memory: [{ mode: 'forget', source: source.id,
            quote: 'My gym locker code is 3310', summaryPassages: ["The operator's locker code is 3310."] }] });
        }
        return 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 1, at: 1790000000000 });
    journal.append({ kind: 'summary', through: 1,
      text: "The operator's locker code is 3310. Riley's locker code is 3310.", at: 1790000000000 });
    worker.intake([update(2, 'Please stop remembering my gym locker code.')]); await worker.drain();
    expect(journal.view.memory).toHaveLength(1);
    await worker.summarizeIfNeeded(true);
    expect(laterSummaryInput).not.toContain("The operator's locker code is 3310.");
    expect(laterSummaryInput).toContain("Riley's locker code is 3310.");
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it.each([
  { name: 'unoffered reply', extra: { replies: ['telegram:12345678:update:99'] } },
  { name: 'unoffered summary passage', extra: { summaryPassages: ['The operator owns a red bicycle.'] } },
])('refuses an $name while retaining the original fact', async ({ extra }) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-unoffered-derived-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Unresolved request.', people: [],
          memory: [], memoryDisposition: 'unresolved' });
        if (input.question === 'Please stop remembering my gym locker code.') {
          const packet = JSON.parse(input.context);
          const source = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('My gym locker code is 3310'));
          return JSON.stringify({ reply: 'I forgot it.', memory: [{ mode: 'forget', source: source.id,
            quote: 'My gym locker code is 3310', ...extra }] });
        }
        return 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 1, at: 1790000000000 });
    journal.append({ kind: 'summary', through: 1, text: "The operator's locker code is 3310.", at: 1790000000000 });
    worker.intake([update(2, 'Please stop remembering my gym locker code.')]); await worker.drain();
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[1]?.memoryPending).toBe(true);
    expect(journal.view.order[1]?.sent).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('keeps an uncued unresolved ordinary summary pending through restart and the next summary', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-ordinary-unresolved-')));
  try {
    const w = world(root, 'normal-summary-unresolved');
    await w.say(1, 'My gym locker code is 3310.');
    await w.say(2, 'Please stop remembering my gym locker code.');
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.journal.view.summaryFailures.size).toBe(1);
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.order[1]?.memoryPending).toBe(true);
    w.journal.close();
    const resumed = world(root, 'normal-summary-unresolved');
    expect(resumed.journal.view.order[1]?.memoryPending).toBe(true);
    await resumed.say(3, 'Hello again.');
    expect(resumed.summaryPrompts.some(packet => JSON.parse(packet).memoryRequest?.message
      === 'Please stop remembering my gym locker code.')).toBe(true);
    expect(resumed.journal.view.order[1]?.memoryPending).toBe(true);
    expect(resumed.journal.view.summaries).toHaveLength(0);
    resumed.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('settles an uncued resolved ordinary summary across restart', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-ordinary-resolved-')));
  try {
    const w = world(root, 'normal-summary');
    await w.say(1, 'My gym locker code is 3310.');
    await w.say(2, 'Please stop remembering my gym locker code.');
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.summaries.at(-1)?.memoryFor).toEqual([w.journal.view.order[1]?.id]);
    expect(w.journal.view.order[1]?.memoryPending).toBeUndefined();
    w.journal.close();
    const resumed = world(root, 'normal-summary');
    expect(resumed.journal.view.order[1]?.memoryPending).toBeUndefined();
    await resumed.say(3, 'Hello again.');
    await resumed.worker.summarizeIfNeeded(true);
    expect(resumed.summaryPrompts.length).toBeGreaterThan(0);
    expect(resumed.summaryPrompts.every(packet => JSON.parse(packet).memoryRequest === undefined)).toBe(true);
    expect(resumed.journal.view.order[1]?.memoryPending).toBeUndefined();
    resumed.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('replays an invalid answer decision as pending after interruption at the answer frame', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-answer-replay-')));
  try {
    const path = join(root, 'journal.encrypted');
    let interrupt = false;
    const journal = openPreviewJournal(path, key, genesis, stage => {
      if (interrupt && stage === 'after:answer') throw Error('simulated process interruption');
    });
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async (input: { question: string }) => input.question === 'Please stop remembering my gym locker code.'
        ? JSON.stringify({ reply: 'I have forgotten that code.', memory: [{ mode: 'forget', source: 'not-offered',
          quote: 'My gym locker code is 3310' }] }) : 'Understood.',
      send: async () => 1, checkOutbound: () => {} };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    worker.intake([update(2, 'Please stop remembering my gym locker code.')]);
    interrupt = true;
    await expect(worker.drain()).rejects.toThrow('simulated process interruption');
    journal.close();
    const reopened = openPreviewJournal(path, key);
    const resumed = createJournalWorker(reopened, ports);
    await resumed.drain();
    expect(reopened.view.order[1]?.sent).toBeUndefined();
    expect(reopened.view.order[1]?.held).toBe('memory correction pending');
    expect(reopened.view.memory).toEqual([]);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('never sends a rejected acknowledgement after a later no-request decision', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-rejected-ack-')));
  try {
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis);
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string; question: string }) => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'A memory request was reviewed.', people: [], memory: [] })
        : input.question === 'Please stop remembering my gym locker code.'
          ? JSON.stringify({ reply: 'I have forgotten that code.', memory: [{ mode: 'forget', source: 'not-offered',
            quote: 'My gym locker code is 3310' }] }) : 'Understood.',
      send: async () => 1, checkOutbound: () => {} };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    worker.intake([update(2, 'Please stop remembering my gym locker code.')]); await worker.drain();
    expect(journal.view.order[1]?.intent).toBeUndefined();
    journal.close();
    const reopened = openPreviewJournal(path, key);
    await createJournalWorker(reopened, ports).drain();
    expect(reopened.view.memory).toEqual([]);
    expect(reopened.view.order[1]?.intent).toBe('PREVIEW — I reviewed your memory request.');
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('supersedes an old fact after rolling summary, leaves a similar fact intact, forgets, and replays across restart', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-change-')));
  try {
    let w = world(root);
    await w.say(1, 'Sam knows My gym locker code is 3310.');
    await w.say(2, "Riley's gym locker code is 3310.");
    let id = 3;
    while (!w.journal.view.summaries.length && id < 20) await w.say(id++, `Filler ${id}: ${'garden '.repeat(500)}`);
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    const question = 'What is my gym locker code?';
    await w.say(id++, question);
    expect(w.journal.view.order.at(-1)?.answer).toBe('Your gym locker code is 3310.');
    await w.say(id++, 'Actually my gym locker code is 4412, not 3310.');
    expect(w.journal.view.memory).toHaveLength(1);
    w.journal.close(); w = world(root);
    await w.say(id++, question);
    const corrected = JSON.parse(w.prompts.get(question)!);
    expect(w.journal.view.order.at(-1)?.answer).toBe('Your gym locker code is 4412.');
    expect(JSON.stringify(corrected)).not.toContain('My gym locker code is 3310');
    expect(JSON.stringify(corrected)).not.toContain('Your gym locker code is 3310');
    expect(JSON.stringify(corrected)).not.toContain('"quote":"locker code is 3310"');
    expect(JSON.stringify(corrected)).toContain("Riley's gym locker code is 3310");
    const sam = w.worker.probe('What does Sam know?');
    expect('reason' in sam).toBe(false);
    if (!('reason' in sam)) expect(JSON.parse(sam.context).people).toBeUndefined();
    await w.say(id++, 'Forget my gym locker code.');
    expect(w.journal.view.memory).toHaveLength(2);
    w.journal.append({ kind: 'coherence', id: w.journal.view.order.at(-1)!.id,
      findings: [{ rule: 96, check: 'possible stale quote', excerpt: 'My gym locker code is 3310' }],
      at: 1790000000000 });
    w.journal.close(); w = world(root);
    await w.say(id++, question);
    const forgotten = JSON.parse(w.prompts.get(question)!);
    expect(w.journal.view.order.at(-1)?.answer).toBe('I do not have that code.');
    expect(JSON.stringify(forgotten)).not.toContain('my gym locker code is 4412');
    expect(JSON.stringify(forgotten)).not.toContain('My gym locker code is 3310');
    expect(JSON.stringify(forgotten)).not.toContain('Your gym locker code is 3310');
    expect(JSON.stringify(forgotten)).not.toContain('Your gym locker code is 4412');
    expect(JSON.stringify(forgotten)).not.toContain('"quote":"locker code is 3310"');
    expect(JSON.stringify(forgotten)).toContain("Riley's gym locker code is 3310");
    const samAfterForget = w.worker.probe('What does Sam know?');
    expect('reason' in samAfterForget).toBe(false);
    if (!('reason' in samAfterForget)) expect(JSON.parse(samAfterForget.context).people).toBeUndefined();
    await w.say(id++, 'A later unrelated garden note.');
    await w.worker.summarizeIfNeeded(true);
    const laterSummaryInput = w.summaryPrompts.at(-1)!;
    expect(laterSummaryInput).not.toContain('my gym locker code is 4412');
    expect(laterSummaryInput).not.toContain('My gym locker code is 3310');
    expect(laterSummaryInput).not.toContain('Your gym locker code is 3310');
    expect(laterSummaryInput).not.toContain('Your gym locker code is 4412');
    expect(laterSummaryInput).not.toContain('"quote":"locker code is 3310"');
    expect(laterSummaryInput).toContain("Riley's gym locker code is 3310");
    expect(w.journal.view.order[0]?.text).toBe('Sam knows My gym locker code is 3310.');
    expect(w.journal.view.memory.map(change => change.mode)).toEqual(['correct', 'forget']);
    w.journal.close();
    const command = (mode: string) => spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', mode, '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    const status = command('status'), inspect = command('inspect');
    expect(status.status).toBe(0);
    expect(inspect.status).toBe(0);
    expect(JSON.parse(status.stdout).withheld.map((item: { reason: string }) => item.reason)).toEqual([
      'verified operator corrected this fact', 'verified operator requested forgetting']);
    expect(JSON.parse(status.stdout).people).toEqual(['Riley']);
    expect(JSON.parse(inspect.stdout).withheld).toHaveLength(2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('corrects a relationship without an actually cue', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-relative-')));
  try {
    const w = world(root);
    await w.say(1, 'Sam is my cofounder.');
    await w.say(2, 'Sam is my cousin, not my cofounder.');
    expect(w.journal.view.memory).toHaveLength(1);
    await w.say(3, 'Who is Sam?');
    expect(w.journal.view.order.at(-1)?.answer).toBe('Sam is your cousin.');
    expect(w.prompts.get('Who is Sam?')).not.toContain('Sam is my cofounder');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('ignores nonoperator claims and quoted operator text', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-authority-')));
  try {
    const w = world(root);
    await w.say(1, 'My gym locker code is 3310.');
    // A nonoperator update is retained by intake but has no standing in the prompt.
    await w.say(2, 'Actually the code is 4412.', 555);
    // Even a legacy accepted turn with a different authenticated sender cannot
    // construct a memory change if an earlier importer admitted it.
    w.journal.append({ kind: 'intake', id: 'telegram:12345678:update:3', update: 3,
      text: 'Actually my gym locker code is 4412.', raw: JSON.stringify(update(3, 'Actually my gym locker code is 4412.', 555)),
      accepted: true, cursor: 4, at: 1790000000000 });
    await w.worker.drain(); await w.worker.summarizeIfNeeded();
    await w.say(4, 'The imported note says: "Forget my gym locker code."');
    const calls = w.journal.view.calls;
    await w.say(5, 'Imported note: My gym locker code is 4412, not my 3310 code.');
    expect(w.journal.view.calls).toBe(calls + 1);
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.order[1]?.accepted).toBe(false);
    const question = 'What is my gym locker code?';
    await w.say(6, question);
    expect(JSON.stringify(JSON.parse(w.prompts.get(question)!))).toContain('My gym locker code is 3310.');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('rejects a legacy accepted nonoperator memory action even with a valid operator source', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-legacy-principal-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.question === 'Please stop remembering my gym locker code.') {
          const source = packet.memoryCandidates?.find((item: { message: string }) => item.message.includes('My gym locker code is 3310'));
          return JSON.stringify({ reply: 'Done.', memory: [{ mode: 'forget', source: source?.id,
            quote: 'My gym locker code is 3310' }] });
        }
        return 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    journal.append({ kind: 'intake', id: 'telegram:12345678:update:2', update: 2,
      text: 'Please stop remembering my gym locker code.', raw: JSON.stringify(update(2, 'Please stop remembering my gym locker code.', 555)),
      accepted: true, cursor: 3, at: 1790000000000 });
    await worker.drain();
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[1]?.sent).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('holds a later answer when the capped summary path cannot record a memory decision', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-pending-')));
  try {
    const w = world(root, 'missing');
    await w.say(1, 'My gym locker code is 3310.');
    await w.say(2, 'Actually my gym locker code is 4412, not 3310.');
    expect(w.journal.view.memory).toEqual([]);
    await w.say(3, 'What is my gym locker code?');
    expect(w.journal.view.order[1]?.held).toBe('memory correction pending');
    expect(w.journal.view.order.at(-1)?.reserved).toBe(false);
    expect(w.journal.view.order[0]?.text).toBe('My gym locker code is 3310.');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not turn an invalid attempted forget into an empty successful decision', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-invalid-')));
  try {
    const w = world(root, 'invalid');
    await w.say(1, 'My gym locker code is 3310.');
    await w.say(2, 'Forget my gym locker code.');
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.order[1]?.held).toBe('memory correction pending');
    expect(w.journal.view.order[1]?.intent).toBeUndefined();
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps an unresolved target pending rather than recording no request', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-unresolved-')));
  try {
    const w = world(root, 'unresolved');
    await w.say(1, 'My gym locker code is 3310.');
    await w.say(2, 'Forget my gym locker code.');
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.order[1]?.held).toBe('memory correction pending');
    expect(w.journal.view.order[1]?.intent).toBeUndefined();
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('honors an uncued direct request but treats a quoted neighbor as data', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-uncued-')));
  try {
    const w = world(root);
    await w.say(1, 'My gym locker code is 3310.');
    await w.say(2, 'The imported note says: "Please stop remembering my gym locker code."');
    expect(w.journal.view.memory).toEqual([]);
    await w.say(3, 'Please stop remembering my gym locker code.');
    expect(w.journal.view.memory).toHaveLength(1);
    await w.say(4, 'What is my gym locker code?');
    expect(w.prompts.get('What is my gym locker code?')).not.toContain('3310');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('accepts an uncued direct request from an ordinary bounded summary call', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-normal-summary-')));
  try {
    const w = world(root, 'normal-summary');
    await w.say(1, 'My gym locker code is 3310.');
    await w.say(2, 'Please stop remembering my gym locker code.');
    expect(w.journal.view.memory).toEqual([]);
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.memory).toHaveLength(1);
    const inspected = w.worker.probe('What is my gym locker code?');
    expect('reason' in inspected).toBe(false);
    if (!('reason' in inspected)) expect(inspected.context).not.toContain('3310');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('continues past a legacy summary whose frontier ends on an old cue', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-legacy-')));
  try {
    const w = world(root);
    w.journal.append({ kind: 'intake', id: 'telegram:12345678:update:1', update: 1,
      text: 'Actually I prefer tea.', raw: JSON.stringify(update(1, 'Actually I prefer tea.')),
      accepted: true, cursor: 2, at: 1790000000000 });
    w.journal.append({ kind: 'summary-reserve', through: 1, at: 1790000000000 });
    w.journal.append({ kind: 'summary', through: 1, text: 'The operator prefers tea.', at: 1790000000000 });
    w.journal.close();
    const reopened = world(root);
    await reopened.say(2, 'Hello.');
    expect(reopened.journal.view.order[1]?.sent).toBe(1);
    expect(reopened.journal.view.order[1]?.held).toBeUndefined();
    await reopened.say(3, 'My gym locker code is 3310.');
    await reopened.say(4, 'Forget my gym locker code.');
    expect(reopened.journal.view.memory).toHaveLength(1);
    expect(reopened.journal.view.order[3]?.sent).toBe(1);
    reopened.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
