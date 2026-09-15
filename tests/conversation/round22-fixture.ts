import { closeSync, fsyncSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEffectDoorway, createEffectSpine } from '../../src/effects/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { CapturedContent } from '../../src/facts/index.js';
import { installTelegramReplyOperation } from '../../src/conversation/index.js';
import { privateKey } from '../facts/fixtures.js';
import { value } from '../intake/fixtures.js';
import { telegramPreparedOutbound } from './round5-fixture.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference replica host is JavaScript, outside pure core compilation.
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';

type ResultSummary = Readonly<{ kind: string; detail?: string; stage?: string }>;

const summarize = (result: Readonly<{ kind: string; detail?: string; value?: unknown }>): ResultSummary => {
  const stage = result.value !== null && typeof result.value === 'object' && 'stage' in result.value
    && typeof result.value.stage === 'string' ? result.value.stage : undefined;
  return {
    kind: result.kind,
    ...(result.detail === undefined ? {} : { detail: result.detail }),
    ...(stage === undefined ? {} : { stage }),
  };
};

function installFixtureOperation(fixture: ReturnType<typeof telegramPreparedOutbound>,
  host: typeof fixture.effects.host, spine: typeof fixture.effects.spine): void {
  const definition = value(fixture.doorway.inspect()).find(row => row.record.type === 'OperationDefinition'
    && row.record.id === fixture.request.definition)?.record;
  if (definition?.type !== 'OperationDefinition') throw new Error('round22 operation definition is missing');
  value(installTelegramReplyOperation({
    id: definition.id,
    generation: definition.generation,
    admitted: fixture.telegram.admitted,
    target: fixture.target,
    speaker: definition.speaker,
    scopeDigest: definition.scopeDigest,
    durability: definition.durability,
    replicas: definition.replicas,
    lossModel: definition.lossModel,
    verificationBar: definition.verificationBar,
  }, host, spine));
}

export interface Round22CaptureReferenceResult {
  readonly uniqueReference: boolean;
  readonly lostResponse: boolean;
  readonly invocations: readonly ResultSummary[];
  readonly dispatch: ResultSummary;
  readonly providerCalls: number;
  readonly markerIds: readonly string[];
  readonly markerCaptureReferences: readonly string[];
  readonly allocatedCaptureReferences: readonly string[];
}

/** Permanent import of rereview20's capture-reference-claim.ts four-case matrix. */
export function round22CaptureReferenceClaim(uniqueReference: boolean,
  lostResponse: boolean): Round22CaptureReferenceResult {
  const fixture = telegramPreparedOutbound(lostResponse);
  let captures = 0;
  const aliases: Record<string, CapturedContent> = {};
  const capture = fixture.effects.host.capture;
  const host: typeof fixture.effects.host = {
    ...fixture.effects.host,
    capture(bytes: string) {
      const result = capture(bytes);
      if (!bytes.includes('TelegramReplyInvocationStarted') || !uniqueReference) return result;
      const original = value(result);
      const reference = `capture:invocation:${++captures}`;
      for (const directory of ['origin-captures', 'peer-captures']) {
        const file = openSync(join(fixture.effects.directory, directory, `invocation-${captures}.bytes`), 'w', 0o600);
        try { writeFileSync(file, bytes); fsyncSync(file); } finally { closeSync(file); }
        const parent = openSync(join(fixture.effects.directory, directory), 'r');
        try { fsyncSync(parent); } finally { closeSync(parent); }
      }
      aliases[reference] = {
        hash: original.hash as CapturedContent['hash'],
        bytes,
        status: 'available',
        byteLength: Buffer.byteLength(bytes),
      };
      return fixture.effects.success({ reference, hash: original.hash });
    },
  };
  const context = {
    ...fixture.effects.ctx,
    get captures(): Record<string, CapturedContent> {
      return { ...fixture.effects.ctx.captures, ...aliases };
    },
  };
  const resultPort = <T>(run: () => T) => fixture.effects.success(run());
  const peer = createFactStore(context, createTransportFileStorage(join(fixture.effects.directory, 'peer'), resultPort));
  const replicas = createEffectReplicaStorage(join(fixture.effects.directory, 'origin'),
    { id: 'fixture-peer-directory', store: peer }, resultPort);
  const store = createFactStore(context, replicas.storage);
  const spine = createEffectSpine(host, { context, privateKey }, store);
  installFixtureOperation(fixture, host, spine);

  const invocations: ReturnType<typeof fixture.adapter.invoke>[] = [];
  const doorway = createEffectDoorway({
    ...fixture.effects.composition,
    host,
    spine,
    durability: replicas.durability,
    assessment: null,
    adapter: {
      ...fixture.adapter,
      invoke(input) {
        const first = fixture.adapter.invoke(input);
        const second = fixture.adapter.invoke(input);
        invocations.push(first, second);
        return first;
      },
    },
  });
  const dispatch = doorway.dispatch(fixture.request, fixture.effects.fence);
  const markers = value(store.read()).filter(row => row.kind === 'effect-OperationObservation')
    .map(row => (row.body as { record: { id: string; capture: { reference: string } } }).record)
    .filter(record => record.id.startsWith('observation:telegram-invocation-started:'));
  return {
    uniqueReference,
    lostResponse,
    invocations: invocations.map(summarize),
    dispatch: summarize(dispatch),
    providerCalls: fixture.telegram.calls.send.length,
    markerIds: markers.map(record => record.id),
    markerCaptureReferences: markers.map(record => record.capture.reference),
    allocatedCaptureReferences: Object.keys(aliases),
  };
}

export const round22InvocationChanges = [
  'control',
  'stop-before-invoke',
  'expiry-before-invoke',
  'stop-at-marker-capture',
  'expiry-at-marker-capture',
  'stop-after-marker-append',
  'expiry-after-marker-append',
] as const;

export type Round22InvocationChange = typeof round22InvocationChanges[number];

export interface Round22InvocationBoundaryResult {
  readonly change: Round22InvocationChange;
  readonly fired: boolean;
  readonly dispatch: ResultSummary;
  readonly providerCalls: number;
  readonly markerIds: readonly string[];
  readonly observationStages: readonly string[];
}

/** Permanent import of rereview20's invocation-boundaries.ts seven-case matrix. */
export function round22InvocationBoundary(change: Round22InvocationChange): Round22InvocationBoundaryResult {
  const fixture = telegramPreparedOutbound();
  let fired = false;
  const mutate = () => {
    fired = true;
    if (change.startsWith('stop')) fixture.effects.stop();
    else fixture.effects.time(10_000);
  };
  const capture = fixture.effects.host.capture;
  const host: typeof fixture.effects.host = {
    ...fixture.effects.host,
    capture(bytes: string) {
      const result = capture(bytes);
      if (bytes.includes('TelegramReplyInvocationStarted') && change.endsWith('marker-capture')) mutate();
      return result;
    },
  };
  const storage = fixture.effects.replicas.storage;
  const append = storage.append;
  const wrappedStorage: typeof storage = {
    ...storage,
    append(bytes: string, head: string | null) {
      const result = append(bytes, head);
      if (bytes.includes('observation:telegram-invocation-started:') && change.endsWith('marker-append')) mutate();
      return result;
    },
  };
  const store = createFactStore(fixture.effects.ctx, wrappedStorage);
  const spine = createEffectSpine(host, { context: fixture.effects.ctx, privateKey }, store);
  installFixtureOperation(fixture, host, spine);
  const doorway = createEffectDoorway({
    ...fixture.effects.composition,
    assessment: null,
    adapter: {
      ...fixture.adapter,
      invoke(input) {
        if (change.endsWith('before-invoke')) mutate();
        return fixture.adapter.invoke(input);
      },
    },
  });
  const dispatch = doorway.dispatch(fixture.request, fixture.effects.fence);
  const observations = value(fixture.effects.store.read())
    .filter(row => row.kind === 'effect-OperationObservation')
    .map(row => (row.body as { record: { id: string; stage: string } }).record);
  return {
    change,
    fired,
    dispatch: summarize(dispatch),
    providerCalls: fixture.telegram.calls.send.length,
    markerIds: observations.filter(record => record.id.startsWith('observation:telegram-invocation-started:'))
      .map(record => record.id),
    observationStages: observations.map(record => record.stage),
  };
}
