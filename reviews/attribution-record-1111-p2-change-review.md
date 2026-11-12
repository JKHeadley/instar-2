# Change review — record outgoing reply attribution after delivery

Subject base: d3d563cd1c2396a72bf08fc08c7a7740be419ca8
Review state: open
Reviewed content: none
Outcome: With --attribution-replies record, delivered agent replies produce attribution-check journal rows carrying the credited words, person, cited reference and sourceFound. Off by default. sourceFound means the cited source resolved in this journal, not proof of authorship or historical absence. Reply text and delivery do not consume an attribution verdict. The existing note-write option remains independent.
Affected rules: 121 (credited span/person and cited-source resolution); 10, 11, 86 (existing model extracts meaning, exact lookup establishes only a reference's resolution); 41, 58, 75 (existing recorded and metered judgment); 60 (bounded existing call reservation); 77 (after-delivery pass independent of send drain); 72, 73 (dark attribution capability and explicit graduation thresholds); 74 (this review); 101 (no hook bypass); 102 (decisions below); 113 (journal ownership and replication); 116 (shared reviewed routine, no new store or scheduler); 118, 122 (existing subscription doorway, no added provider or service).
Affected floors: secrets — existing model envelope and subscription disclosure path, no new transport; spend cap — existing attribution reservation and maxCalls before dispatch, one call per id/digest; stop — halted and gate before reservation; no duplicate sends — no new send call, receipt required, reservation prevents paid-call replay; durable intake — unchanged journal intake and intent/receipt preparation.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the live runner's optional model-call wiring and durable reply observation, even though it cannot gate delivery.
Side effects: Opt-in consumes at most one existing attribution call per prefiltered delivered reply within the 16,384-character bound. These calls share the existing allowance; no tuning is included. Missing, oversized, capped, stopped, interrupted or unreadable judgments remain unchecked. Existing prefilter can miss credits. Old compacted turns without projected speaker evidence are not retrospectively classified as agent replies. The full text remains in the journal intent; recorded spans retain the inherited 500-character bound. No new row kind or prompt is added.
Undo and recovery: Launch without --attribution-replies. Existing attribution readers can replay these row kinds; sourceFound is an optional additive span fact. No send is retried. A restart before reservation rediscovers delivered intents; after reservation it preserves unchecked and never repeats the paid call. Existing note-check settings retain their behavior.
Multi-machine posture: The journal-owning host records observations. Records replicate with the journal; sourceFound concerns only the cited source available in that journal. No second store, peer lookup, or global absence claim.
Layer below: Fetched actual JKHeadley/instar main 3ae8208a69b027ad465dca78ec7db2eb2c16b66e; searched src/, docs/specs/ and history aeef135a8 (feature), c3529b2f7 (judge tuning), 33628f375 (channel coverage). Read src/server/attributionRoutes.ts find/trace, src/core/attribution/attributionRuntime.ts find/trace, AttributionService.ts, AttributionLedger.ts, and docs/specs/attribution-paper-trail.md. Reuse person/claim/ref/outcome append-only observations and model extraction; find suggests candidates without establishing provenance, trace reads recorded wordings. The 2.0 adaptation at 979a1282 supplies attributionStep, attributionOfReply, conversation packet and reserve/check format. Existing journal source resolution replaces the separate 1.x ledger/pins/peer fan-out. Read matching Studio ONEX-LESSONS.md areas: self-coherence/parallel-work-attribution, semantic recall and capture-through-consumer. Inspected existing reviewReplies concurrency, wholeReplyReceipt, model-call recorder, token reservation and journal replay below the change.
Bug class: integration
Bug evidence: reproducer=tests/preview/attribution-record.test.ts
Hook bypass: none
Convergence: none
Decision: record-after-send | Share the existing bounded note routine using the source unit's surface parameter, and call it from the existing serial after-delivery review pass. Independent --attribution-replies record selects no note writes or send enforcement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-record-1111-p2-build-report.md
Decision: source-found-fact | Add optional sourceFound to send spans from exact marker facts. Continue model extraction after a missing marker source so the row still names what was credited and to whom; the note path keeps its existing exact refusal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-record-1111-p2-build-report.md
Decision: receipt-and-speaker | Project the intent's existing signed speaker and observe only wholly delivered agent replies, excluding grouped copies and infrastructure notices. This prevents treating an attempted or partial send as a delivered agent statement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-record-1111-p2-build-report.md
Decision: pinned-runtime | Use the installed Node 24.14.1 matching the repository certificate after the ambient Node 24.15.0 produced a runtime mismatch. No declaration was changed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-record-1111-p2-build-report.md
Prompt review: ATTRIBUTION_QUESTION and parseAttributionAnswer are unchanged. Restored the source unit's authenticated conversation packet for send recap handling. Replayed six actual Claude/Codex r3 outputs from Studio attribution-2-0-replay (A-bare, H-recap-true source message 131446, I-send-false) through the worker and journal. Also replayed the committed proof-room/live shapes: summary writer 715672480, summary uncertain 715672483, Jev undecided 715672482, Jev unsure 969389570, reply review 969389923, delivered reply 715672479 and empty recorded candidate 715672550. None is misread as an attribution answer; each reaches unchecked through the new consumer. Empty recorded candidate is not asserted to have been delivered. These prove integration on captured model bytes, not new live model quality or fleet readiness.
Prompt finding: 105c1569b6bb | protocol-literal | Existing fixed notice wording in journal.ts, unchanged by this unit.
Prompt finding: 4106b49fff07 | protocol-literal | Existing fixed context wording in journal.ts, unchanged by this unit.
Prompt finding: 7ef11b68103f | protocol-literal | Existing fixed activation wording in journal.ts, unchanged by this unit.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed memory wording in journal.ts, unchanged by this unit.
Prompt finding: 85544c20941f | protocol-literal | Existing fixed capacity wording in journal.ts, unchanged by this unit.
Prompt finding: 9f0106c66027 | protocol-literal | Existing fixed stop wording in journal.ts, unchanged by this unit.
Prompt finding: bac6ce7485d9 | protocol-literal | Existing fixed stop wording in journal.ts, unchanged by this unit.
Prompt finding: e8708c7fea24 | protocol-literal | Existing fixed source-label wording in journal.ts, unchanged by this unit.

Subject: tests/preview/attribution.ts, tests/preview/journal.ts, tests/preview/journal-agent.mjs, tests/preview/capabilities.ts, tests/preview/attribution-record.test.ts, tests/preview/fixtures/attribution-record-r3-2026-11-06.json, docs/defects/attribution-rule121-owed-parts.md, and generated source pins.
Verification: Focused source/missing-source/off tests, byte-identical replies, slow-judge second delivery, receipt UNKNOWN, cap, stop, crash/reopen, independent note mode, real model bytes and non-attribution shapes are in attribution-record.test.ts. Existing attribution, journal-conversation-session, capabilities and model-call-boundary suites passed with it (205 tests before expanded recorded-shape checks). Final command results are in the build report.
Residue: attr-record-live | medium | Live Telegram record period is not asserted; the development/record thresholds and 2026-11-21 review are tracked in docs/defects/attribution-rule121-owed-parts.md under Echo. This remains an opt-in dark observation, not enforcement.

## Parts retained for separate units

Owner: Echo; tracked acceptance and graduation review are in docs/defects/attribution-rule121-owed-parts.md. Product-line estimates:

1. Refusal: ~30 lines, consuming recorded findings as a send decision.
2. Revision: ~50 lines, connecting the attribution objection to the revision round.
3. Cut-out: ~70 lines, claim-scoped removal and empty-result handling.
4. Write check: ~330-line existing slice already on the base; no new write behavior in this unit.
5. Long-note chunking: ~70 lines, preserving complete claims across bounded chunks.
6. Trace command: ~40 lines, reading recorded wordings and references.
7. Status text: ~25 lines, surfacing recorded counts and unchecked causes.
8. Enforce mode: ~15 lines, separately reviewed switch and policy wiring.
9. Allowance tuning: ~30 lines, based on the measured record period.

## Closing block

simplestRobustRoute: This is the simplest robust route: adapt 979a1282's shared surface-aware attribution routine to the already-landed note slice, reuse its judge/reservation/records and existing after-delivery serial pass, and expose one independent record-only switch. Exact source-found facts supplement rather than replace model extraction. Signed speaker and whole receipt prevent counting infrastructure or incomplete delivery. Existing spend/stop guards and digest reservation bound execution and recovery. No autonomous live-completion claim is made.
80/20: The product diff stays below 100 changed lines; captured real outputs and both sides of each new boundary verify the slice. No send enforcement, new queue, store, trace UI or tuning is included.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
