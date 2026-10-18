# Change review — w4-toolsfull repair round 3: an inline skill is admitted; a forking or unverified skill is refused

Subject base: 614b2e3793874b6fca6c4f11a54ca06eb8337ef5
Review state: open
Reviewed content: none
Outcome: Unit review round 3 (Astra, VERDICT NO) found the hook refused every Skill call on its name for a fork liability an inline skill does not incur. The pinned harness (2.1.280) forks a skill only when its resolved execution context is `fork` (getContext ?? context ?? inline); an inline skill returns its instructions to the existing conversation and starts nothing. Under the turn's empty setting sources the harness loads no user or project skills (its skill loaders require userSettings/projectSettings, read from the pinned artifact), so the invocable skills are its bundled ones, whose context is set in harness code the hook cannot read at call time. tests/preview/tool-admission.mjs: INLINE_SKILLS names the bundled skills read from the pinned artifact as inline (no context, getContext, agent, background, hooks or model, and a prompt built without a command or network request): claude-api, dataviz, explain-usage, fewer-permission-prompts, keybindings-help, loop, run, simplify, update-config, workflow-authoring; those are admitted as ordinary work under the turn's existing checks (each later tool call still meets the hook, the doorway and the call cap). code-review, whose getContext forks unless its own checks say inline, is refused for budget; any other name (commit and pr, which run git in prompt building; schedule, which reads a cloud account in prompt building; an unknown or managed skill) is refused by default, as an unclassified tool is. Workflow stays refused for budget. README updated; tests cover the inline positive, the fork refusal neighbor and the unverified refusal, directly and through the real executable hook.
Affected rules: 1 and 4 (each call decided by an exact class, failing closed), 34 (both sides of the new decision tested), 36 and observer #106 (the spike's and the full-tool runs' recorded calls replay through the changed hook; no recorded shape contains a Skill call), 37 (fixed at source), 60 (a skill that can fork is still refused before dispatch), 74 (this record), 101 (plain commits), 103 (each refusal names its floor or its reason), 116 (a fixed table read from the pinned artifact, like the tool classes; no new mechanism); Purpose: the agent's ability is not reduced where a checkpoint can hold the safeguard
Affected floors: secrets — unchanged: an admitted skill adds instructions only; every tool call it leads to meets the same hook; spend cap — a skill that can fork stays refused for budget, an inline one starts nothing and sets no model; stop — unchanged; no duplicate sends — unchanged (sends still go to the doorway); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it widens what a model-driven tool turn may invoke, held by the admission hook.
Side effects: a model can now load the ten inline bundled skills' instructions into a tool turn; the tools policy digest is unchanged (no argument or prompt changed).
Undo and recovery: revert these commits and this record; journal rows are unchanged in shape.
Multi-machine posture: machine-local, unchanged.
Layer below: the pinned harness's Skill dispatcher (fork only when the resolved context is fork; background forks possible), its bundled skill definitions and skill loaders (user and project skills gated on their setting sources), read from the pinned artifact at sha256:387a5c5d…; the hook's call slots (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: toolsfull-r3-inline-skills | a fixed table of bundled skills verified inline in the pinned 2.1.280 artifact is admitted; a skill that can fork is refused for budget and any other name refused by default, because the hook cannot read a bundled skill's context at call time and the turn loads no file skills | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsfull-PROGRESS.md
Prompt review: no model-facing text changed; the change is the hook's decision on Skill calls. Real recorded shapes replayed through the changed hook: the spike's recorded calls (fixtures/tool-turn/spike-cab6b51d) and the full-tool live runs (fixtures/tool-turn/full-2026-10-03 full, outward, stop-child), all reaching their recorded decisions; none of them contains a Skill call, so the new admission has no recorded live shape yet.
Deferral: generated/register.json:1 | not-a-deferral=generated register replay output

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/README.md, tests/preview/tool-admission.mjs, tests/preview/tool-admission.test.ts

## Closing block

simplestRobustRoute: the required outcome is that an ordinary inline skill works while a forking one stays unreservable-refused. The hook already classifies each tool by a fixed table; one more fixed table, read from the pinned artifact, classifies the skills the turn can actually invoke. No resolution machinery is added, because the turn loads no file skills.
80/20: 0 must-fix, 2 notes — the table is tied to the pinned harness and needs re-reading on a harness change (an unlisted name is refused, so a change fails closed); no live tool turn has invoked a skill yet.
VERDICT: author submission; the independent verdict is recorded as a pass
