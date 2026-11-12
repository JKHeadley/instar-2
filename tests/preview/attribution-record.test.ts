import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { parseAttributionAnswer } from './attribution.js';
// @ts-expect-error the production recorder is JavaScript
import { observedSubscriptionIO } from './call-diagnostics.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const now = 1790000000000, day = new Date(now).toISOString().slice(0, 10);
const source = 'Run builds on the mini.', bare = 'Sam said to run builds on the mini.';
const sourced = `Sam said: "${source}" [source: telegram 7654321/1 ${day}]`;
const judgment = (text: string, marker: number | null) => JSON.stringify({ claims: [{ span: text, person: 'Sam', kind: 'statement',
  marker, labelled: false, stillCredits: false, recap: false, ownWords: marker === null ? null : 'own', faithful: marker === null ? null : true, why: 'Recorded credit.' }] });

function fixture(text = bare, options: { enabled?: boolean; raw?: string | null; pause?: Promise<void>; maxCalls?: number; crash?: boolean; send?: 'unknown'; notes?: true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'attribution-record-'))); roots.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(24), sends: string[] = [], packets: string[] = [];
  let judged = 0, stopped = false, crashed = false;
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: options.maxCalls ?? 40, maxReplies: 20, maxTurns: 20, maxBytes: 262144, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis, stage => {
    if (options.crash && !crashed && stage === 'after:attribution-reserve') { crashed = true; throw Error('reservation crash'); }
  });
  const ports: PreviewPorts = { now: () => now, stopped: () => stopped,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', 9999999999999), model: async () => text,
    checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return options.send === 'unknown' ? { kind: 'unknown', reason: 'lost receipt' } : sends.length; },
    ...(options.enabled === false ? {} : { attribution: { mode: options.notes ? 'enforce' as const : 'record' as const,
      ...(options.notes ? {} : { notes: false as const }), recordReplies: true as const,
      judge: async ({ id, packet }: { id: string; packet: string }) => {
        judged++; packets.push(packet); await options.pause;
        await observedSubscriptionIO({ execute: async () => ({ code: 0, limited: false, stdout: '', stdoutBytes: new Uint8Array() }) },
          { maxTokens: 2048, maxOutputBytes: 16384 }, id, (row: never) => journal.append(row), { elapsed: () => 1, at: () => now }).execute({ stdin: 'x' });
        return { value: options.raw === undefined ? judgment(text, text.includes('[source:') ? 0 : null) : options.raw };
      } } }) };
  let worker = createJournalWorker(journal, ports);
  const intake = (update: number) => worker.intake([{ update_id: update, message: { message_id: update,
    chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: source } }]);
  intake(1);
  return { get worker() { return worker; }, get journal() { return journal; }, sends, packets, intake,
    get judged() { return judged; }, stop: () => { stopped = true; },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); },
    close: () => journal.close() };
}

it.each([[sourced, true], [bare, false], [sourced.replace('/1 ', '/99 '), false]] as const)('records the credit and exact cited-source resolution: %s', async (text, found) => {
  const f = fixture(text);
  try {
    await f.worker.drain(); expect(f.judged).toBe(0); expect(f.sends).toEqual([text]);
    await f.worker.reviewReplies();
    expect(f.journal.view.attribution).toMatchObject([{ surface: 'send', mode: 'record', claims: 1,
      spans: [{ span: text, person: 'Sam', sourceFound: found }] }]);
    const saved = structuredClone(f.journal.view.attribution);
    f.reopen(); await f.worker.reviewReplies(); await f.worker.drain();
    expect(f.journal.view.attribution).toEqual(saved); expect(f.judged).toBe(1); expect(f.sends).toEqual([text]);
  } finally { f.close(); }
});

it('off makes no record or call and delivers byte-identical text; reply-only never checks a note', async () => {
  const off = fixture(bare, { enabled: false }), on = fixture();
  try {
    for (const f of [off, on]) {
      await f.worker.drain(); await f.worker.reviewReplies();
      expect(await f.worker.attributionOfNote('toolu_1', bare)).toBeNull();
    }
    expect(off.sends).toEqual(on.sends); expect(off.sends).toEqual([bare]);
    expect(off.judged).toBe(0); expect(off.journal.view.attribution).toBeUndefined();
    expect(on.judged).toBe(1); expect(on.journal.view.attribution).toHaveLength(1);
  } finally { off.close(); on.close(); }
});

it('a blocked judge does not delay either reply; one review job owns the pending call', async () => {
  let release!: () => void;
  const f = fixture(bare, { pause: new Promise<void>(resolve => { release = resolve; }) });
  try {
    await f.worker.drain();
    const pending = f.worker.reviewReplies(); expect(f.worker.reviewReplies()).toBe(pending);
    await Promise.resolve(); expect(f.judged).toBe(1);
    f.intake(2); await f.worker.drain(); expect(f.sends).toEqual([bare, bare]);
    release(); await pending; expect(f.journal.view.attribution).toHaveLength(2);
  } finally { release(); await f.worker.reviewReplies(); f.close(); }
});

it.each([null, 'not json'])('an unavailable or unreadable judge stays unchecked after delivery: %s', async raw => {
  const f = fixture(bare, { raw });
  try { await f.worker.drain(); await f.worker.reviewReplies();
    expect(f.sends).toEqual([bare]); expect(f.journal.view.attribution).toMatchObject([{ verdict: 'unchecked' }]);
  } finally { f.close(); }
});

it.each(['cap', 'stop', 'crash', 'unknown', 'enforce-notes'] as const)('retains the %s boundary', async boundary => {
  const f = fixture(bare, { ...(boundary === 'cap' ? { maxCalls: 1 } : {}), crash: boundary === 'crash',
    ...(boundary === 'unknown' ? { send: 'unknown' as const } : {}), ...(boundary === 'enforce-notes' ? { notes: true as const } : {}) });
  try {
    await f.worker.drain(); const delivered = [...f.sends]; if (boundary === 'stop') f.stop();
    if (boundary === 'crash') { await expect(f.worker.reviewReplies()).rejects.toThrow('reservation crash'); f.reopen(); }
    await f.worker.reviewReplies();
    expect(f.sends).toEqual(delivered); expect(f.sends[0]).toBe(bare);
    if (boundary === 'unknown') expect(f.journal.view.attribution).toBeUndefined();
    else expect(f.journal.view.attribution).toMatchObject([{ mode: 'record', verdict: boundary === 'enforce-notes' ? 'refuse' : 'unchecked' }]);
    expect(f.judged).toBe(boundary === 'enforce-notes' ? 1 : 0);
  } finally { f.close(); }
});

const captured = JSON.parse(readFileSync(new URL('./fixtures/attribution-record-r3-2026-11-06.json', import.meta.url), 'utf8')) as
  { source: string; model: string; set: string; note: string; text: string; raw: string }[];
it.each(captured)('records real $model $set output ($note) through the journal consumer', async row => {
  const f = fixture(row.text, { raw: row.raw });
  try { await f.worker.drain(); await f.worker.reviewReplies();
    expect(f.sends).toEqual([row.text]); expect(f.judged).toBe(1);
    expect(f.journal.view.attribution).toMatchObject([{ surface: 'send', mode: 'record', claims: 1,
      spans: [{ person: 'Justin', sourceFound: false }] }]);
  } finally { f.close(); }
});

const archive = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string; source: string }[] };
it.each(archive.otherShapes)('keeps recorded $kind ($id) distinct from an attribution answer', async row => {
  const read = readAnswer(row.raw, { wrapped: 'refuse', object: true });
  expect(() => parseAttributionAnswer(read.ok ? read.value : row.raw)).toThrow();
  const f = fixture(bare, { raw: read.ok ? read.value : row.raw });
  try { await f.worker.drain(); await f.worker.reviewReplies();
    expect(f.sends).toEqual([bare]); expect(f.journal.view.attribution).toMatchObject([{ verdict: 'unchecked', cause: 'unreadable answer' }]);
  } finally { f.close(); }
});
