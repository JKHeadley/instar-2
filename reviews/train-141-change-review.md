# Change review — train-141 lost-worker recovery integration

Subject base: b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed work-resume-1023s head 16f9c0e5473780272cae039b9e66509f66b2173c onto the accepted live train-136 base, retaining bounded lost-worker continuation and conservative tool-effect uncertainty.
Affected rules: 4, 26, 29, 30, 34, 36, 37, 46, 49, 55, 57, 60, 61, 63, 68, 69, 70, 74, 75, 83, 90, 96, 101, 102, 105, 111, 113, 114, 115, 116
Affected floors: secrets — existing admission and identity retained; spend cap — cumulative call allowance and original deadline retained; stop — existing replacement guards retained; no duplicate sends — uncertain tools and outward sends prohibit replay; durable intake — saved accepted input and recovery intent retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Release integration of reviewed autonomous worker recovery with no additional product behavior.
Side effects: One eligible confirmed exit can use remaining allowance for one replacement; context and worker recovery share that bound. Unknown effects, tool preparations, children, batched inputs, missing evidence, stop and exhausted allowance preserve uncertainty.
Undo and recovery: Keep the accepted live build until the desk accepts this candidate; use the existing release rollback. No live root, runner, schema or authority was changed.
Multi-machine posture: Existing owner-fenced machine-local worker replacement. Durable work remains under installation custody; no ownership transfer or additional shared state.
Layer below: Read the exact member diff, its review and SHA-256-verified evidence snapshot; inspect host recovery guards and Codex restoration contract. The snapshot records actual interrupted-worker proof, real output/protocol replays and native macOS certificate renewal. Apply the existing cint-L37 desk generation chain.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; live=tests/e2e/conversation-worker-recovery-live.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples
Convergence: none
Skip: tests/e2e/conversation-worker-recovery-live.test.ts:26 | scope=Existing opt-in Studio test-login proof; reviewed member evidence records its successful real run. This remote integration uses recorded-shape replay and does not access serving logins.
Decision: train-141-merge-resume | Ordinary merge fast-forwarded the exact reviewed head 16f9c0e5473780272cae039b9e66509f66b2173c; source evidence is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-resume-1023s-PROGRESS.md, downloaded and SHA-256 verified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-141-PROGRESS.md
Decision: train-141-A-preserve | Preserve the entire reviewed member implementation and renewed declaration without hand edits; no conflicts arose. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-141-PROGRESS.md
Decision: train-141-B-live-base | Retain exact accepted live b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03 in ancestry; no main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-141-PROGRESS.md
Decision: train-141-D-host-checks | Report sandbox-denied physical process identity and unavailable canonical Studio evidence as host limitations; preserve checks and declarations for the Studio gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-141-PROGRESS.md
Decision: train-141-desk-replay | Reuse downloaded desk repin, build, owner rehash and register replay tools; regenerate publication from the exact reviewed head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-141-PROGRESS.md
Prompt review: No new model wording, parsing or classification in this integration. Member tests replay real summary/uncertain, Jev undecided/unsure, reply review, delivered reply and empty reply shapes through replacement, plus captured Codex protocol. No fresh live-provider or Telegram result is claimed.
Prompt finding: 0725f0150c56 | protocol-literal | Existing role/tool-refusal wording is unchanged; fixture checks preservation of role boundaries, not a keyword decision.
Prompt finding: 27d7720e7977 | protocol-literal | Existing memory/work grounding wording is unchanged; fixture checks complete grounding delivery, not a model verdict keyword.
Validation: Targeted direct consumers, requested journal tests, provider subscription, register, context floor, pinned tests and constitutional checks are recorded in the handoff. Canonical report paths remain Studio destinations; downloaded snapshots are read-only evidence. Full candidate gate belongs to the desk.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the one exact reviewed head, standard generation tools and targeted consumer verification. No product machinery is added. Existing admission, owner, stop, spend, durable-input and effect-uniqueness guards remain intact. The member snapshot provides unattended shipped-path evidence; this record claims integration verification only.
80/20: Preserve reviewed behavior and check direct consumers and required gates; the desk owns combined-candidate acceptance.
VERDICT: author submission; no independent verdict claimed
