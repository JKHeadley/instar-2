import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAnswer } from './answer-reading.js';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createJournalWorker, openPreviewJournal, ModelNotStarted, ModelDisclosureRefused,
  createModelLaunchBoundary, type PreviewPorts } from './journal-test-worker.js';

// Execute the shipped host closure, substituting only its physical/model dependencies.
const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const signature = 'async ({ id, prepared, question, context: packet }) => {';
const body = host.split(`      model: ${signature}`)[1]!.split('\n      summaryCheck:')[0]!.trimEnd().replace(/,$/u, '');
const optionsBody = host.split('const conversationSessionOf = options => {')[1]!.split('\nconst sessionWorkOf')[0]!;
const mode = Function(`return options => {${optionsBody.replace(/;\s*$/u, '')}`)() as (options: Record<string, string>) => boolean;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const usage = { inputTokens: null, outputTokens: null, charge: null };
const update = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

function fixture(enabled = true, checkIntake = true, maxCalls = 200) {
  const root = mkdtempSync(join(tmpdir(), 'conversation-wiring-')); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls, maxReplies: 20,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  const f = assemblyRuntimeFixture();
  let now = 1000, launches = 0, calls = 0, fallback = 0, stopped = false, edges = 0;
  let destination = '', answer = JSON.stringify({ reply: 'A useful answer.', memory: [] });
  const files = new Map<string, string>(), delivered: string[] = [], sent: string[] = [];
  const port = value(createConversationSessionPort({ conversation: 'operator',
    createDriver: resolve => ({ owner: 'part-eight', launch: () => { launches++; return f.success('session:123:1'); },
      deliver: input => { if (checkIntake) expect(journal.view.order.some(turn => turn.id === input.intake && turn.reserved)).toBe(true);
        delivered.push(resolve(input.intake, input.digest)); calls++; files.set(destination, answer); return f.success('accepted'); },
      observe: () => f.success({ phase: 'output-observed', evidence: 'closed', detail: 'closed' }), stop: () => f.success(['123']) }),
    io: { clearResult: path => { destination = path; files.delete(path); }, readResult: path => files.get(path) ?? null,
      wait: async ms => { now += ms; }, modelCalls: () => calls, prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, openDelegations: [] }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => now, stopped: () => stopped,
    append: record => { journal.append({ kind: 'session-work', record, at: now }); if (record.type === 'SessionWorkEdge') edges++; }, parent: 'runner', owner: 'machine',
    placement: 'local', transport: 'fake', workingScope: '/scope', resultDirectory: '/scope', artifact: 'worker',
    incarnation: 'one', deadlineMs: 10000, pollMs: 25, maxResultBytes: 65536, maxSteps: 8, maxCalls: 10 }));
  const model = Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools',
    'invokeSubscription', 'recordedUsage', 'ModelDisclosureRefused', 'modelLaunch', 'conversationSession',
    'sessionWork', 'ModelNotStarted', 'readAnswer', 'recordShape', 'shapesPath', `return (${signature}${body});`)(journal, async () => {}, () => false, () => false,
    () => { throw Error('unexpected tools fallback'); }, async () => { fallback++; return { state: 'complete', value: answer, usage }; },
    (input: unknown) => input, ModelDisclosureRefused, createModelLaunchBoundary(), enabled,
    { port, authority: 'existing-role' }, ModelNotStarted, readAnswer, () => {}, '/unused') as PreviewPorts['model'];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    prepareModel: input => JSON.stringify({ ...input, responseContract: "decision-envelope-marker" }), model,
    send: async input => { sent.push(input.expectedText); return sent.length; },
    checkOutbound: text => { if (text.includes('SECRET')) throw Error('credential'); } });
  return { journal, worker, model, port, sent, delivered, edges: () => edges, counts: () => ({ launches, calls, fallback }),
    answer: (text: string) => { answer = text; }, stop: () => { stopped = true; },
    close: async () => { await port.close(); journal.close(); } };
}

it('defaults off, validates the single option, and never silently enables an absent activation', () => {
  expect(mode({})).toBe(false); expect(mode({ 'conversation-session': 'off' })).toBe(false);
  expect(mode({ 'conversation-session': 'on', 'session-work-activation': '/reviewed' })).toBe(true);
  expect(() => mode({ 'conversation-session': 'on' })).toThrow(/activation/);
  expect(() => mode({ 'conversation-session': 'maybe' })).toThrow(/on or off/);
});

it.each([false, true])('uses the shipped model route, mode=%s, and sends each durably admitted turn once', async enabled => {
  const f = fixture(enabled);
  try {
    f.worker.intake([update(1, 'First question')]); await f.worker.drain();
    f.answer(JSON.stringify({ reply: 'Second answer.', memory: [] }));
    f.worker.intake([update(2, 'Second question')]); await f.worker.drain(); await f.worker.drain();
    expect(f.sent).toEqual(['A useful answer.', 'Second answer.']);
    expect(f.counts()).toEqual(enabled ? { launches: 1, calls: 2, fallback: 0 } : { launches: 0, calls: 0, fallback: 2 });
    if (enabled) {
      expect(f.delivered[0]).toContain('First question');
      expect(f.delivered[0]).toContain('decision-envelope-marker');
      expect(f.delivered[1]).toContain('Second question'); expect(f.delivered[1]).toContain('A useful answer.');
      expect(f.delivered[0]).not.toContain('You have no tools');
      expect(f.edges()).toBe(1);
    }
  } finally { await f.close(); }
});

it('keeps summary/review/repair calls on their existing route and refuses a closed session without fallback', async () => {
  const f = fixture();
  try {
    await f.model({ id: 'summary:1', question: 'summarize', context: '{}', prepared: 'exact bytes' });
    expect(f.counts().fallback).toBe(1); expect(f.counts().launches).toBe(0);
    await f.port.close();
    await expect(f.model({ id: 'telegram:7654321:update:2', question: 'hello', context: '{}', prepared: '{}' }))
      .rejects.toBeInstanceOf(ModelNotStarted);
    expect(f.counts().fallback).toBe(1);
  } finally { await f.close(); }
});

it('keeps the outbound credential wall and durable stop in front of delivery', async () => {
  const f = fixture();
  try {
    f.answer(JSON.stringify({ reply: 'SECRET', memory: [] }));
    f.worker.intake([update(1, 'Question')]); await f.worker.drain();
    expect(f.sent).toEqual([]); expect(f.journal.view.order[0]?.held).toBe('outbound secret refused');
    f.worker.stop('operator');
    expect(() => f.worker.intake([update(2, 'Next')])).toThrow(/stopped/);
    expect(f.counts().calls).toBe(1);
  } finally { await f.close(); }
});

const recorded = JSON.parse(readFileSync(new URL('./fixtures/conversation-session-userwalk-2026-10-13.json', import.meta.url), 'utf8')) as {
  records: { frame: number; id: string; output: string }[] };
it.each(recorded.records)('reads the real user-walk output at frame $frame through the session result path', async row => {
  const f = fixture(true, false);
  try {
    f.answer(row.output);
    const result = await f.model({ id: row.id, question: 'Return the recorded answer shape', context: '{}', prepared: '{}' });
    expect(result).toMatchObject({ state: 'complete', usage });
    expect(typeof result).toBe('object');
    if (typeof result === 'string' || !('text' in result)) throw Error('recorded answer was not read');
    const raw = JSON.parse(row.output) as { reasoning: string; reply: unknown; dated: unknown[] };
    const answer = JSON.parse(result.text) as { reasoning?: unknown; reply: unknown; dated: unknown[] };
    expect(answer.reply).toEqual(raw.reply); expect(answer.dated).toEqual(raw.dated);
    expect(answer.reasoning).toBeUndefined(); expect(result).toMatchObject({ reason: raw.reasoning });
    expect(f.counts()).toEqual({ launches: 1, calls: 1, fallback: 0 });
  } finally { await f.close(); }
});

it('the journal refuses the whole session reservation before launch when the parent cap cannot hold it', async () => {
  const f = fixture(true, false, 9);
  try {
    const result = await f.model({ id: 'telegram:7654321:update:1', question: 'hello', context: '{}', prepared: '{}' });
    expect(result).toEqual({ state: 'uncertain' });
    expect(f.counts()).toEqual({ launches: 0, calls: 0, fallback: 0 });
    expect(f.journal.view.calls).toBe(0);
    expect(f.sent).toEqual([]);
  } finally { await f.close(); }
});
