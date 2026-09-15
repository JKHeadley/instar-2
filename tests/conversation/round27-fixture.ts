import type { ConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

export interface Round27AdmissionFreshnessRow {
  readonly name: string;
  readonly expected: 'Success' | 'Refused';
  readonly actual: 'Success' | 'Refused';
  readonly detail: string;
  readonly passingConformanceCount: number;
  readonly conformanceFactClocks: readonly number[];
  readonly testedAt: readonly number[];
  readonly trace: readonly Readonly<Record<string, unknown>>[];
}

/** Permanent import of rereview25's conditional-append-clock-149-to-150 case. */
export function round27AdmissionFreshness(): readonly Round27AdmissionFreshnessRow[] {
  const rows: Round27AdmissionFreshnessRow[] = [];
  for (const [validationClock, commitClock] of [[149, 149], [149, 150], [150, 150]] as const) {
    const fixture = conversationFixture({ skipInitialAdmission: true });
    fixture.assembly.time(validationClock);
    let now = validationClock;
    const trace: Array<Readonly<Record<string, unknown>>> = [];
    const owner = fixture.admissionDependencies.conditionalAssembly;
    const conditionalAssembly = Object.freeze({ ...owner,
      appendIfSubjectFrontier: ((...args: Parameters<ConditionalAssemblyAppendPort['appendIfSubjectFrontier']>) => {
        trace.push({ at: 'append-enter', now, validUntil: (args[2] as { validUntil?: unknown }).validUntil });
        now = commitClock;
        fixture.assembly.time(commitClock);
        trace.push({ at: 'append-clock', now });
        const result = owner.appendIfSubjectFrontier(...args);
        trace.push({ at: 'append-result', now, kind: result.kind });
        return result;
      }) as ConditionalAssemblyAppendPort['appendIfSubjectFrontier'],
    });
    const result = admitTelegramAdapter(fixture.declaration, {
      ...fixture.admissionDependencies,
      conditionalAssembly,
      clock: () => {
        trace.push({ at: 'adapter-clock', now });
        return fixture.intake.f.clock(now);
      },
    });
    const facts = value(fixture.assembly.store.read()).filter(row => row.kind === 'assembly-AdapterConformance');
    const conformances = value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'AdapterConformance' && row.record.disposition === 'passed');
    rows.push({
      name: `conditional-append-clock-${validationClock}-to-${commitClock}`,
      expected: validationClock === 149 && commitClock === 149 ? 'Success' : 'Refused',
      actual: result.kind,
      detail: result.kind === 'Refused' ? result.detail : '',
      passingConformanceCount: conformances.length,
      conformanceFactClocks: facts.map(row => (row.at as { value: number }).value),
      testedAt: conformances.map(row => row.record.type === 'AdapterConformance' ? row.record.testedAt : -1),
      trace,
    });
  }
  return rows;
}
