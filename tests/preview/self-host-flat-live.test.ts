// @ts-nocheck -- the registered doorway's physical IO is its captured-frame conformance fixture; every other step is the shipped path.
// Plan #606 (rules 2, 115): self-host reads the model's plan through readAnswer, the one reading of the flat answer protocol
// (plan #491). Live J test 5 step 2 on sb-w4-replycheck e4cf7104 refused both real answers "model returned no plan": the
// model wrote the flat object the conversation framing asks for, and dispatchOwnedProvider still read conclusion.value.
// These tests replay those two recorded result texts byte for byte (fixtures/self-host-flat-live-2026-10-06.json), plus a
// flat answer with no plan (still refused, now naming the defect) and the legacy full Decision (still read).
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SELF_HOST_CONTEXT as context, doorwayProvider, selfHost } from './self-host.mjs';
import { dispatchOwnedProvider, providerStores } from './self-host-owners.ts';
import { stoppedAt } from './self-host-harness.mjs';
import { DOORWAY_CONFORMANCE } from './doorway-conformance.js';
import { successiveWorld } from './successive-fixture.js';

const RECORDED = JSON.parse(readFileSync(new URL('./fixtures/self-host-flat-live-2026-10-06.json', import.meta.url), 'utf8')).recorded;
const TASK = 'Build a word-count capability: export wordCount(text) returning the number of whitespace-separated words, with a node:test file. Namespace agent.word-count, version 1.0.0.';
const NOW = 1790000002000, DOORWAY = 'claude-code-subscription', world = successiveWorld();
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'self-host-flat-')));
/** The registered doorway, answering with `result` as the model's raw result text (never wrapped by the fixture). */
const providerFor = (root, result) => doorwayProvider({ doorwayId: DOORWAY, profile: DOORWAY_CONFORMANCE[DOORWAY].profile,
  io: DOORWAY_CONFORMANCE[DOORWAY].io({ outcome: 'complete', calls: 0, stdin: [], result: () => result }),
  activation: world.activation(), model: world.model, stopped: stoppedAt(root), now: () => NOW });
const dispatch = async (root, result) => dispatchOwnedProvider({ root, task: 'task', question: 'q', conversation: [{ request: { plan: 'p' } }],
  allowance: 3, provider: await providerFor(root, result), stopped: stoppedAt(root), now: () => NOW });

it('the recorded fixture holds the two real refused shapes', () => {
  expect(RECORDED.map(item => [item.label, item.state])).toEqual([['answer-text', 'complete'], ['fields-beside-reasoning', 'complete']]);
  // The real shapes: the plan as JSON text inside "answer"; the plan's fields beside "reasoning", raw line breaks in strings.
  expect(Object.keys(JSON.parse(RECORDED[0].output))).toEqual(['reasoning', 'answer']);
  expect(() => JSON.parse(RECORDED[1].output)).toThrow();
  expect(RECORDED[1].output.startsWith('{"reasoning":')).toBe(true);
});

for (const item of RECORDED) {
  it(`reads the recorded live ${item.label} answer as the plan (it was refused "model returned no plan")`, async () => {
    const root = temp();
    try {
      const call = await dispatch(root, item.output);
      const plan = JSON.parse(call.answer);
      expect(plan.files.length).toBeGreaterThan(0);
      expect(plan.files.every(file => typeof file.path === 'string' && typeof file.content === 'string')).toBe(true);
      expect(plan.tools.some(tool => tool.operation === 'package-test')).toBe(true);
      expect(plan.package).toMatchObject({ namespace: 'agent.word-count', version: '1.0.0' });
      expect(plan).not.toHaveProperty('reasoning');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it(`the recorded live ${item.label} answer builds, tests, installs and exercises the package end to end`, async () => {
    const root = temp();
    try {
      const report = await selfHost({ task: TASK, provider: await providerFor(root, item.output), repo: process.cwd(), root,
        grants: ['local-install'], context });
      expect(report).toMatchObject({ namespace: 'agent.word-count', passed: true });
      expect(report.tools.find(tool => tool.tool === 'package-test')).toMatchObject({ code: 0 });
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 120_000);
}

it('a flat answer with no plan is still refused, now naming the defect, after the attempt is recorded', async () => {
  const root = temp();
  try {
    await expect(dispatch(root, '{"reasoning":"I will not plan."}')).rejects.toThrow(/model returned no plan \(it has no answer/u);
    const kinds = providerStores(root)[0].facts.map(fact => fact.kind);
    expect(kinds).toContain('judgment-provider-ProviderJudgmentAttemptRecord');
    await expect(dispatch(root, 'Here is the plan you asked for.')).rejects.toThrow(/model returned no plan \(/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('the legacy full Decision (recorded replays, offline fakes) is still read', async () => {
  const root = temp();
  try {
    const plan = { files: [{ path: 'a.mjs', content: 'export const a = 1;\n' }], tools: [], package: { namespace: 'agent.a', version: '1.0.0' } };
    const legacy = JSON.stringify({ type: 'Decision', schemaVersion: 1, id: 'x',
      conclusion: { subject: 'preview-stage2-answer', value: JSON.stringify(plan) } });
    expect(JSON.parse((await dispatch(root, legacy)).answer)).toEqual(plan);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
