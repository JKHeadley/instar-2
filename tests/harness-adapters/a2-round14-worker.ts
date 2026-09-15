import { createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
import type { HarnessOperationAttempt } from '../../src/harness-adapters/contracts.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { attemptInput, harnessFixture, witnessedEvent } from './fixture.js';
import { round14FileFixture } from './a2-round14-file-fixture.js';

const [operation, target] = process.argv.slice(2);
if (!operation || !target) throw new Error('round-fourteen worker requires an operation and target path');

if (operation === 'append-failed-probe') {
  const fixture = round14FileFixture(target);
  const event = witnessedEvent(fixture.ten, 'probe-failed', {
    id: 'r14:final-read:failed',
    sourceEvidence: ['r14:final-read:failure-observation'],
    launch: fixture.handle.launch,
    incarnation: fixture.handle.incarnation,
    sourceClock: 22,
    observedAt: 22,
    streamState: 'closed',
  });
  const receipt = fixture.evidence.admit(event);
  process.stdout.write(JSON.stringify({ receipt, liveness: fixture.evidence.liveness(fixture.handle, 22) }));
} else if (operation === 'open-legacy') {
  const fixture = harnessFixture();
  try {
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
    const source = attemptInput() as HarnessOperationAttempt;
    const receipt = holder.beginAttempt({ ...source, attemptedAt: 30 });
    process.stdout.write(JSON.stringify({ receipt }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
} else {
  throw new Error(`unknown round-fourteen worker operation: ${operation}`);
}
