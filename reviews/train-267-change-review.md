# Change review — train-267

Subject base: 82be0674d3c38cbc53102ea0441337cabfa6d86f
Review state: open
Reviewed content: none
Outcome: Integrate exact reviewed operator CPU priority and finished-result retirement heads, retaining the live base's bounded packet search and all inherited sign-in repair behavior.
Affected rules: 4, 7, 8, 14, 15, 28, 34, 36, 37, 39, 42, 44, 46, 49, 52, 55, 60, 61, 63, 70, 74, 77, 83, 87, 90, 93, 95, 97, 101, 102, 111, 113, 116, 123.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing owners and checks. No new grant, provider call, live mutation or unbounded retry.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of reviewed worker admission and durable result lifecycle, including existing model-facing retirement guidance and inherited sign-in recovery.
Side effects: Verified operator work can start without CPU observations; measured memory and physical ceilings remain. A first verified operator worker survives unknown memory. Finished results retire only with completion evidence and no unresolved objection, retaining source-scoped lookup. Pending and retired context both yield at packet-search exhaustion; omitted bytes remain durable. The exact heads also carry train-243 sign-in repair ancestry absent from the live base.
Undo and recovery: Revert integration under review and replay the register using existing desk tools. Preserve journal history and retained results. No live deployment performed; the desk owns rollout and native certificate renewal.
Multi-machine posture: Capacity observations and retry timers are machine-local beneath existing ownership and finite worker leases. Journal ownership, replication and effect fencing remain authoritative for retirement and delivery.
Team posture: Existing verified principal, private-by-default source audience and owner/member/guest authorization remain unchanged. Retired-result retrieval stays source-topic scoped; no new sharing or access grant.
Layer below: Reviewed the existing topic coordinator lease/drain and production runner provenance callback; retained result writer/replay and source-scoped lookup; packet preparation's shared count/time budget and bounded fallback. Direct consumer tests cover admission, lifecycle, replay, report objections, summary and sign-in plumbing. No unrelated shared-index import sweep.
Bug class: integration
Bug evidence: reproducer=tests/preview/packet-search-bound.test.ts
Hook bypass: none; core.hooksPath is .husky/_, that directory is absent in this checkout; common hooks contain samples only. Plain merges and commits, no bypass flags or stash.
Convergence: none
Prompt review: No new prompt wording beyond the reviewed member. Replay recorded summary/uncertain writer, Jev undecided, reply-review, delivered and empty shapes using existing fixture tests. Stale projection uses supplied IDs and explicitly labelled body/completion stand-ins. No fresh model call or live acceptance claimed.
Decision: train-267-M1 | Ordinary merge of exact 6c21a96a161156e08f56c86badddbe891f6be2c2; member evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/operator-turn-cpu-floor-1112-PROGRESS.md, authenticated snapshot b7ccba9ab20c7af75043f66c9058205884c943b30dac400723e257e78083e6b1. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-267-PROGRESS.md
Decision: train-267-M2 | Ordinary merge of exact 0bf1813d3037d95b413cd1db3ef856fa848168b8; member evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-results-retire-1112-r2-PROGRESS.md, authenticated snapshot 7932c14801625d824befe8b5e0e4270ff5d8e28b0bc1c229ac10cbb8a97f85e4. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-267-PROGRESS.md
Decision: train-267-A | Resolve journal reportVariants overlap by retaining field-specific pending/retired selection and source lookup, applying the live-base limited fallback to either field, and retaining shared exhaustion/count accounting around both. Generated conflicts use temporary base publication then full regeneration, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-267-PROGRESS.md
Decision: train-267-B | Create branch directly at exact live base 82be0674d3c38cbc53102ea0441337cabfa6d86f; preserve both reviewed members and their recorded train-243 ancestry including sign-in repair. Do not merge main or move branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-267-PROGRESS.md
Decision: train-267-D | Run targeted foreground tests and required checks with unchanged guards/timeouts; classify unchanged host-dependent checks separately, leaving native certificate renewal and full gate to Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-267-PROGRESS.md
Decision: train-267-chain | Run authenticated cint-L37 chain: repin, build, owner rehash and register replay from merged source; Linux sed spelling only in downloaded desk script. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-267-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated publication quotes existing governing material; no deferred product work introduced.

1.x comparison: Fetched actual JKHeadley/instar main abfdc63b6397aacc6afe0963c0d408976f6eecd4; searched src/core/SessionManager.ts, hostSpawnSemaphore.ts, src/monitoring/CommitmentTracker.ts, docs/specs/robust-load-assessment-fleet.md, auto-expiry-review-ledger.md and history abfdc63b6, 4018bf338, 1b4350998, e8576a096. Reuse bounded human priority and honest retained closure from the reviewed units' db3ed6d3052cfcc24888b6c8bc86086abcfc2987 comparison. Separate recovery-slot machinery and broad inactivity expiry do not fit the existing 2.0 lease/journal owners. ONEX-LESSONS sections 2,5,6 inspected: distinguish busy/unknown from failed, preserve source history, bound physical scope and verify loaded consumers.

Scope: No member omitted; desk decision C unused because both product behaviors fit. Combined size exceeds 100 lines because this is two complete reviewed units plus their recorded common-base sign-in repair ancestry. Integration itself only combines the existing packet loops and regenerated publication. Independent read-only merge_review found no blocking defect and requested a mixed pending/retired exhaustion regression; no independent release acceptance claimed.

simplestRobustRoute: Two exact ordinary merges and the existing desk chain are the simplest robust route. Keep the existing packet fitter, journal and worker admission, without another service or store. Start guards are exact reviewed heads and durable verified inputs; end guards are targeted consumer evidence and pushed custody; physical limits, source audience and all five safety floors remain. Desk full/native/live gates retain their own bars.
80/20: Verify the actual overlap, new/changed tests and relevant direct consumers; do not run the whole journal or repository suite on the remote builder.
VERDICT: author submission; independent release review and live acceptance belong to the desk
