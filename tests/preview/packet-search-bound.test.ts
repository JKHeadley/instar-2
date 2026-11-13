import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { createJournalWorker, openPreviewJournal, OBLIGATION_DECISION_FLOOR, pendingReports, retiredResults } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const at = 1_793_160_000_000, key = new Uint8Array(32).fill(83);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 2000, maxReplies: 2000, maxTurns: 2000, maxBytes: 409600, cursor: 0 };
let fixture: ReturnType<typeof world>;
function world(seeded = false) {
  const root = mkdtempSync(join(tmpdir(), 'packet-search-bound-'));
  const path = join(root, 'journal');
  if (seeded) copyFileSync(fixture.path, path);
  const journal = openPreviewJournal(path, key, seeded ? undefined : genesis);
  return { journal, path, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}
async function seed(journal: ReturnType<typeof openPreviewJournal>) {
  // Same scale as incident 969390748: 411 retained prompts, 75 obligations,
  // 49 uncertain recoveries, ten waiting tasks and sixteen completed reports.
  // All state goes through the authenticated journal writer, never a mutated view.
  for (let n = 1; n <= 411; n++) {
    const id = `telegram:12345678:update:${n}`, text = `Check login access item ${n}.`;
    const reply = n <= 75 ? `I will check access task ${n}.` : 'Noted.';
    const raw = JSON.stringify({ update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
    journal.append({ kind: 'intake', id, update: n, text, raw, accepted: true, cursor: n + 1, at });
    journal.append({ kind: 'reserve', id, prompt: 'p'.repeat(75000), at });
    journal.append({ kind: 'answer', id, text: reply,
      ...(n <= 75 ? { loops: [{ kind: 'deferral' as const, quote: reply, waitsOn: 'nothing' as const }] } : {}), at });
    journal.append({ kind: 'intent', id, text: reply, chat: genesis.chat, update: n, grant: genesis.grant,
      ...(n <= 75 ? { loops: [{ kind: 'deferral' as const, quote: reply, waitsOn: 'nothing' as const }] } : {}), at });
    journal.append({ kind: 'sent', id, message: n, at });
    if (n % 16 === 0) await setImmediate();
  }
  for (let n = 0; n < 75; n++) {
    journal.append({ kind: 'obligation-start', obligation: `commitment:${n}`, slot: at, at });
    journal.append({ kind: 'obligation-result', obligation: `commitment:${n}`, slot: at,
      ...(n < 49 ? { outcome: 'uncertain' as const, recoveryHeld: true as const }
        : n < 59 ? { outcome: 'waiting' as const, waitsOn: 'external' as const, note: 'Awaiting access check.' }
          : { ...(n === 59 ? { completion: [{ id: 'verified', work: 'Check access', state: 'complete' as const, evidence: 'Recorded access check.' }] } : {}), outcome: 'report' as const, report: `Access check ${n}: ${'recorded details '.repeat(80)}`.trim() }), at });
  }
}
beforeAll(async () => { fixture = world(); await seed(fixture.journal); fixture.journal.close(); }, 120000);
afterAll(() => fixture?.close());
const recordedShapes = (JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] }).otherShapes;
it.each(['count', 'time', 'history', 'retired-count', 'retired-time'] as const)('answers at the floor when the preparation %s budget expires', async mode => {
  const f = world(true); let tries = 0, elapsed = 0, packet = '', sends = 0;
  const mixed = mode.startsWith('retired-'), countMode = mode.endsWith('count');
  const pendingCount = mixed ? 15 : 16;
  if (mixed) {
    f.journal.append({ kind: 'results-retired', keys: ['commitment:59'],
      reason: 'Undelivered finished result retired after five days since its source message; retained for lookup.', at: at + 6 * 86400000 });
  }
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  try {
    expect(f.journal.view.commitments).toHaveLength(75);
    expect(pendingReports(f.journal.view)).toHaveLength(pendingCount);
    const worker = createJournalWorker(f.journal, { now: () => at, stopped: () => false,
      sources: recordedShapes.map(shape => ({ source: shape.kind, id: shape.id, text: shape.raw })),
      prepareModel: input => {
        if (input.id.startsWith('summary:')) throw Error('summary unavailable');
        tries++;
        if (!countMode) elapsed += 1000;
        const p = JSON.parse(input.context);
        const floor = p.obligationDecision === OBLIGATION_DECISION_FLOOR && !p.memorySummary && !p.pendingReports && !p.memorySearch
          && !p.retiredResults && !p.memoryCandidates && !(p.recalled?.length) && !(p.commitments?.length) && !(p.people?.length);
        // The probe caps the unfixed reproducer at 5002 attempts so a RED run cannot
        // occupy a worker for minutes. The real canonical envelope is still used.
        if ((!floor || mode === 'history' && p.history.length > 0) && tries <= 5001) throw Error('preview: complete prompt overflow');
        return prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, at, genesis.maxBytes);
      }, model: async input => { packet = input.context; return '{"reply":"I will check the current access evidence.","memory":[]}'; },
      send: async () => ++sends, checkOutbound: () => {} });
    worker.intake([{ update_id: 969390748, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Is any of your access missing or about to run out right now: logins, GitHub, the browser?' } }]);
    const started = process.hrtime.bigint();
    await worker.drain();
    const actualMs = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(JSON.stringify({ mode, preparationCalls: tries, drainMs: actualMs, retainedPromptBytes: 411 * 75000 }));
    // Count mode freezes time to prove the independent count brake even on a slow host.
    if (countMode) expect(tries).toBe(5001);
    else expect(actualMs).toBeLessThan(5000);
    expect(tries).toBeLessThanOrEqual(countMode ? 5001 : mode.endsWith('time') ? 6 : 30);
    const p = JSON.parse(packet);
    expect(p.obligationDecision).toBe(OBLIGATION_DECISION_FLOOR);
    if (mode === 'history') expect(p.history).toEqual([]);
    expect(p.memorySummary).toBeUndefined(); expect(p.pendingReports).toBeUndefined(); expect(p.memorySearch).toBeUndefined();
    expect(p.pendingReportsOmitted).toBe(pendingCount);
    if (mixed) {
      expect(p.retiredResults).toBeUndefined(); expect(p.retiredResultsOmitted).toBe(1);
      expect(retiredResults(f.journal.view).map(item => item.text)).toEqual([`Access check 59: ${'recorded details '.repeat(80)}`.trim()]);
    }
    expect(p.sources.map((source: { text: string }) => source.text)).toEqual(recordedShapes.map(shape => shape.raw));
    expect(sends).toBe(1);
    expect(f.journal.view.order.at(-1)?.packetDropped).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'preparation-search', reason: expect.stringContaining('5000 candidates / 5000 ms') })]));
    expect(pendingReports(f.journal.view)).toHaveLength(pendingCount);
    f.journal.close();
    const replay = openPreviewJournal(f.path, key);
    expect(replay.view.order.at(-1)?.packetDropped).toEqual(f.journal.view.order.at(-1)?.packetDropped);
    if (mixed) expect(retiredResults(replay.view)).toEqual(retiredResults(f.journal.view));
    replay.close();
  } finally { clock.mockRestore(); f.close(); }
}, 30000);

it('keeps an ordinary fitting packet and canonical envelope byte-identical to the base', async () => {
  const f = world(); let context = '', prepared = '';
  try {
    const worker = createJournalWorker(f.journal, { now: () => at, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, at, genesis.maxBytes),
      model: async input => { context = input.context; prepared = input.prepared!; return '{"reply":"Hello.","memory":[]}'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Hello.' } }]);
    await worker.drain();
    expect([context, prepared].map(value => createHash('sha256').update(value).digest('hex'))).toMatchInlineSnapshot(`
      [
        "309970044f4929cc9f0960e3713dd719c30bbf6361e45981f86a963a0a5d0844",
        "b9789bc54b8ffd6ae46d30c585273bc677ce87dfb308b5dfb6c32407e3d759c0",
      ]
    `);
    expect(f.journal.view.order[0]?.packetDropped).toEqual([]);
  } finally { f.close(); }
});
