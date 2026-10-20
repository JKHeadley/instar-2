# Change review — cancelled acknowledgement accounting in two-machine proof

Subject base: 03ec08f03ede9ce75a686fec50cf24424ab32e9b
Review state: open
Reviewed content: none
Outcome: Keep the two-machine proof strict about physical sends while accounting for durable acknowledgement intents cancelled before dispatch.
Affected rules: 13, 26, 31, 37, 42, 49, 63, 70, 74, 87, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement; this repair changes only tests and their review record.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test accounting repair; no runtime, model prompt, output parser, authority or migration changes.
Side effects: The runner proof now allows only the named acknowledgement-cancelled refusal; it still rejects unknown sends, missing receipts, duplicate physical sends and unrelated refusals. The same invalid reply-count comparison in owner-loss handoff is repaired.
Undo and recovery: Revert this test-only commit through ordinary review. No journal rewrite, resend, migration or installation change is needed.
Multi-machine posture: Verify the existing replicated-intent and physical-send distinction for owner/standby, peer loss and hand-back. No multi-machine behavior or ownership policy changes.
Layer below: Inspected journal held-notice-intent replay (increments replies), dispatch send-outcome recording, sendOutcomeCounts, journal-agent status and send admission around shared.admit, and the physical Telegram fixture. The fixture rejects reactions explicitly and accepts text sends. Acknowledgement cancellation after durable admission preserves the intent and records refusal without a send.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample files only.
Convergence: none
Prompt review: No model-facing prompt, model parser, or model acceptance policy changes; only test assertions and controlled scheduling change.
Decision: train-86-p2-repair-accounting | Compare durable replies to answers plus held-notice intents, accepted outcomes to physical sends, and refused outcomes only to cancelled acknowledgements. Preserve unknown, uniqueness and replication assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-86-p2-repair-192507-PROGRESS.md
Decision: train-86-p2-repair-reproducer | Extend the existing deferred acknowledgement test across pre-admission and post-admission cancellation, using a controlled promise and clock instead of CPU load; exercise real worker/journal accounting and prove another drain cannot resend. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-86-p2-repair-192507-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: repair the test's comparison of different quantities using existing outcome and held-notice status fields. Keep the runtime's cancellation and non-refunding accounting intact. No machinery or timing delays are added to production; controlled test scheduling proves both cancellation boundaries. No autonomous live-completion claim.
80/20: Run the two changed test files, typecheck and required cheap and pinned checks; the Studio owns the full suite and native certificate. No quarantine, broad suite, or second base worktree.
VERDICT: author submission; no independent verdict or live acceptance claim
