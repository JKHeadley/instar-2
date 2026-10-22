# Change review — Preserve the updater installation-path checkpoint

Subject base: 3194ff3b7416523871a5c4d94404fb0fc8d91015
Review state: open
Reviewed content: none
Outcome: The updater checks the canonical installation root through the existing assertAgentPaths boundary before creating any directory, preserving the operator's macOS protected-folder direction.
Affected rules: 4/93/103 (reuse exact standing path enforcement); 26/34/70 (real filesystem refusal and installed-command regression coverage); 74/102 (review and reported decision); 101 (no hook bypass); 113 (machine-local posture); 116 (one existing checkpoint, no new policy or machinery).
Affected floors: secrets — no new credential handling or diagnostics; spend cap — no model calls or cap changes; stop — unchanged; no duplicate sends — no sends added; durable intake — refusal precedes writes and preserves all existing state.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Focused wiring repair for an existing installation policy, with no new state, model-facing behavior or authority.
Side effects: macOS updates into protected folders, including canonical symlink aliases, now refuse before creating the root. Linux retains the existing no-op path policy. Valid roots still install and run the installed CLI.
Undo and recovery: Revert this repair commit to restore previous updater behavior; no data migration or state cleanup is required. For a refused root, choose the existing supported agent home.
Multi-machine posture: Machine-local, deliberately. Each host applies its existing path policy independently; no peer ownership, replication or cross-machine state changes.
Layer below: Read the full origin/main purpose and rules, scripts/agent-paths.mjs canonical ancestor and platform handling, onboarding's existing checkpoint, and the updater's first filesystem write. The fixture installs the real shared module so installed-command verification resolves the same dependency.
Bug class: integration
Bug evidence: reproducer=tests/preview/update.test.ts
Hook bypass: none
Convergence: none
Prompt review: none; no model prompts, parsing, acceptance or refusal of model output changed.
Decision: update-a-repair-path | Invoke the shared path assertion at the updater's first-write boundary; use real filesystem tests with a child-only macOS platform override on Linux, and retain native macOS CLI cases. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1021-repair-090948-PROGRESS.md

Original unit base: 52ead9423d978a2061f7fc32e8d53e0befc32960. This repair reviews only changes after the Subject base, not the intervening mainline units in the desk's broad review range.
Subject (3 paths): scripts/update.mjs, tests/preview/update.test.ts, tests/preview/agent-paths.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: call assertAgentPaths before mkdirSync. It closes the demonstrated updater bypass while preserving update capability and the existing canonical-path and Linux behavior. Start guard is the existing path assertion; end evidence is absent refused roots plus successful real npm installation and installed command; existing bounded installer and lock limits remain unchanged. No autonomous live-agent completion claim is made.
80/20: One demonstrated must-fix, one shared checkpoint, focused regression tests. Native macOS cases remain for the Studio gate; Linux runs the actual boundary with an emulated platform and real filesystem paths.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
