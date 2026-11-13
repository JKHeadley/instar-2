import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, selfRepairOptions, obligationSchedule } from './journal-test-worker.js';

// Recorded shapes authorized by repair-when-asked-1112 Round 2: the description of
// message 828 (2026-11-12 17:16 PST) is evidence, not access to the private journal.
// All state below goes through the actual durable writer, never projection mutation.
const T0 = 1_794_519_000_000, DAY = 86_400_000, key = new Uint8Array(32).fill(42);
const id = (n: number) => `telegram:12345678:update:${n}`;
function world(options: { failRepair?: boolean; secondHeld?: boolean; cap?: number; unknownWork?: boolean; stopped?: boolean; cancel?: boolean; expire?: boolean; sameTime?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'self-repair-')), path = join(root, 'journal');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: T0 + 10 * DAY,
    maxCalls: options.cap ?? 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 });
  const clock = { now: T0 + 1000, stop: false }, calls: string[] = [], sends: string[] = [], preparations: string[] = [];
  const intake = (n: number, text: string, sender = 7654321, thread?: number) => {
    const raw = JSON.stringify({ update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: sender },
      text, date: Math.floor(clock.now / 1000), ...(thread === undefined ? {} : { message_thread_id: thread }) } });
    journal.append({ kind: 'intake', id: id(n), update: n, text, raw, accepted: sender === 7654321,
      ...(thread === undefined ? {} : { thread }), cursor: n + 1, at: clock.now });
  };
  intake(1, 'Please review the plan.');
  journal.append({ kind: 'reserve', id: id(1), at: clock.now });
  journal.append({ kind: 'answer', id: id(1), text: 'I will review the plan.', loops: [{ kind: 'deferral', quote: 'I will review the plan.', waitsOn: 'nothing', deliveryRequest: 'Please review the plan.' }], at: clock.now });
  journal.append({ kind: 'intent', id: id(1), text: 'I will review the plan.', chat: '7654321', update: 1,
    grant: 'grant:preview', loops: [{ kind: 'deferral', quote: 'I will review the plan.', waitsOn: 'nothing', deliveryRequest: 'Please review the plan.' }], at: clock.now });
  journal.append({ kind: 'sent', id: id(1), message: 1, at: clock.now });
  journal.append({ kind: 'obligation-start', obligation: 'commitment:0', slot: clock.now, at: clock.now });
  journal.append({ kind: 'obligation-result', obligation: 'commitment:0', slot: clock.now,
    outcome: options.unknownWork ? 'uncertain' : 'continue', ...(options.unknownWork ? { recoveryHeld: true as const } : { note: 'Still reviewing.' }), at: clock.now });
  intake(2, 'Please answer the held question.');
  journal.append({ kind: 'hold', id: id(2), reason: 'prompt overflow', at: clock.now });
  intake(3, 'An operation whose outcome is unknown.');
  journal.append({ kind: 'reserve', id: id(3), at: clock.now });
  journal.append({ kind: 'hold', id: id(3), reason: 'reply check unavailable', at: clock.now });
  if (options.secondHeld) {
    intake(30, "A second held question.");
    journal.append({ kind: "hold", id: id(30), reason: "prompt overflow", at: clock.now });
  }
  if (!options.sameTime) clock.now += 1000;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => clock.stop,
    prepareModel: input => {
      preparations.push(input.id);
      if (input.id === id(30) || input.id === id(2) && (options.failRepair || !journal.view.order.some(turn => turn.selfRepairs?.length)))
        throw Error('prompt too large');
      return input.context;
    }, model: async input => {
      calls.push(input.id);
      if (input.id.startsWith('obligation:')) return '{"outcome":"continue","note":"The repair is working on the plan."}';
      if (input.id === id(2)) return '{"reply":"Here is the held answer."}';
      const packet = JSON.parse(input.context);
      expect(packet.selfRepair.instruction).toContain('Re-check sign-ins with your installed tools');
      expect(packet.selfRepair.items.find((item: { key: string }) => item.key === `reply:${id(3)}`))
        .toMatchObject({ eligible: false, state: 'outcome unknown; never repeat' });
      if (options.stopped) clock.stop = true;
      if (options.expire) clock.now = journal.view.expires;
      return JSON.stringify({ reply: 'I am requesting the available repairs. The uncertain operation will not be repeated.',
        selfRepairs: [`reply:${id(2)}`, 'work:commitment:0', `reply:${id(3)}`],
        ...(options.cancel ? { cancelDeliveries: [{ id: 0, quote: 'Cancel the plan review.' }] } : {}) });
    }, checkOutbound: () => {}, send: async input => { sends.push(input.text); return sends.length + 1; } });
  const ask = async (n: number) => { if (!options.sameTime) clock.now += 1000; intake(n, options.cancel ? 'Cancel the plan review.' : 'Is anything broken or stuck on your side right now? If so, what are you doing about it?'); await worker.drain(); };
  return { journal, worker, clock, calls, sends, preparations, intake, ask, path, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('requests and runs one held-reply attempt and work re-queue; repeated asks and replay cannot request them again', async () => {
  const w = world();
  try {
    expect(obligationSchedule(w.journal.view)[0]!.slot).toBeGreaterThan(w.clock.now);
    await w.ask(4);
    expect(w.journal.view.turns.get(id(4))!.selfRepairs).toEqual([`reply:${id(2)}`, 'work:commitment:0']);
    expect(w.journal.view.turns.get(id(2))!.selfRepairAttempted).toBe(true);
    expect(w.calls.filter(call => call === id(2))).toHaveLength(1);
    expect(w.calls.filter(call => call.startsWith('obligation:'))).toHaveLength(1);
    expect(w.calls).not.toContain(id(3));
    expect(w.sends.find(text => text.includes('uncertain operation'))).toContain('I queued one re-attempt of the held reply. I re-queued the unfinished work');
    await w.ask(5);
    expect(w.journal.view.turns.get(id(5))!.selfRepairs).toBeUndefined();
    expect(w.calls.filter(call => call.startsWith('obligation:'))).toHaveLength(1);
    w.journal.compact();
    const replay = openPreviewJournal(w.path, key);
    expect(replay.view.order).toEqual(w.journal.view.order);
    expect(obligationSchedule(replay.view)).toEqual(obligationSchedule(w.journal.view));
    replay.close();
  } finally { w.close(); }
});

it('retains unknown work without re-queue or repeat', async () => {
  const w = world({ unknownWork: true });
  try { await w.ask(4);
    expect(w.journal.view.turns.get(id(4))!.selfRepairs).toEqual([`reply:${id(2)}`]);
    expect(w.calls.some(call => call.startsWith('obligation:'))).toBe(false);
    expect(w.journal.view.obligationWork['commitment:0']!.recoveryHeld).toBe(true);
  } finally { w.close(); }
});

it('a failed held preparation consumes its single accelerated attempt and stays held', async () => {
  const w = world({ failRepair: true, secondHeld: true });
  try {
    await w.worker.drain();
    const heldCounts = () => [2, 30].map(n => w.preparations.filter(call => call === id(n)).length);
    const beforeRequest = heldCounts();
    expect(beforeRequest.every(count => count > 0)).toBe(true);
    await w.worker.drain();
    expect(heldCounts()).toEqual(beforeRequest);
    await w.ask(4);
    expect(heldCounts()[0]).toBeGreaterThan(beforeRequest[0]!);
    expect(heldCounts()[1]).toBe(beforeRequest[1]);
    const afterRepair = w.preparations.filter(call => call === id(2)).length;
    const afterBoth = heldCounts();
    await w.worker.drain(); await w.ask(5);
    expect(w.preparations.filter(call => call === id(2))).toHaveLength(afterRepair);
    expect(heldCounts()).toEqual(afterBoth);
    expect(w.journal.view.turns.get(id(2))!.selfRepairAttempted).toBe(true);
    expect(w.journal.view.turns.get(id(2))!.held).toContain('prompt overflow');
    expect(w.calls).not.toContain(id(2));
    expect(w.journal.view.order.flatMap(turn => turn.selfRepairs ?? []).filter(key => key === `reply:${id(2)}`)).toHaveLength(1);
  } finally { w.close(); }
});

it('never offers another conversation or an unverified sender repair authority', () => {
  const w = world();
  try { w.intake(4, 'Check things.', 7654321, 99);
    expect(selfRepairOptions(w.journal.view, w.journal.view.turns.get(id(4))!)).toEqual([]);
    w.intake(5, 'Check things.', 9876543);
    expect(selfRepairOptions(w.journal.view, w.journal.view.turns.get(id(5))!)).toEqual([]);
  } finally { w.close(); }
});

it('replay writer refuses unknown, duplicate and cross-conversation requests', () => {
  const w = world();
  try { w.intake(4, 'Check things.'); w.journal.append({ kind: 'reserve', id: id(4), at: w.clock.now });
    for (const repairs of [[`reply:${id(3)}`], ['work:missing'], ['work:commitment:0', 'work:commitment:0']])
      expect(() => w.journal.append({ kind: 'answer', id: id(4), text: 'Request.', selfRepairs: repairs, at: w.clock.now })).toThrow('self repair request refused');
    expect(w.journal.view.turns.get(id(4))!.selfRepairs).toBeUndefined();
  } finally { w.close(); }
});

it('stop during the answer starts no repair', async () => {
  const w = world({ stopped: true });
  try { await w.ask(4).catch(() => {});
    expect(w.journal.view.order.flatMap(turn => turn.selfRepairs ?? [])).toEqual([]);
    expect(w.calls).not.toContain(id(2));
    expect(w.calls.some(call => call.startsWith('obligation:'))).toBe(false);
  } finally { w.close(); }
});


it('preserves the call allowance even with a recorded repair request', async () => {
  const w = world({ cap: 4 });
  try { await w.ask(4);
    expect(w.journal.view.calls).toBeLessThanOrEqual(4);
    expect(w.calls.some(call => call.startsWith('obligation:'))).toBe(false);
    expect(w.journal.view.obligationWork['commitment:0']!.attempts).toBe(1);
  } finally { w.close(); }
});

it('a withdrawal in the same answer wins over its repair request', async () => {
  const w = world({ cancel: true });
  try { await w.ask(4);
    expect(w.journal.view.turns.get(id(4))!.selfRepairs).not.toContain('work:commitment:0');
    expect(w.journal.view.closed.has(0)).toBe(true);
    expect(w.calls.some(call => call.startsWith('obligation:'))).toBe(false);
  } finally { w.close(); }
});

it('old unknown replies cannot hide eligible work in the bounded offer', () => {
  const w = world();
  try {
    for (let n = 4; n < 20; n++) {
      w.intake(n, 'Unknown older operation.');
      w.journal.append({ kind: 'reserve', id: id(n), at: w.clock.now });
      w.journal.append({ kind: 'hold', id: id(n), reason: 'reply check unavailable', at: w.clock.now });
    }
    w.intake(20, 'Check things.');
    expect(selfRepairOptions(w.journal.view, w.journal.view.turns.get(id(20))!))
      .toContainEqual(expect.objectContaining({ key: 'work:commitment:0', eligible: true }));
  } finally { w.close(); }
});


it('expiry during the answer records no repair and starts no work', async () => {
  const w = world({ expire: true });
  try { await w.ask(4).catch(() => {});
    expect(w.journal.view.order.flatMap(turn => turn.selfRepairs ?? [])).toEqual([]);
    expect(w.calls).not.toContain(id(2));
    expect(w.calls.some(call => call.startsWith('obligation:'))).toBe(false);
  } finally { w.close(); }
});


it('equal clock readings retain one pending work acceleration across replay, then consume it by attempt count', async () => {
  const w = world({ sameTime: true });
  try {
    await w.ask(4);
    expect(w.journal.view.turns.get(id(4))!.selfRepairs).toContain('work:commitment:0');
    expect(w.calls.some(call => call.startsWith('obligation:'))).toBe(false);
    expect(obligationSchedule(w.journal.view)[0]!.slot).toBe(w.clock.now + 1);
    w.journal.compact();
    const replay = openPreviewJournal(w.path, key);
    expect(obligationSchedule(replay.view)).toEqual(obligationSchedule(w.journal.view));
    replay.close();
    w.clock.now++;
    expect(await w.worker.workObligations()).toBe(true);
    expect(await w.worker.workObligations()).toBe(false);
    await w.ask(5);
    expect(w.calls.filter(call => call.startsWith('obligation:'))).toHaveLength(1);
    expect(w.journal.view.turns.get(id(5))!.selfRepairs).toBeUndefined();
  } finally { w.close(); }
});

it('retries both preparation-held turns only when their cooldown expires', async () => {
  const w = world({ failRepair: true, secondHeld: true });
  try {
    await w.worker.drain();
    const counts = () => [2, 30].map(n => w.preparations.filter(call => call === id(n)).length);
    const initial = counts();
    w.journal.compact();
    w.clock.now += 5 * 60_000 - 1;
    await w.worker.drain();
    expect(counts()).toEqual(initial);
    w.clock.now++;
    await w.worker.drain();
    expect(counts()[0]).toBeGreaterThan(initial[0]!);
    expect(counts()[1]).toBeGreaterThan(initial[1]!);
    const retried = counts();
    await w.worker.drain();
    expect(counts()).toEqual(retried);
  } finally { w.close(); }
});
