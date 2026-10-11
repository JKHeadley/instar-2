import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendGroupCarry, buildCarriedMemory, groupCarryPacket, validCarriedMemory } from './group-carry.js';
import { createJournalWorker, openPreviewJournal, openRequests, CARRIED_MEMORY_ITEM_SOURCE, MEMORY_ITEM_SHAPE, type JournalRecord } from './journal-test-worker.js';
import { resolveGroupDisclosure, verifyGroupAudience } from './group-disclosure.js';
import { now, key, sealKey, scope, records, authority, membership, permissionFor } from './group-carry-fixture.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
  grant: 'TEST-lineage', configurationDigest: 'sha256:test', expires: now + 86400000,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 };
const update = (id: number, text: string, forum = false) => ({ update_id: id, message: { message_id: id,
  chat: { id: Number(forum ? scope.chat : scope.operator), type: forum ? 'supergroup' : 'private', ...(forum ? { is_forum: true } : {}) },
  from: { id: Number(scope.operator) }, text } });
const permission = () => resolveGroupDisclosure(scope, authority(), now, records, sealKey);
async function world() {
  const dir = mkdtempSync(join(tmpdir(), 'group-carry-')); dirs.push(dir);
  const path = join(dir, 'source.encrypted'), target = join(dir, 'destination.encrypted');
  const writer = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(writer, { now: () => now - 2000, stopped: () => false,
    model: async () => 'Noted.', send: async () => 10, checkOutbound: () => {} });
  worker.intake([update(1, 'My preferred meeting place is the arboretum.')]); await worker.drain();
  writer.close();
  // The carry holds the predecessor's writer (it records any request transfer); with nothing open it writes nothing there.
  const source = openPreviewJournal(path, key);
  const destination = openPreviewJournal(target, key, { ...genesis, chat: scope.chat, forum: true });
  return { path, target, source, destination };
}
it('carries once under sourced grant and verified audience, survives compaction, and leaves a predecessor with no open request byte-identical', async () => {
  const w = await world(), bytes = readFileSync(w.path);
  const audience = await verifyGroupAudience(scope, membership());
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), audience, now, () => false)).toBe('carried');
  const size = w.destination.size, digest = w.destination.view.groupCarry!.digest;
  expect(appendGroupCarry(w.destination, w.source, scope, permission(), audience, now, () => false)).toBe('already-carried');
  expect(w.destination.size).toBe(size);
  expect(w.destination.view.cursor).toBe(0);
  expect(w.destination.view.calls).toBe(0);
  expect(w.destination.view.replies).toBe(0);
  expect(w.destination.view.reminders.size).toBe(0);
  expect(w.destination.view.commitments).toHaveLength(0);
  w.destination.compact(); w.destination.close();
  const replay = openPreviewJournal(w.target, key);
  expect(replay.view.groupCarry!.digest).toBe(digest);
  expect(validCarriedMemory(replay.view.groupCarry!)).toBe(true);
  expect(appendGroupCarry(replay, w.source, scope, permission(), audience, now, () => false)).toBe('already-carried');
  expect(readFileSync(w.path)).toEqual(bytes);
  replay.close(); w.source.close();
});
it('refuses a missing grant, other member, unknown membership, stop, wrong identity and changed predecessor before writing', async () => {
  const w = await world(), size = w.destination.size;
  const attempt = (p = permission(), audience = true, stopped = false, subject = scope) =>
    appendGroupCarry(w.destination, w.source, subject, p, audience, now, () => stopped);
  expect(() => attempt({ kind: 'refused', reason: 'no grant' })).toThrow(/permission/u);
  const other = await verifyGroupAudience(scope, membership((m, _b, v) => m === 'getChatMemberCount' ? 3 : v));
  expect(() => attempt(permission(), other)).toThrow(/audience/u);
  expect(() => attempt(permission(), false)).toThrow(/audience/u);
  expect(() => attempt(permission(), true, true)).toThrow(/stopped/u);
  expect(() => attempt(permission(), true, false, { ...scope, operator: '999' })).toThrow(/permission/u);
  expect(w.destination.size).toBe(size);
  attempt();
  expect(() => attempt(permission(), true, false, { ...scope, sourceRoot: '/other' })).toThrow(/permission/u);
  w.destination.close(); w.source.close();
});
it('carries corrected facts, active preferences, summaries and promise context; open requests travel as live requests, not context', async () => {
  const w = await world();
  const source = w.source.view, id = source.order[0]!.id;
  // Unit-level projection states; integration above and recorded-journal replay below use real persisted rows.
  source.memory.push({ mode: 'prefer', source: id, trigger: id, quote: 'Use short replies.' },
    { mode: 'correct', source: id, trigger: id, quote: 'arboretum', replacement: 'library' });
  source.summaries.push({ kind: 'summary', through: 1, text: 'The meeting is at the arboretum; the replacement is library.', at: now - 2000,
    memoryItems: [{ source: id, quote: 'My preferred meeting place is the library.' }] });
  source.commitments.push({ source: id, in: 'message', quote: 'Check the venue.', owner: 'agent', waitsOn: 'nothing' },
    { source: id, in: 'message', quote: 'Already finished.', owner: 'agent', waitsOn: 'nothing' });
  source.closed.set(1, { id: 1, source: id, quote: 'Done.' });
  source.dated.push({ source: id, quote: 'Remind me to check the venue tomorrow.', when: 'tomorrow',
    day: '2026-10-11', zone: 'UTC', remind: true });
  const p = permission(); if (p.kind !== 'resolved') throw Error(p.reason);
  const memory = buildCarriedMemory(source, scope, p, now, [source.dated[0]!]), all = JSON.stringify(memory.entries);
  expect(memory.entries.map(e => e.kind)).toEqual(expect.arrayContaining(['recall', 'preference', 'correction', 'summary', 'promise']));
  expect(memory.entries.some(e => e.kind === 'reminder')).toBe(false);
  expect(memory.requests).toEqual([{ item: source.dated[0], askedAt: now - 2000 }]);
  expect(buildCarriedMemory(source, scope, p, now).requests).toEqual([]);
  expect(all).toContain('library'); expect(all).not.toContain('arboretum');
  expect(all).not.toContain('Already finished.'); expect(all).toContain('Use short replies.');
  expect(memory.entries).toContainEqual(expect.objectContaining({ kind: 'recall', text: 'My preferred meeting place is the library.' }));
  expect(all).toContain('waitsOn');
  const packet = groupCarryPacket(memory, 'meeting place', now, 32768);
  expect(Buffer.byteLength(JSON.stringify(packet))).toBeLessThanOrEqual(Math.floor(32768 / 5));
  expect(packet.entries.length).toBeGreaterThan(0);
  w.destination.close(); w.source.close();
});
it('the actual worker offers lineage to its model, rechecks before dispatch, and refuses a host with no resolver after restart', async () => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  let allowed = true, calls = 0, sends = 0, context = '';
  const worker = createJournalWorker(w.destination, { now: () => now + 1000, stopped: () => false,
    groupDisclosure: async () => allowed,
    model: async input => { calls++; context = input.context; allowed = false; return 'You named the arboretum.'; },
    send: async () => { sends++; return 1; }, checkOutbound: () => {} });
  worker.intake([update(2, 'What place did I name?', true)]); await worker.drain();
  expect(context).toContain('predecessorMemory'); expect(context).toContain('arboretum');
  expect(calls).toBe(1); expect(sends).toBe(0);
  w.destination.close();
  const replay = openPreviewJournal(w.target, key);
  const without = createJournalWorker(replay, { now: () => now + 2000, stopped: () => false,
    model: async () => { calls++; return 'Should not run.'; }, send: async () => { sends++; return 2; }, checkOutbound: () => {} });
  without.intake([update(3, 'Recall it again.', true)]); await without.drain();
  expect(calls).toBe(1); expect(sends).toBe(0);
  replay.close(); w.source.close();
});

it('names carried sources in memory guidance only for a carried root; a root without a carry keeps the shape byte for byte', async () => {
  const w = await world();
  const decision = (context: string) => (JSON.parse(context) as { memoryDecision?: string }).memoryDecision ?? '';
  let plain = '';
  const uncarried = createJournalWorker(w.source, { now: () => now - 1000, stopped: () => false,
    model: async input => { plain = input.context; return 'Noted.'; }, send: async () => 11, checkOutbound: () => {} });
  uncarried.intake([update(2, 'Where do we meet?')]); await uncarried.drain();
  expect(decision(plain)).toContain(`style. ${MEMORY_ITEM_SHAPE} For an earlier answer`);
  expect(plain).not.toContain(CARRIED_MEMORY_ITEM_SOURCE); expect(plain).not.toContain('predecessorMemory');
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  let carried = '';
  const worker = createJournalWorker(w.destination, { now: () => now + 1000, stopped: () => false,
    groupDisclosure: async () => true, model: async input => { carried = input.context; return 'The arboretum.'; },
    send: async () => 1, checkOutbound: () => {} });
  worker.intake([update(2, 'Where do we meet?', true)]); await worker.drain();
  expect(decision(carried)).toContain(`style. ${MEMORY_ITEM_SHAPE} ${CARRIED_MEMORY_ITEM_SOURCE} For an earlier answer`);
  w.destination.close(); w.source.close();
});

it('replays the real proof-room journal including uncertain summaries and reply reviews before carrying only its settled memory', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as {
    genesis: typeof genesis; rows: JournalRecord[] };
  const dir = mkdtempSync(join(tmpdir(), 'group-carry-recorded-')); dirs.push(dir);
  const path = join(dir, 'source.encrypted'), target = join(dir, 'group.encrypted');
  const seed = openPreviewJournal(path, key, { ...capture.genesis, kind: 'genesis', expires: genesis.expires, cursor: 0 });
  for (const row of capture.rows) seed.append(row);
  expect(seed.view.order).toHaveLength(22);
  expect(seed.view.summaries.map(s => s.through)).toEqual([715672480, 715672481, 715672484]);
  expect([...seed.view.summaryReservations.keys()]).toEqual([715672492, 715672496, 715672497]);
  expect(seed.view.order.some(t => t.replyChecks?.some(c => c.verdict === 'unsure' || c.verdict === 'unavailable'))).toBe(true);
  seed.close();
  const sourceBytes = readFileSync(path), source = openPreviewJournal(path, key);
  const exact = { ...scope, operator: capture.genesis.operator, bot: capture.genesis.bot };
  const destination = openPreviewJournal(target, key, { ...genesis, operator: exact.operator, bot: exact.bot, chat: exact.chat, forum: true });
  // The authority fixture is TEST-only. Its seal/provenance resolution is covered separately; this
  // integration replays the live journal's exact decision and delivery rows, never a live identity store.
  const p = permissionFor(exact); if (p.kind !== 'resolved') throw Error(p.reason);
  appendGroupCarry(destination, source, exact, p, true, now, () => false);
  const memory = destination.view.groupCarry!;
  expect(memory.entries.filter(e => e.kind === 'summary').map(e => e.source)).toEqual(['summary:715672484']);
  expect(memory.entries.some(e => e.kind === 'recall' && e.source.endsWith('715672500'))).toBe(true);
  expect(memory.entries.some(e => e.source === 'summary:715672497')).toBe(false);
  // Recorded shape: 715672494 asked for 2:55 pm, and 715672496 "Actually, cancel the bird feeder one." came back malformed
  // with its memory request undecided. The runner holds that request, so it stays with the predecessor (no transfer
  // record, predecessor bytes unchanged) and reaches the group only as labelled context, never as a live request.
  expect(memory.requests).toEqual([]);
  expect(source.view.requestTransfer).toBeUndefined();
  expect(openRequests(source.view).map(item => item.source)).toEqual(['telegram:8994258214:update:715672494']);
  expect(memory.entries.filter(e => e.kind === 'reminder').map(e => e.source)).toEqual(['telegram:8994258214:update:715672494']);
  expect(openRequests(destination.view)).toEqual([]);
  const worker = createJournalWorker(destination, { now: () => now, stopped: () => false, groupDisclosure: async () => true,
    model: async () => 'Unused.', send: async () => 1, checkOutbound: () => {} });
  const packet = worker.probe('What do you remember from the prior conversation?');
  expect('reason' in packet).toBe(false);
  if ('reason' in packet) throw Error(packet.reason);
  const selected = JSON.parse(packet.context).predecessorMemory;
  expect(selected.entries.length + selected.omitted).toBe(memory.entries.length);
  expect(selected.entries.length).toBeGreaterThan(0);
  for (const entry of selected.entries) expect(memory.entries).toContainEqual(entry);
  expect(destination.view.calls).toBe(0); expect(destination.view.replies).toBe(0);
  expect(destination.view.summaryReservations.size).toBe(0);
  expect(readFileSync(path)).toEqual(sourceBytes);
  destination.close(); source.close();
});

it.each(['correct', 'forget', 'bad-source', 'bad-quote'] as const)('resolves carried evidence through durable memory: %s', async mode => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  const snapshot = JSON.stringify(w.destination.view.groupCarry);
  const source = w.source.view.order[0]!.id;
  const quote = 'My preferred meeting place is the arboretum.';
  const replacement = 'My preferred meeting place is the library.';
  const worker = createJournalWorker(w.destination, { now: () => now + 1000, stopped: () => false,
    groupDisclosure: async () => true, checkOutbound: () => {}, send: async () => 2,
    model: async input => JSON.stringify({ ...(input.id.startsWith('summary:')
      ? { summary: 'The operator requested a memory change.', people: [] } : { reply: 'Okay.' }), memory: [{ mode: mode === 'forget' ? mode : 'correct',
      source: mode === 'bad-source' ? 'missing:source' : source, quote: mode === 'bad-quote' ? 'Invented old meeting location.' : quote,
      ...(mode === 'forget' ? {} : { replacement }) }] }) });
  worker.intake([update(2, mode === 'forget' ? `Forget this: ${quote}` : `Correction: ${replacement}`, true)]);
  await worker.drain();
  const valid = mode === 'correct' || mode === 'forget';
  expect(w.destination.view.memory).toHaveLength(valid ? 1 : 0);
  expect(!!w.destination.view.order.at(-1)!.memoryPending).toBe(!valid);
  expect(JSON.stringify(w.destination.view.groupCarry)).toBe(snapshot);
  w.destination.compact(); w.destination.close(); w.source.close();
  const resumed = openPreviewJournal(w.target, key);
  const packet = groupCarryPacket(resumed.view.groupCarry!, 'meeting', now + 2000, 409600, resumed.view);
  if (valid) expect(JSON.stringify(packet)).not.toContain('arboretum');
  else expect(JSON.stringify(packet)).toContain('arboretum');
  if (mode === 'correct') {
    const view = createJournalWorker(resumed, { now: () => now + 2000, stopped: () => false,
      model: async () => 'unused', send: async () => 1, checkOutbound: () => {} }).probe('Where do I meet?');
    expect('context' in view && view.context).toContain('library');
  }
  resumed.close();
});

it.each([
  { external: false, allowed: true, charge: 0 },
  { external: false, allowed: false, charge: 0 },
  { external: true, allowed: true, charge: 0 },
  { external: true, allowed: false, charge: 0 },
  { external: true, allowed: true, charge: 1 },
])('retains semantic recall and enforces external disclosure/spend: %j', async ({ external, allowed, charge }) => {
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false);
  w.source.close();
  for (let i = 10; i < 36; i++) {
    const text = i === 10 ? 'The bicycle combination is 4471.' : `A quiet afternoon note number ${i}.`;
    const id = `telegram:${scope.bot}:update:${i}`;
    w.destination.append({ kind: 'intake', id, update: i, text, accepted: true,
      raw: JSON.stringify(update(i, text, true)), cursor: i + 1, at: now + i });
    w.destination.append({ kind: 'reserve', id, at: now + i });
    w.destination.append({ kind: 'answer', id, text: 'Noted.', state: 'complete', at: now + i });
    w.destination.append({ kind: 'intent', id, text: 'Noted.', chat: scope.chat, update: i, grant: genesis.grant, at: now + i });
    w.destination.append({ kind: 'sent', id, message: i, at: now + i });
  }
  w.destination.append({ kind: 'summary-reserve', through: 35, at: now + 40 });
  w.destination.append({ kind: 'summary', through: 35, text: 'The operator keeps afternoon notes.', at: now + 40 });
  let calls = 0, reads = 0, context = '';
  const worker = createJournalWorker(w.destination, { now: () => now + 1000, stopped: () => false,
    // Admit the pass, then exercise the external rerank's own asynchronous checkpoint.
    groupDisclosure: async () => ++reads === 1 || allowed,
    model: async input => { context = input.context; return JSON.stringify({ reply: 'Noted.', memory: [] }); },
    send: async () => 50, checkOutbound: () => {},
    recallReranker: { id: 'semantic-test', chargePerCall: charge, ...(external ? { external: true as const } : {}),
      rerank: (_query, candidates) => {
        calls++;
        const value = { kind: 'Success' as const, value: candidates.flatMap((text, i) => text.includes('4471') ? [i] : []) } as never;
        return external ? Promise.resolve(value) : value;
      } } });
  if (external) {
    worker.intake([update(40, 'What is the combination for my bike?', true)]); await worker.drain();
    expect(calls > 0).toBe(allowed && charge === 0);
    if (allowed && charge === 0) expect(context).toContain('4471');
    if (!allowed) expect(context).toBe('');
  } else {
    const packet = worker.probe('What is the combination for my bike?');
    expect(calls).toBeGreaterThan(0);
    expect('context' in packet && packet.context).toContain('4471');
    expect(reads).toBe(0); // a local computation has no disclosure effect to admit
  }
  w.destination.close();
});

it('recovers a held real recorded answer (proof-room update 715672480) without calling the model twice', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as { rows: JournalRecord[] };
  const recorded = capture.rows.find((row): row is Extract<JournalRecord, { kind: 'answer' }> =>
    row.kind === 'answer' && row.id.endsWith(':715672480'))!;
  const w = await world();
  appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false); w.source.close();
  let allowed = true, calls = 0;
  const sends: string[] = [];
  const ports = { now: () => now + 1000, stopped: () => false, groupDisclosure: async () => allowed,
    model: async () => { calls++; allowed = false; return recorded.text; },
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return 1; }, checkOutbound: () => {} };
  const worker = createJournalWorker(w.destination, ports);
  worker.intake([update(2, 'Continue the conversation.', true)]); await worker.drain();
  expect(w.destination.view.order[0]!.held).toBe('group disclosure refused');
  expect(sends).toEqual([]);
  w.destination.compact(); w.destination.close();
  const resumed = openPreviewJournal(w.target, key); allowed = true;
  const restarted = createJournalWorker(resumed, ports);
  await restarted.drain(); await restarted.drain();
  expect(calls).toBe(1); expect(sends).toHaveLength(1); expect(sends[0]).toContain(recorded.text);
  resumed.close();
});

it('replays all recorded model shapes through carried recall after the disclosure checkpoint recovers', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
    import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
  expect(captured.otherShapes.map(shape => shape.id)).toEqual(['summary:715672480', '715672483', '715672482',
    '969389570', '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const shape of captured.otherShapes) {
    const w = await world();
    appendGroupCarry(w.destination, w.source, scope, permission(), true, now, () => false); w.source.close();
    let allowed = false, calls = 0;
    const sends: string[] = [];
    const worker = createJournalWorker(w.destination, { now: () => now + 1000, stopped: () => false,
      groupDisclosure: async () => allowed,
      model: async input => {
        calls++;
        expect(JSON.parse(input.context).predecessorMemory.entries.length, shape.id).toBeGreaterThan(0);
        return shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) as { state: 'uncertain' } : shape.raw;
      },
      send: async input => { sends.push(input.expectedText); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(2, 'What meeting place do you remember?', true)]); await worker.drain();
    expect(calls, shape.id).toBe(0); expect(sends, shape.id).toEqual([]);
    expect(w.destination.view.order[0]!.held, shape.id).toBe('group disclosure refused');
    allowed = true; await worker.drain();
    expect(calls, shape.id).toBe(1);
    expect(sends.every(text => text.trim().length > 0), shape.id).toBe(true);
    w.destination.close();
  }
});
