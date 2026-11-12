# Change review — train-242-repair-1045

Subject base: 5609a711fdc89eafe5f1b49e67e8d4dff7fad8c2
Review state: open
Reviewed content: none
Outcome: Repair six release-train regression groups while preserving same-turn login retry, default Threadline, private reports and burn observation. Restore protected memory/reminder briefing and room for source-backed cancellation; align extracted test dependencies and the reviewed admission roster.
Affected rules: 4, 28, 34, 36, 37, 42, 49, 55, 60, 66, 70, 74, 78, 84, 93, 101, 102, 111, 113, 116, 123
Affected floors: secrets — existing custody, redaction and disclosure remain intact; spend cap — no cap or retry limit changes; stop — no stop-path changes; no duplicate sends — captured quota-only retry and exact send counts, nonquota refusal unchanged; durable intake — retained journal and source-backed cancellation unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Restores model-facing awareness and cancellation context at shared release composition boundaries; runtime authority is unchanged.
Side effects: Shorter generated capability summaries may change self-description wording; protected memory/reminder lines restored verbatim. Every ability and detailed source remains. Over-block: no new refusal, disclosure tests retain all boundaries. Under-block: cancellation still requires a grounded commitment and exact operator quote; 401 and UNKNOWN do not become quota retry evidence. No timing, process, external route or state schema change.
Undo and recovery: Revert this repair's source/test edits and replay the register; no data migration. Keep all carried generation-7 journal readers and durable effect records. A rollback reintroduces the briefing pressure, so test cancellation before release.
Multi-machine posture: Generated summaries ship equally to every installation; current conversation ownership, replicated journal, account-local custody and Threadline private shares are unchanged. No new host-local state or unshared durable fact.
Team posture: Existing verified operator and owner-signed private shares still gate reports and Threadline. Member/guest access is not widened. Group disclosure refusal/recovery assertions remain unchanged.
Layer below: Actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 searched in src/, docs/specs/ and git history. Inspected SubscriptionPool.ts eligibleSiblingAccounts, ThreadlineBootstrap.ts default custody bootstrap, PrivateViewer.ts private markdown, BurnDetector.ts bounded signal; specs POOL-AWARE-QUOTA-THROTTLE-SPEC.md, threadline-mcp-local-http.md, a2a-honest-delivery-outcomes.md; history df87e1630, 948d48d0a, 32e752fdc. Studio ONEX-LESSONS.md section 4 read. Reuse carried features; repair 2.0 wiring tests and context budget rather than rebuild 1.x. Inspected actual readRootMcp, admitThreadline, callSubscription, capacity-retry projection and deliveryCancellationSupported. The failed withdrawal packet dropped commitment 0, so its cancellation was correctly refused despite affirmative prose.
Bug class: integration
Bug evidence: reproducer=tests/preview/followup-deliver-launch.test.ts; base withdrawal drops commitment 0 from grounding under packet pressure; unchanged closed assertion and retained diagnostics prove restored behavior. Other named regressions reproduced individually; MCP/disclosure failures stem from missing Function-environment bindings, quota launcher expectations predate intentional same-turn recovery.
Hook bypass: none; core.hooksPath=.husky/_, directory absent in this checkout. No bypass flags.
Convergence: none
Verification progress: MCP 3/3, disclosure 30/30, roster 4/4, same-turn retry 18/18 pass. Register regenerated from source commit ec992f15f7889fd59a56164ee77a994b538f705c; final context/launcher/native gates not yet claimed.
Prompt review: Restore the exact live memory/reminder lines; shorten other capability summaries without changing abilities, scope or limits. Preserve captured historical note bytes; explicit exact replacement mapping permits only declared wording revisions in self-description comparisons. Existing real summary/uncertain, Jev undecided/uncertain, reply-review and delivered/empty shapes replay in feature tests and captured reminder/self-description/cancellation tests. No new parser or verdict policy.
Decision: T242-R-BIND | Supply actual imported admitThreadline and absent-runtime binding in the MCP extraction; supply a real-shaped selected login profile in disclosure extraction. Preserve all admission and disclosure assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-242-repair-1045-PROGRESS.md
Decision: T242-R-ROSTER | Enumerate the already reviewed Threadline recorded-governed-state site, referencing its signed private share and exact registration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-242-repair-1045-PROGRESS.md
Decision: T242-R-RETRY | Expect quota-only same-turn recovery; assert one A attempt, retained capacity failure, selected A/B history and exactly three unique sends. Preserve 401 and secret-answer controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-242-repair-1045-PROGRESS.md
Decision: T242-R-CONTEXT | Restore protected memory/reminder guidance and shorten other README capability summaries until the available inventory is no larger than live e3cb0f08. Keep context caps, cancellation authority and all four features unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-242-repair-1045-PROGRESS.md
Decision: T242-R-GATE | Use the brief-required same branch and per-file WSL checks; Studio owns native conformance renewal and complete suite. Commit source before mechanical register replay because generation reads committed inputs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-242-repair-1045-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: correct stale extracted-test dependencies and intentional retry expectations, enumerate the existing site, and regain packet room through existing generated summaries. No new retry, scheduler, gate or context-selection mechanism. Start is exact supplied branch; end is preserved features with targeted evidence and pushed commits. No autonomous-completion or live-release claim.
80/20: Narrow reversible composition repair; one independent review pass and the named targeted gates. Full-suite and native verification remain the desk's existing release gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
