# Change review — train-142 summary frontier integration

Subject base: 42767914df8d0561fd1a5280cc0e7341cc546913
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed w4-rule33-autos head 73527b2a0ba5d5356bfa9f54731aa7c7165ffe6c onto the exact live train-138 base. Summary facts and preferences stay within their source frontier; later memory remains durable.
Affected rules: 7, 26, 33, 34, 36, 37, 49, 70, 74, 90, 96, 101, 102, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing paths. No added model call, effect, store or scheduler.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Integration of reviewed summary packet selection; no integration-authored product behavior.
Side effects: Older summary packets omit future saved facts and preferences. Ordinary answers still honor current-message preferences. All memory remains durable, historical packets retain their original audit results, and no prompt wording or parser changes.
Undo and recovery: Retain the accepted live build until the desk accepts this candidate; use the existing release rollback. No live root, journal schema or runner change is made by this integration.
Multi-machine posture: Existing journal ownership, custody and replication govern preferences; no new local state or cross-machine guarantee. A takeover reads only received durable records.
Layer below: Read the full constitution, exact member diff and hash-verified member and cint-L37 evidence snapshots. Check both summary frontier boundaries, durable memory, current-message preferences and unchanged provenance checks; replay checked-in real outputs. No new access to live journals is required for this mechanical integration.
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-candidate-frontier.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples
Convergence: none
Decision: train-142-merge-frontier | Ordinary merge fast-forwarded to exact reviewed 73527b2a0ba5d5356bfa9f54731aa7c7165ffe6c; member evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule33-autos-PROGRESS.md downloaded with verified snapshot SHA256 and committed as reviews/train-142-member-evidence.txt. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-142-PROGRESS.md
Decision: train-142-A-preserve | Preserve every reviewed member byte; no conflict resolution or product edits required. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-142-PROGRESS.md
Decision: train-142-B-live-base | Retain exact 42767914df8d0561fd1a5280cc0e7341cc546913 ancestry; no main merge, branch move or change to train-137 or train-141. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-142-PROGRESS.md
Decision: train-142-D-host-checks | Apply the declared WSL exception to unchanged host-bound checks; disclose outcomes and inaccessible absolute Studio report paths without changing declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-142-PROGRESS.md
Decision: train-142-desk-replay | Run downloaded repin, TypeScript build, owner rehash and register replay at the reviewed member head; adapt only the temporary script's sed invocation to Linux. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-142-PROGRESS.md
Prompt finding: 4106b49fff07 | protocol-literal | Existing no-tools disclosure is asserted by topic-awareness; it does not classify user intent by a fixed phrase.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording is asserted at its consumer; it is not a semantic intent gate.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-provenance guidance is asserted at its consumer; it is not a fixture-derived classifier.
Prompt review: No integration-authored wording or parser changes. Preserve the reviewed packet selection and replay checked-in real outputs: uncertain summary, Jev unsure/undecided, reply review and empty recorded reply context. Member report documents original encrypted-prefix replay; this integration does not claim to repeat that inaccessible Studio journal replay or fresh live delivery.

Verification: Local handoff records targeted direct-import consumers, journal tests, provider subscription, pinned tests, unchanged context floor, lint, typecheck, architecture, register and review outcomes. Original report references remain Studio paths. The desk owns the native-host and full combined-candidate gates.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the exact reviewed head, existing desk regeneration and targeted consumer verification. No product machinery is added. Start authority, durable intake, completion evidence, stop, spend and send uniqueness remain enforced. Integration verification does not claim fresh unattended live completion.
80/20: Preserve reviewed behavior and verify consumers; leave the full combined-candidate gate to its designated host.
VERDICT: author submission; no independent verdict claimed
