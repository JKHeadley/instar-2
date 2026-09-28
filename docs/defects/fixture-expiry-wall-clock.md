# Preview fixture trial expired on the real clock (Rule 37 quarantine)

**Status:** OPEN. **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

`tests/preview/self-state.test.ts` — `gives every held reply one fixed plain reason and truthful resend advice` — began failing deterministically at 2026-09-28T20:40:00Z (run `/private/tmp/claude-501/cint1-livefix/full-rr2-lag.log`). Its `status` command reported `This reply is held because the trial is stopped; resending will not help.` for both held replies, before the test issued `stop`. Runs that finished before that time pass.

**Cause (known):** the test's genesis record sets `expires: Date.UTC(2026, 8, 28, 20, 40)`. The in-process part of the test uses a fixed clock (`NOON`), but it then runs `tests/preview/journal-agent.mjs status` as a child process. That child computes `stopped` from `existsSync(stopPath) || view.stop !== null || wallNow() >= view.view.expires` using the real host clock. Once the host clock passed the fixture's expiry, every hold is reported as stopped. It is a time bomb in the test, not caused by the declaration repair.

**Reproduce:** at any host time after 2026-09-28T20:40:00Z, `npx vitest run tests/preview/self-state.test.ts` with the skip removed.

**Disposition:** the case is quarantined with `it.skip` and a comment linking here; its body and assertions are retained. While quarantined, the gate does not prove the `status` command's per-reason hold notices, or the switch to the stopped notice after `stop`, through the real agent process. The in-process `holdNotice` wording checks in the same file stay active. A green gate is reported as green with this quarantine named.

**Repair and closure:** the owner gives the child a fixed clock (as `tests/preview/journal-upgrade-compat.test.ts` does with a `Date.now` import) or moves the fixture expiry to a date that cannot pass during the test's life, removes the skip, and shows the case passing. Any other fixture found to share a real-clock expiry is added here.

**Multi-machine posture:** machine-local test. This record and the quarantine travel with the repository.
