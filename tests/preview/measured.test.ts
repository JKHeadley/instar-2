// Rule 13: live quantities carry their subject; a cross-subject comparison refuses.
import { expect, it } from 'vitest';
import { clockDifference, compareLive, liveMeasurement, measuredTimings, renderMeasured, resourceCompare } from './measured.js';

it('compares live quantities of one subject and refuses a different subject, instance or unit', () => {
  const memory = liveMeasurement('owned-process-memory', 'launch:a', 300, 1000);
  const ceiling = liveMeasurement('owned-process-memory', 'launch:a', 200, 1000);
  expect(compareLive(memory, ceiling)).toBe(100);
  // Thirty of one thing is not thirty of another.
  expect(() => compareLive(liveMeasurement('owned-process-count', 'launch:a', 300, 1000), ceiling)).toThrow(/mismatch/u);
  expect(() => compareLive(liveMeasurement('owned-process-memory', 'launch:b', 300, 1000), ceiling)).toThrow(/mismatch/u);
  expect(compareLive(liveMeasurement('owned-process-memory', 'launch:b', 300, 1000), ceiling, true)).toBe(100);
  expect(renderMeasured(memory)).toBe('300 bytes of owned-process-memory (launch:a)');
});

it('decodes resource-owner observations with their registered unit only', () => {
  const row = (kind: string, unit: string, value: number) => ({ subject: { kind, instance: 'launch:x' }, unit, value, at: 5 });
  expect(resourceCompare(row('owned-process-count', 'processes', 40), row('owned-process-count', 'processes', 32))).toBe(8);
  expect(() => resourceCompare(row('owned-process-count', 'bytes', 40), row('owned-process-count', 'bytes', 32))).toThrow(/unit/u);
  expect(() => resourceCompare(row('owned-process-count', 'processes', 40), row('owned-process-memory', 'bytes', 32))).toThrow();
  expect(() => liveMeasurement('owned-process-memory', 'launch:x', Number.NaN, 5)).toThrow();
});

it('measures elapsed time on one host clock', () => {
  expect(clockDifference(5000, 2000)).toBe(3000);
});

it('renders reply timings as subject-bound claims and compares the Jev p95 with its own budget', () => {
  const none = { count: 0, p50Ms: null, p95Ms: null };
  const timings = { budgetMs: 30000, perReply: [], answer: { count: 2, p50Ms: 900, p95Ms: 1200 },
    jev: { count: 2, p50Ms: 400, p95Ms: 31000 }, fallback: none, send: { count: 1, p50Ms: 80, p95Ms: 80 } };
  const measured = measuredTimings(timings, 5000);
  expect(measured.claims.answer).toEqual({ p50: '900 ms of answer-latency (preview-replies/answer)',
    p95: '1200 ms of answer-latency (preview-replies/answer)' });
  expect(measured.claims.fallback).toEqual({ p50: null, p95: null });
  expect(measured.jevWithinBudget).toBe(false);
  expect(measuredTimings({ ...timings, jev: { count: 1, p50Ms: 400, p95Ms: 400 } }, 5000).jevWithinBudget).toBe(true);
  expect(measuredTimings({ ...timings, jev: none }, 5000).jevWithinBudget).toBeNull();
  expect(measured.budgetMs).toBe(30000);
});
