# Change review — recover unregistered work left on disk

Subject base: a1b59d03faad205e33fc33dc6915825abfecb635
Review state: open
Reviewed content: none
Outcome: A complete fresh census with positive owner absence and sustained quiet submits one owned recovery request to existing durable intake. Restart and repeated samples reuse that request; a new activity episode can open new work at the same HEAD. A replacement reads the original checkout and changes. Observation and assignment confer no mutation or send authority.
Affected rules: 2, 4, 8, 9, 26, 34, 36, 42, 46, 49, 55, 57, 60, 61, 62, 63, 68, 74, 83, 95, 101, 102, 107, 111, 113, 116
Affected floors: secrets — only git metadata/status and configured observer evidence; spend cap — no additional model calls; stop — checked before observation and each intake; no duplicate sends — no send path; durable intake — existing Four capture, assignment and deduplication
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: user-facing lost-work recovery, with conservative observation and durable assignment only
Side effects: bounded read-only git queries without optional index locks; one existing intake item per quiet episode; immutable request bytes across renewed samples avoid intake mismatch; unresolved identity is retained by intake as a refusal
Undo and recovery: revert the consumer and observer; existing ordinary intake records remain readable and owned, with no new schema/store to migrate
Multi-machine posture: process and checkout observations are machine-local and must match the configured observing machine. The existing intake facts are shared; identity includes the observed machine. A peer observation never authorizes local checkout mutation or an unfenced worker.
Layer below: scripts/process-inventory.mjs and src/assembly/process-inventory.ts complete/partial/failed contracts; actual git porcelain NUL capture; src/intake/port.ts durably captures before assignment, rejects same-id/different-bytes, and deduplicates after disk reopen. The consumer preserves these behaviors and uses an installed observer route, not a user identity inferred from files.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: Recovery request names the preserved checkout and delegates judgment to the existing worker within its authority. Tools and conversation policy prompts/digests are unchanged. The Part Ten public-module source pin is refreshed to the changed export bytes; no conformance declaration is changed. The real temporary checkout retains and reopens the committed fixture's summary writer (715672480), uncertain summary (715672483), Jev undecided (715672482), Jev unsure (969389570), reply review (969389923), delivered reply (715672479) and empty-context reply (715672550) bytes. Also retains the complete recorded summary-cascade journal, updates 715672479–715672500. The new observation/intake path fires without interpreting those bytes as a promise or completion. No live model or delivery claim is made.
Decision: undated-promise-1015-recovery | Reuse Part Four durable intake and its installed work owner for reconciliation; keep observation timestamps outside the stable episode request so restart deduplicates identical bytes. No second queue, watcher, model call or automatic git effect | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/undated-promise-1015-PROGRESS.md

Subject (11 paths): register-source/owner-references/part-ten.json, reviews/undated-promise-1015-change-review.md, scripts/worktree-inventory.mjs, src/assembly/README.md, src/assembly/index.ts, src/assembly/worktree-inventory.ts, src/assembly/worktree-recovery.ts, tests/assembly/fixtures/worktree-list-2026-10-15.bin, tests/assembly/fixtures/worktree-list-2026-10-15.md, tests/assembly/worktree-inventory.test.ts, tests/assembly/worktree-recovery.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: bounded read-only observation plus the existing durable intake, work owner and normal run-admission. No parallel store or recovery dispatcher. Stable episode identity prevents duplicate recovery on restart; retaining last activity distinguishes new work without using a fresh sampling timestamp. Start guards require complete fresh same-machine snapshots, absent ownership and positive quiet coverage; missing evidence leaves work untouched. Stop inhibits intake. The first delivered capability is preservation and assignment, not autonomous mutation. The caller must supply its authenticated observer and actual activity evidence on its existing cycle; the desk owns the live proof-room recovery/result-delivery acceptance.
80/20: Automated tests cover disk-backed intake replay, deduplication, new episodes, real git state left by an exited builder, exact recorded-byte recovery, live/unknown owners, recent/missing activity, partial enumeration, unknown cwd, foreign machine, stale/slow observations, stop and preserved intake refusal. No independent convergence or unattended delivered-result claim is asserted here.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
