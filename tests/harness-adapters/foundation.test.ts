import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import {
  compareHarnessAdapterRecords,
  decodeHarnessAdapterRecord,
  decodeHarnessAdapterStateSnapshot,
  decodeHarnessHandleSnapshot,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
  harnessAdapterIdentity,
} from '../../src/harness-adapters/index.js';
import type { HarnessAdapterRecordName, HarnessRuntimeEventKind } from '../../src/harness-adapters/index.js';
import { intakeFixture, message, route, value } from '../intake/fixtures.js';
import {
  attemptInput,
  decodedHandle,
  digest,
  eventInput,
  handleInput,
  harnessFixture,
  witnessedEvent,
} from './fixture.js';

const eventKinds: readonly HarnessRuntimeEventKind[] = [
  'process-started', 'probe-live', 'probe-failed', 'input-accepted', 'context-consumed',
  'heartbeat', 'work-transition', 'output-chunk', 'turn-closed', 'process-exited', 'diagnostic',
];

function records() {
  const f = harnessFixture();
  const handle = decodedHandle(f);
  const events = eventKinds.map(kind => value(decodeHarnessRuntimeEvent(eventInput(kind), f.owner.c)));
  return { f, handle, events,
    handleSnapshot: { type: 'HarnessHandleSnapshot', schemaVersion: 1, id: 'handles:1', adapter: 'native',
      machine: 'machine-a', capturedAt: 20, maxHandles: 1, handles: [handle] },
    stateSnapshot: { type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state:1', adapter: 'native',
      machine: 'machine-a', revision: 1, maxHandles: 1, maxAttempts: 2, maxEvents: events.length,
      maxCaptureBytes: 5, handles: [handle], attempts: [attemptInput()], events },
  };
}

it('P13-NF-01 A1-RECORDS all four owned forms and eleven event variants are closed, total, canonical, migrated, and deeply frozen', () => {
  const { f, handle, events, handleSnapshot, stateSnapshot } = records();
  const decoded = [
    value(decodeHarnessRuntimeHandle(handle, f.owner.c)),
    ...events.map(event => value(decodeHarnessRuntimeEvent(event, f.owner.c))),
    value(decodeHarnessHandleSnapshot(handleSnapshot, f.owner.c)),
    value(decodeHarnessAdapterStateSnapshot(stateSnapshot, f.owner.c)),
  ];
  expect(decoded).toHaveLength(14);
  for (const row of decoded) {
    expect(Object.isFrozen(row)).toBe(true);
    for (const child of Object.values(row as unknown as Record<string, unknown>))
      if (child && typeof child === 'object') expect(Object.isFrozen(child)).toBe(true);
  }
  const v2 = events.find(event => event.kind === 'heartbeat')!;
  const { sourceClock, observedAt, freshFor, ...old } = v2;
  const migrated = value(decodeHarnessRuntimeEvent({ ...old, schemaVersion: 1, at: sourceClock }, f.owner.c));
  expect(migrated).toEqual({ ...v2, sourceClock, observedAt: sourceClock, freshFor: 0 });
  const reordered = Object.fromEntries(Object.entries(v2).reverse());
  expect(value(compareHarnessAdapterRecords('HarnessRuntimeEvent', v2, reordered, f.owner.c))).toEqual({ equal: true });
  expect(harnessAdapterIdentity(v2).canonicalHash).toBe(value(canonical(reordered)).hash);
  for (const [name, input] of [
    ['HarnessRuntimeHandle', handle], ['HarnessHandleSnapshot', handleSnapshot],
    ['HarnessAdapterStateSnapshot', stateSnapshot],
  ] as const) {
    expect(decodeHarnessAdapterRecord(name as HarnessAdapterRecordName, { ...input, extra: true }, f.owner.c).kind).toBe('Refused');
  }
});

it('R5-REVIEW-REPLAY P13-NF-01 replays all 1,323 reviewer field mutations through typed decoder refusals', () => {
  const f = harnessFixture();
  const handle = handleInput();
  const fixtures: Record<string, any>[] = [
    handle,
    ...eventKinds.map(kind => eventInput(kind)),
    { type: 'HarnessHandleSnapshot', schemaVersion: 1, id: 'snap', adapter: 'native', machine: 'machine-a',
      capturedAt: 20, maxHandles: 2, handles: [handle] },
    { type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state', adapter: 'native', machine: 'machine-a',
      revision: 1, maxHandles: 2, maxAttempts: 3, maxEvents: 4, maxCaptureBytes: 16, handles: [handle],
      attempts: [attemptInput({ operation: 'op' }), attemptInput({ kind: 'delivery', operation: 'op2',
        subjectDigest: digest('second'), state: 'observed', evidence: 'receipt', observedAt: 20 })],
      events: [eventInput('output-chunk')] },
  ];
  const paths = (input: any, path: (string | number)[] = []): (string | number)[][] =>
    input === null || typeof input !== 'object' ? []
      : Object.keys(input).flatMap(key => [[...path, key], ...paths(input[key], [...path, key])]);
  const parent = (input: any, path: (string | number)[]) =>
    path.slice(0, -1).reduce((row, key) => row[key], input);
  let mutations = 0;
  for (const original of fixtures) {
    expect(decodeHarnessAdapterRecord(original.type, original, f.owner.c).kind).toBe('Success');
    for (const path of paths(original)) {
      const leaf = path.reduce((row, key) => row[key], original);
      const changes: [string, unknown][] = [['missing', undefined], ['wrong-type',
        typeof leaf === 'string' ? 42 : typeof leaf === 'number' ? 'wrong'
          : typeof leaf === 'boolean' ? 'true' : leaf === null ? {} : 'wrong']];
      if (typeof leaf === 'number') changes.push(['not-finite', Infinity], ['fractional', 0.5],
        ['unsafe', Number.MAX_SAFE_INTEGER + 1], ['out-of-range', path.at(-1) === 'exitStatus' ? 65536 : -1]);
      if (typeof leaf === 'string' && ['type', 'kind', 'state', 'streamState', 'childrenState'].includes(String(path.at(-1))))
        changes.push(['changed-enum', 'unsupported-enum']);
      if (typeof leaf === 'string' && String(leaf).startsWith('sha256:')) changes.push(['bad-hash', 'sha256:bad']);
      if (leaf && typeof leaf === 'object' && !Array.isArray(leaf)) changes.push(['extra', true]);
      for (const [mode, replacement] of changes) {
        const candidate = structuredClone(original); const target = parent(candidate, path); const key = path.at(-1)!;
        if (mode === 'missing') delete target[key];
        else if (mode === 'extra') target[key].extra = true;
        else target[key] = replacement;
        expect(() => decodeHarnessAdapterRecord(original.type, candidate, f.owner.c)).not.toThrow();
        expect(decodeHarnessAdapterRecord(original.type, candidate, f.owner.c).kind).toBe('Refused');
        mutations += 1;
      }
    }
    expect(decodeHarnessAdapterRecord(original.type, { ...structuredClone(original), unexpected: true }, f.owner.c).kind).toBe('Refused');
    mutations += 1;
  }
  expect(mutations).toBe(1323);
});

it('R5-F5 P13-NF-15 malformed begin/finish attempt fields are typed refusals and never append partial state', () => {
  const f = harnessFixture();
  const malformed = [
    { ...attemptInput(), kind: 'other' }, { ...attemptInput(), operation: '' },
    { ...attemptInput(), launch: '' }, { ...attemptInput(), incarnation: '' },
    { ...attemptInput(), subjectDigest: 'bad' }, { ...attemptInput(), attemptedAt: -1 },
  ];
  for (const candidate of malformed) {
    expect(() => f.port.beginAttempt(candidate, [], 2)).not.toThrow();
    expect(f.port.beginAttempt(candidate, [], 2)).toMatchObject({ disposition: 'refused', attempt: null });
  }
  const started = f.port.beginAttempt(attemptInput(), [], 2);
  expect(started.disposition).toBe('started');
  expect(() => f.port.finishAttempt('operation:launch', '', 20, [started.attempt!])).not.toThrow();
  expect(f.port.finishAttempt('operation:launch', '', 20, [started.attempt!]).disposition).toBe('refused');
  expect(f.port.finishAttempt('operation:launch', 'evidence:owner', 20, [started.attempt!]).disposition).toBe('observed');
});

it('R5-F6 P13-NF-39 one operation retains one exact action and subject across attempt kinds', () => {
  const f = harnessFixture();
  const first = f.port.beginAttempt(attemptInput(), [], 2);
  expect(first.disposition).toBe('started');
  expect(f.port.beginAttempt(attemptInput(), [first.attempt!], 2).disposition).toBe('existing');
  expect(f.port.beginAttempt(attemptInput({ launch: 'launch:other', subjectDigest: digest('other') }), [first.attempt!], 2).disposition).toBe('refused');
  expect(f.port.beginAttempt(attemptInput({ kind: 'delivery' }), [first.attempt!], 2).disposition).toBe('refused');
  const { stateSnapshot } = records();
  const contradictory = { ...stateSnapshot, attempts: [attemptInput(), attemptInput({ kind: 'delivery' })] };
  expect(decodeHarnessAdapterStateSnapshot(contradictory, f.owner.c).kind).toBe('Refused');
});

it('R5-F7 P13-NF-31 P13-NF-34 output progress identity ignores runtime id and capture label but not bytes', () => {
  const f = harnessFixture();
  const original = value(decodeHarnessRuntimeEvent(eventInput('output-chunk'), f.owner.c));
  const repeated = value(decodeHarnessRuntimeEvent(eventInput('output-chunk', {
    id: 'event:republished', output: { ...original.output!, captureReference: 'capture:two' },
  }), f.owner.c));
  const changed = value(decodeHarnessRuntimeEvent(eventInput('output-chunk', {
    id: 'event:changed', output: { ...original.output!, digest: digest('different'), captureReference: 'capture:three' },
  }), f.owner.c));
  expect(f.port.progressIdentity(original, [])).toMatchObject({ disposition: 'advancing' });
  expect(f.port.admitObservation(original, [original], 1)).toMatchObject({ disposition: 'duplicate', progress: false });
  expect(f.port.progressIdentity(repeated, [original])).toMatchObject({ disposition: 'duplicate' });
  expect(f.port.admitObservation(repeated, [original], 1)).toMatchObject({ disposition: 'duplicate', progress: false });
  expect(f.port.progressIdentity(changed, [original])).toMatchObject({ disposition: 'conflict' });
});

it('R5-F4 P13-NF-05 P13-NF-25 P13-NF-29 current Part Ten observation generation is mandatory at A1 admission', () => {
  const matching = harnessFixture();
  expect(matching.port.admitObservation(witnessedEvent(matching), [], 2)).toMatchObject({ disposition: 'recorded' });
  const obsolete = harnessFixture();
  expect(obsolete.port.admitObservation(witnessedEvent(obsolete, 'heartbeat', {}, 'generation:obsolete'), [], 2))
    .toMatchObject({ disposition: 'refused', reason: expect.stringContaining('non-current register generation') });
});

it('R5-F8 P13-NF-31 P13-NF-34 output custody and resume confirmation are NON-EXECUTABLE-UNTIL-slice-A2', () => {
  const f = harnessFixture();
  const output = witnessedEvent(f, 'output-chunk');
  expect(f.port.admitObservation(output, [], 2)).toMatchObject({
    disposition: 'refused', reason: expect.stringContaining('NON-EXECUTABLE-UNTIL-slice-A2'),
  });
  const source = readFileSync('src/harness-adapters/contracts.ts', 'utf8');
  expect(source).not.toContain("owner: 'part-two'");
  expect(source).not.toMatch(/resume|poison/i);
});

for (const code of ['EACCES', 'EIO']) {
  it(`R5-F9 P13-NF-24 P13-NF-46 real Part Four custody read ${code} returns a typed refusal and preserves the durable receipt`, () => {
    const f = intakeFixture();
    const interrupted = value(createIntakePort({ ...f.deps, storage: { ...f.storage,
      append(bytes, head) {
        const receipt = f.storage.append(bytes, head);
        if ((JSON.parse(bytes) as { kind?: string }).kind === 'intake-receipt')
          throw new Error('cut-after-durable-receipt');
        return receipt;
      },
    } }));
    expect(interrupted.receive(message(), route).kind).toBe('Refused');
    const receipt = f.facts()[0]!;
    const before = JSON.stringify(f.frames);
    const broken = value(createIntakePort({ ...f.deps, storage: { ...f.storage,
      read() { const error = new Error(code); Object.assign(error, { code }); throw error; },
    } }));
    const result = broken.recover(receipt.id);
    expect(result).toMatchObject({ kind: 'Refused', preserved: receipt.id });
    expect(JSON.stringify(f.frames)).toBe(before);
    expect(value(f.port().recover(receipt.id)).kind).toBe('admitted');
  });
}

it('P13-NF-02 the complete Part Thirteen design still passes the governed-document checker', () => {
  expect(() => execFileSync(process.execPath, ['scripts/check-governed-docs.mjs', 'docs/17-harness-adapters.md', 'docs/17-harness-adapters'],
    { cwd: process.cwd(), encoding: 'utf8' })).not.toThrow();
});
