import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { decodeRun, decodeRunBudget, decodeRunExit, decodeRunStep, decodeRunTransition,
  decodeSessionGrounding, recordFromWire } from '../../src/rungraph/index.js';
import { closingRun, setup, value } from './fixtures.js';

type Decoder = (input: unknown, context: ReturnType<typeof setup>['context'] extends () => infer C ? C : never) => unknown;
type Golden = Readonly<{ caseCount: number; values: Readonly<Record<string, string>>;
  cases: Readonly<Record<string, Readonly<Record<string, string>>>> }>;
const golden = JSON.parse(readFileSync(new URL('./legacy-decoder-main-golden.json', import.meta.url), 'utf8')) as Golden;

it('P5-SEAM-RC-A-F5-LEGACY-BYTES P5-SEAM-RC-R8-F3-LEGACY-771-BYTES P5-SEAM-RC-R12-V01 preserves every main Result byte in the 282/321 legacy mutation harnesses', () => {
  const f = setup(), ready = value(f.graph.open(f.run));
  const groundingFact = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const grounding = recordFromWire((groundingFact.body as Readonly<Record<string, Json>>).record!);
  const start = f.start(ready, groundingFact);
  value(f.graph.transition(start));
  const close = closingRun();
  const records: readonly [string, Readonly<Record<string, unknown>>, Decoder, ReturnType<typeof setup>][] = [
    ['Run', f.run, decodeRun, f], ['RunBudget', f.run.budget, decodeRunBudget, f],
    ['RunStep', start.step, decodeRunStep, f], ['RunTransition', start, decodeRunTransition, f],
    ['SessionGrounding', grounding as Readonly<Record<string, unknown>>, decodeSessionGrounding, f],
    ['RunExit', close.terminalExit, decodeRunExit, close], ['CloseTransition', close.close, decodeRunTransition, close],
  ];
  let cases = 0;
  for (const [group, record, decoder, fixture] of records) {
    const mutations: [string, unknown][] = [['valid', record]];
    for (const key of Object.keys(record)) {
      const missing = structuredClone(record) as Record<string, unknown>; delete missing[key];
      mutations.push([`omit:${key}`, missing]);
      for (const replacement of [null, 'bad', 0, [], {}])
        mutations.push([`replace:${key}:${JSON.stringify(replacement)}`, { ...record, [key]: replacement }]);
    }
    if ('exit' in record && record.exit && typeof record.exit === 'object' && !Array.isArray(record.exit)) {
      for (const key of Object.keys(record.exit)) {
        const missing = structuredClone(record) as Record<string, Record<string, unknown>>;
        delete missing.exit![key]; mutations.push([`nested-exit-omit:${key}`, missing]);
      }
    }
    if (group === 'RunExit') for (const key of ['exitTest', 'check', 'evidence', 'result', 'settledOperations']) {
      const input = structuredClone(record) as Record<string, unknown>;
      input.kind = 'unsupported'; delete input[key]; mutations.push([`unsupported-kind-omit:${key}`, input]);
    }
    for (const [name, input] of mutations) {
      const id = golden.cases[group]?.[name];
      expect(id, `${group}:${name} missing from the main golden`).toBeDefined();
      const bytes = value(canonical(decoder(input, fixture.context()))).bytes;
      expect(bytes, `${group}:${name}`).toBe(golden.values[id!]);
      cases++;
    }
  }
  expect(cases).toBe(golden.caseCount);
  expect(cases).toBe(771);
});
