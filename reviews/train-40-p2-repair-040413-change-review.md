# Change review — repair Codex cross-owner imports

Subject base: a70eeefcb9a1dcef56c717dcf28e1eb2b2848bae
Review state: open
Reviewed content: none
Outcome: Restore the assembly and adapter public-boundary contracts by routing existing Codex composition through each owner's index.
Affected rules: Rules 26, 30, 37, 49, 70, 74, 101, 102, 111, 113, 115 and 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; no runtime policy or authority changes.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Public module composition changes, without new behavior or model-facing text.
Side effects: Public barrel loading gains the existing session helpers and Codex worker; the worker tests now exercise the public entry point. Native composition certificate requires Studio renewal.
Undo and recovery: Revert this repair and regenerate publication; that restores the known private-import failures. Preserve all runtime records and unknown effects.
Multi-machine posture: Shared source exports only; physical process handles and injected IO retain their existing machine-local scope. No new state, transport or ownership.
Layer below: Inspected both private-import checkers, assembly assertions, session launch helpers, adapter worker configuration and public barrel initialization. Existing worker and driver tests cover initialization, stop, admission and uncertain closure through the repaired composition.
Bug class: unit
Bug evidence: reproducer=tests/assembly/telegram-bot-api-round7-private-import-guard.test.ts, tests/rungraph/production-grounding-boundary.test.ts, tests/harness-adapters/contract-map.test.ts and tests/harness-adapters/a2-governance-and-additivity.test.ts reproduce all five supplied failures; all 32 assertions now pass, including forbidden-import negative controls.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Prompt review: No prompt, parser, acceptance or refusal policy changed. Only import/export paths and an identical local assertion helper changed.
Prompt finding: 42faf877ba82 | protocol-literal | Existing agent identity prompt is untouched; the changed provider line is an import, not model-facing text.
Decision: train40-p2-public-imports | Use existing public owner barrels and a local one-line assertion rather than weakening import checks or adding exceptions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-40-p2-repair-040413-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Mechanically replayed publication preserves inherited descriptions and adds no deferred work.

## Closing block

simplestRobustRoute: This is the simplest route: export the existing cross-owner dependencies through their public indices, keep a generic assertion local, and use those exports. No new mechanism, runtime branch, authority or capability restriction is added. The existing architecture checkers and worker tests guard both allowed composition and forbidden private edges; existing admission, stop and resource bounds remain the limits. This is a source-boundary repair, not an autonomous live-path completion claim.
80/20: Targeted failure reproducers, portable direct consumers, typecheck and publication checks; the Studio owns the full suite and native certificate renewal.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
