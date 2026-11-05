# Change review — train-177 main merge conflict repair

Subject base: d5eb8d152b645fbcb48661c49464852bc13bc376
Review state: open
Reviewed content: none
Outcome: Merge approved main c20b68d1d9b5744a72c243c4dc8a4b69114179d6 into train-177, retaining the train's runtime shape and reaper carryover, main's Rule 121 and all existing changelog entries. Derive the conflicting replay pin from the combined anchor and regenerate the register from committed source.
Affected rules: 26, 37, 49, 74, 90, 91, 101, 111, 112, 113, 116, 119. Main's approved Rule 121 is incorporated verbatim; this repair changes no constitutional obligation.
Affected floors: secrets — custody unchanged; spend cap — accounting unchanged; stop — cancellation unchanged; no duplicate sends — effect dispatch unchanged; durable intake — admission and journal unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration includes the approved constitutional amendment and its register evidence, although the conflict resolution itself is a derived artifact.
Side effects: The register gains Rule 121 and its coverage row while preserving train-177's 298-entry runtime shape. Product source and model-facing briefing remain byte-identical to the repair base. The count assertion comes unchanged from main. No new execution or refusal path.
Undo and recovery: Reject this candidate and retain the serving build, or revert the repair commits together; do not split the combined anchor, derived pin and generated register. No live installation is changed.
Multi-machine posture: Git distributes the combined source and generated artifacts. No new machine-local runtime state or cross-machine authority; the inherited reaper census remains deliberately machine-local.
Layer below: The full purpose and rule book from main; both parent anchors and their shape/document hashes; canonical encoding in src/decode/canonical.ts; committed-source replay in scripts/build-register.mjs and scripts/register-source.mjs; changelog entry preservation; the existing owner-reference and inventory repin scripts; register lifecycle and constitutional briefing consumers.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No prompt, model-output parser or accept/escalate/refuse logic changed. Rule 121 is outside existing briefing excerpts. Run the four mandated constitutional consumer files and the changed register lifecycle test; there is no new model path for recorded-shape replay.
Deferral: generated/conversion.json:1 | not-a-deferral=generated conversion repeats existing constitutional declarations and coverage gaps without introducing a postponement
Deferral: generated/register.json:1 | not-a-deferral=generated register repeats existing declarations without introducing a postponement

1.x comparison: Inherited original train comparison at JKHeadley/instar main cc11e45f92e2590dd1bbd3c3facb5b849532f0fc; rechecked actual origin/main ab256f684cda141db19abe8bba5300b980e1025b, src/monitoring/AgentWorktreeReaper.ts, src/monitoring/agentWorktreeGit.ts, docs/specs/agent-worktree-reaper.md and history ff8344b4b / 6fb1db837. Preserve bounded passes, KEEP on ambiguous evidence, ignored-file protection and non-forced removal unchanged. Searched main src/, docs/specs/ and their git history for approvedConversion, conversion pin and build-register: no matching 1.x mechanism in the inspected scope; the derived conversion pin is 2.0-specific. Read ONEX-LESSONS.md section 6, including untracked blindspot and squash-merge blindness: use actual merge evidence and preserve unique bytes. No new 1.x implementation is needed for this artifact-only repair.

Review-state repair: The first complete change-review check found exactly one Rule 109 failure: the original reviews/train-177-change-review.md was frozen to the pre-merge subject. Reopened it using the supported checker command, voiding that stale round while preserving its record. This submission requires fresh independent review of the merged content.

Verification: npm run build and npm run typecheck; targeted register lifecycle and four constitutional consumer files; npm run lint, npm run register:check, node scripts/check-change-review.mjs check, and diff whitespace checks. Exact outcomes are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-PROGRESS.md. Full-suite execution remains with the Studio pipeline as directed; no fabricated full-run report.

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge, the existing canonical hash function and committed-source register replay. No new machinery. Start guard is the assigned candidate and fetched main, completion guards are targeted tests plus cheap gates and pushed clean head, and limits are no live writes or full suite on Studio. No autonomous runtime capability completion is claimed.
80/20: Resolve the one real conflict at its derived source, preserve both histories and test the consumers; independent desk review decides acceptance.
VERDICT: author submission; this record asserts no independent verdict.
