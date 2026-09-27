import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { HOLDING_REPLY, REPLY_RULES } from './reply-check.js';
// @ts-expect-error The supervised Node script is intentionally an untyped .mjs entry.
import { resultSince } from './live-test-suite.mjs';

const before = { order: [{ update: 1, intake: true, answered: true, sent: true, held: null }] };
const turn = (update: number, changes: Record<string, unknown> = {}) =>
  ({ update, intake: true, answered: true, sent: true, held: null, ...changes });

describe('supervised live suite classification', () => {
  it('counts only new answered, Telegram accepted turns', () => {
    expect(resultSince(before, { order: [...before.order, turn(2), turn(3, { answered: false })] }))
      .toEqual({ answered: 1, held: 0, reason: '', unresolved: 0 });
  });

  it('keeps the first hold reason even when a candidate answer exists', () => {
    expect(resultSince(before, { order: [...before.order, turn(2, { sent: false, held: 'reply check unavailable' }),
      turn(3, { sent: false, held: 'call cap' })] }))
      .toEqual({ answered: 0, held: 1, reason: 'reply check unavailable', unresolved: 0 });
  });

  it('does not count a pending or UNKNOWN send as answered', () => {
    expect(resultSince(before, { order: [...before.order, turn(2, { sent: false })] }))
      .toEqual({ answered: 0, held: 0, reason: '', unresolved: 1 });
  });

  it('notices an older accepted turn that becomes held during the procedure', () => {
    expect(resultSince(before, { order: [turn(1, { held: 'memory correction pending' })] }))
      .toEqual({ answered: 0, held: 1, reason: 'memory correction pending', unresolved: 0 });
  });

  it('retains the first journal hold after a later reservation clears the current hold', () => {
    expect(resultSince({ ...before, holdEvents: [] }, { order: [turn(1)],
      holdEvents: ['reply check unavailable'] }))
      .toEqual({ answered: 0, held: 1, reason: 'reply check unavailable', unresolved: 0 });
  });
});

const key = new Uint8Array(32).fill(3);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 };
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: `question ${id}` } });

function startSuite(root: string) {
  const child = spawn(process.execPath,
    ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/live-test-suite.mjs', root],
    { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
  let output = '', error = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { error += String(chunk); });
  const waitFor = async (needle: string, after = 0) => {
    const deadline = Date.now() + 10000;
    while (output.indexOf(needle, after) < 0 && child.exitCode === null && Date.now() < deadline)
      await new Promise(done => setTimeout(done, 20));
    expect(output.indexOf(needle, after), error || output).toBeGreaterThanOrEqual(0);
    return output.indexOf(needle, after);
  };
  const finished = async () => {
    const code = child.exitCode ?? await new Promise<number | null>((done, fail) => {
      const timer = setTimeout(() => fail(Error(`suite did not exit: ${output}\n${error}`)), 10000);
      child.once('exit', value => { clearTimeout(timer); done(value); });
    });
    return { code, output, error };
  };
  return { child, waitFor, finished };
}

it('fails the actual coordinator on a sent holding reply after an ordinary answer', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-suite-hold-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const suite = startSuite(root);
  try {
    await suite.waitFor('enter PASS or FAIL with a reason:');
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => Date.now(), stopped: () => false,
      model: async input => input.question.includes('question 1') ? 'ordinary answer' : 'bad candidate',
      checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
      replyCheck: { elapsedMs: () => 100,
        jev: async text => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES)
          .map(id => [id, { type: 'noul', noul: text.includes('bad candidate') && id === 'raw_path' ? 0.91 : 0.01 }])) }, latencyMs: 100 }),
        escalate: async () => ({ verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 100,
          reason: 'raw path in candidate' }) } });
    worker.intake([update(1)]); await worker.drain();
    worker.intake([update(2)]); await worker.drain();
    const result = await suite.finished();
    expect(result.code, result.error).toBe(1);
    expect(sent).toEqual(['PREVIEW — ordinary answer', HOLDING_REPLY]);
    expect(result.output).toMatch(/jev-live-test\.md\s+FAIL\s+1\s+1\s+reply check violation: raw_path — raw path in candidate/u);
    expect(result.output).not.toContain('marker-dup-live-test.md                  PASS');
  } finally { suite.child.kill(); journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['stop file', 'journal stop'])('fails the final procedure on %s during its prompt', async stopSource => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-suite-stop-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const suite = startSuite(root);
  try {
    let id = 0;
    for (const [index, count] of [1, 2, 12, 1, 5, 2].entries()) {
      const marker = await suite.waitFor(`=== ${['jev-live-test.md', 'marker-dup-live-test.md', 'recall-benchmark-live-test.md',
        'channel-memory-live-test.md', 'dated-memory-live-test.md', 'away-digest-live-test.md'][index]} ===`);
      await suite.waitFor('enter PASS or FAIL with a reason:', marker);
      for (let turn = 0; turn < count; turn++) {
        id++;
        const keyId = `turn:${id}`;
        journal.append({ kind: 'intake', id: keyId, update: id, text: `question ${id}`, raw: JSON.stringify(update(id)),
          accepted: true, cursor: id + 1, at: id });
        journal.append({ kind: 'reserve', id: keyId, at: id });
        journal.append({ kind: 'answer', id: keyId, text: `answer ${id}`, at: id });
        journal.append({ kind: 'intent', id: keyId, text: `answer ${id}`, chat: genesis.chat, update: id,
          grant: genesis.grant, at: id });
        journal.append({ kind: 'sent', id: keyId, message: id, at: id });
      }
      if (index < 5) suite.child.stdin.write('PASS\n');
    }
    if (stopSource === 'stop file')
      writeFileSync(join(root, 'preview-stop.json'), JSON.stringify({ reason: 'operator' }));
    else journal.append({ kind: 'stop', reason: 'operator', at: id + 1 });
    const result = await suite.finished();
    expect(result.code, result.error).toBe(1);
    expect(result.output).toMatch(/away-digest-live-test\.md\s+FAIL\s+2\s+0\s+runner stopped/u);
    expect(result.output).not.toMatch(/away-digest-live-test\.md\s+PASS/u);
  } finally { suite.child.kill(); journal.close(); rmSync(root, { recursive: true, force: true }); }
});
