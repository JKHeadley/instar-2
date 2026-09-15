import { join } from 'node:path';
import { createAssemblySpine, currentAssemblyRows, resolveAssemblyHistory } from '../../src/assembly/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createHarnessAdmissionPort } from '../../src/harness-adapters/index.js';
import { createHarnessEvidenceHolder } from '../../src/harness-adapters/holder.js';
import type { HarnessAdapterStateSnapshot, HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { privateKey, value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

export function round14FileFixture(directory: string, seed = false) {
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
  const six = transportFixture(join(directory, 'six'));
  const storage = createTransportFileStorage(join(directory, 'ten'), six.result);
  if (seed) {
    let head: string | null = null;
    for (const rawFact of fixture.ten.owner.raw) {
      const fact = rawFact as Readonly<{ contentHash: string }>;
      value(storage.append(JSON.stringify(fact), head));
      head = fact.contentHash;
    }
  }

  const context = fixture.ten.owner.context;
  const store = createFactStore(context, storage);
  let decodeContext = fixture.ten.owner.c;
  const spine = createAssemblySpine(fixture.ten.owner.host, { context, privateKey }, store);
  const history = Object.freeze({
    owner: 'part-ten' as const,
    current: () => fixture.ten.owner.success(currentAssemblyRows(value(store.readForProjection()), decodeContext)),
    lookup: (reference: string) => {
      const snapshot = value(store.readForProjection());
      const rows = currentAssemblyRows(snapshot, decodeContext);
      const row = rows.find(candidate => candidate.record.id === reference || candidate.fact.id === reference);
      return fixture.ten.owner.success(row ? {
        ...row,
        completeness: value(resolveAssemblyHistory(row.record, spine, decodeContext)).completeness,
      } : null);
    },
    resolve: (record: Parameters<typeof resolveAssemblyHistory>[0]) =>
      resolveAssemblyHistory(record, spine, decodeContext),
  });
  decodeContext = Object.freeze({ ...fixture.ten.owner.c, history });

  const admission = createHarnessAdmissionPort({
    adapter: fixture.handle.harness,
    artifact: fixture.handle.artifactDigest,
    platform: fixture.handle.platform,
    machine: fixture.handle.machine,
    context: decodeContext,
    current: fixture.ten.owner.host,
  });
  const ten = {
    owner: { ...fixture.ten.owner, c: decodeContext, spine },
    port: admission,
  };
  const state = createHarnessAdapterFileState(join(directory, 'events')) as HarnessEvidenceStateStorePort;
  if (seed) {
    state.save(null, fixture.eventState.load() as HarnessAdapterStateSnapshot);
    for (const candidate of fixture.eventState.loadPoisonCandidates()) {
      state.appendPoisonCandidate(candidate as HarnessRuntimeEvent);
    }
  }
  const evidence = createHarnessEvidenceHolder({
    adapter: fixture.handle.harness,
    artifact: fixture.handle.artifactDigest,
    platform: fixture.handle.platform,
    machine: fixture.handle.machine,
    scope: 'conversation:1',
    maxEvents: 32,
    maxCaptureBytes: 1024,
    context: decodeContext,
    state,
    admission,
    owners: {
      handles: fixture.handles,
      current: fixture.ten.owner.host,
      verification: fixture.freshNine(fixture.fullNine).runtime,
    },
  });
  const fence = value(six.api.acquire('r14:final-read:lease', '', 500));
  return { ...fixture, ten, six, fence, state, evidence };
}
