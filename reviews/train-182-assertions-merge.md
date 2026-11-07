# Change review — retain accepted train-182 history with the assertion repair

Subject base: 2441b8379b77b47a4851986c0a5fb872abb9a1d3
Review state: open
Reviewed content: none
Outcome: Preserve remote train-182 head 4ad08b28c83afe33ea7271310190d5e5d35148f2 and its accepted Rule 122 merge-live chain alongside the verified assertion repair, then publish the combined source.
Affected rules: 26, 37, 49, 69, 74, 90, 101, 102, 107, 111, 112, 113, 116, 119, 122
Affected floors: secrets — no credential changes; spend cap — no model calls; stop — unchanged; no duplicate sends — no effect dispatch; durable intake — no journal changes.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: An ordinary history-preserving merge and derived publication. The classifier sees constitutional and generated paths; their wording and implementation are inherited byte-for-byte from the accepted remote head, not newly authored here. The source repair has its own review.
Side effects: The stale local starting head d30d47d77 lacked the remote merge-live chain. The normal merge retains both histories, including Rule 122 and its approved changelogs, bootstrap anchor, register builder and register test update. Only seven generated files conflicted; they first retained the remote versions and were then regenerated from the combined commit. The four repaired test files are byte-identical to b80b6741e. No executable source conflict or policy choice was resolved by preference.
Undo and recovery: Revert the repair commits and regenerate from the retained remote chain; do not rewrite or drop the accepted history. No installed state migration.
Multi-machine posture: Git-shared source and derived register. Test orchestration remains local two-process simulation as declared in the source review. No live installation or multi-host acceptance is claimed.
Layer below: Both parents and their existing reviews; exact diff against remote 4ad08b28; purpose and rule book read in full from that head; unchanged repaired tests; canonical delegated rehash (zero additional changes); exact-source register replay.
Bug class: none
Bug evidence: Normal push rejected non-fast-forward. Fetch showed five remote commits from aa8cbc934 through 4ad08b28 missing locally; the merge retains them as ancestors instead of overwriting them.
Hook bypass: none
Convergence: none
Prompt review: No newly authored model-facing change. Constitution and provenance are exactly the already-approved remote bytes; source repair changes only test orchestration and assertion readers.
Deferral: generated/conversion.json:1 | not-a-deferral=Inherited conversion record retained byte-for-byte from accepted remote history; no altered obligation.
Deferral: generated/register.json:1 | not-a-deferral=Mechanical replay of inherited register obligations, not a new deferral.

1.x FIRST: Inherit the source repair's actual JKHeadley/instar main c034523ac3033529c648f807aaaee442850a206e search of src/, docs/specs/ and history, including MissingLoginSessionDetector.ts, hostTestRunnerSemaphore.ts, scrape-fixture-realness.md, test-runner-concurrency-bound.md and ONEX-LESSONS sections 1/4/6. Captured-fixture and bounded-execution discipline fits; the inspected signal/semaphore do not implement the 2.0 assertion reader or publication chain. The exact owning notice repair e7f0d6de is preserved. Ordinary merge and register replay reuse the accepted 2.0 desk chain, with no replacement subsystem.

Decision: train182-retain-remote | Merge the missing accepted remote chain without rebasing or force-pushing; resolve only generated conflicts by exact remote bytes followed by committed-source replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-PROGRESS.md

Rule 119/122 accounting: The inherited constitutional change carries its original counterpart and approval records. This merge changes no constitutional wording relative to remote/main and introduces no paid-service dependency or reduction of ability. Current Rule 122 is binding, not declared implemented by this repair.

Verification: Merged-tree tsc --noEmit and build pass. Delegated scripts report zero further hash/inventory changes. Replay from 0e4b633ae755d013cb33f79b8f70de28d0cee4ac passes: 299 entries, 122 rules, generation sha256:a6aa91663d6cd1ff0997e8aa52050452158b8e75c2bf96389a165e4379585ee6, shape-only. The source repair's 42/42 and red old-term control remain retained; merged-head targeted and final cheap checks are recorded in PROGRESS. Full-suite exact-head verification and independent review remain assigned to the automatic pipeline.

## Closing block

simplestRobustRoute: This is the simplest robust route: preserve both accepted histories with a normal merge and regenerate derived output from committed bytes. Parent ancestry, exact source comparisons, bounded targeted verification and the existing cheap gates guard the start, end state and limits; no new runtime machinery or reduced agent ability.
80/20: Keep the owning repairs and accepted constitution, resolve generated conflicts mechanically, and verify the resulting publication without a full local suite.
VERDICT: author submission; no independent verdict claimed
