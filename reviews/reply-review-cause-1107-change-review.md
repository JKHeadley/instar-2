# Change review — reply checks and reviews record why they read unavailable

Subject base: aa8cbc934351f78e52d4ecebc3714648981ece0f
Review state: open
Reviewed content: none
Outcome: every reply check or review that reads unavailable now records a bounded cause and fixed-token detail in the journal, for the jev, subscription and holding paths, the after-send review and the review of a revised reply; inspect shows them per reply and status and inspect count them by path and cause. Nothing about retries, gating or what is sent changes.
Affected rules: 2, 9, 38, 39, 41, 42, 48, 49, 67, 73, 74, 77, 95, 102, 108, 113, 116
Affected floors: secrets — cause is a closed set and detail must match a short token pattern built from typed failure fields or an error class name, so no exception message, URL or provider text is stored, and a forged tag is refused in a test; spend cap — no new call, reservation or retry; stop — unchanged; no duplicate sends — the send path is untouched and a durable test shows one send; durable intake — unchanged, the fields are optional on existing rows.
Operator questions: none
Suggested tier: standard
Declared tier: standard
Tier rationale: additive optional diagnostic fields on existing rows, with no decision reading them.
Side effects: reply-check rows and reply-revision-review rows gain optional cause and causeDetail. The rejected and uncertain internal subscription results gain providerFailure, which the answer path spreads but does not read or journal. Three existing test pins now expect the new fields. The reply lookup view that already returned the last check row also shows the new tokens. An exhausted login pool's error gains a reviewCause tag, with its message unchanged.
Undo and recovery: revert this commit. Rows written with the fields still replay, because the older reader ignores them.
Multi-machine posture: rows travel in the conversation journal as before; the classification happens on the machine that made the call, and no new state or machine-local store is added.
Layer below: provider-failure.ts typed classes (limit, policy, timeout, transport, unknown), provider-invocation's copied failure field, the login pool's refusal, callJev's existing jevCause, and journal row replay.
Bug class: unit
Bug evidence: reproducer=tests/preview/reply-review-cause.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt, parser or accept, escalate or refuse decision changes; no code branches on cause. Recorded shapes replayed: jev-admission-2026-10-12 (update 969390426), jev-unavailable-2026-10-11 and the group-audience live fixture's unavailable revision review.
Decision: rrc-1x-comparison | 1.x source JKHeadley/instar main 015fa6cb16add5552cba7e86b7c02a2c083e2579, src/core/MessagingToneGate.ts (DegradeReason, buildDegradedToneResult and its bounded paths list) and docs/specs/tone-gate-graceful-degradation.md; reused the closed reason carried on the result and audited, with finer classes because the 2.0 provider adapter already types them | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-cause-1107-PROGRESS.md
Decision: rrc-jev-cause-already-durable | Jev's cause already reaches the durable row, shown by jev-retry.test.ts and by recorded fixtures carrying cause, so jevCause was left as it is; the real gaps were the subscription, holding and revision rows and the missing counts; Jev gained only a detail for an admission refusal | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-cause-1107-PROGRESS.md
Decision: rrc-detail-is-tokens-not-text | the redacted detail is built from typed fields and error class names rather than a scrubbed message, because the existing floor forbids persisting exception messages and a token cannot carry provider text | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-cause-1107-PROGRESS.md
Decision: rrc-extra-causes | call-cap and interrupted join the brief's example classes, because the holding path and crash recovery read unavailable for those reasons and would otherwise record other | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-cause-1107-PROGRESS.md
Decision: rrc-narrowed-importer-run | the direct-importer run stopped after one full chunk and three timed-out chunks on WSL; 45 files that pin the changed rows and shapes ran instead, and the Studio full gate decides the remainder | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-cause-1107-PROGRESS.md

Verification: tsc clean; the new test failed 15 of 15 before the change and passes after; 45 pinned test files passed apart from one pin since fixed and rerun; architecture check passed. Launcher tests could not reach the review code on WSL, so the status and inspect wiring in journal-agent.mjs has not been run end to end.
Residue: live-cause-reading | medium | the live journal is not reachable from the Mama PC, so no live unavailable row has yet been read with its cause, and why Jev failed on the reported updates remains unknown until new rows exist.
Residue: launcher-status-wiring | medium | the status and inspect lines in journal-agent.mjs are unproven here because launcher tests stop at a host refusal; the Studio gate runs them.

## Closing block

simplestRobustRoute: this is the simplest route: one optional field pair on existing rows, classified from the typed failure callers already hold, with no new row kind, store or retry.
80/20: the shipped result handling is driven through its real source for each failure class; live confirmation comes from the next real unavailable row.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
