# Change review — train-84 phone-route proof integration

Subject base: 5b8a3230bdf7826f8628fade0f3a2c9d5a01135d
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed phone-route proof fix onto live train-82, preserving available-action evidence separately from renewal at the ceiling.
Affected rules: 26, 36, 37, 49, 69, 70, 74, 79, 82, 90, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing guards. No product authority, trial limit, model call or durable state changes.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Proof classification and generated publication only; reviewed product behavior is preserved.
Side effects: Available phone actions can pass at the ceiling while renewal remains UNTESTED. The historical missing-activation failure remains a failure. The committed Studio patch is still unapplied; neither configuration nor a reachability receipt proves completed operator approval.
Undo and recovery: Revert through review and regenerate publication; reverse the Studio patch only if the desk has applied it. No product-state migration or uncertain effect replay.
Multi-machine posture: Each proof uses its deployed ceiling and its own recorded status and receipt. Existing live ownership and multi-machine state are unchanged; this WSL build is not Studio live acceptance.
Layer below: Read the complete constitution, member report through the Studio API, and cint-L37 desk chain. Inspected phoneRouteProof and its real-status/receipt tests, source admission and renewal boundary. Ordinary merge preserves the live base and member without conflicts.
Bug class: integration
Bug evidence: reproducer=tests/preview/phone-route-proof.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks inspected, containing samples only.
Convergence: none
Prompt review: No model prompt, model-output parser or model accept/escalate/refuse decision changes. Real recorded status updates 715675120 and 6234534 and receipt 8858 replay, alongside October 8 updates 715674868 and 6232820.
Decision: train-84-merge | Ordinary merge of exact reviewed 5a95265b55bba0850d8846f5b86df32041775d3d; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule79-q79a-1018-PROGRESS.md read via Studio file API. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-84-PROGRESS.md
Decision: train-84-A | Preserve member behavior and the live base byte for byte outside generated publication; no overlapping conflict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-84-PROGRESS.md
Decision: train-84-B | Create branch directly at exact live base 5b8a3230bdf7826f8628fade0f3a2c9d5a01135d; no main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-84-PROGRESS.md
Decision: train-84-C | No product conflict and no omitted head; generated files come only from replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-84-PROGRESS.md
Decision: train-84-D | Apply WSL exclusions for e2e/integration checks and report unavailable Studio evidence paths; desk owns live and native acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-84-PROGRESS.md
Decision: train-84-desk | Use existing downloaded repin/build/rehash/replay tools, with Linux sed syntax; preserve guard constants and native certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-84-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording reproduced by the generator; no new deferred repair.
Verification: Targeted helper/direct-importer and recorded fixture tests, default-context-floor, subscription provider, journal tests, pinned READY selection, typecheck, lint, architecture, register and change-review checks; results recorded in the train report.
simplestRobustRoute: This is the simplest robust route: one ordinary reviewed merge and the existing desk chain. Splitting the existing proof predicate prevents an unavailable renewal from hiding available-action coverage, without new services, policy or authority. Missing source, disclosure, route and invalid expiry remain refusals. No unattended live-completion claim.
80/20: Targeted member and direct importer tests plus requested train checks; no full suite or second comparison worktree.
VERDICT: author submission for desk gate; no independent convergence or live acceptance claim
