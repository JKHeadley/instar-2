import { expect, it } from 'vitest';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, projectMemoryText } from './journal.js';

const key = new Uint8Array(32).fill(41);
const turns = 37;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:offline-growth', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const question = (n: number) => `Operator turn ${n}: remember the meeting notes and answer from the dated record.`;
const raw = (n: number) => JSON.stringify({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: question(n) } });
// Fixed, unique clauses from a synthetic conversation; each later packet repeats
// the accumulated history, pinned sources and an evolving self-state like the runner.
const clause = (n: number) => `On 2026-09-${String(n % 28 + 1).padStart(2, '0')}, item ${n} named `
  + Array.from({ length: 90 }, (_, j) => `${(n * 173 + j * 47) % 997} ${['orchid', 'ledger', 'harbor', 'copper'][j % 4]}`).join(' ') + '.';
const packet = (n: number) => JSON.stringify({ messages: [
  { role: 'system', content: 'Private preview. Answer from the grounded journal only.' },
  { role: 'context', content: JSON.stringify({ packet: { audience: 'verified operator',
    history: Array.from({ length: Math.min(n, 20) }, (_, i) => ({ id: id(n - i), text: clause(n - i) })),
    sources: [{ name: 'purpose', text: Array.from({ length: 10 }, (_, i) => clause(i + 70)).join('\n') }],
    self: `turn ${n} of ${turns}; limits and memory health from durable state` } }) },
  { role: 'user', content: question(n) },
] });
const outcome = (promptBytes: number) => ({ exitCode: 0, localLimit: null, elapsedMs: 45,
  type: 'result' as const, subtype: 'success' as const, isError: false, outputTokens: 80, promptBytes });

function frameBytes(path: string): Record<string, number> {
  const sealed = readFileSync(path), result: Record<string, number> = {};
  for (let offset = 0; offset < sealed.length;) {
    const length = sealed.readUInt32BE(offset), bytes = sealed.subarray(offset + 4, offset + 4 + length);
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`preview-journal:${offset}`)); decipher.setAuthTag(bytes.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    const json = plain[0] === 1 ? brotliDecompressSync(plain.subarray(1)) : plain;
    const kind = (JSON.parse(json.toString('utf8')) as { kind: string }).kind;
    result[kind] = (result[kind] ?? 0) + length + 4;
    offset += length + 4;
  }
  return result;
}

function rows(path: string): { kind: string; prompt?: string; promptSha256?: string }[] {
  const sealed = readFileSync(path), result = [];
  for (let offset = 0; offset < sealed.length;) {
    const length = sealed.readUInt32BE(offset), bytes = sealed.subarray(offset + 4, offset + 4 + length);
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`preview-journal:${offset}`)); decipher.setAuthTag(bytes.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    result.push(JSON.parse((plain[0] === 1 ? brotliDecompressSync(plain.subarray(1)) : plain).toString('utf8')));
    offset += length + 4;
  }
  return result;
}

it('keeps a 37-turn synthetic replay and inspect journal below 8 KiB per turn', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-growth-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    for (let n = 1; n <= turns; n++) {
      const prompt = packet(n), turn = id(n), at = 1000 + n * 100;
      journal.append({ kind: 'intake', id: turn, update: n, text: question(n), raw: raw(n),
        accepted: true, cursor: n + 1, at });
      journal.append({ kind: 'reserve', id: turn, prompt, at: at + 1 });
      journal.append({ kind: 'call-outcome', id: turn, role: 'model', outcome: outcome(Buffer.byteLength(prompt)), at: at + 2 });
      journal.append({ kind: 'answer', id: turn, text: `The recorded item is ${n}.`, at: at + 3 });
      journal.append({ kind: 'reply-review-reserve', id: turn, candidate: `PREVIEW — The recorded item is ${n}.`,
        promptSha256: createHash('sha256').update(prompt).digest('hex'), at: at + 4 });
      journal.append({ kind: 'call-outcome', id: `${turn}:reply-review`, role: 'reply-review',
        outcome: outcome(Buffer.byteLength(prompt)), at: at + 5 });
      journal.append({ kind: 'reply-review-state', id: turn, state: 'complete', at: at + 6 });
      journal.append({ kind: 'reply-check', id: turn,
        result: { verdict: 'pass', ruleIds: [], confidence: 1, path: 'subscription', latencyMs: 45 }, at: at + 7 });
      journal.append({ kind: 'intent', id: turn, text: `PREVIEW — The recorded item is ${n}.`,
        chat: genesis.chat, update: n, grant: genesis.grant, at: at + 8 });
      journal.append({ kind: 'sent', id: turn, message: n + 500, at: at + 9 });
      if (n % 4 === 0) {
        journal.append({ kind: 'summary-reserve', through: n, prompt: packet(n), at: at + 10 });
        journal.append({ kind: 'summary', through: n, text: clause(n), at: at + 11 });
      }
    }
    const beforeCompact = frameBytes(path);
    const bytes = statSync(path).size;
    journal.compact();
    const afterCompact = frameBytes(path);
    journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true, undefined, true);
    expect(replay.view.order).toHaveLength(turns);
    expect(replay.view.order.at(-1)?.prompt).toBe(packet(turns));
    expect(replay.view.order.at(-1)?.sent).toBe(537);
    expect(replay.view.summaries).toHaveLength(9);
    replay.close();
    console.log('growth fixture bytes', JSON.stringify({ beforeCompact, afterCompact, bytes,
      perTurn: Math.ceil(bytes / turns), compactedPerTurn: Math.ceil(statSync(path).size / turns) }));
    expect(bytes / turns).toBeLessThan(8192);
    expect(statSync(path).size / turns).toBeLessThan(8192);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('checks review references before append and preserves UNKNOWN and forgetting through compaction', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-growth-safety-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    journal.append({ kind: 'intake', id: id(1), update: 1, text: question(1), raw: raw(1),
      accepted: true, cursor: 2, at: 1000 });
    const original = packet(1);
    journal.append({ kind: 'reserve', id: id(1), prompt: original, at: 1001 });
    journal.append({ kind: 'answer', id: id(1), text: 'The blue notebook is on the shelf.', at: 1002 });
    const beforeInvalid = journal.size;
    expect(() => journal.append({ kind: 'reply-review-reserve', id: id(1), candidate: 'candidate',
      promptSha256: '0'.repeat(64), at: 1003 })).toThrow('reference differs');
    expect(journal.size).toBe(beforeInvalid);
    journal.append({ kind: 'reply-review-reserve', id: id(1), candidate: 'candidate',
      promptSha256: createHash('sha256').update(original).digest('hex'), at: 1003 });
    journal.append({ kind: 'reply-review-state', id: id(1), state: 'uncertain', at: 1004 });
    journal.append({ kind: 'intake', id: id(2), update: 2, text: question(2), raw: raw(2),
      accepted: true, cursor: 3, at: 2000 });
    journal.append({ kind: 'reserve', id: id(2), prompt: packet(2), at: 2001 });
    journal.append({ kind: 'answer', id: id(2), text: 'I will forget that location.', memory: [
      { mode: 'forget', source: id(1), quote: 'blue notebook', trigger: id(2) }], at: 2002 });
    journal.compact(); journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true, undefined, true);
    expect(replay.view.turns.get(id(1))?.reviewState).toBe('uncertain');
    expect(replay.view.turns.get(id(1))?.prompt).toBe(original);
    expect(replay.view.turns.get(id(1))?.intent).toBeUndefined();
    expect(replay.view.memory).toHaveLength(1);
    expect(projectMemoryText(replay.view, 'The blue notebook is on the shelf.')).not.toContain('blue notebook');
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('the worker writes a digest reference when full-context review reuses its reserved packet', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-growth-worker-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: () => packet(1), model: async () => 'The answer is in the journal.',
      replyCheck: { jev: async () => { throw Error('offline Jev unavailable'); },
        escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 }),
        elapsedMs: () => 0 }, checkOutbound: () => {}, send: async () => 601 });
    worker.intake([JSON.parse(raw(1))]);
    await worker.drain();
    const reservation = rows(path).find(row => row.kind === 'reply-review-reserve');
    expect(reservation?.promptSha256).toBe(createHash('sha256').update(packet(1)).digest('hex'));
    expect(reservation?.prompt).toBeUndefined();
    expect(journal.view.order[0]?.sent).toBe(601);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('replays a large legacy JSON frame beside new compact frames', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-growth-legacy-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    journal.append({ kind: 'intake', id: id(1), update: 1, text: question(1), raw: raw(1),
      accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id: id(1), prompt: packet(1), at: 1001 });
    journal.close();
    const offset = statSync(path).size, nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
    const body = Buffer.concat([cipher.update(JSON.stringify({ kind: 'hold', id: id(1),
      reason: `legacy ${'x'.repeat(2000)}`, at: 1002 }), 'utf8'), cipher.final()]);
    const sealed = Buffer.concat([nonce, cipher.getAuthTag(), body]), length = Buffer.alloc(4);
    length.writeUInt32BE(sealed.length);
    appendFileSync(path, Buffer.concat([length, sealed]));
    const replay = openPreviewJournal(path, key, undefined, undefined, true, undefined, true);
    expect(replay.view.order[0]?.prompt).toBe(packet(1));
    expect(replay.view.order[0]?.held).toBe(`legacy ${'x'.repeat(2000)}`);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
