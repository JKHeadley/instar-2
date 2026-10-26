# Change review — train-162 journal evidence retention integration

Subject base: fcc49ab27f44ff45831a7797e4849a277b7d48c3
Review state: open
Reviewed content: none
Outcome: Integrate the reviewed phase timing retention head and its journal-growth base into the exact live build, preserving unique evidence and avoiding aggregate snapshot strings.
Affected rules: Purpose Rules 2 and 3; Rules 7, 9, 13, 26, 32, 33, 34, 37, 41, 49, 58, 60, 70, 74, 75, 90, 101, 102, 111, 112, 113 and 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement paths and causal evidence. Diagnostic retention grants no authority.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of a reviewed encrypted journal durability repair, retaining authenticated frames, pending evidence, projection verification and atomic replacement.
Side effects: Unique historical phase timing evidence survives compaction. Only exact repeated idle audience observations are summarized, with first observation, count/time range and recent 100 samples per verdict run. Journal-growth also suppresses redundant diagnostic writes, retains sentinel changes/events and streams snapshot JSON in bounded chunks. Total retained history still consumes memory and disk. No model prompt or output acceptance change.
Undo and recovery: Keep the current journal and subsequent intake/effect receipts. Do not restore an old backup over active state or roll back to blanket phase-timing deletion. Preserve the bounded snapshot reader and evidence-retaining policy. Leave the live build in place until the desk accepts the combined candidate.
Multi-machine posture: Existing encrypted version-1 snapshot replication remains portable. Sampling caches are worker-local diagnostic state, never authority. Counts describe one journal, not distributed totals; no new ownership or durability requirements.
Layer below: Read full constitution and hash-verified member/desk reports; inspected snapshot chunk encode/decode/hash, retainedEvidence, timing classification, sentinel retention and audience observer changes. Preserve the member's crash/reopen and backup-copy evidence without claiming to repeat its unavailable live-root proof on WSL.
1.x comparison: Member inspected JsonlStore and jsonl-rotation; preserve its bounded diagnostics versus causal archive distinction through existing 2.0 snapshot machinery, without transplanting plaintext deletion or adding an archive engine.
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-compaction.test.ts; restart=tests/preview/journal-compaction.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples.
Convergence: none
Prompt review: No prompt, parse or model accept/escalate/refuse changes. Snapshot encoding preserves model records as data; existing captured-shape consumer tests remain applicable. No new live-model evidence claimed.
Decision: train-162-merge | Ordinary merge of exact reviewed 7d9914c30a0a76b7d21ecfb173fa8c21ae72540e; fast-forward, no conflicts. Cites /Users/dabombstudio/.instar/agents/echo/.instar/lanes/phase-timing-retain-1026-PROGRESS.md, read from the supplied SHA-verified snapshot. Its journal-growth ancestor is included deliberately. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-162-PROGRESS.md
Decision: train-162-A | Preserve all reviewed member and accepted live behavior through the conflict-free merge. No changelog versions removed; generated publication is regenerated. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-162-PROGRESS.md
Decision: train-162-B | Create a separate branch directly at exact live fcc49ab27f44ff45831a7797e4849a277b7d48c3; no main merge, branch movement or newer unreviewed head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-162-PROGRESS.md
Decision: train-162-C | No genuine product conflict; include the sole requested head and leave out none. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-162-PROGRESS.md
Decision: train-162-D | Run targeted foreground checks with nice 10 and one worker on WSL; disclose host-dependent exclusions and unchanged host failures for the Studio gate, without weakening tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-162-PROGRESS.md
Decision: train-162-desk | Use the supplied cint-L37 repin/build/rehash/replay chain with only Linux sed syntax adaptation. No inventory or owner pin changes needed. Regenerate publication from the exact merged head, preserving the context guard. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-162-PROGRESS.md
Prompt finding: 4106b49fff07 | protocol-literal | Existing source-bound action-claim instruction, unchanged from the supplied base. The test asserts the protocol and does not supply a desired verdict.
Prompt finding: 85544c20941f | protocol-literal | Existing fixed queued-message notice, unchanged from the supplied base; its test checks the actual notice, not a semantic trigger.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel attribution instruction, unchanged from the supplied base; no prompt or fixture was copied or changed.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory display literal, unchanged from the supplied base; no semantic classifier is introduced.

Validation: Run member changed tests, direct import consumers, journal tests, provider subscription and context floor; typecheck, architecture, lint, register and change-review checks; final pushed-head pinned tests. Report actual results and host exceptions in the handoff.
simplestRobustRoute: This is the simplest robust route: one exact reviewed merge and existing desk regeneration, with no train-only runtime machinery. Pinned base/member guard the start; evidence-preserving compaction and full projection/pending-state checks guard replacement; existing secret, spend, stop and effect uniqueness owners remain intact. No unattended deployment or live acceptance claim.
80/20: Bounded affected checks then independent Studio gate; no full-suite duplication or new retention design.
VERDICT: author submission; independent desk acceptance pending
