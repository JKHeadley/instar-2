# Change review — train-45 pipeline replay repair

Subject base: 4f9ed99dd3528c597a5f9c36f0a45c185e398b79
Review state: open
Reviewed content: none
Outcome: Repair the conversation-class replay's comparison of a historical digest with the current ordinary conversation policy, keeping exact-digest authority boundaries tested.
Affected rules: 26, 36, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; this change edits a test and its review only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair with no runtime, model prompt, parser, authority or deployment change.
Side effects: The ordinary conversation factory may evolve without this unrelated historical session-class replay requiring its old hash. Exact-digest admission remains checked positively and a prose-only mutation now proves refusal. Recorded train-46/train-47 digest checks remain intact.
Undo and recovery: Revert this repair commit to restore the earlier test; no production state or migration is involved.
Multi-machine posture: Deterministic portable test only; no new state, ownership, transport or replication behavior.
Layer below: Read subscriptionConversationPolicy and its eed49b80 guidance change, the recorded train-46/train-47 policy fixture, and the exact/class resolver exercised by this test. The old 3598cc75 digest predates completion guidance; the current policy produces 7b1d9af2. Runtime policy drift here is intentional and still requires its own exact grant.
Bug class: none
Bug evidence: Test regression reproduced on 4f9ed99d: 1 failed and 7 passed in tools-policy-class.test.ts at line 259. After repair: 8 passed; npm run typecheck exited 0. This is not a runtime defect claim.
Hook bypass: none; core.hooksPath is unset; the git common hooks directory contains sample files only.
Convergence: none
Prompt review: No model-facing wording, parsing, accept/escalate/refuse implementation or provider route changes. The changed prose is a synthetic negative-control policy used only to prove exact-grant refusal. Existing real captured policy objects and their provenance remain byte-identical.
Decision: train45-repair-policy-replay | Test the current ordinary policy's exact-grant boundary and prose-mutation refusal instead of comparing it to an unrelated historical constant; retain all recorded session-policy pins and class refusal tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-45-repair-205455-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: repair the mistaken test assumption and strengthen its negative neighbor in the existing test, with no new fixture, pin, mechanism or runtime change. Entry is the reproduced failing head; exit is the targeted replay, typecheck and required portable gates on the pushed commit; existing authority and safety floors are untouched. No autonomous shipped-path claim is made.
80/20: One test file and this required review; the Studio pipeline owns the full-suite gate.
VERDICT: author submission; no independent convergence or deployment claim
