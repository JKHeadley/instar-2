# Change review — candidate-scoped worktree ownership

Subject base: 711ee018548be2744f216273c20eca94c9eafbcd
Review state: open
Reviewed content: none
Outcome: An owner of another checkout no longer suppresses a quiet abandoned checkout. Ownership is resolved against each candidate independently of process cwd, and unknown or missing joins still exclude that candidate.
Affected rules: 26, 34, 49, 63, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — no new content read or disclosure; spend cap — no model call; stop — existing recovery checks unchanged; no duplicate sends — no send path added; durable intake — existing capture and episode deduplication retained
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repair the review's M1 predicate at the observation boundary, preserving the existing recovery admission and durable intake contract.
Side effects: Observer callers now supply ownership(checkout), returning the independently resolved PID map for that candidate. This is a compile-time API change to an uncomposed library; both existing test callers are updated. Generated register pins are republished from committed sources as required.
Undo and recovery: Revert this repair and regenerate source pins; existing intake records and episode identifiers are unchanged. No migration or destructive operation is introduced.
Multi-machine posture: Deliberately machine-local observations still require matching fresh machine identities. A finding cannot grant ownership or authority on another machine; current ownership must be checked at normal recovery effect admission.
Layer below: ProcessInventorySnapshot complete population and observed cwd requirements, candidate WorktreeObservation absent-owner and quiet-coverage predicates, and Part Four durable intake are unchanged. A process can own a candidate from another cwd, so cwd is not used as a substitute for ownership evidence.
Bug class: unit
Bug evidence: reproducer=tests/assembly/worktree-inventory.test.ts
Hook bypass: none
Convergence: none
Decision: undated-promise-1015-M1 | Resolve the existing ownership join per candidate through a callback instead of deriving ownership from cwd or adding a store. This retains uncertainty for a candidate and prevents unrelated live work from disabling discovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/undated-promise-1015-repair-185857-PROGRESS.md

Subject: src/assembly/worktree-inventory.ts, src/assembly/README.md, tests/assembly/worktree-inventory.test.ts, tests/assembly/worktree-recovery.test.ts, generated register publication

## Closing block

simplestRobustRoute: This is the simplest robust route: move the existing PID ownership check into the candidate predicate and make its candidate scope explicit in the existing observation input. No store, watcher, gate, model, or effect is added. Complete/fresh observations, quiet coverage, absent owner, current effect admission, stop, and durable intake remain the guards. N1 remains desk-owned installed recovery and delivered-result evidence; this submission claims no unattended delivered recovery.
80/20: The two-checkout regression reproduced the inventory-wide veto before repair. Targeted tests prove discovery beside a live owner, exclusion for candidate ownership even from another cwd, and unknown/missing joins. The real git checkout and recorded-shape test now exercises intake beside a dirty active neighbor and verifies both checkouts retain their bytes. Existing stop, stale/partial census, refusal, restart and deduplication tests remain green. Native macOS conformance must be renewed by the Studio under the charter's explicit R105 exception; its declaration is untouched.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
