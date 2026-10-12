# Change review — Combine approved train-12 heads and preserve capability instructions within the floor

Subject base: 4b125fec868204430f25023b94d0cf071e0c867d
Review state: open
Reviewed content: none
Outcome: Combine botid-1011, train-11 and capsentence2-1011 on the exact live base; preserve the three capability-answer requirements within the existing context floor.
Affected rules: 35, 36, 37, 47, 49, 58, 69, 70, 74, 78, 84, 90, 101, 102, 103, 104, 111, 112, 113, 116; Purpose self-knowledge and evidence.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combines reviewed model-facing changes; the compact prompt needs captured-shape replay and fixed-floor checks.
Side effects: Only SELF_DESCRIPTION is synthesized under the desk instruction; test expectations adapt historical instructions explicitly without editing captures. Onboarding and memory-fact changes stay intact. Generated publications and owner hashes are refreshed by the existing desk chain.
Undo and recovery: Keep the live build at 4b125fec until desk acceptance; revert the combined build and regenerate publications to recover. No live installation or journal is modified.
Multi-machine posture: Repository-shared prompt and declarations apply identically on every machine. Offline test journals and this builder report are machine-local. No runtime ownership, replication or transport change.
Layer below: Verified exact merge parents and incoming heads; read both constitutional documents from origin/main in full. Inspected rendered capability note, floor and reply-review reserve, recorded replay adapters and existing desk generation tools.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Capsentence2 meaning wins: verbatim tools/outbound paragraph without label or quotes; no free-text limits or missing-status asides; limits quoted verbatim with timestamps. The capability note already supplies authority and abilities. Captured outputs and verdicts remain immutable, including run 24 FAIL. Replay verifies code paths and provenance, not a new live model quality verdict.
Prompt finding: 034c5250da92 | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 849db3a6296a | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 95e349aaf4ac | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: b00ed403060a | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: e8708c7fea24 | quoted-evidence | Existing capability/protocol wording or a negative-control locator is compared as evidence, not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/briefing.ts:218 | not-a-deferral=Preserved captured reasoning or instruction precedence wording, not deferred builder work.
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:14 | not-a-deferral=Preserved captured reasoning or instruction precedence wording, not deferred builder work.
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:113 | not-a-deferral=Preserved captured reasoning or instruction precedence wording, not deferred builder work.
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:114 | not-a-deferral=Preserved captured reasoning or instruction precedence wording, not deferred builder work.
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:166 | not-a-deferral=Preserved captured reasoning or instruction precedence wording, not deferred builder work.
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:486 | not-a-deferral=Preserved captured reasoning or instruction precedence wording, not deferred builder work.
Deferral: tests/preview/selfdesc-abilities.test.ts:41 | not-a-deferral=Preserved captured reasoning or instruction precedence wording, not deferred builder work.

Subject (38 paths): bin/instar2.mjs, docs/standing-trust-setup.md, package-lock.json, package.json, scripts/onboarding-state.mjs, scripts/onboarding.mjs, tests/preview/README.md, tests/preview/briefing.ts, tests/preview/capability-briefing.test.ts, tests/preview/default-context-floor.test.ts, tests/preview/effect-doorway.mjs, tests/preview/fixtures/capsentence-2026-10-11.json, tests/preview/fixtures/capsentence2-2026-10-11.json, tests/preview/group-carry.test.ts, tests/preview/guidance.test.ts, tests/preview/hallucinated-memory-rate.test.ts, tests/preview/journal-boundaries.test.ts, tests/preview/journal-channel-memory.test.ts, tests/preview/journal-commitments.test.ts, tests/preview/journal-cutover-ports.mjs, tests/preview/journal-longchat.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-poll-endpoint.mjs, tests/preview/journal.ts, tests/preview/onboarding.test.ts, tests/preview/promise-fulfilment-quote.test.ts, tests/preview/proofs-launcher.test.ts, tests/preview/recall-latency.test.ts, tests/preview/reply-check.ts, tests/preview/retrospective-live-failures-3.test.ts, tests/preview/selfdesc-abilities.test.ts, tests/preview/selfdesc-limits.test.ts, tests/preview/successive-fixture.ts, tests/preview/successive.test.ts, tests/preview/summary-cascade-stall.test.ts, tests/preview/tool-turn.test.ts, tests/preview/topic-awareness.test.ts, tests/preview/trust-setup.mjs

Publication chain: inventory repin changed zero pins; owner rehash refreshed 15 part-nine pins and one preview pin. Seven generated publications are replayed from the committed merged source.

## Closing block

simplestRobustRoute: This is the simplest robust route: continue the two verified ordinary merges, resolve the one desk-authorized prompt conflict by shortening its wording, and reuse desk generation. No added machinery or budget expansion. Start guards are exact heads and immutable captures; end guards are targeted tests, the unchanged floor and register checks. Existing safety floors remain. No autonomous deployment claim.
80/20: Targeted foreground checks and recorded-shape replays; the desk owns live deployment, independent judgment and the full-suite gate.
Decision: train-12-botid | Retain verified ordinary merge 480a7bae of d54b62be on 4b125fec; fixture bot identity and test-root isolation. Evidence: lanes/botid-1011-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-12b-PROGRESS.md
Decision: train-12-train11 | Retain verified ordinary merge aceeb193 of dd77f572; preserve onboarding and memory-fact behavior and floor repair. Evidence: lanes/train-11-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-12b-PROGRESS.md
Decision: train-12-capsentence2 | Complete the in-progress ordinary merge of 1c010c55; retain its tests and immutable fixture with explicit historical prose adaptation. Evidence: lanes/capsentence2-1011-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-12b-PROGRESS.md
Decision: train-12-desk-resolution | Apply the 2026-10-12 desk decision in lanes/fanout/train-12b-prompt.txt: capsentence2 three requirements win in meaning, compact the instruction without editing the floor guard. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-12b-PROGRESS.md
Decision: train-12-publication | Regenerate owner hashes and publications using the cint-L37 desk chain; never hand-merge generated contents. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-12b-PROGRESS.md
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
