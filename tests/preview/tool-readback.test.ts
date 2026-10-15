import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { READ_BEFORE_ANSWER, TOOL_TASK_COMPLETION } from '../../src/assembly/tool-answer-guidance.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT,
  SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-codex-provider.js';
import { readAnswer } from './answer-reading.js';
// @ts-expect-error Physical admission log parsing stays outside the pure core.
import { toolTrace } from './tool-admission.mjs';

const capture = JSON.parse(readFileSync(new URL('./fixtures/tool-readback-715676207.json', import.meta.url), 'utf8'));

it('retains the actual missed read-back and the live positive neighbor as separate evidence', () => {
  expect(capture.failed.evidence.update).toBe(715676207);
  expect(capture.failed.evidence.consistent).toBe(true);
  expect(capture.failed.evidence.calls.map((call: { tool: string }) => call.tool)).toEqual(['Write', 'Bash']);
  const [write, count] = capture.failed.evidence.calls;
  expect(JSON.parse(write.result).content).toBe('hello from the tool test\n');
  expect(JSON.parse(count.input).command).toBe('wc -c tools-0cea09.txt');
  expect(JSON.parse(count.result).stdout.trim()).toBe('25 tools-0cea09.txt');
  // A write echo and a correct byte count still do not establish that a read ran.
  expect(capture.failed.reply.reply).toBe(capture.original.answer);
  expect(capture.live.evidence.update).toBe(46040044);
  expect(capture.live.evidence.calls.map((call: { tool: string }) => call.tool)).toEqual(['Write', 'Read', 'Bash']);
  expect(JSON.parse(capture.live.evidence.calls[1].result).file.content).toBe('hello from the tool test\n');
});

it('replays two real model runs of the failed journal input through admission and answer readers', () => {
  expect(capture.original.update).toBe(715676207);
  expect(capture.system).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  expect(capture.runs).toHaveLength(2);
  for (const run of capture.runs) {
    const trace = toolTrace(run.admission.trim().split('\n'));
    expect(trace).toEqual(run.trace);
    expect(trace.consistent).toBe(true);
    expect(trace.refused).toBe(0);
    expect(run.stored).toBe('hello from the tool test\n');
    const answer = readAnswer(run.raw, { wrapped: 'accept' });
    expect(answer.ok && answer.value).toBe(run.answer);
    expect(run.answer).toContain('25');
    expect(run.answer).toContain('read it back');
  }
  // Both valid routes have observed contents AFTER the write, not just a write receipt.
  const compound = capture.runs[0].trace.calls[0];
  expect(JSON.parse(compound.input).command).toBe("printf 'hello from the tool test\\n' > tools-0cea09.txt && cat tools-0cea09.txt && wc -c tools-0cea09.txt");
  expect(JSON.parse(compound.result).stdout).toBe('hello from the tool test\n      25 tools-0cea09.txt');
  const separate = capture.runs[1].trace.calls;
  expect(separate.map((call: { tool: string }) => call.tool)).toEqual(['Bash', 'Read', 'Bash']);
  expect(JSON.parse(separate[1].result).file.content).toBe('hello from the tool test\n');
  expect(JSON.parse(separate[2].result).stdout.trim()).toBe('25 tools-0cea09.txt');
});

it('supplies completion guidance on every tool route while keeping text-only routes honest', () => {
  expect(READ_BEFORE_ANSWER).toContain(TOOL_TASK_COMPLETION);
  for (const system of [SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT])
    expect(system.split(TOOL_TASK_COMPLETION)).toHaveLength(2);
  for (const system of [SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, CODEX_CONVERSATION_SYSTEM_PROMPT])
    expect(system).not.toContain(TOOL_TASK_COMPLETION);
  expect(TOOL_TASK_COMPLETION).not.toContain('tools-0cea09');
  expect(TOOL_TASK_COMPLETION).not.toContain('25');
});
