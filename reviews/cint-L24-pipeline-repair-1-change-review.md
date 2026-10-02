# Change review — cint-L24 pipeline repair 1: a stop during replication refuses the provider call; rollback adopts the newest history first; drain timing stated honestly

Subject base: ef83e358470b0fbabc2e16bfe1a7f291f9e36907
Review state: open
Reviewed content: none
Outcome: Astra's three must-fixes on ef83e358 are repaired at their source. (1) awaitReplicated checked the caller's refusal only before awaiting the pump and then admitted on coverage, so a stop, expiry or ownership loss known while the pump's peer request was pending still let the provider call (and a send's claim) start; it now re-evaluates the same refusal callback after the pump and before admitting. tests/preview/journal-replication.test.ts proves both sides: a stop set during a successful pump refuses with its reason (and this case fails with "expected null" when the re-check is removed), and the same successful pump with no stop admits. (2) The Phase 2 rollback in tests/preview/two-machine-live-test.md restarted the Studio in single-machine mode on its own journal, which after T3 is older than the shared history (single-machine startup never adopts replica/), resuming stale intake and call/send accounting after Telegram could drop the newer input. The procedure now first returns the lease to the Studio by the existing verified clean hand-back (history adopted), verifies its turns/replies/calls/sendOutcomes match the previous owner and that the authority cursor equals its settled cursor, and only then switches posture; if that cannot be established it preserves both roots and every copy and holds recovery. (3) The previous review record and the PROGRESS notes claimed the clean drain is bounded by three attempts of at most 5 s each; drain bounds pump rounds, each round sends one request per 256 KiB chunk and drain first awaits an in-flight pump, so the total is byte-dependent. Both statements are corrected; no code changed for (3).
Affected rules: 4 and 63 (stop and lost ownership refuse before a new provider call or claim, even when learned during the replication wait), 31 and 45 and 96 (the rollback never resumes an older root: accepted intake and spend accounting are preserved or recovery holds), 13 (the drain's duration claim is stated as measured, not over-claimed), 37 (fixed at the source; no quarantine), 69 and 90 (register replayed from committed sources), 74 (this record), 116 (one re-check of the existing callback and a procedure correction; no new protocol, store or service)
Affected floors: secrets — unchanged; spend cap — tightened (a provider call is no longer started after a stop learned during its replication wait); stop — tightened (the same); no duplicate sends — unchanged (claims and receipts untouched; an in-flight claimed send still completes, as design 10 §4 allows); durable intake — strengthened in procedure (the rollback adopts the newest accepted history before switching posture, or holds)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one added refusal check on an existing gate (refuse-direction only) plus documentation corrections; no new record, store, prompt or authority.
Side effects: a stop that arrives while a replication pump is in flight now refuses the pending provider call or send admission instead of letting it start.
Undo and recovery: revert a6c32d71, its register replay 03c2d443 and this record to return to ef83e358. Nothing persisted differs.
Multi-machine posture: two-machine replicated(1) serving; the gate change applies to every admission and provider-call wait on the owner; the rollback procedure is the desk's two-to-one-machine switch.
Layer below: tests/preview/journal-replication.ts awaitReplicated, createReplicatedDispatch.admit/replicated (unchanged callers), tests/preview/journal-agent.mjs peerHolds/callJev and enterShared.stop (read, unchanged), adoptReceivedCopy (the hand-back path the procedure now relies on, exercised by tests/preview/two-machine-runner.test.ts)
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-replication.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L24-repair-stop-after-pump | re-run the existing refusal callback after the pump, before admission; not chosen: cancelling the in-flight peer request (a new protocol, and the refusal already lands before any new call starts) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L24-PROGRESS.md
Decision: cint-L24-repair-rollback-handback | rollback to one machine goes through the existing verified hand-back and a count check, or holds with every copy preserved; not chosen: a migration tool that adopts replica/ in single-machine startup (new machinery the existing hand-back already covers) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L24-PROGRESS.md
Prompt review: no prompt text changed.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-replication.test.ts, tests/preview/journal-replication.ts, tests/preview/two-machine-live-test.md

## Closing block

simplestRobustRoute: this is that route: one added check of the callback the gate already takes, and a recovery procedure that reuses the proven hand-back; no new machinery.
80/20: 0 must-fixes, 1 note (targeted tests only, no full suite on this machine, per the operator's rule tonight; the new case fails without the fix and passes with it)
VERDICT: author submission; the independent verdict is recorded as a pass
