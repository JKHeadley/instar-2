# Change review — train-159 serial test scheduling

Subject base: 66869f8ffc69a8c4c15ae52826e5901f9c68618a
Review state: open
Reviewed content: none
Outcome: Remove competition between test files in each gate through the existing serial Vitest pool; retain every test, assertion, timeout and product safeguard.
Affected rules: 26, 37, 49, 60, 70, 74, 101, 102, 108, 111, 112, 113, 116; purpose constraint 3.
Affected floors: secrets — no credential paths changed; spend cap — no paid inference or accounting changes; stop — no production execution changes; no duplicate sends — all effect and recovery assertions retained; durable intake — all storage and crash assertions retained.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test scheduling and its regression coverage only; no product, model-facing, authority, storage, governed-document or generated-publication changes. The complete Studio gate remains required.
Side effects: Full runs have less concurrency and may take longer on idle hosts. Independent runs still compete with each other; a single long synchronous case can still starve its own worker. No full-suite performance improvement or universal timeout cure is claimed.
Undo and recovery: Revert this repair through git to restore the former CPU-derived worker ceiling and serial opt-in. No data migration or live-state write exists.
Multi-machine posture: The per-run scheduling limit is local to each runner process on every host; it is distributed by git and is not a host-wide or cross-machine lock. It does not constrain agent delegation or product concurrency.
Layer below: Read the full purpose and Rules; inspected Vitest config, worker-cap resolver, priority/yield/child-bound setup and the desk's four-worker invocation. Compared the supplied gate durations with unchanged targeted provider and fixed-peer cases. Read 1.x src/core/hostTestRunnerSemaphore.ts: its existing serial full-suite lane supports the resource principle; no host-wide ticket, lease or watchdog machinery is transplanted.
Bug class: unit
Bug evidence: reproducer=tests/unit/test-worker-limit.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Prompt review: No production prompt or model-output parsing changed. The generated probe text names test scheduling only.
Decision: train-159-runner-D1 | Use the existing serial file mode and one-worker ceiling rather than increasing deadlines across unrelated tests or adding a host-wide scheduler. The supplied gate shows broad timing sensitivity; targeted passes do not exonerate that red run. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-159-repair-PROGRESS.md

Evidence: Targeted provider file passed 10/10; its reported failing matrix took 3,125 ms versus 81,095 ms in the supplied gate. Built fixed-peer file passed 13/13 including crash and refusal cases. Worker-cap coverage exercises both legacy serial settings, unset/valid/invalid cap inputs and an actual two-file injected-delay run. The configuration regression fails against the original config (expected one, received six) and passes after restoring the repair. Tests run foreground with nice 10 and one worker. Full-run qualification stays with the Studio pipeline; no saved report was read or fabricated.

## Closing block

simplestRobustRoute: This is the simplest robust route: select the runner's existing serial pool to remove within-run file competition, with the existing bounds and all semantic checks retained. Start guard is the checked-in config; end guards are the cap regression and targeted real-owner tests; limit guards remain case and child deadlines. No new scheduler, retry, waiver or runtime restriction is added, and no unattended product-completion claim is made.
80/20: Repair the shared scheduling amplifier, verify the exact setting and representative failed boundaries, and retain the full gate as the acceptance test. The historical RPC defect remains open until that gate proves closure.
VERDICT: author submission; no independent verdict asserted
