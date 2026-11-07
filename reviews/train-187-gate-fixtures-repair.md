# Change review — train-187 gate fixture repair

Subject base: 1d82ce7f3f5fe3653a5f1a5d0df9080e7aa8a33b
Review state: open
Reviewed content: none
Outcome: Restore the ten named gate regressions' intended evidence without changing runtime behavior: bind census injections to the producer constant, distinguish pending recovery from terminal loss, keep the next-day reminder probe within its trial, and retain current worker-input exports beside the historical settlement slice.
Affected rules: 26, 34, 37, 42, 45, 49, 60, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — temporary offline fixtures only; spend cap — no provider requests; stop — existing independent signal deadline assertions retained; no duplicate sends — exact send counts and UNKNOWN restart checks retained; durable intake — real encrypted journal and replay retained.
Operator questions: none
Suggested tier: standard
Declared tier: standard
Tier rationale: Test fixture repairs only; no production source, prompt, authority, configuration or runtime behavior changes.
Side effects: Census fixtures follow the actual compact query instead of silently losing injection. Timing checks now wait until recovery expires before demanding a terminal notice. Reminder deduplication crosses one day within a two-day fixture trial. The settlement compiler retains the original pinned Eight bodies and nominal identity while exposing the real independent worker-input module required by current assembly.
Undo and recovery: Revert this repair commit; original gate evidence stays in the desk logs. No production migration or data rollback is needed.
Multi-machine posture: Deliberately machine-local process tests; Darwin sandbox and process ownership proofs remain Studio checks. Portable fixture tests run on WSL. No distributed state or ownership behavior changes.
Layer below: Read process-census-query.mjs and resource-owner.mjs query consumers, delivery-recovery.ts TTL and journal.ts notice/reconciliation gates, reminder fixture genesis expiry, and the settlement compiler's historical overlay versus the current effects barrel and production-session-driver imports. The old overlay, not a missing shipped export, caused the settlement failure.
Bug class: none
Bug evidence: Test harness integration defects, reproduced against the assigned head; exact baseline and targeted outcomes are in the canonical progress report. Native Darwin process proofs cannot be certified on WSL.
Hook bypass: none
Convergence: none
Prompt review: No model-facing runtime path changes. Existing reminder-truth recorded-shape replay remains part of the targeted suite.

1.x comparison: Actual JKHeadley/instar origin/main 40a131d93eafc15fd7714a7c383d0a802aa1e847 searched across src/ and docs/specs/ for census, lstart and detached children. Read src/core/AgentIdentityLock.ts:86-99 (unreadable identity remains unknown), docs/specs/external-hog-zombie-autokill-sentinel.md:150-188 (comm census and unknown evidence), and src/monitoring/delivery-failure-sentinel/recovery-policy.ts:67-85 (nine retries, 24h TTL); inspected histories 338b04040, 08ba1558e, fb7483594 and 9f5c9a9b6, and ONEX-LESSONS.md section 6. Reuse existing 2.0 constant and the already carried recovery policy. No direct 1.x subsystem transplant fits the 2.0 test harness repairs; no tuned runtime behavior is replaced.

Decision: train187-census-fixtures | Use PROCESS_CENSUS_COLUMNS at both partial-census interception sites, the native RSS injection and stop delay, including the native fixture's own census control. Preserve every assertion and real identity/ownership join. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-163600-PROGRESS.md
Decision: train187-recovery-timing | Assert the immediate two attempts and durable recovery first, then advance the injected clock through its 24h TTL inside a two-day trial and retain the original exact terminal notice and phase-timing assertions. UNKNOWN remains immediate and is never retried. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-163600-PROGRESS.md
Decision: train187-reminder-lifetime | Give only the next-day restart probe a two-day trial. Keep the persisted-instant, just-before-due, exactly-once and next-day UNKNOWN assertions intact. The separate short-trial refusal test is unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-163600-PROGRESS.md
Decision: train187-settlement-overlay | The pinned 503642b effects barrel predates worker-input, but the compile also includes current assembly. Add the real worker-input module's exports to that test-only barrel, retaining all pinned settlement bodies and all negative type assertions. No source export is patched and no error is filtered. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-163600-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: repair stale fixtures at their existing seams and preserve all assertions. No runtime machinery is added. The input guard is the exact assigned head and recorded gate failures; the end guard is targeted evidence and cheap gates, with Darwin proofs explicitly returned to the Studio.
80/20: Run changed portable tests and direct consumers, typecheck/build, architecture, register and change-review checks; the desk owns the full suite and Darwin process proofs.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
