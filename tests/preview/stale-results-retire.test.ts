/** Recorded live projection from Nov 12: result bodies, completion evidence and exact source times were omitted.
 * Those bytes below are stand-ins; IDs, counts, outcomes, completion states and objections come from the fixture.
 * Historical rows are built through the journal writer, then replayed unchanged before the new writer runs. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retiredResults, FINISHED_RESULT_SOURCE_AGE_MS,
  type JournalRecord } from './journal-test-worker.js';
import { loopHealth, loopStatusLines } from './obligations.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/stale-results-1112.json', import.meta.url), 'utf8')) as {
  items: { id: number; quote: string; attempts: number; outcome: 'report' | 'uncertain'; last: string; lastSlot: string;
    recoveryHeld: boolean; failedAttempts: number; completionStates: 'complete'[]; objection?: string; withheldBy?: string; withheldAt?: string }[] };
const key = new Uint8Array(32).fill(64), NOW = Date.parse('2026-11-12T21:13:00Z');
const genesis = { kind: 'genesis' as const, bot: '8820318295', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: NOW + 1e10, maxCalls: 2000, maxReplies: 2000, maxTurns: 2000, maxBytes: 65536, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
async function setup(age = 6 * 86400000, options: { reportBytes?: number; maxBytes?: number; deliveryOnly?: boolean; objection?: string; reworkOutcome?: 'failed' | 'uncertain'; forum?: boolean; omitAll?: boolean } = {}) {
  const input = (id: number, text: string, thread = 7) => {
    const raw = update(id, text);
    return options.forum ? { ...raw, message: { ...raw.message, chat: { id: -1007654321, type: 'supergroup', is_forum: true }, message_thread_id: thread } } : raw;
  };
  const items = fixture.items.map(item => ({ ...item,
    ...(options.deliveryOnly ? { withheldBy: undefined, recoveryHeld: false } : {}),
    ...(options.objection && item.objection ? { objection: options.objection } : {}) }));
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'stale-results-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { ...genesis, ...(options.forum ? { forum: true, chat: '-1007654321' } : {}), maxBytes: options.maxBytes ?? genesis.maxBytes }), now = NOW - age;
  let calls = 0, answer = 'Recorded.', reject: { key: string; objection: string }[] = [];
  const sent: string[] = [], packets: Record<string, unknown>[] = [];
  // Old intents had no resultDefects marker. This adapter only creates that historical wire shape.
  const historicalWriter = { ...journal, append(row: JournalRecord) {
    if (row.kind === 'results-retired') return; // The historical writer had no retirement transition.
    if (row.kind === 'intent') { const { resultDefects: _newField, ...old } = row; journal.append(old); }
    else journal.append(row);
  } };
  const ports = { prepareModel: ({ context }: { context: string }) => {
      if (options.omitAll && JSON.parse(context).retiredResults) throw Error('synthetic prepared envelope has no archive headroom');
      return context;
    }, now: () => now, stopped: () => false,
    model: async ({ context, id }: { context: string; id: string }) => {
      calls++; if (id.startsWith('obligation:')) throw Error('no new work call');
      const packet = JSON.parse(context); packets.push(packet);
      if (answer === 'lookup' && !packet.memoryLookup?.searched) return JSON.stringify({ lookup: [items[0]!.quote.slice(0, 70)] });
      const reply = answer === 'list' || answer === 'lookup' ? packet.retiredResults.items.map((item: { subject: string; text: string }) => `${item.subject}: ${item.text}`).join('\n') : answer;
      return JSON.stringify({ reply, rejectedReports: reject });
    }, send: async ({ text }: { text: string }) => { sent.push(text); return sent.length; }, checkOutbound: () => {} };
  let worker = createJournalWorker(historicalWriter, ports);
  for (let i = 0; i < items.length; i++) {
    now = NOW - age - (3 - Math.floor(i * 4 / items.length)) * 86400000;
    worker.intake([input(100 + i, items[i]!.quote)]); await worker.drain();
  }
  journal.append({ kind: 'summary-reserve', through: 110, maxInputTokens: 65536, maxOutputTokens: 2048, at: now });
  journal.append({ kind: 'summary', through: 110, text: 'Earlier operator requests, each retained.', at: now,
    commitments: items.map((item, i) => ({ in: 'message', source: journal.view.order[i]!.id, quote: item.quote, owner: 'agent', waitsOn: 'nothing' })) });
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!, obligation = `commitment:${i}`, end = Date.parse(item.lastSlot);
    const completion = item.completionStates.map((state, n) => ({ id: `item:${n}`, work: `Recorded complete task ${item.id}/${n}`, state, evidence: 'Evidence bytes omitted in supplied projection.' }));
    for (let n = 1; n <= item.attempts - (item.recoveryHeld ? 1 : 0); n++) {
      const slot = end - (item.attempts - n) * 1000;
      journal.append({ kind: 'obligation-start', obligation, slot, at: slot });
      const last = n === item.attempts - (item.recoveryHeld ? 1 : 0);
      journal.append({ kind: 'obligation-result', obligation, slot, at: slot, completion,
        ...(last ? { outcome: 'report', report: `Retained result body stand-in for live item ${item.id}.`.padEnd(options.reportBytes ?? 0, 'x') }
          : n <= item.failedAttempts ? { outcome: 'failed' } : { outcome: 'continue', note: 'Historical attempt; final result follows.' }) });
    }
  }
  for (const [id, at] of [[969390727, '2026-11-12T20:38:45Z'], [969390728, '2026-11-12T20:51:23Z']] as const) {
    now = Date.parse(at);
    reject = items.flatMap((item, i) => item.withheldBy?.endsWith(String(id)) ? [{ key: `commitment:${i}`, objection: item.objection! }] : []);
    worker.intake([input(id, 'An unrelated new request.')]); await worker.drain();
  }
  reject = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!; if (!item.recoveryHeld) continue;
    const obligation = `commitment:${i}`, slot = Date.parse(item.lastSlot);
    journal.append({ kind: 'obligation-start', obligation, slot, at: slot });
    journal.append({ kind: 'obligation-result', obligation, slot, outcome: options.reworkOutcome ?? 'uncertain', ...(options.reworkOutcome ? {} : { recoveryHeld: true }), at: Date.parse(item.last) });
  }
  const before = structuredClone(journal.view.obligationWork);
  journal.close(); journal = openPreviewJournal(path, key);
  expect(journal.view.obligationWork).toEqual(before); // Existing replay remains byte-for-byte in meaning.
  now = NOW; calls = 0; sent.length = 0; packets.length = 0;
  worker = createJournalWorker(journal, ports);
  return { get journal() { return journal; }, get worker() { return worker; }, before, sent, packets, input,
    calls: () => calls, setAnswer: (value: string) => { answer = value; },
    restart: () => { journal.compact(); journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); },
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}
it('eleven finished delivery-only neighbors retain lookup and announce retirement once', async () => {
  const run = await setup(6 * 86400000, { deliveryOnly: true });
  try {
    expect(await run.worker.workObligations()).toBe(false);
    expect(run.calls()).toBe(0); expect(run.sent).toEqual([]);
    expect(retiredResults(run.journal.view)).toHaveLength(11);
    expect(Object.values(run.journal.view.obligationWork).map(work => work.attempts)).toEqual(fixture.items.map(item => item.attempts));
    expect(loopStatusLines(run.journal.view, NOW).filter(line => line.includes('retired undelivered'))).toHaveLength(1);
    expect(loopHealth(run.journal.view, NOW)).toMatchObject({ dueWork: 0, awaitingDelivery: 0, recoveryUnknown: 0, withdrawnResults: 0 });
    run.restart();
    run.worker.intake([update(969390729, 'Hello again.')]); await run.worker.drain();
    expect(run.sent).toHaveLength(1);
    expect(run.sent[0]).toContain('11 older finished items from 2026-11-03 to 2026-11-06 were retired undelivered; ask and I will list them.');
    expect(run.sent[0]).not.toContain('Retained result body');
    expect(run.packets.at(-1)?.commitments).toBeUndefined();
    run.restart(); run.setAnswer('list');
    run.worker.intake([update(969390730, 'List the retired items.')]); await run.worker.drain();
    for (const item of fixture.items) expect(run.sent.at(-1)).toContain(`Retained result body stand-in for live item ${item.id}.`);
    expect(run.sent.at(-1)).not.toContain('ask and I will list them');
    expect(await run.worker.workObligations()).toBe(false);
    expect(run.calls()).toBe(2); // Only the two requested ordinary answers.
  } finally { run.close(); }
});
it('a one-hour-old source is retained for normal delivery; malformed retirement cannot close it', async () => {
  const run = await setup(3600000);
  try {
    await run.worker.drain();
    expect(retiredResults(run.journal.view)).toEqual([]);
    expect(() => run.journal.append({ kind: 'results-retired', keys: ['commitment:0'], reason: 'aged', at: NOW })).toThrow();
    expect(run.journal.view.obligationWork['commitment:0']?.report).toBeDefined();
    expect(FINISHED_RESULT_SOURCE_AGE_MS).toBe(5 * 86400000);
  } finally { run.close(); }
});
it.each(['open', 'operator', 'external', 'missing-checklist', 'defective', 'unknown-send', 'in-flight'] as const)(
  'does not retire genuinely unresolved or undemonstrated work: %s', async state => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'retirement-neighbor-'))), path = join(root, 'journal');
    const journal = openPreviewJournal(path, key, genesis);
    let now = NOW - 7 * 86400000, second = false;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => JSON.stringify(!second ? { reply: 'I will check the requested file.', promises: [{ quote: 'I will check the requested file.' }] }
        : { reply: 'Hello.', ...(state === 'defective' ? { rejectedReports: [{ key: 'commitment:0', objection: 'The result names the wrong file.' }] }
          : state === 'unknown-send' ? { selectedReports: ['commitment:0'] } : {}) }),
      send: async () => second && state === 'unknown-send' ? null : 1, checkOutbound: () => {} });
    try {
      worker.intake([update(1, 'Check the file.')]); await worker.drain();
      journal.append({ kind: 'obligation-start', obligation: 'commitment:0', slot: now, at: now });
      if (state !== 'in-flight') journal.append({ kind: 'obligation-result', obligation: 'commitment:0', slot: now, at: now,
        ...(state === 'missing-checklist' ? {} : { completion: [{ id: 'job', work: 'Check the file',
          state: state === 'open' ? 'open' : 'complete', evidence: 'Recorded check.' }] }),
        ...(state === 'operator' || state === 'external' ? { outcome: 'waiting', waitsOn: state, note: 'The needed input has not arrived.' }
          : state === 'open' ? { outcome: 'continue', note: 'The check remains open.' } : { outcome: 'report', report: 'Checked the file.' }) });
      second = true;
      if (state === 'defective' || state === 'unknown-send') {
        now++; worker.intake([update(2, 'Hello.')]); await worker.drain();
      }
      now = NOW; await worker.drain();
      expect(retiredResults(journal.view)).toEqual([]);
      if (state === 'defective') expect(journal.view.obligationWork['commitment:0']?.reworkRequired).toBe(true);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

it('a large retained archive yields context without losing an ordinary answer or retained results', async () => {
  const run = await setup(6 * 86400000, { deliveryOnly: true, reportBytes: 1450, maxBytes: 20000 });
  try {
    await run.worker.workObligations();
    const archive = retiredResults(run.journal.view);
    expect(archive).toHaveLength(11);
    for (const id of [969390729, 969390730]) {
      run.worker.intake([update(id, 'Hello again.')]); await run.worker.drain();
      expect(run.sent.at(-1)).toContain('Recorded.');
      const packet = run.packets.at(-1)!;
      expect(Buffer.byteLength(JSON.stringify(packet))).toBeLessThanOrEqual(20000);
      expect(packet.retiredResultsOmitted).toBeGreaterThan(0);
      expect(retiredResults(run.journal.view).map(item => item.text)).toEqual(archive.map(item => item.text));
      run.restart();
    }
    expect(run.calls()).toBe(2);
  } finally { run.close(); }
});
it.each(['uncertain', 'failed'] as const)('legacy withheld defects stay owned after %s rework until a corrected report', async outcome => {
  const objection = 'The result checked file A instead of requested file B. Correct the result.';
  const run = await setup(6 * 86400000, { objection, reworkOutcome: outcome });
  try {
    const index = fixture.items.findIndex(item => item.objection), key = `commitment:${index}`;
    expect(run.journal.view.obligationWork[key]?.reworkRequired).toBeUndefined();
    await run.worker.drain();
    expect(run.journal.view.obligationWork[key]?.withheld?.objection).toBe(objection);
    expect(run.journal.view.obligationWork[key]?.retired).toBeUndefined();
    run.restart();
    expect(run.journal.view.obligationWork[key]?.retired).toBeUndefined();
    run.journal.append({ kind: 'obligation-start', obligation: key, slot: NOW, at: NOW });
    run.journal.append({ kind: 'obligation-result', obligation: key, slot: NOW, outcome: 'report', report: 'Checked file B; corrected result.', at: NOW });
    await run.worker.drain();
    expect(retiredResults(run.journal.view).find(item => item.key === key)?.text).toBe('Checked file B; corrected result.');
  } finally { run.close(); }
});

it('the recorded legacy projection retires seven reports and retains four unresolved withheld results', async () => {
  const run = await setup();
  try {
    await run.worker.drain();
    expect(retiredResults(run.journal.view)).toHaveLength(7);
    const held = Object.values(run.journal.view.obligationWork).filter(work => work.withheld);
    expect(held).toHaveLength(4);
    expect(held.every(work => !work.retired && work.recoveryHeld)).toBe(true);
    expect(loopHealth(run.journal.view, NOW)).toMatchObject({ recoveryUnknown: 4 });
    run.restart();
    expect(retiredResults(run.journal.view)).toHaveLength(7);
  } finally { run.close(); }
});

it('an omitted old result can be retrieved through the existing source-subject memory lookup', async () => {
  const run = await setup(6 * 86400000, { deliveryOnly: true, reportBytes: 1450, maxBytes: 20000 });
  try {
    await run.worker.drain();
    run.worker.intake([update(969390729, 'Hello again.')]); await run.worker.drain();
    const first = run.packets.at(-1) as { retiredResults?: { items: { key: string }[] } };
    expect(first.retiredResults?.items.some(item => item.key === 'commitment:0')).not.toBe(true);
    run.setAnswer('lookup');
    run.worker.intake([update(969390730, 'Look up the old result for that earlier request.')]); await run.worker.drain();
    expect(run.calls()).toBe(3);
    expect(run.sent.at(-1)).toContain('Retained result body stand-in for live item 33.');
    expect(run.journal.view.order.at(-1)?.lookup?.words).toEqual([fixture.items[0]!.quote.slice(0, 70).trim()]);
    expect(retiredResults(run.journal.view)).toHaveLength(11);
  } finally { run.close(); }
});

it('a fully omitted archive remains disclosed and scoped to its source topic', async () => {
  const run = await setup(6 * 86400000, { deliveryOnly: true, forum: true, omitAll: true });
  try {
    await run.worker.drain();
    expect(retiredResults(run.journal.view, { thread: 7 })).toHaveLength(11);
    expect(retiredResults(run.journal.view, { thread: 8 })).toEqual([]);
    run.worker.intake([run.input(969390729, 'Hello again.')]); await run.worker.drain();
    expect(run.sent.at(-1)).toContain('Recorded.');
    expect(run.packets.at(-1)?.retiredResults).toBeUndefined();
    expect(run.packets.at(-1)?.retiredResultsOmitted).toBe(11);
    run.worker.intake([run.input(969390730, 'List retired results.', 8)]); await run.worker.drain();
    expect(run.packets.at(-1)?.retiredResults).toBeUndefined();
    expect(run.packets.at(-1)?.retiredResultsOmitted).toBeUndefined();
    expect(run.sent.at(-1)).not.toContain('retired undelivered');
  } finally { run.close(); }
});

it('retired context yields for recorded ordinary reply bytes and the recorded empty-reply absence', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8')) as {
    negativeOutputs: { id: string; output?: string; record?: { reply: string; replied: boolean } }[] };
  const ordinary = captured.negativeOutputs.find(item => item.id === 'telegram:8993213212:update:46040043')!.output!;
  const empty = captured.negativeOutputs.find(item => item.id === 'messageId:4')!.record!;
  expect(empty).toMatchObject({ reply: '', replied: false }); // Captured absence, not evidence of a delivered empty bubble.
  for (const reply of [ordinary, empty.reply]) {
    const run = await setup(6 * 86400000, { deliveryOnly: true, reportBytes: 1450, maxBytes: 20000 });
    try {
      await run.worker.drain(); run.setAnswer(reply);
      run.worker.intake([update(969390729, 'Hello again.')]); await run.worker.drain();
      expect(run.calls()).toBeGreaterThan(0);
      expect(run.packets.at(-1)?.retiredResultsOmitted).toBeGreaterThan(0);
      expect(retiredResults(run.journal.view)).toHaveLength(11);
      expect(run.sent.every(text => text.trim().length > 0)).toBe(true);
    } finally { run.close(); }
  }
});
