# Change review — refresh authority-cache source wiring publication

Subject base: 74dd6744ddd8bcbb6bf70b70d45a6049f2fe9a83
Review state: open
Reviewed content: none
Outcome: The generated wiring publication binds the committed authority-cache launcher, so lint and register checking can verify the actual branch source.
Affected rules: 1, 26, 32, 37, 49, 69, 70, 74, 101, 111, 112, 113, 116
Affected floors: secrets — existing disclosure checkpoints unchanged; spend cap — existing reservations and caps unchanged; stop — existing stop checks unchanged; no duplicate sends — no send or receipt changes; durable intake — no intake, journal or durable format changes
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Derived publication metadata only; declarations, capabilities, runtime code and authority policy are unchanged.
Side effects: Seven generated artifacts point to source commit 74dd6744ddd8bcbb6bf70b70d45a6049f2fe9a83 and its new generation. The register's 286 entry base references change with the source commit; declarations are byte-equivalent as parsed objects. This remains a shape-only replay, not runtime authority or deployment.
Undo and recovery: Revert the generated publication commit and this review commit with ordinary git commits. That restores the old publication and its known stale-source failure; regenerate against the desired committed source before landing. No runtime state migration or external effects.
Multi-machine posture: Repository-wide publication consumed consistently on every checkout. No change to the existing process-local operator-record cache, file invalidation, authority ownership or replication.
Layer below: Inspected build-register.mjs committed-source replay, check-register-wiring.mjs source-byte comparisons, delegated manifest rehash and grounding-chain tools. Both repin tools completed without changing files; only the generated publication was stale. Compared the generated register structurally: only its commit and 286 entry base references differ, with every declaration unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only
Convergence: none
Prompt review: No model-facing code, prompt, output parser or judgment routing changed. The original cache repair's recorded-input replay remains documented in authority-cache-1011-PROGRESS.md for updates 715675441/442/443/444.
Deferral: generated/register.json:1 | not-a-deferral=Existing generated declaration text is republished unchanged; this repair introduces no deferred work.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Regenerate the existing publication from the committed source using the delegated tools; this is the simplest robust route and adds no mechanism or runtime restriction. Start guard: committed source and unchanged constitution. End guards: lint, register and review checks against the final commit. Limit guards: existing effect checkpoints and all five floors stay intact. This repair makes no new autonomous-completion claim.
80/20: Typecheck and build passed; foreground nice -n 10 vitest with one worker passed the 10 cache tests and 7 authority tests. All eleven requested contract checkers were invoked; each stopped only because neither the specified gate worktree nor this worktree has .test-results.json. No report was fabricated and no full suite was run. Final cheap-check outcomes and publication evidence are recorded in the lane PROGRESS reports; the pipeline owns fresh full-run evidence and independent landing review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
