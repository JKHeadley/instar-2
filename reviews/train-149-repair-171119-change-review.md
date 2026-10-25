# Change review — renew the dark rungraph graduation window

Subject base: 0e9735e74e2ea653f8712306f9797e41beadc7ba
Review state: open
Reviewed content: none
Outcome: Restore current-clock register currency after the dark rungraph-core graduation deadline expired at 2026-10-25 00:00 UTC. Propose a finite renewal through 2026-11-08 00:00 UTC; preserve P5-NF-54, dark status and the production liveProof requirement. The supplied Studio full run passed its assertions and post-test contract checks but failed the final register check. This is not production graduation or a claim that the recurring maturation obligation is complete.
Affected rules: 1, 26, 37, 49, 62, 70, 72, 73, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; no runtime implementation, permission, provider or send path changes
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: one finite declaration deadline and its regression assertions; no runtime code, constitutional text or authority change
Side effects: the existing register check accepts the dark feature during the renewed window and refuses at expiry; all production activation obligations remain outstanding
Undo and recovery: revert the repair and regenerate publication with the existing generator; the old expired deadline then refuses again; preserve history
Multi-machine posture: shared repository metadata and generated publication are identical across machines; local verification grants no runtime authority or deployment approval
Layer below: src/rulegraph/graph.ts checkDeadlines strict greater-than boundary; src/register/declarations.ts liveProof invariant; src/rungraph/registration.ts; scripts/build-register.mjs committed-source publication; reviews/repo-checks-1010-change-review.md prior renewal
Bug class: integration
Bug evidence: reproducer=tests/rungraph/scope.test.ts
Hook bypass: none
Convergence: none
Decision: train-149-renew-dark-window | The previous finite window expired without production liveProof. Renew fourteen days through November 8 UTC, retain strict expiry and dark status, and leave production reassessment with the desk by that date. Do not graduate, disable the deadline, backdate the clock or claim the recurring obligation resolved. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-149-repair-171119-PROGRESS.md

The scope test drives the actual declaration through the real register and deadline consumer at deadline minus one, exactly deadline, and deadline plus one. Existing tests retain refusal of live/soaking without liveProof and unresolved production proof. The historical declaration comparison permits only the named renewal alongside its existing metadata exceptions; all other bytes remain checked. Publication pins are regenerated through the desk tools rather than edited manually.

## Closing block

simplestRobustRoute: use the existing finite declaration gate and register generator, with exact boundary regression evidence and an explicit desk reassessment; this is that route and adds no checker or runtime machinery.
80/20: the declaration/expiry and additivity tests pass (7 assertions, 41 explicitly retained scope skips), as do all 47 fixed-installation contract tests, typecheck, build and architecture. The generated register consumes committed source 057f1169fe32f644ca982467213f4e834aee9df3 in shape-only replay mode. The repair addresses the identified register expiry only; production live proof, independent full-gate acceptance and the inherited review blockers remain outstanding at their original owners.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
