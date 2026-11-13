# Usage self-report
Subject base: 6d4ac144179b53eed1fcda07033be08244e548f2
Review state: open
Reviewed content: none
Outcome: Every turn receives the installation's reported calls, gross and outstanding reservations, token measurements and missing usage by work kind, and neutral login availability with reset times.
Affected rules: 13, 26, 30, 47, 49, 60, 74, 75, 78, 84, 101, 102, 111, 113, 116, 123
Affected floors: secrets — only numerical usage and neutral login indices; spend cap — presentation only, unchanged reservation/settlement/shed/raise; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged journal writer/replay.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: reversible self-description repair using existing accounting and pool observations, without new authority.
Side effects: adds mandatory prompt bytes and distinguishes unknown usage from calls lacking a durable answer. Both packet forms share the same accounting wording as full self-state. No new store or model call. No keyword-based intent or outbound gate. Eight-login context-floor test measures distinct resets and fresh quota. Compact state keeps all counters with an explicit zero default and recent run evidence; usage dimensions remain labeled.
Undo and recovery: revert this presentation change; no data or activation migration, replay unchanged.
Multi-machine posture: usage comes from the current owned journal and its existing replication path. Login availability is deliberately local to the executing runner's configured pool, re-read each turn; no claim about a remote machine's logins.
Team posture: existing private self-state packet and status audiences unchanged; no account name, email, profile, path or credential is carried by the new capacity text. No sharing or grant changes.
Layer below: journal reserveTokens/settleTokens and usageReconciliation, full status projection, turnSources to selfStateSource to prepared packet, and pool select/outage freshness/hold recovery logic.
Bug class: integration
Bug evidence: reproducer=tests/preview/usage-self-report.test.ts
Hook bypass: none
Convergence: none
Prompt review: Recorded-shape journal supplied in the brief is reconstructed through the real writer; packet text is checked for measured/unknown subjects, with mixed-kind and partial-usage cases. Existing recorded summary/review/delivered/empty shapes replay in credential-self-state tests. No new intent classifier, output parser, model judgment or phrase-trigger branch. Neutral independent review examined arithmetic, privacy, pool recovery and packet size.
Decision: usage-measurement-subjects | status tokenTotals includes unobserved reservation bounds. Present measured dimensions separately from those bounds, with complete reported-call and unknown-usage counts. Gross reservations and cap-held counts are never attempts used. Existing reconciliation settledCalls is released unused capacity, not actual calls; label it accordingly. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/usage-self-report-1112-PROGRESS.md
Decision: usage-neutral-capacity | use pool-owned current observations with neutral one-based login numbers; expired holds do not limit, unknown resets stay unknown, sign-in/unavailable evidence stays distinct. No profile fields reach the packet. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/usage-self-report-1112-PROGRESS.md

1.x comparison: researched actual JKHeadley/instar origin/main bd8150b26d65b2e0cc9d861272062a2073e34cee, src/monitoring/TokenLedger.ts summary and missing cache-split semantics; src/server/routes.ts /tokens/summary; src/monitoring/QuotaTracker.ts fresh/unknown pool quota; docs/specs/unified-usage-ledger.md token arithmetic, coverage and unknown pricing; history f70e04fca, 0868b62cc, 64e1641ee. Reused distinction between measured totals and absent evidence plus work attribution. SQLite scanning and cost estimation do not fit this journal-backed presentation repair. ONEX-LESSONS.md absent from searched local worktree/.instar paths; inherited settlement review cites sections 2 and 6, indeterminate is not dead and activity/counts differ.

Step 0: selfStateBrief deliberately excluded tokens and called view.calls 'used'. journal-agent always sent that brief while status already exposed tokenTotals and usageReconciliation. Pool status included private profile references and was not in turnSources. Shared usage text and pool-owned neutral text close those gaps without changing replay or caps.

simplestRobustRoute: This is the simplest robust route: reuse existing journal and pool projections and inject their labeled figures through the existing always-sent self-state source. No new ledger, query tool, model call or authority. Packet-size checks guard the additional bytes; cap and stop guards remain at their existing owners. This is builder evidence for review, not a claim of live deployment or unattended acceptance.
80/20: narrow rendering/wiring plus targeted writer, packet, pool, and context-floor tests; Studio owns live gate and host-only checks.
VERDICT: author submission; independent landing verdict belongs to the desk
