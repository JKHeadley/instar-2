import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, projectMemoryClause } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { memoryReport } from './memory-export.js';
import { auditPacket } from './journal-audit.mjs';

const key = new Uint8Array(32).fill(47), now = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-7654321', operator: '7654321', forum: true as const,
  grant: 'grant:fixture', configurationDigest: 'sha256:fixture', expires: now + 86400000,
  maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const quote = 'the desk test word is lantern-4817';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const raw = (update: number, text: string, topic = 1, from = 7654321, chat = -7654321) => ({ update_id: update,
  message: { message_id: update, message_thread_id: topic, chat: { id: chat, type: 'supergroup', is_forum: true }, from: { id: from }, text } });
function world() {
  const root = mkdtempSync(join(tmpdir(), 'remember-fact-')); dirs.push(root);
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), allowed = true, changeBeforeSend = false;
  const packets: string[] = [], sends: string[] = [];
  const ports = { now: () => now, stopped: () => false, groupDisclosure: async () => allowed,
    prepareModel: (input: { question: string; context: string; id: string }) => prepareJournalEnvelope(input, 'fixture-model', genesis.grant, now, 32768),
    model: async (input: { id: string; question: string; context: string }) => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) {
        const candidate = packet.memoryCandidates?.find((item: { message: string }) => item.message.includes(quote));
        return JSON.stringify({ summary: 'The operator discussed a saved fact.', people: [], memory:
          packet.memoryRequest?.message === 'forget the desk test word' && candidate
            ? [{ mode: 'forget', source: candidate.id, quote }] : [] });
      }
      packets.push(input.context);
      if (changeBeforeSend) allowed = false;
      if (input.question === `remember ${quote}`) {
        expect(packet.memoryDecision).toContain('mode:"remember"');
        return JSON.stringify({ reply: 'Noted.', memory: [{ mode: 'remember', source: input.id, quote }] });
      }
      if (input.question === 'what do you remember?') return JSON.stringify({ reply: 'Listing.', memory: [], memoryList: true });
      const found = packet.memory?.find((item: { mode: string }) => item.mode === 'remembered');
      return JSON.stringify({ reply: found?.replacement ?? 'No saved fact.', memory: [] });
    }, checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  let worker = createJournalWorker(journal, ports);
  return { get journal() { return journal; }, get worker() { return worker; }, ports, packets, sends,
    allow: (value: boolean) => { allowed = value; }, revokeDuringAnswer: () => { changeBeforeSend = true; },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); },
    turn: async (id: number, text: string, topic = 1) => { worker.intake([raw(id, text, topic)]); await worker.drain(); await worker.summarizeIfNeeded(); } };
}

it('saves in topic 3, recalls in topic 1 and after restart, lists it and forgets it without duplicate sends', async () => {
  const w = world();
  try {
    await w.turn(1, `remember ${quote}`, 3);
    expect(w.journal.view.memory).toMatchObject([{ mode: 'remember', quote }]);
    expect(w.sends.at(-1)).toBe('Saved the requested fact.');
    expect(projectMemoryClause(w.journal.view, quote)).toBe(quote);
    expect(memoryReport(w.journal.view)).toContain('lantern');
    await w.turn(2, 'what is the desk test word?');
    expect(w.sends.at(-1)).toBe(quote);
    const packet = JSON.parse(w.packets.at(-1)!);
    expect(packet.memory[0].sourceLabel).toContain('topic 3');
    expect(auditPacket(w.journal.view, w.journal.view.order.at(-1)!, packet).findings).toEqual([]);
    w.reopen(); await w.worker.drain(); expect(w.sends).toHaveLength(2);
    await w.turn(3, 'what is the desk test word?'); expect(w.sends.at(-1)).toBe(quote);
    await w.turn(4, 'what do you remember?'); expect(w.sends.at(-1)).toContain(quote);
    await w.turn(5, 'forget the desk test word');
    expect(w.journal.view.memory.some(item => item.mode === 'forget')).toBe(true);
    w.reopen(); await w.turn(6, 'what is the desk test word?');
    expect(w.sends.at(-1)).toBe('No saved fact.');
    expect(w.packets.at(-1)).not.toContain('lantern-4817');
    expect(memoryReport(w.journal.view)).not.toContain('lantern');
  } finally { w.journal.close(); }
});

it.each(['shared', 'revoked-before-send'])('withholds private saved facts when audience is %s', async scenario => {
  const w = world();
  try {
    await w.turn(1, `remember ${quote}`, 3); w.reopen();
    if (scenario === 'shared') w.allow(false); else w.revokeDuringAnswer();
    await w.turn(2, 'what is the desk test word?');
    expect(w.journal.view.order.at(-1)?.accepted).toBe(true);
    expect(w.sends).toEqual(['Saved the requested fact.']);
    if (scenario === 'shared') expect(w.packets).toHaveLength(1);
  } finally { w.journal.close(); }
});

it.each(['unverified-author', 'other-chat', 'invented-quote', 'wrong-source', 'shared-audience', 'reply-metadata'])('rejects a remember insertion with %s', async scenario => {
  const w = world();
  try {
    if (scenario === 'shared-audience') w.allow(false);
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async input => JSON.stringify({ reply: 'Noted.', memory: [{
      mode: 'remember', source: scenario === 'wrong-source' ? 'another-turn' : input.id,
      quote: scenario === 'invented-quote' ? 'an invented fact absent from the operator message' : quote,
      ...(scenario === 'reply-metadata' ? { replies: ['another-turn'] } : {}) }] }) });
    worker.intake([raw(1, `remember ${quote}`, 3, scenario === 'unverified-author' ? 1234 : 7654321,
      scenario === 'other-chat' ? -1234 : -7654321)]); await worker.drain();
    expect(w.journal.view.memory).toEqual([]);
  } finally { w.journal.close(); }
});

// Exact archived live/proof-room bytes, including the empty reply retained in a recorded context.
// An empty historical context is not evidence of an empty Telegram delivery.
const recorded = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(recorded.otherShapes.flatMap(row => [false, true].map(resaved => ({ ...row, resaved }))))('saved fact survives real $kind output shape from $id (resaved=$resaved)', async row => {
  const w = world();
  try {
    await w.turn(1, `remember ${quote}`, 3); w.reopen();
    if (row.resaved) { await w.turn(2, 'forget the desk test word'); await w.turn(3, `remember ${quote}`, 3); w.reopen(); }
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async input => {
      expect(input.context).toContain('"mode":"remembered"');
      expect(input.context).toContain(quote);
      return row.kind === 'summary-uncertain' ? JSON.parse(row.raw) : row.raw;
    } });
    worker.intake([raw(4, 'what is the desk test word?')]); await worker.drain();
    expect(w.journal.view.memory.at(-1)).toMatchObject({ mode: 'remember', quote });
    expect(w.journal.view.memory).toHaveLength(row.resaved ? 3 : 1);
    expect(w.sends.every(text => text.trim().length > 0)).toBe(true);
    w.reopen(); await w.turn(5, 'what is the desk test word?'); expect(w.sends.at(-1)).toBe(quote);
  } finally { w.journal.close(); }
});

it('the summary recovery path can insert a direct request and replay it without a second insertion', async () => {
  const w = world();
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async input => {
      const packet = JSON.parse(input.context);
      if (!input.id.startsWith('summary:')) return JSON.stringify({ reply: 'Noted.', memory: [{
        mode: 'remember', source: 'unoffered-source', quote }] });
      expect(input.question).toContain('mode:"remember"');
      return JSON.stringify({ summary: 'The operator asked for a fact to be saved.', people: [], memory: [{
        mode: 'remember', source: packet.memoryRequest.id, quote }] });
    } });
    worker.intake([raw(1, `remember ${quote}`, 3)]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(w.journal.view.memory).toMatchObject([{ mode: 'remember', quote }]);
    w.reopen(); await w.turn(2, 'what is the desk test word?');
    expect(w.sends.at(-1)).toBe(quote); expect(w.journal.view.memory).toHaveLength(1);
  } finally { w.journal.close(); }
});

it('an ordinary or quoted request with an empty model decision keeps intake without creating a fact', async () => {
  const w = world();
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => JSON.stringify({ reply: 'Understood.', memory: [] }) });
    worker.intake([raw(1, `Forwarded text: "remember ${quote}"`, 3)]); await worker.drain();
    expect(w.journal.view.order[0]?.accepted).toBe(true);
    expect(w.journal.view.memory).toEqual([]);
    expect(w.sends).toEqual(['Understood.']);
  } finally { w.journal.close(); }
});

it('forgetting a repeated saved fact removes it from the list as well as recall', async () => {
  const w = world();
  try {
    await w.turn(1, `remember ${quote}`, 3);
    await w.turn(2, `remember ${quote}`);
    expect(w.journal.view.memory.filter(item => item.mode === 'remember')).toHaveLength(2);
    await w.turn(3, 'forget the desk test word');
    await w.turn(4, 'what do you remember?');
    expect(w.sends.at(-1)).not.toContain('lantern-4817');
    expect(w.packets.at(-1)).not.toContain('lantern-4817');
  } finally { w.journal.close(); }
});

it('review: an explicit save after forgetting is recalled', async () => {
 const w=world(); try {
  await w.turn(1, `remember ${quote}`, 3);
  await w.turn(2, 'forget the desk test word');
  await w.turn(3, `remember ${quote}`, 3);
  expect(w.sends.at(-1)).toBe('Saved the requested fact.');
  await w.turn(4, 'what is the desk test word?');
  expect(w.sends.at(-1)).toBe(quote);
  const oldSource = w.journal.view.order[0]!.id, newSource = w.journal.view.order[2]!.id;
  expect(projectMemoryClause(w.journal.view, quote, oldSource)).not.toBe(quote);
  expect(projectMemoryClause(w.journal.view, quote, newSource)).toBe(quote);
  expect(w.journal.view.memory.map(item => item.mode)).toEqual(['remember', 'forget', 'remember']);
  expect(memoryReport(w.journal.view)).toContain('lantern');
  const packet = JSON.parse(w.packets.at(-1)!);
  expect(packet.memory.filter((item: { mode: string }) => item.mode === 'remembered')).toHaveLength(1);
  expect(auditPacket(w.journal.view, w.journal.view.order.at(-1)!, packet).findings).toEqual([]);
  expect(auditPacket(w.journal.view, w.journal.view.order.at(-1)!, { ...packet, unsourced: quote }).findings)
    .toContainEqual({ code: 'forgotten-reachable', at: 'memory-change[1]' });
  expect(auditPacket(w.journal.view, w.journal.view.order.at(-1)!, { ...packet, recalled: [{ id: oldSource, user: quote }] }).findings)
    .toContainEqual({ code: 'forgotten-reachable', at: 'memory-change[1]' });
  w.reopen();
  await w.turn(5, 'what do you remember?'); expect(w.sends.at(-1)).toContain(quote);
  await w.turn(6, 'forget the desk test word');
  await w.turn(7, 'what is the desk test word?'); expect(w.sends.at(-1)).toBe('No saved fact.');
  expect(memoryReport(w.journal.view)).not.toContain('lantern');
 } finally {w.journal.close();}
});
it('review: seventeenth short fact fits the unchanged packet budget', async () => {
 const w=world(); try {
  const worker=createJournalWorker(w.journal,{...w.ports, model:async input=>{
   if(input.id.startsWith('summary:')) return JSON.stringify({summary:'The operator saved facts.',people:[],memory:[]});
   const packet = JSON.parse(input.context);
   expect(Buffer.byteLength(input.context)).toBeLessThanOrEqual(32768);
   const turn = w.journal.view.turns.get(input.id)!;
   expect(turn.grounding!.memoryChanges).toHaveLength(packet.memory?.length ?? 0);
   expect(auditPacket(w.journal.view, turn, packet).findings).toEqual([]);
   if(input.question === 'what do you remember?') return JSON.stringify({reply:'Listing.',memory:[],memoryList:true});
   if(input.question.startsWith('remember ')) return JSON.stringify({reply:'Noted.',memory:[{mode:'remember',source:input.id,quote:input.question.slice(9)}]});
   return JSON.stringify({reply:'Hello there.',memory:[]});
  }});
  for(let i=1;i<=17;i++) {
   worker.intake([raw(i, `remember fact number ${i} has the following value: ${'abcdefghij '.repeat(30)}`,3)]);
   await worker.drain();
  }
  console.log(JSON.stringify({facts:w.journal.view.memory.length,lastIntakeBytes:Buffer.byteLength(w.journal.view.order.at(-1)!.text),lastReply:w.sends.at(-1),maxBytes:w.journal.view.limits.maxBytes,calls:w.journal.view.calls}));
  expect(w.journal.view.memory.filter(x=>x.mode==='remember')).toHaveLength(17);
  expect(w.sends.at(-1)).toBe('Saved the requested fact.');
  expect(w.journal.view.order.some(turn => turn.packetDropped?.some(item => item.kind === 'fact'))).toBe(true);
  worker.intake([raw(18, 'what do you remember?', 1)]); await worker.drain();
  expect(w.sends.at(-1)).toContain('fact number 1 ');
  expect(memoryReport(w.journal.view)).toContain('fact number 17 ');
 } finally {w.journal.close();}
});
