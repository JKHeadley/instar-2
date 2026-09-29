import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(31);
const now = Date.parse('2026-09-26T12:00:00Z');
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-packet-priority-')));
const genesis = (maxTurns: number) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: maxTurns * 3, maxReplies: maxTurns, maxTurns, maxBytes: 262144, cursor: 0 });
const addTurn = (journal: ReturnType<typeof openPreviewJournal>, id: number, text: string) => {
  const raw = JSON.stringify({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text, date: Math.floor(now / 1000) + id } });
  journal.append({ kind: 'intake', id: `telegram:12345678:update:${id}`, update: id, text, raw,
    accepted: true, cursor: id + 1, at: now });
};
const workerFor = (journal: ReturnType<typeof openPreviewJournal>) => createJournalWorker(journal, {
  now: () => now, stopped: () => false, model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
const summarize = (journal: ReturnType<typeof openPreviewJournal>, through: number) => {
  journal.append({ kind: 'summary-reserve', through, at: now });
  journal.append({ kind: 'summary', through, text: 'The operator discussed the studio, Sam and a scheduled review.',
    commitments: [{ in: 'message', source: 'telegram:12345678:update:1', quote: 'Keep the studio commitment open.' }],
    people: [{ name: 'Sam', source: 'telegram:12345678:update:3', quote: 'Sam reviewed the studio plan.' }], at: now });
};
const p95 = (values: number[]) => values.sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]!;
// Rule 37 repair (docs/defects/preview-packet-priority-timing-flake.md): the byte-limit sweep below was the whole
// wall cost of that case, so host load decided it. The step is the work, not a bound, and the record's own
// suggested repair is "a coarser step that still crosses every priority boundary". Measured on a loaded runner
// (load about 43), sweeping 10000 down to 950 and checking the asserted drop kinds and boundary crossings:
//   step   50 -> 129 probes, 58.9 s, full coverage   (58.9 s against a 60 s deadline: no margin at all)
//   step  200 ->  33 probes, 16.2 s, full coverage
//   step  400 ->  17 probes,  7.6 s, full coverage   <- chosen
//   step  700 ->  10 probes,  4.5 s, full coverage
//   step 1000 ->   7 probes,  3.9 s, LOSES person-before-correction
// 400 keeps every drop kind and every boundary crossing the case asserts, sits two measured steps clear of the
// coverage cliff at 1000, and leaves about 8x time headroom. Coverage is not loosened; only the probe count is.
const PRIORITY_SWEEP_STEP = 400;

it('retains higher-priority memory at the byte boundary and records every lower-priority drop', () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis(20));
    addTurn(journal, 1, `Keep the studio commitment open. ${'x'.repeat(700)}`);
    addTurn(journal, 2, `Review the permit on 2026-09-29. ${'y'.repeat(700)}`);
    addTurn(journal, 3, `Sam reviewed the studio plan. ${'z'.repeat(700)}`);
    addTurn(journal, 4, `Ordinary studio update for 2027-12-01. ${'q'.repeat(700)}`);
    addTurn(journal, 5, `The preview said it scheduled a meeting. ${'r'.repeat(700)}`);
    const id = 'telegram:12345678:update:5';
    journal.append({ kind: 'reserve', id, at: now });
    journal.append({ kind: 'answer', id, text: 'I scheduled a meeting.', at: now });
    journal.append({ kind: 'intent', id, text: 'PREVIEW — I scheduled a meeting.',
      chat: '7654321', update: 5, grant: 'grant:preview', at: now });
    journal.append({ kind: 'coherence', id, findings: [{ rule: 84, check: 'unsupported action', excerpt: 'I scheduled a meeting.' }], at: now });
    summarize(journal, 5);
    const worker = workerFor(journal);
    const specific = worker.probe('What did Sam say?');
    if ('reason' in specific) throw Error(specific.reason);
    expect((JSON.parse(specific.context) as { recalled?: { id: string }[] }).recalled
      ?.some(item => item.id === 'telegram:12345678:update:2') ?? false).toBe(false);
    const seen = new Set<string>(), boundary = new Set<string>();
    const sweepStart = performance.now();
    for (let limit = 10000; limit >= 950; limit -= PRIORITY_SWEEP_STEP) {
      journal.view.limits.maxBytes = limit;
      const probe = worker.probe('What should I know about Sam and the studio?');
      if ('reason' in probe) continue;
      expect(Buffer.byteLength(probe.context)).toBeLessThanOrEqual(limit);
      const dropped = probe.dropped.map(item => item.kind);
      for (const kind of dropped) seen.add(kind);
      const rank = (kind: string) => ({ commitment: 0, dated: 1, correction: 2, person: 3, recent: 4, candidate: 5 })[kind as 'commitment'] ?? 6;
      expect(dropped.map(rank)).toEqual(dropped.map(rank).sort((a, b) => b - a));
      const packet = JSON.parse(probe.context);
      if (dropped.includes('person') && !dropped.includes('commitment') && packet.commitments?.length) boundary.add('person-before-commitment');
      if (dropped.includes('dated') && !dropped.includes('commitment') && packet.commitments?.length) boundary.add('dated-before-commitment');
      if (dropped.includes('person') && !dropped.includes('correction') && packet.corrections?.length) boundary.add('person-before-correction');
      if (dropped.includes('correction') && !dropped.includes('dated') && packet.recalled?.length) boundary.add('correction-before-dated');
    }
    expect(seen).toContain('candidate');
    expect(seen).toContain('recent');
    expect(seen).toContain('person');
    expect(seen).toContain('dated');
    expect(seen).toContain('correction');
    expect(boundary).toContain('person-before-commitment');
    expect(boundary).toContain('dated-before-commitment');
    expect(boundary).toContain('person-before-correction');
    expect(boundary).toContain('correction-before-dated');
    process.stdout.write(`packet priority sweep: ${String(Math.ceil((10000 - 950) / PRIORITY_SWEEP_STEP) + 1)} probes in ${(performance.now() - sweepStart).toFixed(0)} ms\n`);
    journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
}, 300000); // Measured: 17 packet-building probes cost 7.6 s one process at a time and 38.3 s inside this
// 5-worker suite at load 42. The probe count is the work and is already cut from 129 to 17 above; this budget is
// sized to that measurement with about 8x headroom, so the sweep's coverage assertions decide the case, not the host.

it('keeps a nearby dated open item inside the ten-commitment window ahead of older undated items', () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis(20));
    const commitments = [];
    for (let id = 1; id <= 12; id++) {
      const quote = id === 1 ? 'Review the permit on 2026-09-29.' : `Remember ordinary item ${id}.`;
      addTurn(journal, id, `${quote} ${'x'.repeat(700)}`);
      commitments.push({ in: 'message' as const, source: `telegram:12345678:update:${id}`, quote });
    }
    addTurn(journal, 13, `Unrelated history. ${'f'.repeat(15000)}`);
    journal.append({ kind: 'summary-reserve', through: 13, at: now });
    journal.append({ kind: 'summary', through: 13, text: 'The operator listed open items.', commitments, at: now });
    journal.view.limits.maxBytes = 16000;
    const probe = workerFor(journal).probe('What remains open?');
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context);
    expect(packet.historyMode).toBe('summary-plus-recent');
    const ids = packet.commitments.flatMap((entry: { items: { id: number }[] }) => entry.items.map(item => item.id));
    expect(ids).toContain(0); // oldest, but due within 14 days
    expect(ids).not.toContain(1); // oldest undated item yields to the ten-item limit
    expect(ids).not.toContain(2);
    expect(ids).toHaveLength(10);
    journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('measures packet bytes and non-model p95 at 200, 1000 and 2000 accepted turns', () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis(2001));
    const worker = workerFor(journal);
    for (let i = 1; i <= 2000; i++) {
      addTurn(journal, i, i === 1 ? 'Keep the studio commitment open.'
        : i === 3 ? 'Sam reviewed the studio plan.' : `Studio update ${i}: errands and planning.`);
      if (![200, 1000, 2000].includes(i)) continue;
      summarize(journal, i);
      journal.view.limits.maxBytes = 8192;
      const samples: number[] = [], bytes: number[] = [];
      for (let warmup = 0; warmup < 10; warmup++) worker.probe('What did Sam say about the studio commitment?');
      for (let trial = 0; trial < 60; trial++) {
        const start = performance.now();
        const packet = worker.probe('What did Sam say about the studio commitment?');
        samples.push(performance.now() - start);
        if ('reason' in packet) throw Error(packet.reason);
        bytes.push(Buffer.byteLength(packet.context));
      }
      process.stdout.write(`packet priority ${i} turns: bytes=${bytes[0]}, non-model p95=${p95(samples).toFixed(2)} ms\n`);
      expect(Math.max(...bytes)).toBeLessThanOrEqual(8192);
      journal.view.limits.maxBytes = 262144;
    }
    journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
  // This case asserts only packet BYTES (<= 8192); the p95 it prints is a recorded measurement, not an assertion,
  // so the deadline is purely a budget for 2 000 turn appends plus 210 real packet probes. Measured: the 200-turn
  // probe p95 was 262.95 ms in one suite run and 366.44 ms in another at load 42, about 4x its unloaded cost, and
  // the whole case overran a 120 s budget. Sized to that measurement (Rule 37: the work, not the bound).
}, 600000);

// Child-process cost, measured on this runner (load about 43), because every budget below is sized from it and
// not guessed. A preview child starts with `--loader ./scripts/slice-ts-loader.mjs`, which re-transpiles the whole
// TypeScript graph it imports on EVERY start with no cache (scripts/slice-ts-loader.mjs, 19 lines):
//   bare node -e 0                                 0.11 s
//   loader hooks active, nothing TypeScript loaded  1.3-1.6 s
//   the journal-agent graph, one process at a time  12.5-14.8 s
//   the same child inside this 5-worker suite       about 50 s (measured: a provider child's first heartbeat
//                                                   arrived after 48 288 ms, and a 60 s child budget still fired)
// So roughly 90% of a cold child is uncached transpilation, and that — not this case's subject — is what host load
// scales. The real repair is a transpile cache in that shared loader, which unit U6 does not own; see
// docs/defects/full-suite-load-timeouts.md. Until then these budgets are watchdogs sized to the measured cost with
// headroom, never bounds on the behaviour asserted here, and the observed child cost is printed on every run.
it('replays packet omissions into status without exposing the omitted text', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, { ...genesis(20), maxBytes: 4400 }); // cbuild-2: the always-offered summary decision needs room (measured fit 4400; was 4000)
    addTurn(journal, 1, `Keep the studio commitment open. ${'x'.repeat(700)}`);
    addTurn(journal, 2, `Review the permit on 2026-09-29. ${'y'.repeat(700)}`);
    addTurn(journal, 3, `Sam reviewed the studio plan. ${'z'.repeat(700)}`);
    for (let update = 1; update <= 3; update++) {
      const id = `telegram:12345678:update:${update}`;
      journal.append({ kind: 'reserve', id, at: now });
      journal.append({ kind: 'answer', id, text: 'Noted.', at: now });
      journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: '7654321', update, grant: 'grant:preview', at: now });
      journal.append({ kind: 'sent', id, message: update, at: now });
    }
    summarize(journal, 3);
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      prepareModel: input => {
        const prompt = JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] });
        if (Buffer.byteLength(prompt) > journal.view.limits.maxBytes) throw Error('prompt overflow');
        return prompt;
      },
      model: async () => 'ok', summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 4, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'What should I know about Sam and the studio?' } }]);
    await worker.drain();
    const dropped = journal.view.order.at(-1)?.packetDropped;
    expect(dropped?.length).toBeGreaterThan(0);
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', path],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 240000 });
    expect(status.status).toBe(0);
    const packet = JSON.parse(status.stdout).packet;
    expect(packet.dropped).toEqual(dropped);
    expect(packet.bytes).toBeLessThanOrEqual(packet.limit);
    expect(JSON.stringify(packet)).not.toContain('studio commitment open');
  } finally { rmSync(path, { recursive: true, force: true }); }
}, 600000); // One cold `--loader` status child at 240 s, plus this case's journal work.
