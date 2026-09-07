// One kill-schedule test file per profile so each vitest worker's RPC channel carries
// a bounded chunk (astra CI addendum). Every row and invariant is asserted in the
// shared driver; the completeness of the pinned table is asserted in the completeness
// file. See tests/e2e/slice-kill-schedule.shared.ts.
import { registerProfileSchedule } from './slice-kill-schedule.shared.js';

registerProfileSchedule('reply');
