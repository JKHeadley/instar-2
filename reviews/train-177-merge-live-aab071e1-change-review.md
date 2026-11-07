# Change review — train-177 merge live aab071e1 with one probe flush repair

Subject base: 4269b806c1f2e73a23bd41d1ec9bde7711241ef8
Review state: open
Reviewed content: none
Outcome: Merge live aab071e1 into train-177 so both sides' behaviour survives. Both sides fixed the same harness probe tail loss; the launcher keeps live's streamed rows and awaited empty write, and both sides' regressions stay. The register is replayed from the merge commit.
Affected rules: 26, 34, 37, 70, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets — access checks and custody unchanged, no credential read or printed; spend cap — no model call or retry added; stop — the 45-second probe timeout and cancellation unchanged; no duplicate sends — no send or replay path authored; durable intake — no journal or intake path authored
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Accept the suggested merge tier. The only authored choice is one launcher conflict resolution, and the result is byte-identical to live; live's other changes arrive unchanged under their own reviews.
Side effects: Probe rows are written as each path is probed instead of held and written once, so a probe that times out keeps its partial output and the existing bytes= log in probeAccess reports progress rather than 0. A successful probe still exits only after queued stdout completes. Malformed specs still exit 125, and the reader still refuses a short or malformed reply. Generated files are replayed, never hand-pinned.
Undo and recovery: Revert this merge against its first parent and regenerate the register through the same scripts. No installation state is migrated. Readiness installs the launcher by content, so a revert reinstalls the earlier bytes the same way.
Multi-machine posture: Repository change shared identically across hosts. The launcher measures each host's own kernel identity and paths; no peer state, credential or synchronization change.
Layer below: Read base 5a5fdc91, ours and theirs for the conflict; commits 74aef3153 and c45cbd0c4; probeAccess in tests/preview/harness-user.mjs, whose reader and bytes= failure log are unchanged. Listed files changed on both sides since the merge base: only the launcher, its test file and docs/defects/vitest-worker-rpc-timeouts.md, and the last two merged cleanly. The launcher is byte-identical to live at this merge. Node's stream callback ordering was exercised only through the real subprocess tests, on Linux here.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-user.test.ts; other=docs/defects/2026-11-05-harness-probe-drain-minimal.md
Hook bypass: none
Convergence: none
Decision: train177-one-probe-flush | Take live's streamed rows and awaited empty write instead of train-177's single buffered write, because both meet the same requirement, live's is the repair already owned by caaf501e, the launcher becomes byte-identical to live, and streaming keeps partial progress in the timeout log. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-032514-PROGRESS.md
Decision: train177-keep-both-probe-tests | Keep train-177's 20,000-row reply test and live's paused-reader test, because they apply different pressure to the same exit path and both pass on the chosen launcher. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-032514-PROGRESS.md
Decision: train177-1106-generated-replay | Take live's generated files as a temporary merge base and replay them from the merge commit instead of merging by hand; the rehash and chain tools found no pin to change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-032514-PROGRESS.md
Prompt review: No prompt, model-output parser or model accept, escalate or refuse decision is authored. The launcher writes operating-system access results; probeAccess reads them unchanged. So no recorded model shape replay is owed by this repair.
Deferral: docs/defects/rule-36-genuine-parser-captures.md:9 | not-a-deferral=live commit 364d2f2b1 deliberately restored exact main text here (due 2026-10-31, overdue paragraphs dropped), and train-177 only inherited the earlier wording from the merge base; this merge takes live and authors no new postponement or deadline
Deferral: docs/defects/rule-36-genuine-parser-captures.md:10 | not-a-deferral=live commit 364d2f2b1 deliberately restored exact main text here (due 2026-10-31, overdue paragraphs dropped), and train-177 only inherited the earlier wording from the merge base; this merge takes live and authors no new postponement or deadline
Deferral: generated/register.json:1 | not-a-deferral=generated register metadata replayed from committed source, not a new promise

1.x comparison: Checked at JKHeadley/instar main f374e5b9723f0fe317fdb6dee0af4cc6d2c66d6d: src/scheduler/ScriptCanaryRunner.ts:491, in writeStubProber, writes stdout and calls process.exit from the write callback, with latest file history 35b02553b. That is a test stub writer rather than a production path, and it shows the same ordering this launcher uses. Inherited from reviews/train-188-probe-flush-change-review.md at 234fa37563dfb6ec8ba0c8c8e0deb7514b61db34 (source and spec search on stdout flush, truncation and process exit; ONEX-LESSONS sections 2 and 3) and from the train-177 probe repair at fe1b0f41a0b4a5f428c6fa07478ae0aad0c19b23: 1.x has no separate-user access probe. I ran no new broad 1.x search for this merge.

Subject (18 paths): docs/defects/2026-11-05-harness-probe-drain-minimal.md, docs/defects/rule-36-genuine-parser-captures.md, docs/defects/vitest-worker-rpc-timeouts.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, src/assembly/production-codex-provider.declarations.json, tests/e2e/harness-adapters-round7-regression.test.ts, tests/fixtures/codex-model-catalog-2026-11-06.json, tests/preview/harness-launch.mjs, tests/preview/harness-user.test.ts, tests/preview/journal-agent.test.ts, tests/preview/resource-census-recovery.test.ts

## Closing block

simplestRobustRoute: Ordinary merge, take the repair live already owns for this cause, then the existing pin and replay tools. This is the simplest robust route; it adds no mechanism, loosens no access check and narrows no ability. Start guards and bounds stay in probeAccess and harnessReadiness, and success still requires the entire reply. This hand-off makes no unattended live-answer claim.
80/20: Both probe regressions, the launcher file, the live-side test files this merge brings in, typecheck, build, lint and register checks run here. macOS behaviour and the full suite belong to the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
