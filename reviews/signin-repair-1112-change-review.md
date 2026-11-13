# Change review — partial sign-in repair lifecycle

Subject base: df88638c2b5ae94361efd77524e4146880cea2c2
Review state: open
Reviewed content: none
Outcome: tested partial census D / row 30 implementation. Durable repair episodes, normal-only helper interface, independent identity/use verification and candidate publication. Installed-owner bindings and live scheduling remain absent; not READY. Expansion stopped at measured 403 product lines, followed only by correctness repairs.
Affected rules: 4, 26, 31, 32, 52, 55, 60, 61, 63, 74, 83, 87, 88, 100, 102, 113, 116, 120, 123
Affected floors: secrets — references and closed outcomes only; spend cap — existing admission required by the host contract, not yet bound; stop — checked at each stage and during waits; no duplicate sends — existing journal keys, no new sender; durable intake — unchanged, existing atomic fsynced pool state.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: credential recovery and durable retry safety; fake ports do not meet live acceptance.
Side effects: optional episode fields, recurrence identity, exact superseded snapshot digests and pull-visible actions. Success clears only matching sign-in evidence; quota holds remain. No real account or profile is touched. Reply refresh never awaits repair.
Undo and recovery: revert branch; old readers ignore new fields. Retain attempting/verifying records and require revalidation after restart. No external effect or credential was changed by this unit.
Multi-machine posture: machine-local deliberately, under the root writer lease, for physical browser and credential custody. Host and controller check recorded machine. Installed binding must use the existing machine resource owner; no cross-root serialization claimed.
Team posture: existing private operator reply/status audience; no sharing or role widening. Installed binding must resolve the account owner's recorded authority.
Layer below: pool select/hold/outage/status, durablePreviewWrite, journal-agent construction and replyNotices, read-only owner-browser policy, session admission and credential custodian. They do not yet bind the new controller to normal sign-in execution.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model prompt, parser or rubric change. Closed lifecycle outcomes only. Direct-import signed-out tests replay genuine CLI 401 and limit captures. No pane classifier or browser parser added.
Decision: signin-repair-1112-D1 | reuse pool storage and carry the tuned 1.x lifecycle instead of importing its server dependency graph | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-repair-1112-PROGRESS.md
Decision: signin-repair-1112-D2 | repair is separate from reply refresh; unknown attempts and resumed parked episodes require revalidation | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-repair-1112-PROGRESS.md
Decision: signin-repair-1112-D3 | isolate candidate credentials and publish only after independent identity/use proof | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-repair-1112-PROGRESS.md
Decision: signin-repair-1112-D4 | stop expansion at measured 403 product lines and preserve a BLOCKED partial with row 30 open | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-repair-1112-PROGRESS.md

1.x FIRST: actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987, confirmed by git ls-remote. Sources: src/core/SubscriptionReloginRuntime.ts:172-235,305-312,397-434; SubscriptionReloginService.ts:263-278; SubscriptionReloginHelper.ts:112-133; SubscriptionReloginOrchestrator.ts:90-94,306-315. History: 8e3c2df09, fead49361, 3807ebfae, ca020e263, 4a81cf385. Semantic carry: one helper/episode, three attempts, five-second exponential backoff, ten-minute overall bound, uncertain recovery, identity then authenticated-use arbitration. New: pool persistence/validation, normal-only interface, snapshot supersession, isolated candidate and notice keys. No complete file copied. Fallback codes excluded by the brief. ONEX-LESSONS.md not found in the workspace or /tmp; no remote absence claim. Census 7cd1b795 row D is the starting finding.

Tests: lifecycle and custody adapter fake-port coverage, plus directly importing pool tests. Live normal sign-in, actual new-notice delivery and a real disposable signed-out seat remain unproven. Independent inspection found issues that were corrected; no convergence claim.

## Closing block

simplestRobustRoute: existing pool storage and journal keys, carried 1.x lifecycle, existing admission/custody owners behind one normal-sign-in interface. Isolated candidates prevent damaging a serving login; revalidation prevents repeating unknown effects. No new authority or general browser automation. Unbound interfaces are partial work.
80/20: preserve tested partial at the explicit size boundary, keep census D and row 30 open.
VERDICT: author submission; partial BLOCKED, no readiness claim
