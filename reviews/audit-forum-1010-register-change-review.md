# Change review — publish repaired audit source

Subject base: c4da8cdd69adb4e9c5edfd03020da1cb613a4bed
Review state: open
Reviewed content: none
Outcome: Refresh the existing shape-only register publication against the committed forum-summary audit repair, so lint and the real-clock register check consume its exact source.
Affected rules: 37, 49, 69, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; generated replay metadata grants no runtime authority
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Mechanical generated publication; all seven changes are exact source-commit and generation substitutions.
Side effects: Generated identities bind source c4da8cdd69adb4e9c5edfd03020da1cb613a4bed. No owner declaration, policy, rule, authority or runtime behavior changes.
Undo and recovery: Revert the source repair if needed and regenerate the register through the existing command; preserve journal originals and UNKNOWN effects.
Multi-machine posture: Identical generated repository metadata shared by git; no new machine state or peer dependency.
Layer below: scripts/build-register.mjs committed-source replay, source inventory, owner artifacts and check-register-wiring.mjs; machine checks validate exact bytes and current-clock deadlines.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: audit-forum-publication | Regenerate after the source commit to satisfy final lint and register:check, instead of leaving their permitted source-pin lag for the desk. All outputs remain shape-only. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/audit-forum-1010-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Mechanical replay preserves existing declaration descriptions; this change introduces no deferred work.

## Closing block

simplestRobustRoute: Use the existing committed-source generator with its ordinary replay mode and actual clock; no new checker or hand-edited pin. Source authentication and exact generated-byte checks remain the start/end guards, with runtime floors untouched.
80/20: Architecture and full npm run lint pass with issues=[]; real-clock register:check passes for 286 entries and 116 Rules. The seven generated files were compared against their parents after substituting only commit and generation IDs and are otherwise byte-identical.
VERDICT: author submission; independent landing review remains required
