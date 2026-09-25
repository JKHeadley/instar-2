import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openPreviewState } from './state.js';
import { stage2CompositionFixture } from './stage2-fixture.js';
import { classifyProviderFailure } from '../../src/assembly/provider-failure.js';
// @ts-expect-error The physical provider host remains JavaScript.
import { productionProviderIO } from '../../scripts/production-boot-io.mjs';

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

it('carries a parsed six-hour reset into the five-hour durable hold cap', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-long-reset-'))); roots.push(root);
  const now = 1000000;
  const state = openPreviewState({ root, configuration: { trial: 'long-reset' }, expiresAt: now + 30000000,
    now: () => now, replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, totalErrorLimit: 100,
    maxPendingTurns: 16, maxTrialTurns: 128 });
  const failure = classifyProviderFailure({ code: 1, limited: false, now,
    stdout: JSON.stringify({ type: 'result', is_error: true,
      result: "You've hit your usage limit; resets in 6 hours" }) });
  expect(failure).toMatchObject({ failureClass: 'limit', resetAt: now + 21600000 });
  state.noteLimit(failure.resetAt);
  expect(state.read().limitHoldUntil).toBe(now + 18000000);
});

it('caps the captured weekly reset at five hours across a state reopen', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-captured-limit-'))); roots.push(root);
  const now = new Date('2026-09-24T21:01:00-07:00').getTime();
  const state = openPreviewState({ root, configuration: { trial: 'captured-limit' }, expiresAt: now + 30000000,
    now: () => now, replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, totalErrorLimit: 100,
    maxPendingTurns: 16, maxTrialTurns: 128 });
  const stdout = readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8');
  const failure = classifyProviderFailure({ code: 1, limited: false, stdout, now,
    calendarResetAt: productionProviderIO.calendarResetAt });
  expect(failure.resetAt).toBe(1790506800000);
  state.noteLimit(failure.resetAt);
  expect(state.read().limitHoldUntil).toBe(now + 18000000);
  expect(() => openPreviewState({ root, configuration: { trial: 'captured-limit' }, expiresAt: now + 30000000,
    now: () => now, replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, totalErrorLimit: 100,
    maxPendingTurns: 16, maxTrialTurns: 128, create: false }).gateSpend()).toThrow('usage limit hold');
});

it('retains the captured weekly limit in the provider receipt, turn, and reopened five-hour hold', async () => {
  const now = new Date('2026-09-24T21:01:00-07:00').getTime();
  const terminal = readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8');
  const s = stage2CompositionFixture({ start: now, terminal, terminalCode: 1 }); roots.push(s.root);
  const c = await s.create();
  try {
    c.pollOnce(); await c.resume();
    expect(s.models).toHaveLength(1);
    const receiptReference = c.sidecar.read().references.receipt;
    expect(receiptReference).toMatch(/^judgment-capture:sha256:[a-f0-9]{64}$/u);
    const receipt = JSON.parse(readFileSync(join(s.root, '.preview-stage2/captures', receiptReference.split(':').at(-1)), 'utf8'));
    expect(receipt.failure).toEqual({ failureClass: 'limit', resetHint: null, resetAt: 1790506800000 });
    expect(Object.values(s.state.read().turns)).toEqual([expect.objectContaining({ failureClass: 'limit', resetHint: null })]);
    expect(s.state.read().limitHoldUntil).toBe(now + 18000000);
    expect(c.sidecar.read().phase).toBe('held');
  } finally { c.close(); }
  const reopened = openPreviewState({ root: s.root, configuration: s.configuration,
    expiresAt: s.state.read().trial.expiresAt, now: () => now, replyLimit: 6, replyWindowMs: 60000,
    errorLimit: 5, totalErrorLimit: 1000, maxPendingTurns: 16, maxTrialTurns: 128, create: false });
  expect(reopened.read().limitHoldUntil).toBe(now + 18000000);
  expect(() => reopened.gateSpend()).toThrow('usage limit hold');
}, 60000);

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
