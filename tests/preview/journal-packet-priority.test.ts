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
    const seen = new Set<string>(), boundary = new Set<string>();
    for (let limit = 5500; limit >= 950; limit -= 25) {
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
    journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

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
    journal.view.limits.maxBytes = 12000;
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
}, 120000);

it('replays packet omissions into status without exposing the omitted text', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, { ...genesis(20), maxBytes: 2600 });
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
        encoding: 'utf8', timeout: 10000 });
    expect(status.status).toBe(0);
    const packet = JSON.parse(status.stdout).packet;
    expect(packet.dropped).toEqual(dropped);
    expect(packet.bytes).toBeLessThanOrEqual(packet.limit);
    expect(JSON.stringify(packet)).not.toContain('studio commitment open');
  } finally { rmSync(path, { recursive: true, force: true }); }
});
