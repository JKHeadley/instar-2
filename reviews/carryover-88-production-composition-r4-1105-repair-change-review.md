# Change review — Repair optional delegation origins and recursive cancellation

Subject base: aa4f3f8f41e05279d223045579dbe95ce9c1701e
Review state: open
Reviewed content: none
Outcome: Restore admitted work outside the configured forum, replay nested origins after an operator moves the parent, and forward owned descendant cancellations during normal due collection.
Affected rules: 4, 26, 28, 29, 31, 32, 37, 49, 63, 69, 70, 74, 101, 102, 103, 105, 111, 113, 114, 115, 116
Affected floors: secrets — existing custody unchanged; spend cap — canonical Six accounting unchanged; stop — current admission and execution guards retained; no duplicate sends — retained cancel identity switches retries to lookup; durable intake — original signed facts and ledger cancellation retained
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Local repair of three demonstrated production-composition failures, without new authority, protocol or store; targeted independent review remains required.
Side effects: Optional topic projection no longer refuses unrelated admitted causes. Maintenance can emit previously stranded descendant cancellation frames, through the same current-owner fence and existing bounded cadence.
Undo and recovery: Revert this repair to restore prior code. No schema or state migration. Keep cancellation requests and their exact message identity; uncertainty is not completion or permission to resubmit.
Multi-machine posture: Ledger ownership and current Six fencing still decide who can submit a cancellation. Recovered due collection consumes retained descendant requests; sent requests use lookup, and unresolved remote work stays owned. Tests use isolated self-addressed transport, not independent physical peers.
Layer below: Read actual origin/main constitution c20b68d1d9b5744a72c243c4dc8a4b69114179d6 (121 rules) and reconciled design rows C1:25/71/111/112/117/142/180/183/184, C2:108/119/125. Inspected Four intake-admitted facts, journal origin/binding projection, Five ledger recursive cancel/identity rules, Six admitWrite fence, Threadline endpoint and transport lookup.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-delegation.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt, parser, model routing or output acceptance change. The existing seven captured summary/Jev/review/reply shapes are replayed through the production provider branch as part of the touched test file.

Subject (7 paths): scripts/check-assembly-contracts.mjs, src/assembly/harness.declarations.json, src/assembly/production-delegation.ts, tests/assembly/production-delegation.test.ts, tests/assembly/production-grounding-inventory.json, tests/preview/production-collaboration.test.ts, tests/preview/production-collaboration.ts

1.x comparison: inspected actual JKHeadley/instar origin/main f0e7fb0b5730d05a62c54906a364ea6e9243fe9e, src/threadline/TopicLinkageHandler.ts:294-345, src/threadline/hubCommands.ts, src/threadline cancellation search, docs/specs/THREADLINE-NOTIFICATION-ROUTING-SPEC.md H3, THREADLINE-COLLABORATION-SURFACING-SPEC.md, OPENCLAW-IMPORT-TASKFLOW-SPEC.md cancellation and git history (7e8fde8e8, 5a5c9bb5a, b404d4218, a0e7679df, 35cc84664). Reuse absent-topic job passthrough and first-write provenance with explicit operator binding; retain existing 2.0 durable recursive cancellation and fenced dispatcher, not the 1.x advisory TaskFlow mechanism. ONEX-LESSONS sections 3 and 6 read: ambiguity is not proof of non-send, retained queues require a drainer, test production assembly and observable effects. Inherits the original unit’s copied classifier/brief comparison; no model text or parsing change planned.

Decision: repair-origin | Omit optional projection outside the configured forum; replay nested origins by retained exact source/digest independently of current parent binding. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-repair-PROGRESS.md
Decision: repair-cancel | Consume retained pending owned cancellations through the existing fenced port during due collection; reuse message identity and lookup after submission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-repair-PROGRESS.md

Native conformance: before 9/10 (only stale certificate), after 10/10, exit 0; complete 282-file composition sha256:669f9db8f89dd4115a528a788f5912d73439469e768c3ae95ae39cdb1fe3bbb4. Inherit the branch's Studio renewal assignment and comparison (original PROGRESS:474-486): actual 1.x f94fb584bf7cfdfe0bcb5ff4526e88af512d145d src/, docs/specs/ and history had no equivalent composition-certificate implementation; use existing 2.0 composition-digest and guarded lanes/pipeline/merge-live-conformance.mjs --renew, requiring the ten-case contract before/after on the exact runtime. Never rewrite a declaration without this measured evidence. Generated owner references and register publication use the delegated desk scripts, with no changed authority or support state.

Decision: repair-native-renewal | This is the Studio; use inherited guarded contract renewal for the changed composition, then derive owner pins and register from exact bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-repair-PROGRESS.md

Verification: reviewer probes reproduced both origin exceptions and automatic descendant frame count 0 before repair. Both reviewer projection probes now pass; all 25 cases in the two touched files pass, including repeated cancellation identity and lost-fence refusal. Final typecheck and build pass. Exact receipts are recorded in the desk repair PROGRESS. Scope is source composition; no release acceptance, live remote peer, TLS or owner-machine-loss proof is claimed. The inherited 44 unresolved/101 unfinished files and five r3 failures are not cleared by this repair.

Publication: delegated desk rehash found no changed owner artifact pins; desk-repin-chain refreshed twelve existing branch-changed support sources in production-grounding-inventory.json and derived its check-assembly-contracts.mjs digest. No pin was hand-edited. Normal replay from committed source bd654ae8fa23e41ac37ced61690243fdafc7d179 produced generation sha256:fe78875d0992b1f395c9498e47cc620dc9cc53b0c93f79b449a67658485a4672: 299 entries, branch-specific 120 rules, 34 terms, 48 warnings and 112 prerequisites, shape-only authority. Current main has 121 rules; this publication does not claim otherwise. The same review spans source and generated publication commits.

## Closing block

simplestRobustRoute: This is the simplest robust route: omit optional forum bookkeeping for unrelated admitted work, reuse first origin by exact source/digest, and call the existing fenced cancellation port from bounded collection. No new dispatcher, store, authority or review protocol. Start guards remain authenticated causes/current ownership; result/exit evidence closes work, never cancellation submission alone.
80/20: Fix the three demonstrated failures at their source and test both success and refusal neighbors. The two touched test files, typecheck and required narrow native certificate contract are run; full-suite and independent-host/live-use acceptance remain the desk’s work under the explicit bounded repair direction.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
