# Change review — train-139 compact cross-topic memory integration

Subject base: b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed cross-topic-memory-1023 head 5fd3d09478884ed33eb8b64558ffc745c39a1225 on the exact live train-136 base. Retain one attributed open promise or latest statement before dropping sibling context under prompt pressure.
Affected rules: 7, 28, 34, 36, 37, 47, 49, 60, 69, 74, 83, 90, 96, 101, 102, 111, 113, 116, 117
Affected floors: secrets — existing admission and redaction; spend cap — unchanged envelope/call caps; stop — unchanged dispatch checks; no duplicate sends — no send/receipt changes; durable intake — journal history preserved
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates reviewed model-facing context rendering; no additional product behavior.
Side effects: One compact packet rung may retain admitted sibling context where full context does not fit; omission remains when even compact context cannot fit. Full packets retain their bytes. No new model call or store.
Undo and recovery: Keep the accepted live build until desk acceptance; existing release rollback restores that build without schema or data migration.
Multi-machine posture: Read-only projection of the existing owner journal; replication and ownership remain unchanged. Disconnected peer knowledge is not asserted.
Layer below: Read member diff and SHA-verified report, audience/receipt admission, existing bounded rendering and current promise projection. Preserve reviewed bytes and run recorded-shape consumer replay. Read the cint-L37 desk-chain report and use its existing regeneration tools.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-sibling-replay.test.ts
Hook bypass: none; core.hooksPath unset and inspected common hooks directory contains only samples
Convergence: none
Decision: train-139-merge-memory | Ordinary merge of exact reviewed 5fd3d09478884ed33eb8b64558ffc745c39a1225; it fast-forwarded. Member report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/cross-topic-memory-1023-PROGRESS.md; downloaded snapshot SHA-256 verified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-139-PROGRESS.md
Decision: train-139-A-preserve | Keep every reviewed member byte; no overlapping edits or product conflicts occurred. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-139-PROGRESS.md
Decision: train-139-B-live-base | Create the branch directly at b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03; preserve ancestry without a main merge or touching train-137. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-139-PROGRESS.md
Decision: train-139-D-host-checks | Use the directed WSL exception for unchanged host-dependent tests and unavailable Studio evidence; disclose all outcomes without altering declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-139-PROGRESS.md
Decision: train-139-desk-replay | Run downloaded repin, build, owner-rehash and register replay tools; adapt only temporary script sed syntax for Linux. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-139-PROGRESS.md
Prompt review: Carry the member model-facing rendering unchanged. Replay recorded twosession updates 715676486/488 and historical writer, uncertain summary, undecided/unsure Jev, reply-review, delivered and empty output shapes from checked-in fixtures. This verifies model input, not a fresh live answer or Telegram receipt.
Prompt finding: 849db3a6296a | protocol-literal | unchanged saved-memory response inherited from the reviewed member.
Prompt finding: e8708c7fea24 | protocol-literal | unchanged source-label guidance inherited from the reviewed member.
Prompt finding: 4106b49fff07 | protocol-literal | unchanged historical no-tools guidance inherited from the reviewed member.

Verification: Local handoff records targeted/direct-consumer tests, pinned tests, context floor, lint, typecheck, architecture, register and review results. Studio-only report destinations are retained. No full suite or live-root operation performed.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merge, existing desk regeneration and consumer checks. The member prevents all-or-nothing sibling-context loss with one rendering rung, without another service. Existing audience/receipt start guards, observable prepared-envelope end state and stop/spend/unique-send/durability limits remain. No fresh unattended live-completion claim.
80/20: Preserve the reviewed change; verify its direct consumers. The desk owns combined-candidate and native-host acceptance.
VERDICT: author submission; no independent verdict claimed
