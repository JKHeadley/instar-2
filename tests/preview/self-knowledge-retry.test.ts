// @ts-nocheck -- physical replay ports are adapted from the reviewed selfdesc-live fixture.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourcePacket, SOURCE_PINS } from './briefing.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { toolPacketFits } from './tool-turn.mjs';
const read = path => readFileSync(path, 'utf8');
const limits = { providerAttempts: 1000, expiresAt: 9999999999999 };
const live = JSON.parse(read('tests/preview/fixtures/self-knowledge-live-2026-10-10.json'));

it.each(['format-retry', 'answer-replace'])('refreshes the capability source and provenance for %s on changed and stable routes', async mode => {
  const timedOut = JSON.parse(read('tests/preview/fixtures/lostanswer-live-2026-10-02.json')).lostFirstCall.callOutcomes[0];
  for (const floor of [false, true]) for (const withdraw of [false, true]) {
    const directory = mkdtempSync(join(tmpdir(), 'selfdesc-retry-'));
    const now = 1791672000000, maxBytes = 65536;
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), new Uint8Array(32).fill(17), {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 1000, maxReplies: 10, maxTurns: 10, maxBytes, cursor: 0,
    });
    let granted = true;
    const packets = [], sent = [], sourceTurns = [];
    const route = () => granted && toolPacketFits(journal.view);
    const sources = () => sourcePacket(read, SOURCE_PINS, { ...limits, tools: route(), mcp: 0 }).sources;
    const worker = createJournalWorker(journal, {
      now: () => now, stopped: () => false, toolRoute: route,
      sources: turn => { sourceTurns.push(turn?.id); return sources(); },
      prepareModel: input => {
        // Inject byte pressure at the existing floor decision without a CPU load run.
        if (floor && 'capabilities' in JSON.parse(input.context)) throw Error('injected full-guide overflow');
        return prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, maxBytes);
      },
      model: async input => {
        const packet = JSON.parse(input.context);
        expect(JSON.parse(JSON.parse(input.prepared).messages.find(item => item.role === 'context').content).packet).toEqual(packet);
        expect(Buffer.byteLength(input.prepared)).toBeLessThanOrEqual(maxBytes);
        packets.push(packet);
        if (packets.length > 1) return live.answer;
        if (withdraw) granted = false;
        if (mode === 'format-retry') return { state: 'complete', failureClass: 'malformed' };
        // Real proof-room timeout outcome (6230665); only the retry route transition is synthetic.
        const { id: _id, role, at: _at, ...outcome } = timedOut;
        journal.append({ kind: 'call-outcome', id: input.id, role, outcome, at: now });
        return { state: 'uncertain' };
      },
      checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
    });
    try {
      worker.intake([{ update_id: live.update, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: live.question } }]);
      await worker.drain(); await worker.drain();
      expect(packets).toHaveLength(2);
      const capability = packet => packet.sources.find(source => source.id === 'capability-note');
      expect(packets[0].capabilities?.externalTools).toBe(floor ? undefined : 'listed');
      expect(capability(packets[0]).text).toContain('I can find things out on the web');
      expect(packets[1].capabilities?.externalTools).toBe(floor ? undefined : withdraw ? 'none' : 'listed');
      expect(capability(packets[1])).toEqual(sources().find(source => source.id === 'capability-note'));
      expect(capability(packets[1]).provenance.excerptSha256 === capability(packets[0]).provenance.excerptSha256).toBe(!withdraw);
      expect(packets[1].sources.filter(source => source.id !== 'capability-note'))
        .toEqual(packets[0].sources.filter(source => source.id !== 'capability-note'));
      expect(sourceTurns.at(-1)).toBe(journal.view.order[0].id);
      const prompt = journal.view.order[0].prompt;
      expect(JSON.parse(JSON.parse(prompt).messages.find(item => item.role === 'context').content).packet).toEqual(packets[1]);
      expect(sent).toEqual([live.delivered]);
    } finally { journal.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

it.each(['format-retry', 'answer-replace'])('keeps the complete-prompt bound when %s refreshes a larger source', async mode => {
  const directory = mkdtempSync(join(tmpdir(), 'selfdesc-retry-bound-'));
  const now = 1791672000000, maxBytes = 65536;
  const journal = openPreviewJournal(join(directory, 'journal.encrypted'), new Uint8Array(32).fill(17), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1000, maxReplies: 10, maxTurns: 10, maxBytes, cursor: 0,
  });
  let calls = 0, overflowChecked = false;
  const worker = createJournalWorker(journal, {
    now: () => now, stopped: () => false, toolRoute: () => true,
    sources: () => sourcePacket(read, SOURCE_PINS, { ...limits, tools: true }).sources.map(source =>
      source.id === 'capability-note' && calls ? { ...source, text: 'x'.repeat(maxBytes) } : source),
    prepareModel: input => {
      try { return prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, maxBytes); }
      catch (error) { if (calls) overflowChecked = true; throw error; }
    },
    model: async input => {
      calls++;
      if (mode === 'format-retry') return { state: 'complete', failureClass: 'malformed' };
      const { id: _id, role, at: _at, ...outcome } = JSON.parse(read(
        'tests/preview/fixtures/lostanswer-live-2026-10-02.json')).lostFirstCall.callOutcomes[0];
      journal.append({ kind: 'call-outcome', id: input.id, role, outcome, at: now });
      return { state: 'uncertain' };
    },
    checkOutbound: () => {}, send: async () => 1,
  });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: live.question } }]);
    await worker.drain();
    expect(overflowChecked).toBe(true);
    expect(calls).toBe(1);
    expect(journal.view.calls).toBe(1);
  } finally { journal.close(); rmSync(directory, { recursive: true, force: true }); }
});
