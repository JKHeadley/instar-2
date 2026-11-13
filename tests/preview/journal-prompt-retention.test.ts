import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openPreviewJournal, durableProjection, serializedStateBytes, PROMPT_RETENTION_TURNS, settledConstraintWording,
  type JournalView, type BlockerNote, type MemoryChange } from './journal.js';
import { retrospectivePopulation, type RetroResult } from './retrospective.js';
import { replyReviewContext, sharedAudience } from './reply-check.js';
import { auditActiveMemory } from './journal-audit.mjs';
// @ts-expect-error -- host-only continuation projection is JavaScript, exercised at runtime.
import { boundedContinuationGrounding } from './continuation-grounding.mjs';
import { updateDelivery } from './installation.js';

const key = new Uint8Array(32).fill(17);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 2000, maxReplies: 2000, maxTurns: 2000, maxBytes: 262144, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const packetOf = (prompt: string) => JSON.parse(JSON.parse(prompt).messages.find((m: { role: string }) => m.role === 'context').content).packet;
const prompt = (n: number) => JSON.stringify({ model: 'recorded-shape', messages: [
  { role: 'user', content: `question ${n}` }, { role: 'context', content: JSON.stringify({ packet: {
    audience: { surface: 'private', operatorOnlyVerified: true }, actionFacts: { attempted: false },
    governingConstraints: { scope: 'inside recorded scope' }, installedUpdate: { to: 'revision:new' },
    history: [{ text: 'x'.repeat(75_000) }], memorySummary: { through: 1, text: 'an old summary clause and unrelated material' },
  } }) }] });
function add(journal: ReturnType<typeof openPreviewJournal>, n: number, complete = true, thread?: number, checked = true, memory: MemoryChange[] = []) {
  const text = `question ${n}`, raw = JSON.stringify({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text } });
  journal.append({ kind: 'intake', id: id(n), update: n, text, raw, accepted: true, cursor: n + 1, at: n * 10,
    ...(thread === undefined ? {} : { thread }) });
  journal.append({ kind: 'reserve', id: id(n), prompt: prompt(n), at: n * 10 + 1 });
  if (!complete) return;
  journal.append({ kind: 'answer', state: 'complete', id: id(n), text: `answer ${n}`, ...(memory.length ? { memory } : {}), at: n * 10 + 2 });
  journal.append({ kind: 'intent', id: id(n), text: `PREVIEW — answer ${n}`, chat: genesis.chat, update: n, grant: genesis.grant, ...(thread === undefined ? {} : { thread }), at: n * 10 + 3 });
  journal.append({ kind: 'sent', id: id(n), message: n + 1000, at: n * 10 + 4 });
  if (checked) journal.append({ kind: 'coherence', id: id(n), findings: [], at: n * 10 + 5 });
}
const bytes = (view: JournalView) => Buffer.byteLength(JSON.stringify(durableProjection(view)));
it('500 recorded-shape 75KB prompts compact below 4MB, preserve recent bytes and reopen with working old readers', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'prompt-retention-'))), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis, undefined, false, 1_000_000_000);
  try {
    for (let n = 1; n <= 500; n++) { add(journal, n); if (n % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0)); }
    const before = bytes(journal.view), old = journal.view.turns.get(id(1))!;
    expect(before).toBeGreaterThan(37_500_000);
    journal.compact();
    const after = bytes(journal.view);
    expect(after).toBeLessThan(4_000_000);
    expect(serializedStateBytes(journal.view)).toBe(after);
    expect(journal.lastSnapshotSerializedBytes).toBeGreaterThan(after);
    expect(journal.lastSnapshotSerializedBytes).toBeLessThan(5_000_000);
    expect(old).toBe(journal.view.turns.get(id(1))); // worker references see the committed retention
    expect(old.promptRetention).toEqual({ state: 'body not retained', sha256: createHash('sha256').update(prompt(1)).digest('hex'), bytes: Buffer.byteLength(prompt(1)) });
    expect(old.prompt!.length).toBeLessThan(1500);
    expect(packetOf(old.prompt!).audience).toEqual(packetOf(prompt(1)).audience);
    expect(packetOf(old.prompt!).actionFacts).toEqual({ attempted: false });
    expect(settledConstraintWording(journal.view, { source: id(1), constraint: 'scope', rechecks: [] } as unknown as BlockerNote)).toBe('inside recorded scope');
    expect(JSON.parse(replyReviewContext(old.prompt!, old.intent!)).promptRetention.state).toBe('body not retained');
    expect(sharedAudience(old.prompt)).toBe(sharedAudience(prompt(1)));
    const update = { at: 0, to: { revision: 'revision:new', codeDigest: 'digest' } } as Parameters<typeof updateDelivery>[0];
    expect(updateDelivery(update, journal.view.order)).toEqual({ deliveredInReplyTo: 1 });
    const population = retrospectivePopulation(journal.view, () => true);
    expect(population.find(item => item.id === `answer:${id(1)}`)?.meta).toMatchObject({ promptRetention: JSON.stringify(old.promptRetention) });
    for (let n = 501 - PROMPT_RETENTION_TURNS; n <= 500; n++) {
      expect(journal.view.turns.get(id(n))!.prompt).toBe(prompt(n));
      expect(JSON.parse(replyReviewContext(prompt(n), `answer ${n}`)).operatorMessage).toBe(`question ${n}`);
    }
    console.log(JSON.stringify({ turns: 500, promptPayloadBytes: 75000, before, after, snapshotBytes: journal.lastSnapshotSerializedBytes, retainedWindow: PROMPT_RETENTION_TURNS }));
    const expected = JSON.stringify(durableProjection(journal.view));
    journal.compact();
    expect(JSON.stringify(durableProjection(journal.view))).toBe(expected);
    journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    try { expect(JSON.stringify(durableProjection(reopened.view))).toBe(expected); }
    finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 240_000);
it('keeps unfinished, unreviewed and inactive-conversation prompts whole', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'prompt-retention-pending-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis, undefined, false, 1_000_000_000);
  try {
    add(journal, 1, false); add(journal, 2, true, 7); add(journal, 3, true, undefined, false);
    for (let n = 4; n <= 40; n++) add(journal, n);
    journal.compact();
    for (const n of [1, 2, 3]) expect(journal.view.turns.get(id(n))!.prompt).toBe(prompt(n));
    expect(boundedContinuationGrounding('', journal.view.order.filter(turn => turn.thread === 7))).toContain('question 2');
    expect(journal.view.turns.get(id(4))!.promptRetention?.state).toBe('body not retained');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
it('a failed replacement leaves the original prompt body and reader projection intact', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'prompt-retention-crash-'))), path = join(root, 'journal.encrypted');
  let fault = false;
  const journal = openPreviewJournal(path, key, genesis, stage => {
    if (fault && stage === 'compact:before-rename') throw Error('injected replacement failure');
  }, false, 1_000_000_000);
  try {
    for (let n = 1; n <= 34; n++) add(journal, n);
    const before = JSON.stringify(durableProjection(journal.view)); fault = true;
    expect(() => journal.compact()).toThrow('injected replacement failure');
    expect(JSON.stringify(durableProjection(journal.view))).toBe(before);
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    try { expect(JSON.stringify(durableProjection(reopened.view))).toBe(before); }
    finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
it('keeps memory audit clauses and retrospective results while reducing only settled duplicate bodies', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'prompt-retention-evidence-'))), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis, undefined, false, 1_000_000_000);
  try {
    add(journal, 1);
    journal.append({ kind: 'summary-reserve', through: 1, at: 16 });
    journal.append({ kind: 'summary-candidate', through: 1, state: 'candidate body '.repeat(100), at: 17 });
    journal.append({ kind: 'summary', through: 1, text: 'an old summary clause and unrelated material', at: 18 });
    add(journal, 2, true, undefined, true, [{ mode: 'forget', source: id(1), trigger: id(2), quote: 'question 1', summaryPassages: ['an old summary clause'] }]);
    for (let n = 3; n <= 35; n++) add(journal, n);
    journal.append({ kind: 'summary-reserve', through: 2, at: 400 });
    journal.append({ kind: 'summary-candidate', through: 2, state: 'pending candidate', at: 401 });
    const result: RetroResult = { inspected: [], omitted: [], duties: [], gravityWells: [], efficiency: { summary: 'Recorded review result.' },
      findings: [], grades: [], feedback: [], authorizations: [], closures: [], comparisons: [] };
    for (let pass = 0; pass < 34; pass++) {
      journal.append({ kind: 'retro-reserve', pass, turnsSeen: 35, cases: [], omitted: [], eligible: 0, packetSha256: 'sha256:recorded', contextDigest: 'sha256:context', at: 500 + pass * 4 });
      journal.append({ kind: 'retro-duty-reserve', pass, duties: ['waste'], held: result, at: 501 + pass * 4 });
      if (pass === 33) break;
      journal.append({ kind: 'retro-duty', pass, state: 'unknown', reason: 'interrupted', at: 502 + pass * 4 });
      journal.append({ kind: 'retro', pass, state: 'complete', result, at: 503 + pass * 4 });
    }
    const audit = auditActiveMemory(journal.view);
    expect(audit.findings).toEqual([]);
    journal.compact();
    expect(journal.view.turns.get(id(2))!.promptRetention).toBeDefined();
    expect(packetOf(journal.view.turns.get(id(2))!.prompt!).memorySummary).toEqual({ through: 1, text: 'an old summary clause' });
    expect(auditActiveMemory(journal.view)).toEqual(audit);
    expect(JSON.parse(journal.view.summaryCandidates.get(1)!).state).toBe('body not retained');
    expect(journal.view.summaryCandidates.get(2)).toBe('pending candidate');
    expect(journal.view.retroPasses[0]!.dutyFollowUp?.held).toBeUndefined();
    expect(journal.view.retroPasses[0]!.dutyFollowUp?.heldRetention?.state).toBe('body not retained');
    expect(journal.view.retroPasses[0]!.result).toEqual(result);
    expect(journal.view.retroPasses.at(-1)!.dutyFollowUp?.held).toEqual(result);
    journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    try { expect(auditActiveMemory(reopened.view)).toEqual(audit); expect(reopened.view.retroPasses[0]!.result).toEqual(result); }
    finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
it('retains the four sent continuation turns behind a newer unsent backlog', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'prompt-retention-backlog-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis, undefined, false, 1_000_000_000);
  try {
    for (let n = 1; n <= 4; n++) add(journal, n);
    for (let n = 5; n <= 40; n++) add(journal, n, false);
    journal.compact();
    const sent = journal.view.order.filter(turn => turn.sent !== undefined);
    for (const turn of sent) expect(turn.promptRetention).toBeUndefined();
    expect(boundedContinuationGrounding('', sent)).toContain('question 1');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('status measures serialized state and inspect discloses old retained bodies through the real CLI', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'prompt-retention-cli-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis, undefined, false, 1_000_000_000);
  const cli = (args: string[]) => new Promise<{ code: number | null; out: string; error: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', ...args, '--root', root],
      { env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', error = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
    child.stdout.on('data', chunk => { out += String(chunk); }); child.stderr.on('data', chunk => { error += String(chunk); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('exit', code => { clearTimeout(timer); resolve({ code, out, error }); });
  });
  try {
    for (let n = 1; n <= 35; n++) add(journal, n);
    journal.compact();
    const projection = serializedStateBytes(journal.view), snapshot = journal.lastSnapshotSerializedBytes;
    journal.close();
    const status = await cli(['status']); expect(status.code, status.error).toBe(0);
    expect(JSON.parse(status.out).journalCapacity).toMatchObject({ serializedStateBytes: projection, lastSnapshotSerializedBytes: snapshot });
    const inspect = await cli(['inspect', '--update', '1']); expect(inspect.code, inspect.error).toBe(0);
    expect(JSON.parse(inspect.out).reply.promptRetention.state).toBe('body not retained');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 240_000);
