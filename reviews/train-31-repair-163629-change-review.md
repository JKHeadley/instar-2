# Change review — train-31 live merge repair

Subject base: eb50bebe7b4124b3fec53a0b878d970f46de2f8d
Review state: open
Reviewed content: none
Outcome: Merge live 9d8c16f0 into train-31 with both bounded reply revision and after-send review tests retained.
Affected rules: 26, 34, 36, 37, 49, 70, 74, 90, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — both outbound refusal tests retained; spend cap — exact-cap and interrupted paid-review tests retained; stop — stop-before-send test retained; no duplicate sends — restart and revision one-send tests retained; durable intake — reservation checks retained for original, format-retry and reply-revision operations.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates the existing live host changes; the authored conflict repair changes only the shared test fixture signature and generated evidence.
Side effects: Fixture callers may supply the live build's extra worker ports or the branch's authority, reviewer and clock. Both test families keep their previous defaults. Realpath normalization retains the live macOS temporary-path fix. The merge retains live account/session capability support and post-send review, while keeping train-31's bounded worker revision behavior. Owner pins and register outputs are regenerated from the combined bytes, not chosen from one parent.
Undo and recovery: Revert the merge and its generated-register follow-up as a pair before deployment; no history rewrite, new durable schema, or independent live acceptance is claimed.
Multi-machine posture: Tests inject local physical dependencies and a clock. The merged host keeps existing ownership, authority, spend, stop, durable intake and uniqueness checkpoints across machines. The Studio owns macOS certification and the full gate.
Layer below: Compared both parent fixtures and their shared host model/revision closures; kept durable admission for child operations and both journal replay paths. Checked owner-manifest differences are pins only. Read the full purpose and rule book; the merge adds no restriction on agent ability.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: train-31-repair-163629-fixture | Resolve the shared fixture conflict by retaining both optional interfaces and canonical temporary paths; keep every test from both parents. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-163629-PROGRESS.md
Decision: train-31-repair-163629-generated | Recompute owner pins with the delegated desk scripts and replay the register against the combined commit; preserve both histories. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-163629-PROGRESS.md
Prompt review: No new model prompt or parser logic authored. The merged host changes retain their existing review records. Replay both parents' captured output cases through the combined fixture, including summary uncertainty, Jev uncertainty/undecided, reply review, delivered replies and empty replies.
Prompt finding: 849db3a6296a | quoted-evidence | Existing recorded empty-memory answer appears in an unchanged journal prompt and its consumer test; the merge adds no fixed-phrase judgment.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label disclosure instruction is shared with its consumer test; no new literal-based acceptance rule is introduced.

Register evidence: Generated outputs replay the merged source commit 4dae3b57f08ee325a1e08ec7b48242a1b1af0280. The subsequent commit publishes those outputs and this record.

simplestRobustRoute: A normal merge with one combined test-fixture signature is the simplest robust route. It retains both independently useful test families without another helper, runtime mechanism or capability restriction. Existing durable admission is the start guard, one-send settlement/replay is the end guard, and existing spend and stop checkpoints remain limits. This is offline merge evidence, not an unattended shipped-agent completion claim.
80/20: Resolve the actual collision, run the affected test file and cheap gates, regenerate evidence and hand the full platform gate to the Studio.
VERDICT: author submission; independent review belongs to the desk
