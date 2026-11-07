# Change review — train-176

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Integrate exact main ef4a964232b7baf17d8fc4cf1b8a248a95b6d513 and reviewed helper failure fa73a8de6cb062a50d4188d7cbfae26af72dc888 on the accepted live base; preserve both behaviors.
Affected rules: 1, 4, 7, 10, 13, 26, 29, 34, 36, 37, 42, 44, 49, 59, 60, 64, 68, 69, 70, 74, 90, 101, 102, 105, 109, 111, 112, 113, 114, 116, 119, 120
Affected floors: Secrets: only classified failure signals enter the journal; spend cap: existing accounting unchanged; stop: stopped claims refuse; no duplicate sends: settled closes refuse duplicates; durable intake: edges precede launch. Integration adds no external effects.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Helper durable lifecycle, constitutional text and generated publication share the candidate.
Side effects: Helper failures close exact delegated calls; stale open helpers become action-needed without implying death. Constitution pairing checks carry unchanged from main. Publication is regenerated.
Undo and recovery: Keep live base serving until desk acceptance; revert the train if rejected. No live roots, credentials or runners are modified; no resend or state rewrite.
Multi-machine posture: Source publication travels by git. Runtime journal/checkpoint ownership and remote result semantics remain those of the reviewed member. Build evidence is machine-local deliberately; Studio owns live and native macOS checks.
Layer below: Read full constitution, pinned reports and member reviews; inspected actual 1.x main f5fe54444544f83a477dec909f990c848866ed3b HelperWatchdog, SubagentTracker, server wiring, native-hook-events and HONEST-PROGRESS-MESSAGING specs, history 7cfc0ff58/d5b30b1d7, and ONEX-LESSONS sessions/recovery. Five signal classifications reused; existing 2.0 journal/checkpoint/sentinel replace side store, timer and stdin injection. Current 1.x now forwards helper identities, caps stale records and defaults alert injection off; historical member comparison remains pinned to f3f94826. No new implementation invented.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No new model instruction or parser is authored by integration. Preserve the member recorded failure, summary, Jev, review and delivered-reply replay evidence. Constitution context-floor tests verify delivered excerpts and unchanged bounds.
Prompt finding: 0725f0150c56 | protocol-literal | Inherited wording unchanged; protocol instruction, not a keyword meaning gate — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "use them to answer and act within that role; a tool refusal remains a refusal."
Prompt finding: 27d7720e7977 | protocol-literal | Inherited wording unchanged; protocol instruction, not a keyword meaning gate — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "this memory and work record"
Prompt finding: 4106b49fff07 | protocol-literal | Inherited wording unchanged; protocol instruction, not a keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Inherited wording unchanged; protocol instruction, not a keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Inherited wording unchanged; protocol instruction, not a keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Inherited wording unchanged; protocol instruction, not a keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/conversion.json:1 | not-a-deferral=Generated governing text, not a new deferred builder commitment.
Deferral: generated/register.json:1 | not-a-deferral=Generated governing text, not a new deferred builder commitment.

Subject (40 paths): .github/workflows/document-checks.yml, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, docs/implementation/carryover-16-helper-failure-1104.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, legacy-1x/README.md, legacy-1x/src/commands/server.ts.helper-watchdog-excerpt.md, legacy-1x/src/monitoring/HelperWatchdog.ts, legacy-1x/src/monitoring/SubagentTracker.ts, legacy-1x/tests/unit/HelperWatchdog.test.ts, legacy-1x/tests/unit/HelperWatchdog.wireup.test.ts, legacy-1x/tests/unit/subagent-tracker.test.ts, register-source/bootstrap-anchor.json, scripts/build-register.mjs, scripts/check-constitution-pairing.d.mts, scripts/check-constitution-pairing.mjs, src/assembly/README.md, src/assembly/harness.declarations.json, src/assembly/production-conversation-session.ts, src/assembly/production-session-work.ts, tests/assembly/conversation-topics.test.ts, tests/assembly/helper-loss-trace.test.ts, tests/assembly/production-session-work.test.ts, tests/e2e/register.test.ts, tests/preview/admission-gate.mjs, tests/preview/journal.ts, tests/preview/live-sentinels.test.ts, tests/preview/live-sentinels.ts, tests/preview/session-admission.test.ts, tests/preview/tool-admission-hook.mjs, tests/preview/tool-turn.test.ts, tests/register/constitution-pairing.test.ts

Decision: train-176-main | Merge exact main ef4a964232b7baf17d8fc4cf1b8a248a95b6d513; reviewed scope in reviews/constitution-one-constitution-change-review.md and reviews/constitution-person-decides-change-review.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-PROGRESS.md
Decision: train-176-helper | Merge exact fa73a8de6cb062a50d4188d7cbfae26af72dc888; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-16-helper-failure-1104-PROGRESS.md, verified snapshot sha256 ce2c510f9d1edfdf7de12934178816a0a3a265d03cd1a6d7d0b42e66695db328. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-PROGRESS.md
Decision: train-176-A | Preserve main constitution text and both member/live behaviors. Conflicts only in generated publication and derived conversion pin; preserve changelog versions from both sides. Select whole publication temporarily to complete merges, then regenerate all outputs from combined source; no hand-edited generated content. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-PROGRESS.md
Decision: train-176-B | Create separate train-176 directly at exact b5806d1e015dc650cdc1dee2e0accab05a849d4b; preserve ancestry, never move branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-PROGRESS.md
Decision: train-176-C | No genuine product conflict; neither prescribed head left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-PROGRESS.md
Decision: train-176-D | Run targeted foreground WSL checks and disclose host-bound checks for Studio without weakening assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-PROGRESS.md
Decision: train-176-desk | Run repin/build/rehash/replay per /Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L37-PROGRESS.md. Bind derived conversion digest to combined anchor. No certificate declaration edited. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: two ordinary exact-head merges plus the existing repin/build/rehash/replay chain. No new runtime mechanism. The five floors remain enforced. This candidate makes no live acceptance claim; row 16 remains open for the Studio live helper proof.
80/20: Run changed tests and direct imports plus named gates; disclose host-only checks and let the Studio run the full combined suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
