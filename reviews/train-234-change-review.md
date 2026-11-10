# Change review — train-234

Subject base: d3d563cd1c2396a72bf08fc08c7a7740be419ca8
Review state: open
Reviewed content: none
Outcome: Integrate exactly the reviewed connected-tools-copyfirst-1105 head 72a698c14697e14d06703586fe3983938245cd13 with the live train-230 base. Carry installed trust into the product launcher while preserving local conversation/recovery under unavailable policy and refusing affected connected effects until valid trust returns.
Affected rules: 1, 4, 15, 18, 26, 34, 49, 57, 70, 74, 77, 90, 95, 100, 101, 102, 109, 111, 112, 113, 116
Affected floors: Secrets: only policy path crosses argv; no credential handling changes. Spend cap: existing reservations unchanged. Stop: existing gates unchanged. No duplicate sends: unchanged effect ownership and send identity. Durable intake: unchanged journal and request retention.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration touches the runner's authorization composition, with no newly authored runtime behavior.
Side effects: Product launch supplies the installation policy; unreadable or oversized policy refuses connected effects while local recovery remains available. Generated register outputs are regenerated. Two open ancestor review records retain the live base's integration history and Reviewed content: none rather than resurrecting historical pins.
Undo and recovery: Reject this candidate and retain live train-230. No live installation changed. If deployed, restore the previous build without deleting policy, journal, reservation or send-identity records; absent trust must never become permission.
Multi-machine posture: Machine-local policy per installation, deliberately; no new replication, foreign ownership inference, remote write or grant. Existing cross-machine and effect ownership behavior retained.
Layer below: Full purpose and rule book; actual 1.x source/spec/history; ONEX-LESSONS sections 3/4; reviewed member and repair records; product-run buildRunArgv to journal-agent effectPolicyOf/currentEffectPolicy and admission; existing desk repin/build/rehash/replay; exact merge parents and unchanged context guard.
Bug class: integration
Bug evidence: reproducer=tests/preview/product-run.test.ts
Hook bypass: none; configured core.hooksPath .husky/_ is absent in this worktree. Plain merge and commit commands; no stash.
Convergence: none
Prompt review: No new model-facing wording, parser or judgment. Existing product-run tests replay captured shapes as effect payloads, not model-judgment evidence: summary 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered 715672479 and empty bubble 715672550. Real-account acceptance remains with the Studio gate.
1.x comparison: Actual JKHeadley/instar main 2c2cf571737e3330fdeed921f7a1b6693de0825b searched in src/, docs/specs/ and history. setup.ts:636 ensurePlaywrightMcp, SessionManager.ts:7582 buildSessionMcpFlags, frameworkSessionLaunch.ts mcpFlags and DYNAMIC-MCP-LIFECYCLE-SPEC.md; history 54d8de0a7 and da9155237. Reuse existing per-installation and explicit-session configuration adaptation; no new transplant. Ambient/project registration and full-config fallback do not implement 2.0 per-claim authorization. Inherit member comparison at f3f94826ae7c0ae6203c2651698c02b95b89ccfa and repair at 3d7f18de497e41b2b724df5345dec0aa5d8490f5. ONEX sections 3/4: keep operator reachability under unavailable review, distinguish unavailable authority from empty authority.
Decision: train-234-member | Ordinary merge of exact reviewed 72a698c14697e14d06703586fe3983938245cd13; authenticated report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/connected-tools-copyfirst-1105-PROGRESS.md read, including final repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-234-PROGRESS.md
Decision: train-234-A | Keep both product behaviors: automatic source merge preserves live recovery and member trust reader. Resolve only generated outputs by regeneration and open review records by retaining live history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-234-PROGRESS.md
Decision: train-234-B | Branch created directly at exact live d3d563cd1c2396a72bf08fc08c7a7740be419ca8. No main merge, branch movement or other testing train included. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-234-PROGRESS.md
Decision: train-234-C | No product conflict requires omission; no head left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-234-PROGRESS.md
Decision: train-234-D | Report unchanged host-dependent checks separately for Studio. No timeout, guard or native certificate altered. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-234-PROGRESS.md
Decision: train-234-desk | Run existing cint-L37 desk chain with Linux sed syntax only. Seed conflicted generated inputs byte-for-byte from the live base, commit merged source, then regenerate the register against the full committed combined SHA. The attempted pre-commit replay correctly refused uncommitted source; no output from it was accepted. No hand-merged generated content. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-234-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=mechanical register replay, not authored deferral prose
Verification: Targeted product launch, policy admission, MCP consumers, required register/subscription lifecycle, context floor and pinned READY checks; build, typecheck, architecture, wiring, register and change-review checks. Exact results and host exceptions in the report.

## Closing block

simplestRobustRoute: This is the simplest robust route: one pinned ordinary merge and existing regeneration tools, preserving reviewed source. Start guard: exact base/member ancestry. End guard: committed pushed bytes and targeted consumer evidence. Limits: no live writes, provider use or new machinery. No live acceptance or autonomous account completion claimed.
80/20: Changed tests and bounded consumers, not the whole journal or repository suite; Studio owns full release proof.
VERDICT: author submission for independent desk review, not a release verdict
