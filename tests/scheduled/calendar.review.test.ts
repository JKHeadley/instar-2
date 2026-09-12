import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { canonicalInstant, createScheduledWorkPackagePort, normalizeCronV1, parseRfc3339Offset } from '../../src/scheduled/index.js';
import { scheduledFixture, value } from './fixture.js';

const status = (result: unknown) => consumeResult(result as Parameters<typeof consumeResult>[0], {
  Success: () => 'accepted' as const, Refused: () => 'refused' as const,
});

it('P15-NF-09 preserves all 166 independent cron and one-shot boundary cases plus 210 timestamp controls', () => {
  const f = scheduledFixture(); const port = createScheduledWorkPackagePort(); let cases = 0;
  const check = (id: string, expected: 'accepted' | 'refused', run: () => unknown) => {
    cases++; expect(status(run()), id).toBe(expected);
  };
  const domains = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]] as const;
  for (let index = 0; index < domains.length; index++) for (let number = domains[index]![0] - 1; number <= domains[index]![1] + 1; number++) {
    const fields = ['0', '0', '1', '1', '0']; fields[index] = String(number);
    check(`singleton-${index}-${number}`, number >= domains[index]![0] && number <= domains[index]![1] ? 'accepted' : 'refused',
      () => normalizeCronV1(fields.join(' '), f.context));
  }
  for (const [expression, expected] of [['0,15,15 0 * * 0', 'accepted'], ['10-20/5 0 * * 0', 'accepted'], ['*/15 0 * * 0', 'accepted'],
    ['0 0 1-31 * 0-6', 'accepted'], ['0 0 * * 7', 'refused'], ['-1 0 * * 0', 'refused'], ['*/0 0 * * 0', 'refused'],
    ['5/2 0 * * 0', 'refused'], ['20-10 0 * * 0', 'refused'], ['0,,1 0 * * 0', 'refused'], ['0 0 * JAN 0', 'refused'],
    ['@daily', 'refused'], ['0 0 0 * * 0', 'refused'], ['0 0 * * 0 2027', 'refused']] as const)
    check(expression, expected, () => normalizeCronV1(expression, f.context));
  const input = { manifest: f.manifest, namespaceVersion: 'scheduled:v1', installationId: 'install:a',
    scheduledInstant: f.manifest.schedule.kind === 'one-shot' ? f.manifest.schedule.at : '', asOf: f.core.clock(Date.UTC(2027, 0, 1)) };
  check('one-shot/instant-mismatch', 'refused', () => port.planOccurrence({ ...input, scheduledInstant: '2027-01-01T00:00:01Z' }, f.context));
  check('one-shot/pre-activation', 'refused', () => port.planOccurrence({ ...input, manifest: { ...f.manifest,
    schedule: { ...f.manifest.schedule, activationInstant: '2027-01-01T00:00:01Z' } } }, f.context));
  check('one-shot/activation-equality', 'accepted', () => port.planOccurrence({ ...input, manifest: { ...f.manifest,
    schedule: { ...f.manifest.schedule, activationInstant: input.scheduledInstant } } }, f.context));
  check('global/target-refused', 'refused', () => port.planOccurrence({ ...input, targetMachineId: 'machine-a' }, f.context));
  const perMachine = { ...f.manifest, admission: { ...f.manifest.admission, placement: 'every-eligible-machine' as const } };
  check('machine/no-target', 'refused', () => port.planOccurrence({ ...input, manifest: perMachine }, f.context));
  check('machine/foreign-target', 'refused', () => port.planOccurrence({ ...input, manifest: perMachine, targetMachineId: 'machine-c' }, f.context));
  for (const target of ['machine-a', 'machine-b']) check(`machine/${target}`, 'accepted',
    () => port.planOccurrence({ ...input, manifest: perMachine, targetMachineId: target }, f.context));
  expect(cases).toBe(166);

  let dateControls = 0;
  for (const year of [1970, 2000, 2024, 2027, 2100, 2400, 9998]) for (const month of [1, 2, 3, 11, 12])
    for (const day of [1, 28]) for (const offset of ['Z', '+01:30', '-05:00']) {
      const source = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:34:56.789${offset}`;
      const numeric = parseRfc3339Offset(source); expect(numeric).toBe(Date.parse(source));
      expect(canonicalInstant(source)).toBe(new Date(numeric).toISOString()); dateControls++;
    }
  expect(dateControls).toBe(210);
  expect(value(normalizeCronV1('00 0 * * 0', f.context)).expression).toMatch(/^0 /);
});
