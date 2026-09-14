import { expect, it } from 'vitest';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type { AssemblyHistoryReadPort, AssemblyRuntimePort, ConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import type { VerificationRuntimePort } from '../../src/verification/index.js';
import { value } from '../intake/fixtures.js';
import { round15Declarations } from './round15-fixture.js';

function interleaveAt(outerMode: 'long-poll' | 'webhook', target: number | null) {
  const { fixture, declarations } = round15Declarations();
  const base = fixture.admissionDependencies;
  const otherMode = outerMode === 'webhook' ? 'long-poll' : 'webhook';
  const points: string[] = [];
  let nested: ReturnType<typeof admitTelegramAdapter> | undefined;
  let triggered = false;

  const trigger = () => {
    if (triggered || target === null || points.length - 1 !== target) return;
    triggered = true;
    nested = admitTelegramAdapter(declarations[otherMode], base);
  };
  const after = <T>(label: string, operation: () => T): T => {
    const result = operation();
    points.push(label);
    trigger();
    return result;
  };
  const api: TelegramBotApiCustodianPort = Object.freeze({ ...base.api,
    identity: (input: Parameters<TelegramBotApiCustodianPort['identity']>[0]) =>
      after('api.identity', () => base.api.identity(input)),
    readCapture: (reference: string) => after('api.readCapture', () => base.api.readCapture(reference)),
  });
  const history: AssemblyHistoryReadPort = Object.freeze({ ...base.history,
    lookup: (reference: string) => after(`history.lookup:${reference}`, () => base.history.lookup(reference)),
  });
  const verification: VerificationRuntimePort = Object.freeze({ ...base.verification,
    inspect: () => after('verification.inspect', () => base.verification.inspect()),
  });
  const assembly = Object.freeze({ ...base.assembly,
    record: ((name: Parameters<AssemblyRuntimePort['record']>[0], input: unknown) =>
      after(`assembly.record:${name}`, () => base.assembly.record(name, input))) as AssemblyRuntimePort['record'],
    inspectCurrent: () => after('assembly.inspectCurrent', () => base.assembly.inspectCurrent()),
  });
  const conditionalAssembly = Object.freeze({ ...base.conditionalAssembly,
    appendIfSubjectFrontier: ((name: Parameters<ConditionalAssemblyAppendPort['appendIfSubjectFrontier']>[0],
      input: unknown, expected: Parameters<ConditionalAssemblyAppendPort['appendIfSubjectFrontier']>[2]) =>
      after(`conditionalAssembly.appendIfSubjectFrontier:${name}`,
        () => base.conditionalAssembly.appendIfSubjectFrontier(name, input, expected))) as ConditionalAssemblyAppendPort['appendIfSubjectFrontier'],
  });
  const outer = admitTelegramAdapter(declarations[outerMode], {
    ...base,
    api,
    history,
    verification,
    assembly,
    conditionalAssembly,
    clock: () => after('clock', base.clock),
  });
  const records = value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
    row.record.type === 'AdapterConformance' && row.record.adapter === 'telegram:v1:bot:9001');
  return { outer, nested, records, points, triggered };
}

it('P12-NF-16 P12-NF-18 P12-NF-46 round15 admission-every-await-interleaving preserves one-mode commitment', () => {
  for (const outerMode of ['long-poll', 'webhook'] as const) {
    const discovery = interleaveAt(outerMode, null);
    expect(discovery.outer.kind, `${outerMode}: discovery admission`).toBe('Success');
    for (const required of [
      'api.identity',
      'api.readCapture',
      'verification.inspect',
      'assembly.record:AdapterEvidenceContract',
      'conditionalAssembly.appendIfSubjectFrontier:AdapterConformance',
      'assembly.inspectCurrent',
      'clock',
    ]) expect(discovery.points, `${outerMode}: missing ${required}`).toContain(required);
    expect(discovery.points.some(point => point.startsWith('history.lookup:')),
      `${outerMode}: history lookup coverage`).toBe(true);

    for (let target = 0; target < discovery.points.length; target++) {
      const result = interleaveAt(outerMode, target);
      const label = `${outerMode}/${target}:${discovery.points[target]}`;
      expect(result.triggered, label).toBe(true);
      expect([result.outer.kind, result.nested?.kind].filter(kind => kind === 'Success'), label).toHaveLength(1);
      expect(new Set(result.records.map(row => row.record.type === 'AdapterConformance' ? row.record.mode : '')).size,
        label).toBe(1);
      expect(result.records.every(row => row.taint.length === 0 && row.conflicts.length === 0), label).toBe(true);
    }
  }
}, 60_000);
