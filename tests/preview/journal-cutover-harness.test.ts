// @ts-nocheck -- drives the same real child and physical-port fixture as the ownership proof.
import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

it('waits for a real canary poll beyond the old five-second startup window', async () => {
  const harness = cutoverHarness(successiveWorld(), offlineProfile, {
    INSTAR_PREVIEW_CUTOVER_POLL_DELAY_MS: '5500',
  });
  harness.setUpdates([]);
  const child = harness.startCanary(true);
  try {
    await harness.waitForOverlap();
    expect(child.exitCode).toBeNull();
    expect(harness.calls()).toContainEqual(expect.objectContaining({ kind: 'poll', role: 'canary', outcome: 'held' }));
  } finally {
    await harness.stopCanary(child);
    harness.releaseOverlap();
  }
}, 45000);

it('reports a child startup failure with its exit status and diagnostic', async () => {
  const world = successiveWorld();
  const preload = join(world.directory, 'fail-canary.mjs');
  writeFileSync(preload, "process.stderr.write('injected canary boot failure'); process.exit(17);\n");
  const harness = cutoverHarness(world, offlineProfile, { NODE_OPTIONS: `--import=${preload}` });
  const child = harness.startCanary();
  try {
    await expect(harness.waitForOverlap()).rejects.toThrow(/status=17.*injected canary boot failure/);
  } finally { await harness.stopCanary(child); }
});

it('bounds a live child that never reaches its poll without treating it as ready', async () => {
  const world = successiveWorld();
  const preload = join(world.directory, 'hold-canary.mjs');
  writeFileSync(preload, 'await new Promise(resolve => setTimeout(resolve, 60000));\n');
  const harness = cutoverHarness(world, offlineProfile, { NODE_OPTIONS: `--import=${preload}` });
  const child = harness.startCanary();
  try {
    await expect(harness.waitForOverlap(100)).rejects.toThrow('never entered a long poll within 100ms');
    expect(child.exitCode).toBeNull();
  } finally { await harness.stopCanary(child); }
});
