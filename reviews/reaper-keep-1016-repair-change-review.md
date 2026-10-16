# Change review — Repair idle cleanup capacity and refusal decisions

Subject base: 0dbf5946e696124faa898777e2f5ec0c32af463c
Review state: open
Reviewed content: none
Outcome: Queued topics drain under simultaneous idle expiry and slot/resource pressure; retained failures do not pin replacement workers; explained action-time refusals remain refusals through the adapter.
Affected rules: Rules 5, 7, 26, 34, 36, 37, 42, 46, 49, 60, 63, 68, 70, 74, 75, 76, 95, 96, 97, 101, 105, 107, 111, 113, 116.
Affected floors: secrets — no raw capture or credential is added to closure evidence; spend cap — no new model call or allowance reset; stop — explicit stop and lifetime bounds remain independent; no duplicate sends — no resend or dispatch path added; durable intake — every historical input, outcome and queued request remains intact.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: Repairs the automatic worker retirement decision at the capacity and physical control boundaries.
Side effects: A queued worker awaiting admission suppresses ordinary expiry while its slot/resource request drives pressure assessment. All unsettled inputs still veto cleanup; only settled deliveries matching the current claim and incarnation must be complete. The typed pre-actuation refusal is returned before any stop actuation, while unreadable evidence and post-kill errors still throw through the adapter and preserve holder inhibition. The ordinary stop overload retains its existing result type. No new state, service, timer or capability restriction. Delegated desk scripts refresh the prior unit contracts.ts grounding pin and its checker digest; register replay refreshes generated artifacts from commit 237b79ddf6ca700a21c6ee4bb229454b4155e4c9.
Undo and recovery: Revert the repair commits through the normal update path without deleting custody or replaying uncertain effects. Existing durable inhibition still requires exact process/resource reconciliation. No conformance certificate is rewritten to hide the changed composition.
Multi-machine posture: Machine-local process observations and fingerprints remain under the existing conversation ownership fence. Durable custody and outcome history keep their current owner and replication behavior; no peer authority or new store.
Layer below: Inspected queue admission and retry, current delivery claim/incarnation and retained outcomes, admission open-child veto, physical stop lock/identity/fingerprint checks, boundary take error propagation, resource release and durable pool inhibition. Tested the real adapter around the physical driver, including identical error wording for known refusal versus uncertain failure.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; core.hooksPath is unset and the git common hooks directory contains only sample hooks (checked before commit).
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt or model semantic judgment changes. Recorded summary output (summary:715672480), uncertain summary (715672483), Jev undecided (715672482) and unsure (969389570), reply-review (969389923), delivered reply (715672479), and empty candidate (715672550) replay through holder cleanup from retrospective-duty-followup-train-1-2026-10-08.json. The recorded native idle pane update 840342692 drives the adapter action-time race. Output text does not establish idle authority; the empty outcome and current incomplete delivery still veto retirement.

Subject (18 paths): src/assembly/README.md, src/assembly/conversation-harness-adapter.ts, src/assembly/conversation-topics.ts, src/assembly/production-conversation-session.ts, src/assembly/production-session-driver.ts, src/assembly/production-session-work.ts, tests/assembly/conversation-topics.test.ts, tests/assembly/production-conversation-session.test.ts, tests/assembly/production-session-driver.test.ts, scripts/check-assembly-contracts.mjs, tests/assembly/production-grounding-inventory.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: make existing coordinator reason selection consistent, select current-admission deliveries from existing custody, and carry a typed pre-actuation refusal through the existing driver/adapter boundary. These directly repair confirmation resets, historical capacity pinning and false durable inhibition. No new reaper, retry loop, store or service. Start guards remain current authority, settled custody, child completion and stable idle evidence; end guards remain fresh fingerprint, exact stop and confirmed lease release. Confirmation/grace and stop/spend/lifetime floors remain. Full unattended live acceptance is the desk combined-build stage, not claimed here.
80/20: The three touched focused test files pass all 216 cases; typecheck and build pass. Cheap gates run on the final committed head. No full suite or real-load test. Native byte-bound macOS conformance is left to the desk contract run under the standing charter exception, with its red finding recorded explicitly.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
