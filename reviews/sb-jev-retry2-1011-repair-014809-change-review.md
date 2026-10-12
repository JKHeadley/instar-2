# Change review — Merge live acknowledgements into bounded Jev retries

Subject base: 518634f225d1732a2a8a7d5fceedf1ba95c115af
Review state: open
Reviewed content: none
Outcome: Merge origin/holdack2-1011 (4b125fec) into the bounded Jev retry branch with both histories preserved. Keep live acknowledgement admission and durable send behavior, the compact source excerpts, and the recorded self-description replay.
Affected rules: Purpose least revelation and durable cause; Rules 1, 26, 34, 36, 37, 49, 55, 60, 63, 74, 77, 87, 90, 95, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — retain outbound and disclosure checks; spend cap — retain reservations and UNKNOWN accounting; stop — retain admission and latched stop; no duplicate sends — acknowledgement durable intents and final-send ordering; durable intake — existing journal retains each accepted turn.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition touches the shipped reply review and acknowledgement paths; tests establish merge behavior, not production acceptance.
Side effects: Acknowledgements share existing provider and reply ceilings. The merged operation tag keeps acknowledgement review separate from ordinary and revision review; Jev retry limits and disclosure deadlines remain unchanged.
Undo and recovery: Forward-fix failed composition; preserve both parent histories and journals. Any rollback must retain readers for retry reservations and acknowledgement intents; never replay UNKNOWN sends.
Multi-machine posture: Existing conversation ownership and authority checks still gate effects. No new state or peer protocol. Timers remain local; durable journal and replication semantics are inherited.
Layer below: Inspected worker acknowledgement reservation, outbound check, stop and final-send ordering; launcher operation classification and retry interfaces; compact constitutional excerpt pins and captured self-description fixture transformations.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement.test.ts
Hook bypass: none
Convergence: none
Decision: jev-repair-merge | Preserve both histories with an ordinary merge; keep compact excerpts and the stronger acknowledgement assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-014809-PROGRESS.md
Decision: jev-repair-capture | Combine captured capability-note normalization with the live self-description paragraph normalization; preserve fixture bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-014809-PROGRESS.md
Decision: jev-repair-publication | Regenerate owner pins and publication with delegated desk scripts, adapting only BSD sed syntax to Linux. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-014809-PROGRESS.md
Decision: jev-repair-evidence | Run targeted and pinned tests locally; saved Studio result download returned HTTP 404, so report missing old evidence honestly and leave full-suite verification to the gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-014809-PROGRESS.md
Prompt review: Preserve compact constitutional excerpts from the Jev branch and compact self-description wording from the live branch. Combine both transformations on authentic recorded update 840342287 without rewriting captured bytes. Replay acknowledgement and existing Jev/summary/reply shapes through targeted tests.
Prompt finding: 034c5250da92 | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 849db3a6296a | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 95e349aaf4ac | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: b00ed403060a | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: bd01de21286a | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing capability, authority or source-citation wording asserted by regression tests; not a new semantic keyword gate — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Subject (24 paths): docs/defects/stale-main-baseline-additivity.md, register-source/owner-references/preview.json, tests/preview/briefing.ts, tests/preview/call-diagnostics.mjs, tests/preview/call-diagnostics.test.ts, tests/preview/capability-briefing.test.ts, tests/preview/default-context-floor.test.ts, tests/preview/fixtures/reply-acknowledgement-live-2026-10-11.json, tests/preview/group-audience-cache.test.ts, tests/preview/jev-stage-latency.test.ts, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-boundaries.test.ts, tests/preview/journal-conversations.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-packet-pressure-value.test.ts, tests/preview/journal-summary-crash.test.ts, tests/preview/journal.test.ts, tests/preview/journal.ts, tests/preview/reply-acknowledgement.test.ts, tests/preview/reply-check.ts, tests/preview/selfdesc-abilities.test.ts, tests/preview/send-stage-replay.test.ts, tests/preview/two-machine-floors.test.ts

Verification: Typecheck, build and architecture check pass. Targeted replay and final publication checks are recorded in the local repair report; no full-suite or live acceptance is asserted.

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge with narrow conflict resolution and the existing delegated publication tools. No new runtime machinery. Existing admission, secret, stop, spend and durable-intent guards remain the start and limit guards; reviewed verdict and recorded send outcome remain end guards. Offline replay is not a claim of unattended live acceptance.
80/20: Check the changed tests, recorded shapes, context floors and cheap gate checks; the Studio pipeline owns full-suite and macOS verification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
