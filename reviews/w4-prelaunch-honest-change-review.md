# Change review — honest pre-launch failures

Subject base: afa6be392876eb17c2789651090fa90b83a81f92
Review state: open
Reviewed content: none
Outcome: A whole answer that provably attempted no provider launch releases its unused reservation, preserves intake and sends one short infrastructure reply in the original topic asking the operator to resend. A provider launch attempt keeps existing UNKNOWN handling. The existing minimal responder owns notification, durable intent, reserve bound and delivery evidence.
Affected rules: purpose constraints 2 and 3; 1, 4, 14, 26, 34, 36, 42, 46, 49, 52, 60, 63, 70, 74, 75, 77, 87, 89, 95, 101, 102, 111, 113, 116
Affected floors: secrets — fixed text plus existing outbound and audience checks; spend cap — settle zero only before every provider launch, including tool liability, otherwise retain UNKNOWN; stop — existing gate before dispatch; no duplicate sends — existing limited-intent precedes dispatch and survives missing receipts and restart; durable intake — retain the original turn and not-started hold in the encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This changes reservation settlement and the operator-facing reply path.
Side effects: Not-started turns remain held and the reply explicitly asks for a resend; no automatic retry is added. Tool liability is released only with the whole answer's no-launch proof. The host-wide launch counter is conservative under concurrency: any simultaneous provider launch retains UNKNOWN rather than risking a refund. Old readers refuse the new unused-model hold reason; do not downgrade a root carrying it. No new prompt, parser, authority or external service is added.
Undo and recovery: Revert before rollout. After recording a not-started hold, keep a reader supporting it; retain journal evidence and never delete holds or retry UNKNOWN effects. An operator resend is new durable intake. A lost notice receipt stays UNKNOWN and is not repeated.
Multi-machine posture: Uses the existing exclusive journal writer, ownership checks, replication and minimal responder. The in-memory launch proof is local to the current host invocation; only its durable settlement survives restart. Missing proof across a crash retains UNKNOWN. No new store, scheduler or owner.
Layer below: Inspected subscription route construction and per-command admission, the actual executor handoff, tool-turn reservation and trace, unused-model settlement, minimal-path dependency admission and send intents. Only nonempty prepared stdin marks a provider launch attempt, before executor entry; version/auth preflights do not. Tests exercise the real adapter admission failure and both sides of the launch boundary. The extracted shipped-wrapper disclosure fixtures receive the real launch-boundary dependency and mark their simulated executor entry; 30 targeted cases pass after that fixture repair.
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-prelaunch.test.ts; restart=tests/preview/journal-prelaunch-evidence.md
Hook bypass: none; core.hooksPath is unset; common hooks directory contains only sample hooks. Plain commits and pushes.
Convergence: none
Decision: w4-prelaunch-honest-boundary | certify the entire answer before the executor handoff, never by matching an exception message; any possible launch retains UNKNOWN | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-prelaunch-honest-PROGRESS.md
Decision: w4-prelaunch-honest-notice | reuse unused-model hold and bounded limited responder; ask to resend rather than promise unscheduled recovery | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-prelaunch-honest-PROGRESS.md
Decision: w4-prelaunch-honest-tools | refund the reserved whole-tool liability only when the whole answer attempted no provider launch | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-prelaunch-honest-PROGRESS.md
Prompt review: No model prompt or parser change. The fixed infrastructure reply exposes no internal error text. Recorded replay uses tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json, updates 715672479–715672500, including uncertain summaries, unsure/unavailable Jev, undecided outcomes and reply reviews/deliveries. It appends the new certified hold then runs the real minimal responder while retaining prior UNKNOWN liabilities. Real empty-delivered-bubble evidence is absent from that captured fixture; no fabricated live evidence is claimed.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed memory-list reply wording, unchanged by this patch
Prompt finding: bd01de21286a | protocol-literal | existing source citation guidance, unchanged by this patch
Prompt finding: fb5fa7e706c8 | protocol-literal | existing source grounding guidance, unchanged by this patch

simplestRobustRoute: This is the simplest robust route: distinguish a whole answer that made no executor handoff and reuse the existing zero-usage settlement, durable hold and minimal responder. A launch counter prevents the credible error of refunding a later refusal after an earlier call in the same tool turn. Start and limit guards are the existing provider admission, spend cap, owner and stop checks; end-state guard is the existing durable notice intent. Offline real-adapter and recorded-journal evidence is submitted; no live deployment or unattended production-delivery claim is made.
80/20: The new regression cases, adapter admission case, restart replay, build, typecheck and architecture checks pass. Direct-import host tests have unrelated WSL failures recorded for the desk; no independent convergence or live deployment is claimed.
VERDICT: author submission; no independent verdict claimed
