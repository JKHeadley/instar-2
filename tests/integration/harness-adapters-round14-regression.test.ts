import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createRuntimeHandleHolder, sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessOperationAttempt } from '../../src/harness-adapters/contracts.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { attemptInput, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';
import { round14FileFixture } from '../harness-adapters/a2-round14-file-fixture.js';

function beginAt(target: string, attemptedAt: number) {
  const fixture = harnessFixture();
  const state = createHarnessAdapterFileState(target);
  const holder = createRuntimeHandleHolder({
    adapter: 'native',
    machine: 'machine-a',
    maxHandles: 4,
    maxAttempts: 8,
    context: fixture.owner.c,
    state,
    admission: fixture.port,
  });
  return holder.beginAttempt({ ...(attemptInput() as HarnessOperationAttempt), attemptedAt });
}

it('A2-INTEGRATION R14-F1-FINAL-FRONTIER P13-NF-25 P13-NF-29 P13-NF-38 file-backed evidence changing during either final Six read refuses reconnect', () => {
  let scenarios = 0;
  for (const phase of ['inspect', 'admitWrite'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r14-final-${phase}-`));
    const fixture = round14FileFixture(directory, true);
    let reads = 0;
    let writes = 0;
    const mutate = () => fixture.evidence.admit(witnessedEvent(fixture.ten, 'probe-failed', {
      id: `r14:integration:failed:${phase}`,
      sourceEvidence: [`r14:integration:failed-observation:${phase}`],
      launch: fixture.handle.launch,
      incarnation: fixture.handle.incarnation,
      sourceClock: 22,
      observedAt: 22,
      streamState: 'closed',
    }));
    const authority = {
      ...fixture.six.api,
      inspect() {
        reads++;
        if (reads === 2 && phase === 'inspect') mutate();
        return fixture.six.api.inspect();
      },
      admitWrite(...args: Parameters<typeof fixture.six.api.admitWrite>) {
        writes++;
        if (writes === 2 && phase === 'admitWrite') mutate();
        return fixture.six.api.admitWrite(...args);
      },
    };
    expect(sameMachineReconnectCandidate({
      launch: fixture.handle.launch,
      machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation,
      fence: fixture.fence,
      now: 22,
      evidence: fixture.evidence,
      authority,
    }, fixture.handles), phase).toMatchObject({ disposition: 'refused', handle: null });
    expect(fixture.evidence.liveness(fixture.handle, 22)).toMatchObject({ state: 'unknown' });
    scenarios++;
  }
  expect(scenarios).toBe(2);
}, 60_000);

it('A2-INTEGRATION R14-F2-LEGACY-CUSTODY P13-NF-24 P13-NF-28 P13-NF-39 P13-NF-46 only an absent legacy path starts fresh custody', () => {
  const valid = {
    type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'r14:legacy:pending',
    adapter: 'native', machine: 'machine-a', revision: 1,
    maxHandles: 4, maxAttempts: 8, maxEvents: 0, maxCaptureBytes: 0,
    handles: [], attempts: [attemptInput()], events: [],
  };
  const cases = [
    ['regular-pending', JSON.stringify(valid), 'existing'],
    ['json-null', 'null', 'refused'],
    ['json-false', 'false', 'refused'],
    ['json-zero', '0', 'refused'],
    ['json-string', '"missing"', 'refused'],
    ['json-array', '[]', 'refused'],
    ['json-object', '{}', 'refused'],
    ['malformed-json', '{', 'refused'],
    ['empty-file', '', 'refused'],
    ['absent-control', undefined, 'started'],
  ] as const;
  let scenarios = 0;
  for (const [mode, contents, expected] of cases) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r14-${mode}-`));
    const target = join(directory, 'journal.json');
    if (contents !== undefined) writeFileSync(target, contents);
    if (expected === 'refused') {
      expect(() => beginAt(target, 20), mode).toThrow();
    } else {
      expect(beginAt(target, 20), mode).toMatchObject({
        disposition: expected,
        attempt: { attemptedAt: expected === 'existing' ? 10 : 20 },
      });
    }
    scenarios++;
  }

  for (const mode of ['symlink-to-valid-file', 'directory'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r14-${mode}-`));
    const target = join(directory, 'journal.json');
    if (mode === 'symlink-to-valid-file') {
      const original = join(directory, 'original.json');
      writeFileSync(original, JSON.stringify(valid));
      symlinkSync(original, target);
    } else {
      mkdirSync(target);
    }
    expect(() => beginAt(target, 20), mode).toThrow('not a regular file');
    scenarios++;
  }
  expect(scenarios).toBe(12);
}, 60_000);
