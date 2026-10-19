import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { causalIndex, causalCone, historyOf } from '../../src/facts/admission.js';
import type { FactEnvelope } from '../../src/facts/index.js';

const recorded = (): FactEnvelope[] => JSON.parse(gunzipSync(readFileSync(
  new URL('./recorded/host-111-facts.json.gz', import.meta.url))).toString()) as FactEnvelope[];

it.each(['projection', 'allocation'])('recorded host first-process %s survives a cold bounded stack', async mode => {
  const child = spawn(process.execPath, ['--stack-size=768', '--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/facts/recorded-host-conflict.mjs', mode], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { output += String(chunk); });
  const timer = setTimeout(() => child.kill('SIGTERM'), 240000);
  try {
    const status = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject); child.once('close', resolve);
    });
    expect(status, output).toBe(0);
    expect(output).toContain('PASS recorded');
  } finally { clearTimeout(timer); }
}, 250000);

it('cold tail, reverse order, and foreign same-id candidates agree with the causal walk', () => {
  const facts = recorded(), tail = facts.at(-1)!;
  for (const order of [facts, [...facts].reverse()]) {
    const index = causalIndex(order);
    expect(index.coneSize(tail)).toBe(1819);
    expect(index.coneHeads(tail)).toEqual([facts.at(-2)!.contentHash]);
    const cone = causalCone(tail, order);
    const inHistory = historyOf(tail, order, index);
    expect(cone.every(f => inHistory(f.id) === f)).toBe(true);
    expect(inHistory(tail.id)).toBeUndefined();
    const changed = { ...tail, predecessors: { inSegment: facts[0]!.id, required: [], frontier: {} } };
    expect(index.coneSize(changed)).toBe(1); // an id alone never reuses the member's vector
    expect(index.coneSize(tail)).toBe(1819);
  }
});

it('missing references, cycles, and broken chains still fall back to the refusing walk', () => {
  const original = recorded().slice(0, 3), [a, b, c] = original as [FactEnvelope, FactEnvelope, FactEnvelope];
  const missing = { ...c, predecessors: { ...c.predecessors, required: ['missing'] } };
  const cycle = { ...a, predecessors: { ...a.predecessors, required: [c.id] } };
  const gap = { ...b, prevInSegment: a.prevInSegment };
  for (const facts of [[a, b, missing], [cycle, b, c], [a, gap, c]]) {
    const tail = facts.at(-1)!, index = causalIndex(facts);
    expect(index.frontierOf(tail)).toBeUndefined();
    // Failed traversal does not leave an in-progress marker that changes the second answer.
    expect(index.frontierOf(tail)).toBeUndefined();
    if (facts[1] !== gap) expect(() => historyOf(tail, facts, index)).toThrow(/dangling|cycle/);
    else expect(historyOf(tail, facts, index)(a.id)).toBe(a);
  }
});
