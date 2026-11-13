# Change review — remove unsupported commitment reconciliation protocol

Subject base: 6d5f89c955608842151db32de4870ed43f72144c
Review state: open
Reviewed content: none
Outcome: retain receipt-backed closure, unknown-delivery preservation, inventory and sourced withdrawal; remove the unproved optional reconciliation writer, commitment-closed event and launch switch.
Affected rules: 70 evidence; 116 simplest robust route; 8/83/93/99 owned loops; 26/33/84/117 journal awareness; 28/121 sourced withdrawal; 31/63/113 shared journal; 74/102 review and decisions; 101 hooks; 123 private audience.
Affected floors: secrets — unchanged redaction and audience admission; spend cap — no new calls; stop — existing stop unchanged; no duplicate sends — existing receipts unchanged, no reconciliation sends; durable intake — existing append/replay retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: remove a journal event and launch path before this unit passes review; explicitly check retained closure on restart.
Side effects: the experimental --reconcile-delivered-obligations option no longer runs a pass and commitment-closed is no longer a known frame. Ordinary delivered report settlement and unknown receipt refusal remain. No model prompt, parser or accept/escalate/refuse judgment changed. This supersedes the optional reconciliation portions of the original unit review; inventory and withdrawal scope stay intact.
Undo and recovery: revert this repair to restore the unproved path if necessary. No successful commitment-closed event is established by the supplied evidence. A journal containing one would receive existing unknown non-additive-frame refusal, never silent loss; preserve the journal and use a compatible writer. No private journals are edited or certified clean here.
Multi-machine posture: existing shared journal receipt projection remains authoritative across reopen; no additional writer, store or machine-local state. Ownership admission unchanged.
Team posture: existing verified operator audience and redaction stay unchanged; no new visibility, sharing, member or guest authority.
Layer below: read wholeReplyReceipt, settleDeliveredReply, completionPending, obligation-result admission, sent/split-reply projection, and intent fulfillment validation. The removed deliveredClosure checked evidence already consumed by ordinary settlement; a pending completion item prevents both paths, and later work invalidates the old receipt. No supported recovery history was found in these paths. Inherit original 1.x comparison at JKHeadley/instar main 1d30b4fc496924f13fcf43c32dca0c79fd20913e (not present locally), src/monitoring/CommitmentTracker.ts and PromiseBeacon.ts terminal delivery and rearming, docs/specs/agent-owned-followthrough.md and close-the-loop-standard.md, history 4018bf338 and 1b4350998, ONEX-LESSONS coherence/commitments/parallel-work area as read by original builder. Independently searched actual origin/main src/, docs/specs/ and tracker/beacon history at a426851f0795d96afb8e1dde3509f688cd6dae4b; fetched cad4a502c5c1fb26795cf11f267d542af1c76a42 and read matching specs. Reuse evidence-bearing terminal closure and cadence through existing src/rungraph/promises.ts and journal; a second tracker or CAS store is unnecessary. No local ONEX lesson copy found; no remote reread claimed.
Bug class: integration
Bug evidence: reproducer=tests/preview/obligation-close-and-answer.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt or parser changes; inherited finding dispositions in the original review still apply. This repair tests journal projection, without claiming live model wording or new recorded model-shape replay.
Decision: obligation-close-and-answer-remove-unproved-reconciliation | Take the review-authorized removal route because ordinary receipt replay already closes the demonstrated supported history. Retain successful and UNKNOWN receipt neighbors, and assert two reopens preserve their distinct closure states without appending bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/obligation-close-and-answer-1112-p2-PROGRESS.md

Verification: typecheck and build exit 0; the focused obligation-close-and-answer file passes 6/6 on both ambient Node 24.15.0 and the certified installed Node 24.14.1. Architecture passes with the certified runtime. Register replay from source commit 87d54b4ddc82f6c48dcb51fc9c7f57820fbcef68 refreshes eight generated artifacts (308 entries, 123 rules), without owner-manifest, declaration, certificate or hand-edited pin changes. Full-suite and live evidence remain the Studio gate.

simplestRobustRoute: use existing receipt projection to settle delivered promises and preserve unknown delivery, inventory and sourced operator withdrawal; remove the redundant experimental closure protocol instead of inventing a recovery history or adding machinery. No tool, framework, session, network, delegation or persistence capability is narrowed to enforce a safeguard.
80/20: a 40-line product removal plus focused replay evidence resolves the sole MUST-FIX; no new service, gate, or full-suite run.
VERDICT: author submission; independent desk/Astra review pending
