# Change review — train-6 final audit merge

Subject base: 72c467f0876b12f62b88b4e3c3c67e2505cf4891
Review state: open
Reviewed content: none
Outcome: Merge audit-forum-1010 at 87bf2d0155975f127d9d477e99a31c98338f0260 into the repaired train-6 with its exact audit source and tests, preserving the Studio prompt repair and its recorded evidence.
Affected rules: 7, 26, 34, 36, 37, 41, 45, 49, 58, 70, 74, 90, 96, 101, 102, 111, 112, 113, 116
Affected floors: secrets — read-only audit retains existing provenance disclosure; spend cap — no paid calls or reservation changes; stop — no dispatch change; no duplicate sends — no send path change or live sends; durable intake — no journal writes, migrations or lost history
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Integration of the existing audit consumer repair; no new prompt, model decision, runtime behavior or authority design.
Side effects: Summary audit follows all-topic producer history only for recorded summary calls. Carried candidates resolve through the authenticated snapshot and reservation-time projection; exact contents and empty replies still bind. Answers remain topic-local. The Studio reply wording and real captures remain byte-identical.
Undo and recovery: Revert the merge through a reviewed ordinary commit and regenerate publication from retained sources. This restores the known audit finding, so it is not a claim of repaired behavior. Preserve journals and UNKNOWN effects; repeat no effect.
Multi-machine posture: Shared source and evidence fixtures travel through git; audit reads existing machine-local authenticated journals. No ownership, transport, replication or peer requirement changes. WSL checks do not claim Darwin confinement evidence.
Layer below: Reviewed audit call-kind propagation, groundingHistory selection, validCarriedMemory, projectMemoryClause with reservation memory count, exact content/reply checks and compact/reopen tests; inspected existing act-first captured prompts, answer parser and reply-review assertions.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only
Convergence: none
Decision: train6-final-merge | Use one ordinary merge, preserve source bytes from both parents, retain the first-parent publication only until one regeneration from committed merged source; conflicts are exclusively generated outputs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-final-PROGRESS.md
Decision: train6-final-verification | Run the changed audit test and direct consumers plus requested briefing, act-first and reply checks under WSL; replay committed real captures and retain the desk's separate live/Darwin evidence without claiming a fresh live run. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-final-PROGRESS.md
Prompt review: No prompt or output decoder changes relative to the Subject base. The committed act-first replay verifies the exact Studio prompts and real tool/reviewer outputs, original incident 969390343, historical malformed output, summary 715672480, uncertain 715672483, Jev undecided 715672482 and unsure 969389570, reply review 969389923, delivered reply 715672479 and empty candidate 715672550. The audit parent's live replay evidence is recorded in audit-forum-1010-PROGRESS.md; it is not represented as a new WSL live-journal run.

Subject (3 paths): tests/preview/journal-audit.d.mts, tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the verified repair, no hand-composed source changes, then one existing register replay from the merged source commit. Start guards are exact parent commits and clean tree; end guards are targeted checks and verified pushed bytes; the existing safety, authority, durability and resource floors remain unchanged. No new mechanism or autonomous runtime-completion claim.
80/20: Targeted WSL verification and publication results are recorded in the final report. The scale soak remains opt-in and is not enabled. No full suite, live provider call, Studio write or deployment is part of this merge.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
