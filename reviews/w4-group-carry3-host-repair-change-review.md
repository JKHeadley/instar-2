# Change review — Recover group requests at shipped disclosure boundaries

Subject base: 160adf81de11bbaa4a7cc76d5aa7dac869d3c444
Review state: open
Reviewed content: none
Outcome: A carried request whose disclosure fails inside the shipped model wrapper, subscription helper or send binding survives compaction/reopen and completes once disclosure is restored, without repeating an uncertain effect.
Affected rules: 4, 7, 28, 32, 33, 34, 36, 42, 44, 46, 49, 57, 63, 70, 74, 75, 86, 89, 93, 101, 111, 113, 116; purpose constraint 2 and ability/checkpoint direction
Affected floors: secrets — host and worker disclosure plus existing secret filtering retained; spend cap — only proven unused answer reservations settle at zero and regain their existing allowance; stop — checked at admission and immediately before physical dispatch; no duplicate sends — uncertain calls and intents remain non-repeatable; durable intake — existing durable hold preserves the directive and saved answer
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Recovery and causal preparation at the shipped provider/send boundaries determine externally visible behavior.
Side effects: A host-only typed refusal distinguishes disclosure failure before any provider invocation from generic errors. The durable hold settles that unused answer reservation, restores carried corrections, and retains its settlement evidence through compaction. A model wrapper that already recorded a provider attempt cannot claim the whole invocation was unused. The send host consumes the existing deferred intent callback after disclosure and before the replication claim; no intent or claim exists when disclosure refuses. Existing hosts without deferred admission retain their previous contract. No prompts, output parsing or tools are narrowed.
Undo and recovery: Revert before deployment if needed. No new frame kind or service. Existing holds gain optional settlement evidence; old readers remain conservative. UNKNOWN effects are never presumed unused. Saved answers resume without another model call, and the existing exclusive writer remains responsible for durable preparation.
Multi-machine posture: Existing machine-local exclusive journal writer; holds and zero-usage settlement survive snapshots and replication. Host admission writes the intent before the existing replicated dispatch claim, whose stop and ownership predicates remain. No new owner or distributed store.
Layer below: Journal reservation and token settlement; retained evidence and snapshot replay; request scheduler ownership; shipped asynchronous disclosure wrappers; signed outbound intent, replica claim and physical send ordering.
Bug class: durability
Bug evidence: reproducer=tests/preview/group-carry-requests.test.ts; restart=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-group-carry2-repair-PROGRESS.md
Hook bypass: none
Convergence: none
Prompt review: No model prompt or parser changes. Exact host bodies replay recorded answer 715672480 at all three refusal boundaries and authorized controls. The existing 384-row proof-room capture for updates 715672479–715672500 replays summary uncertainty, Jev unsure/unavailable, reply review and delivery. Empty-answer evidence remains explicitly synthetic under the prior desk ruling. Targeted tests also prove that uncertain effects and a wrapper with an earlier provider attempt cannot regain a reservation.
Prompt finding: 849db3a6296a | protocol-literal | existing protocol wording unchanged by this repair
Prompt finding: bd01de21286a | protocol-literal | existing protocol wording unchanged by this repair
Prompt finding: fb5fa7e706c8 | protocol-literal | existing protocol wording unchanged by this repair

## Closing block

simplestRobustRoute: Reuse the durable hold and deferred reply-intent callback. Explicit pre-dispatch evidence is necessary because generic exceptions cannot prove a provider was unused. Moving send preparation behind the host disclosure read prevents a terminal intent for an undispatched reply without a new retry scheduler. Start guards are disclosure, stop, ownership and caps; the durable intent precedes replication and dispatch; end-state controls show one provider call and one delivery after compaction/reopen. The recorded answer completes unattended through the shipped host bodies with external dependencies substituted, not a claim of a new live network proof.
80/20: Typecheck, architecture and 35 focused tests pass. Cheap gate checks and generated source pins are checked again after the final commit. No full suite was run; the automatic pipeline owns fresh full-run certification. Saved-report evidence limitations are recorded in PROGRESS, not claimed green.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
