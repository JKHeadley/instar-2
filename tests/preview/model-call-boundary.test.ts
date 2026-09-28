// Rules 41, 57 and 75: the one recording boundary and the written judgment/usage register.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertLiveJudgment, decisionWithinFloor, ENVELOPE_FLOOR, LIVE_JUDGMENTS, modelCallRecord, USAGE_EXCEPTIONS } from './model-call-boundary.js';
import { openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const call = (overrides: Record<string, unknown> = {}) => ({ id: 'turn:1', judgment: 'answer', route: 'preview-subscription',
  model: 'claude-test', input: 'the exact prompt', output: '{"type":"Decision"}', outcome: 'complete' as const, latencyMs: 12.4,
  usage: { inputTokens: 10, outputTokens: 3, charge: null }, at: 1000, ...overrides });

it('records exact input, output, route, outcome, latency and usage; refuses an unregistered judgment before any call', () => {
  expect(modelCallRecord(call())).toMatchObject({ kind: 'model-call', judgment: 'answer', route: 'preview-subscription',
    input: 'the exact prompt', output: '{"type":"Decision"}', outcome: 'complete', latencyMs: 12, usage: { inputTokens: 10, outputTokens: 3 } });
  expect(() => assertLiveJudgment('invented-gate', 'preview-subscription')).toThrow('unregistered judgment');
  expect(() => assertLiveJudgment('answer', 'typesafe-jev')).toThrow('unregistered judgment');
  expect(() => modelCallRecord(call({ judgment: 'jev-reply-check' }))).toThrow('unregistered judgment');
  // An input already durable in the journal is referenced, not copied.
  expect(modelCallRecord(call({ inputRef: 'reserve:turn:1' }))).toMatchObject({ inputRef: 'reserve:turn:1' });
  expect(modelCallRecord(call({ inputRef: 'reserve:turn:1' })).input).toBeUndefined();
});

it('keeps absent usage UNKNOWN under the written provider exception, never an invented cost', () => {
  const unknown = modelCallRecord(call({ route: 'typesafe-jev', judgment: 'jev-reply-check', usage: null }));
  expect(unknown.usage).toBeNull();
  expect(unknown.usageException).toBe(USAGE_EXCEPTIONS['typesafe-jev']);
  const empty = modelCallRecord(call({ usage: { inputTokens: null, outputTokens: null, charge: null } }));
  expect(empty.usage).toBeNull();
  expect(empty.usageException).toBe(USAGE_EXCEPTIONS['preview-subscription']);
  expect(modelCallRecord(call()).usageException).toBeUndefined();
});

it('scrubs a secret from recorded input and output', () => {
  const secret = 'sk-ant-api03-' + 'A'.repeat(90);
  const record = modelCallRecord(call({ input: `key ${secret}`, output: `echo ${secret}` }));
  expect(JSON.stringify(record)).not.toContain(secret);
});

it('a returned Decision may echo the envelope floor but never widen it or choose outside it', () => {
  const echo = { floor: { allowed: { ...ENVELOPE_FLOOR, actions: [...ENVELOPE_FLOOR.actions] }, chosen: 'work' } };
  expect(decisionWithinFloor({})).toBe(true);
  expect(decisionWithinFloor(echo)).toBe(true);
  expect(decisionWithinFloor({ floor: { allowed: { ...echo.floor.allowed, actions: ['work', 'send-anything'] }, chosen: 'work' } })).toBe(false);
  expect(decisionWithinFloor({ floor: { allowed: echo.floor.allowed, chosen: 'send-anything' } })).toBe(false);
  expect(decisionWithinFloor({ floor: { allowed: { ...echo.floor.allowed, default: 'send-anything' }, chosen: 'work' } })).toBe(false);
  // The envelope sent to the model carries exactly this floor.
  const prepared = JSON.parse(prepareJournalEnvelope({ question: 'q', context: '{}', id: 'x' }, 'claude-test-1', 'grant', 1000));
  expect(prepared.floor).toEqual(ENVELOPE_FLOOR);
});

it('every registered judgment names a route, a closed action space and a default inside it', () => {
  for (const [name, judgment] of Object.entries(LIVE_JUDGMENTS)) {
    expect(['preview-subscription', 'typesafe-jev'], name).toContain(judgment.route);
    expect(judgment.actions as readonly string[], name).toContain(judgment.default);
    expect(judgment.invalid.length, name).toBeGreaterThan(10);
  }
});

it('journals model-call records and refuses a malformed one at the write boundary', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'model-call-')));
  try {
    const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(3);
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '1', chat: '2', operator: '2', grant: 'g',
      configurationDigest: 'sha256:x', expires: 9999999999999, maxCalls: 5, maxReplies: 5, maxTurns: 5, maxBytes: 32768, cursor: 0 });
    journal.append(modelCallRecord(call()));
    journal.append(modelCallRecord(call({ id: 'jev:1', route: 'typesafe-jev', judgment: 'jev-reply-check', usage: null, outcome: 'failed', output: null })));
    expect(() => journal.append({ ...modelCallRecord(call()), usage: null })).toThrow('model call record refused');
    expect(journal.view.modelCalls).toMatchObject({ total: 2, byJudgment: { answer: 1, 'jev-reply-check': 1 },
      byOutcome: { complete: 1, failed: 1 }, usageUnknown: 1 });
    journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    expect(reopened.view.modelCalls.total).toBe(2);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('the shipped launcher reaches models only inside its marked recording boundary', () => {
  const launcher = readFileSync(join(process.cwd(), 'tests/preview/journal-agent.mjs'), 'utf8');
  const start = launcher.indexOf('// model-call-boundary:start'), end = launcher.indexOf('// model-call-boundary:end');
  expect(start).toBeGreaterThan(0);
  const inside = launcher.slice(start, end), outside = launcher.slice(0, start) + launcher.slice(end);
  expect(inside).toContain("fetch('https://api.typesafe.ai/v1/systemone'");
  expect(inside).toContain('route.invoke(');
  expect(outside).not.toMatch(/\bfetch\s*\(/u);
  expect(outside.replace(/physical\.invoke\s*\(/gu, '')).not.toMatch(/\.invoke\s*\(/u);
});

it('the architecture check fails a provider call outside the boundary, including in an imported module', async () => {
  // @ts-ignore the checker is a plain ESM script
  const { lintShippedLauncher } = await import('../../scripts/check-architecture.mjs');
  const files: Record<string, string> = {
    '/v/runner.mjs': "import { x } from './helper.mjs';\n// model-call-boundary:start\nawait fetch('https://api.typesafe.ai');\nawait route.invoke(p);\n// model-call-boundary:end\nphysical.invoke({});\n",
    '/v/helper.mjs': 'export const x = 1;\n' };
  const clean = lintShippedLauncher('/v/runner.mjs', (path: string) => files[path], (path: string) => path in files);
  expect(clean).toEqual([]);
  files['/v/helper.mjs'] = "export const x = await fetch('https://api.typesafe.ai');\n";
  expect(lintShippedLauncher('/v/runner.mjs', (path: string) => files[path], (path: string) => path in files))
    .toMatchObject([{ rule: 'R41-R75', line: 1 }]);
  expect(lintShippedLauncher('tests/preview/journal-agent.mjs')).toEqual([]);
});
