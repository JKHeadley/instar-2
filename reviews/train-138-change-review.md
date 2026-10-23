# Change review — train-138 durable correction integration

Subject base: b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed correction-sticks-1023c head 316cb5f2cffedc441dc4d7e3055678d82927512c onto the exact live train-136 base. Preserve one durable preference for an identical same-turn reply correction across session restarts.
Affected rules: 1, 10, 12, 28, 29, 32, 33, 34, 36, 37, 47, 49, 57, 74, 85, 90, 93, 96, 101, 102, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing paths. No added model call, effect, store or scheduler.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Integration of reviewed guidance and exact state coalescing; no additional product behavior.
Side effects: Identical valid same-turn prefer/directive clauses retain one preference; distinct clauses, explicit supersession and invalid preference provenance keep directive handling. Existing journals are not rewritten. Guidance stays inside the unchanged context guard.
Undo and recovery: Retain the accepted live build until the desk accepts this candidate; use the existing release rollback. No live root, journal schema or runner change is made by this integration.
Multi-machine posture: Existing journal ownership, custody and replication govern preferences; no new local state or cross-machine guarantee. A takeover reads only received durable records.
Layer below: Read the constitution, exact member diff, source validation and obligation admission, recorded-shape fixture and member evidence snapshot; preserve existing audience, memory and send custody. Apply the cint-L37 generation chain.
Bug class: integration
Bug evidence: reproducer=tests/preview/correction-sticks.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples
Convergence: none
Decision: train-138-merge-correction | Ordinary merge fast-forwarded to exact reviewed 316cb5f2cffedc441dc4d7e3055678d82927512c; member evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-sticks-1023c-PROGRESS.md downloaded with verified snapshot SHA256. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-138-PROGRESS.md
Decision: train-138-A-preserve | Preserve every reviewed member byte; no conflict resolution or product edits required. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-138-PROGRESS.md
Decision: train-138-B-live-base | Retain exact b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03 ancestry; no main merge, branch move or change to train-137. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-138-PROGRESS.md
Decision: train-138-D-host-checks | Apply the declared WSL exception to unchanged host-bound checks; disclose outcomes and inaccessible absolute Studio report paths without changing declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-138-PROGRESS.md
Decision: train-138-desk-replay | Run downloaded repin, TypeScript build, owner rehash and register replay at the reviewed member head; adapt only the temporary script's sed invocation to Linux. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-138-PROGRESS.md
Prompt finding: 4106b49fff07 | protocol-literal | Existing no-tools disclosure is asserted by topic-awareness; it does not classify user intent by a fixed phrase.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording is asserted at its consumer; it is not a semantic intent gate.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-provenance guidance is asserted at its consumer; it is not a fixture-derived classifier.
Prompt review: No integration-authored wording or parser changes. Preserve the reviewed member guidance and replay checked-in real outputs through its consumers, including uncertain summary, Jev unsure/undecided, reply-review and empty replies. No fresh live-provider or Telegram completion is claimed.

Verification: Local handoff records targeted direct-import consumers, journal tests, provider subscription, pinned tests, unchanged context floor, lint, typecheck, architecture, register and review outcomes. Original report references remain Studio paths. The desk owns the native-host and full combined-candidate gates.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the exact reviewed head, existing desk regeneration and targeted consumer verification. No product machinery is added. Start authority, durable intake, completion evidence, stop, spend and send uniqueness remain enforced. Integration verification does not claim fresh unattended live completion.
80/20: Preserve reviewed behavior and verify consumers; leave the full combined-candidate gate to its designated host.
VERDICT: author submission; no independent verdict claimed
