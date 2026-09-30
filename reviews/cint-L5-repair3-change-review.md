# Change review — cint-L5 repair 3: the review-layers canary tolerates a due reminder line; the self-state ratio is read at the median with linear headroom

Subject base: 3ecd177010a9d4c357d71921dcede49cff448f65
Review state: open
Reviewed content: none
Outcome: The Mama PC gate at 3ecd1770 failed three tests. (1) The review-layers canary (wrapped, reply-contradiction) asserted the reviewed candidate reply and the sent text byte-exactly; the launcher runs on the real clock against the fixture's fixed activation expiry, which is now within the reminder window, so the correct credential reminder line (Rules 8, 100) rode the answer. The canary now checks the answer exactly and every appended line against the same notice pattern journal-agent.test.ts already uses; nothing else may be appended. (2) The self-state relative timing case read a p95 ratio of 16.67 against 10. Isolated it reads 8.74-8.95: the derivation is linear, so a bound of exactly 10 had no headroom, and the 1 ms reference's p95 is decided by one contention burst. The ratio is now taken at the median of the 200 interleaved samples (p95 figures still printed) and bounded at 20; a temporary tenfold-cost frame derivation read 87.9 and failed, so a quadratic derivation is still caught. No source behavior changes; no case is skipped.
Affected rules: 8 and 100 (the due credential reminder is kept and asserted, not suppressed), 37 (fixed at source, no quarantine; the defect record carries the follow-up), 74, 116 (reuse the existing notice pattern; one statistic and one bound changed)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (the wrapped canary still asserts exactly one send); durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test assertions and a defect record only; no src/ or runner change
Side effects: none at runtime
Undo and recovery: revert the fix commit and this record
Multi-machine posture: tests are machine-local; the defect record travels with the repository
Layer below: tests/preview/credential-reminders.ts notice lines; tests/preview/self-state.ts derivation
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: docs/defects/preview-self-state-timing-flake.md:40 | not-a-deferral=a closed defect record's follow-up note describing a completed repair, not a commitment

Subject (3 paths): docs/defects/preview-self-state-timing-flake.md, tests/preview/review-layers-canary.test.ts, tests/preview/self-state.test.ts

## Closing block

simplestRobustRoute: reuse journal-agent.test.ts's notice-tolerant answer check in the canary; read the timing ratio at the median with a bound that separates linear (8.7) from quadratic (about 100); both sides run
80/20: 0 must-fix, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
