# Change review — restore pull-only holding behavior

Subject base: 82e3aa6f29cc9e7cba03295fe98877f0c88db661
Review state: open
Reviewed content: none
Outcome: Revert holdack merge 43a1bacb because the Rule 87 clarification is not merged; restore pull-only held and agent-initiated status while retaining all four speed changes and canary replay repair.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/13/14/26/28/34/36/37/41/46/49/57/58/63/70/74/75/77/87/95/101/111/112/113/116.
Affected floors: secrets — existing outbound checks; spend cap — existing call/reply reservations; stop — existing intake/dispatch checkpoints; no duplicate sends — durable intent/receipt and unknown-outcome fence; durable intake — original encrypted journal unchanged by runtime rollback.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Removes model-reviewed acknowledgement dispatch and its journal kinds through an explicit first-parent merge revert; replay the worker and opposite review routes.
Side effects: Slow replies no longer consume a separate acknowledgement review or send. Exact first-parent rollback also restores pre-holdack packet ordering and associated tests. The four speed implementations remain intact. Later test adaptations retain confident Jev routing and final-send stop/membership injection, removing only acknowledgement expectations.
Undo and recovery: Revert this revert only after constitutional authority exists, then regenerate source publications. This rollback removes holdack journal kinds; do not open a holdack-written live root with it. Replay uses archived pre-holdack prefixes in disposable desk copies. No live root/runner is changed or rollout claimed.
Multi-machine posture: Existing ownership, signed dispatch, replication, unknown-outcome and recovery fences remain. No new state; observation cache and read scheduling remain deliberately runner-local. Evidence is desk-local.
Layer below: Inspected merge parents, later test composition, canary repair, held drain, reply review routing, host cache wiring and authenticated archived prefixes. Original constitution matches origin/main and Rule 87 still requires pull-only status.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, common hooks directory contains samples only.
Convergence: none
Prompt review: No new prompt or parser. Remove acknowledgement review call and preserve actual recorded summaries, uncertain summaries, uncertain/undecided Jev, reply reviews and delivered reply context in existing recorded-shape tests. Empty recorded context is not claimed as a delivered empty Telegram bubble. Re-run copied-prefix speed-hold replay for updates 969390381 and 969390382.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed memory inventory response, not a new semantic classifier.
Prompt finding: bd01de21286a | protocol-literal | Existing source label instruction and grounding assertion.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing semantic memory retrieval instruction and grounding assertion.

Subject (25 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/call-diagnostics.mjs, tests/preview/call-diagnostics.test.ts, tests/preview/fixtures/reply-acknowledgement-live-2026-10-11.json, tests/preview/group-audience-cache.test.ts, tests/preview/jev-stage-latency.test.ts, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-conversations.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-packet-pressure-value.test.ts, tests/preview/journal-summary-crash.test.ts, tests/preview/journal.test.ts, tests/preview/journal.ts, tests/preview/reply-acknowledgement.test.ts, tests/preview/reply-check.ts, tests/preview/send-stage-replay.test.ts, tests/preview/two-machine-floors.test.ts

Deferral: generated/register.json:1 | not-a-deferral=Existing declaration text republished from reverted source, not postponed implementation.
Verification: Initial speed/canary run passes 75 tests. Typecheck, build and architecture pass. Archived 969390381/969390382 worker replay completes in 8.032/39.267 injected seconds, each with one exact final reply, no acknowledgement and no resend after reopen. Source implementation matches first parent d256aaf4 byte-for-byte for journal, host, audience verifier and reply checking; canary repair remains unchanged. Generated once from source 17d11d0bc840423360a3100cbe30d40acf9a5b2c, generation sha256:622f2951bc7429e030ef2d957bc4570562f0b3820198683180241d9107ad15f9. Final gate outcomes are in the absolute PROGRESS record.

## Closing block

simplestRobustRoute: This is the simplest robust route: first-parent revert and selective removal of later acknowledgement assertions, preserving the four existing speed mechanisms. No new machinery. Start guards retain durable intake/current audience; end guards retain exact signed intent/receipt and unknown no-retry; secrets, cap, stop and bounded reads remain. Archived worker replay is unattended with captured sends, not a live rollout claim.
80/20: Prove restoration, real-output routing, speed stage measurements and required compiler/publication checks with targeted foreground tests; submit to desk review and full-suite pipeline without an author convergence claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
