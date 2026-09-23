// TEST-INFRASTRUCTURE (Astra parallelism ruling, 2026-09-22): let fork-worker IPC replies
// run between synchronous/microtask test cases. A test file whose cases are pure
// synchronous or microtask owner work never lets the worker's event loop reach its I/O
// phase, so the runner's task-update replies queue until the file ends; past birpc's
// fixed 60s deadline that surfaces as "Timeout calling onTaskUpdate" regardless of core
// count or worker priority (proved by the worker-side RPC trace on the G6 candidate).
// This is an awaited real event-loop turn — not Promise.resolve(), nextTick, a detached
// callback or an unref'd immediate — imported from the native timer so a test's replaced
// global timer cannot disable it. Scheduling only: no owner behavior or assertion changes.
import { afterEach } from 'vitest';
import { setImmediate as yieldImmediate } from 'node:timers';

afterEach(() => new Promise(resolve => yieldImmediate(resolve)));
