import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { intakeFixture, message, refused, route, value } from '../intake/fixtures.js';
// @ts-expect-error The production restart acceptance boundary is executable JavaScript by design.
import { bootProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

// The slice performs long synchronous fsync/replay stretches. Give Vitest's RPC
// transport one turn to acknowledge the prior case before the next drive starts.
beforeEach(() => new Promise<void>(resolve => setImmediate(resolve)));
afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

it('R7-F1 rereview5 V30/V33/V34 keeps historical approval valid for ordinary receive/recovery while current-subject reuse stays closed', () => {
  for (const change of [{ currentBase: 'base:2' }, { artifact: hashBytes('new artifact') }]) {
    const f = intakeFixture(), verified = f.verifiedAct();
    const next = f.verifiedAct({ request: { requestId: `new:${Object.keys(change)[0]}` } });
    const port = f.port();
    value(port.receive(message('ordinary before advance'), route));
    const receipt = f.facts().find(row => row.kind === 'intake-receipt')!;
    value(port.admitVerifiedAct(verified.input));
    Object.assign(f.context, { decode: { ...f.context.decode, ...change } });
    expect(value(port.receive(message('ordinary after advance'), { ...route, eventId: `after:${Object.keys(change)[0]}` })).kind).toBe('admitted');
    expect(value(port.recover(receipt.id)).kind).toBe('duplicate');
    refused(port.admitVerifiedAct(next.input), 'current');
  }
});

async function cutDrive(name: 'route' | 'replication-peer', recover: boolean) {
  const boot = bootProductionSliceAssembly({ home: mkdtempSync(join(tmpdir(), `p11-r7-${name}-`)),
    config: sliceConfig({ profile: 'reply' }), restartRecovery: true });
  const coordinator = boot.coordinator;
  const reference = coordinator.references.find((row: { name: string }) => row.name === `dependency:${name}`)!;
  value(coordinator.handles.lifecycle.cut(name));
  refused(coordinator.handles.dependencyAdmission.admit({ name, fact: reference.fact,
    completeness: reference.completeness, missing: reference.missing }), 'cut');
  const refusedReport = await boot.drive();
  expect(boot.service.journal().applications).toHaveLength(0);
  expect(refusedReport.preservedInput).toBeTruthy();
  expect(refusedReport.obligations).toContainEqual(expect.objectContaining({ operation: `prerequisite:${name}`,
    state: 'owned-pending-prerequisite-outage', owner: 'part-ten', exposure: '0' }));
  if (!recover) return { boot, refusedReport };
  value(coordinator.handles.lifecycle.recover(name));
  const recoveredReport = await boot.drive();
  return { boot, refusedReport, recoveredReport };
}

it('R7-F3 rereview5 V52 live route refusal preserves input and an owned outage with zero external reply', async () => {
  await cutDrive('route', false);
}, 240000);

it('R7-F3 rereview5 V53 live replication-peer refusal preserves input and an owned outage with zero external reply', async () => {
  await cutDrive('replication-peer', false);
}, 240000);

it('R7-F3 rereview5 V54 matching lifecycle recovery closes the outage and permits one clean reply', async () => {
  const result = await cutDrive('route', true);
  expect(result.boot.service.journal().applications).toHaveLength(1);
  expect(result.recoveredReport.externalApplications).toHaveLength(1);
  expect(result.recoveredReport.obligations).toContainEqual(expect.objectContaining({ operation: 'prerequisite:route',
    state: 'recovered', owner: 'part-ten', exposure: '0' }));
}, 300000);
