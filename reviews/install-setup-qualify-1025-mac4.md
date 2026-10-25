# Change review — hardened setup prompt qualification

Subject base: 1393bfab27fa55d199a5a973c4524700ca2078ea
Review state: open
Reviewed content: none
Outcome: Measure whether explicit untrusted-evidence framing fixes unsafe judgments without rejecting valid neighbors, using one prompt version and a precommitted held-out set.
Affected rules: 4, 12, 13, 26, 27, 34, 36, 38, 41, 49, 55, 57, 58, 60, 65, 67, 74, 75, 95, 100, 101, 107, 108, 111, 112, 113, 116; purpose Rule 3.
Affected floors: secrets — captured public observations only; spend — local CPU, zero paid calls; stop — existing durable stop before/during execution; no duplicate sends — no sends; durable intake — original evidence, failed candidates and full captures retained.
Operator questions: none; the desk authorized this final prompt-side experiment and the 3-GiB reservation.
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes what the model is asked, requiring real three-repetition evidence on original and held-out cases.
Side effects: More explicit instructions can reject valid evidence or lengthen responses. Both sets are measured separately, with the original positive bar unchanged. Ordinary tests do not load weights. This affects isolated qualification only.
Undo and recovery: Revert the prompt/renderer/selector while retaining all evidence. Each set uses a fresh private cache directory with fsynced stop state; no retries, overwritten prior run or live store changes.
Multi-machine posture: Machine-local macOS arm64 measurement; no ordinary 8-GiB-host or other-platform qualification claim. Evidence and source snapshots are carried in git.
Layer below: Constitution, docs/14 bar, actual captured crypto/storage receipts, unchanged schema/decoder/exact-owner protection, pinned model/runtime, Seven/Six admission and captures, Ten resource owner. Distinct custodian/recovery holder and full GE/A0 preparation remain uncovered.
Hook bypass: none
Convergence: none; independent assessment PENDING ASTRA.

simplestRobustRoute: Reuse the existing runner and apply standard instruction/data separation plus all-postcondition reasoning. This is the simplest robust route. Evidence delimiters and escaped delimiter characters address instruction confusion; the frozen case set exposes overfitting. No additional model, heuristic verdict parser, retries or installer authority are introduced. Existing pin, stop, resource, deadline and exact-PID cleanup guards remain active. No autonomous installation completion is claimed.

Held-out integrity: Commit 70b1f612e contains only 12 held-out cases and their SHA-256 file, before any prompt edit. Six positives and six negatives derive from real owner captures with explicit source hashes and transformations. They are not claimed as independent new owner executions. Prompt wording contains no case-specific examples, IDs or verdict hints. No prompt tuning follows evaluation.

Verification: Three repetitions on each set, with separately reported model and final exact-owner dispositions. Boundary tests preserve the original schema and decoder, escape evidence delimiters, hide expected outcomes and replay real journal/model shapes. Numerical results are in the accompanying evidence report and absolute lane PROGRESS record.

Measured result: Original 0/24 unsafe model accepts, but 0/12 positives (regressed from 12/12). Held-out 0/18 unsafe accepts and 3/18 positives. Both sets completed 36 responses with zero schema/resource failures and consistent dispositions. The original bar fails. Model reasons also claim present fields are missing and identical values differ.

Renderer repair after measurement: A supplemental test demonstrated that literal JavaScript replacement markers in evidence could expand template control tokens. Replacement callbacks fix this without changing any prompt byte for the measured cases; all 72 captures replay against the final renderer. Executed source snapshots remain intact, and reports distinguish the final adapter hash. This is a data-boundary repair, not prompt tuning or a changed case set.

VERDICT: failed qualification evidence; independent assessment PENDING ASTRA
