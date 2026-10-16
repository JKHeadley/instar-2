# Change review — train-51 live-build integration repair

Subject base: 401d61dc3ce1a45612afe30dd04384f2c2416457
Review state: open
Reviewed content: none
Outcome: Merge live build 06fd9f05 into train-51 without losing either behavior or history.
Affected rules: 26, 37, 49, 69, 74, 90, 101, 102, 111, 112, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of existing runtime changes; resolution authors documentation only.
Side effects: Combined journal keeps summary-covered recovery and sibling context alongside live owed-delivery and progress behavior. Derived publications require regeneration. Native Darwin certificate needs Studio renewal for combined bytes.
Undo and recovery: Revert this merge through the desk release process; preserve journals and unknown-send evidence. No deployment is performed here.
Multi-machine posture: Shared repository integration; existing custody, ownership and replicated journal behavior is retained. No new local runtime state.
Layer below: Read full origin/main constitution, both merge parents, auto-merged journal hunks, existing review and declaration histories, register generation and owner-pin tools.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train51-live-merge | Preserve both parents in a merge; retain the candidate deadline review verbatim with the incoming review available in parent 06fd9f05, concatenate the independent assembly documentation sections, and retain the candidate native certificate pending Studio renewal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-51-repair-024012-PROGRESS.md
Prompt review: No authored prompt or parser change. Retain both parents and replay recorded-case regression tests for combined journal behavior. Protocol strings remain instructions under test, never user-intent classifiers.
Prompt finding: 034c5250da92 | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 4106b49fff07 | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 450c79237a95 | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase src/assembly/production-provider.ts <- tests/preview/journal-people.test.ts: "if two active memory items match the question but disagree, or refer to differen"
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 849db3a6296a | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 95e349aaf4ac | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: b00ed403060a | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: e8708c7fea24 | protocol-literal | Existing parent protocol asserted by regression tests; no fixture-specific intent gate is introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/README.md:32 | not-a-deferral=Imported regression evidence or documented existing behavior, not postponed implementation.
Deferral: tests/preview/fixtures/work-recovery-2026-10-15.json:5 | not-a-deferral=Imported regression evidence or documented existing behavior, not postponed implementation.
Deferral: tests/preview/fixtures/work-recovery-2026-10-15.json:231 | not-a-deferral=Imported regression evidence or documented existing behavior, not postponed implementation.
Deferral: tests/preview/fixtures/work-recovery-2026-10-15.json:275 | not-a-deferral=Imported regression evidence or documented existing behavior, not postponed implementation.
Deferral: tests/preview/journal.ts:2578 | not-a-deferral=Imported regression evidence or documented existing behavior, not postponed implementation.
Deferral: tests/preview/owed-delivery.test.ts:181 | not-a-deferral=Imported regression evidence or documented existing behavior, not postponed implementation.

Subject (42 paths): .gitignore, docs/18-sentinel-holders.changelog.json, register-source/owner-references/preview.json, src/assembly/README.md, src/assembly/production-conversation-session.ts, src/assembly/production-session-driver.ts, src/assembly/production-session-work.ts, tests/assembly/production-conversation-session.test.ts, tests/assembly/production-session-driver.test.ts, tests/assembly/production-session-work.test.ts, tests/preview/README.md, tests/preview/agent-commitment.ts, tests/preview/fixtures/work-recovery-2026-10-15.json, tests/preview/fixtures/work-silence-terminal-2026-10-14.json, tests/preview/journal-agent.mjs, tests/preview/journal-long-gap.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-people.test.ts, tests/preview/journal.ts, tests/preview/live-declarations.test.ts, tests/preview/live-sentinels-launch.test.ts, tests/preview/live-sentinels.test.ts, tests/preview/live-sentinels.ts, tests/preview/memory-sentinel.test.ts, tests/preview/obligations.ts, tests/preview/owed-delivery.test.ts, tests/preview/recall-latency.test.ts, tests/preview/retrospective-compact-answer.test.ts, tests/preview/retrospective-first-pass-fit.test.ts, tests/preview/retrospective-over-cap.test.ts, tests/preview/retrospective-promises.test.ts, tests/preview/retrospective-snapshot-continuation.test.ts, tests/preview/retrospective.test.ts, tests/preview/retrospective.ts, tests/preview/selfdesc-abilities.test.ts, tests/preview/selfdesc-limits.test.ts, tests/preview/sentinel-record.ts, tests/preview/topic-awareness.test.ts, tests/preview/working-activity.mjs, tests/preview/working-activity.test.ts, tests/preview/working-progress.test.ts, tests/preview/working-progress.ts

Publication: Replayed generated register from merge 91151b21d834744b83198e945ae8bb87b6569a20. Both desk pin tools reported zero stale pins. Candidate native conformance declaration is retained without alteration; R105 byte mismatch requires Studio contract renewal.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge exact parents, retain both assembly documentation sections and existing review history, regenerate derived pins through existing tools. No new mechanism. Exact parents guard entry, targeted regression and cheap checks guard integration; safety floors remain unchanged. No unattended live completion is claimed.
80/20: Targeted combined-path regression tests plus typecheck and cheap checks. Studio owns full suite and native macOS conformance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
