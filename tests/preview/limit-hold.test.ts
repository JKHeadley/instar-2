import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openPreviewState } from './state.js';
import { stage2CompositionFixture } from './stage2-fixture.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

it('holds spend durably, defaults unknown resets, caps long resets, and releases on time', () => {
  let now = 1000000;
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-limit-'))); roots.push(root);
  const options = { root, configuration: { trial: 'limit' }, expiresAt: now + 30000000,
    now: () => now, replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, totalErrorLimit: 100,
    maxPendingTurns: 16, maxTrialTurns: 128 };
  const state = openPreviewState(options);
  state.noteLimit(null);
  expect(state.read().limitHoldUntil).toBe(now + 1800000);
  expect(() => openPreviewState({ ...options, create: false }).gateSpend()).toThrow('usage limit hold');
  now += 1800000;
  expect(() => state.gateSpend()).not.toThrow();
  state.noteLimit(now + 20000000);
  expect(state.read().limitHoldUntil).toBe(now + 18000000);
  now += 18000000;
  expect(() => state.gateSpend()).not.toThrow();
});

it('refuses the real Stage 2 model path while a durable limit hold is active', async () => {
  const s = stage2CompositionFixture(); roots.push(s.root);
  const c = await s.create();
  try {
    s.state.noteLimit(null);
    c.pollOnce();
    await c.resume();
    expect(s.models).toHaveLength(0);
    expect(s.state.read().limitHoldUntil).toBeGreaterThan(s.now());
  } finally { c.close(); }
}, 60000);
