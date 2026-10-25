# Change review — root-contained login preparation

Subject base: 779c15ea26aa634ee1b02159cef2bbaf1671d0f0
Review state: open
Reviewed content: none
Outcome: Preserve a nonsecret subscription selection and prepare profile directories after role setup, while explicitly retaining the protected enrollment seam. This is the channel-independent portion only, not first-grant completion.
Affected rules: 1, 4, 18, 26, 28, 34, 42, 44, 49, 74, 98, 100, 101, 102, 103, 104, 113, 116
Affected floors: Secrets stay outside this nonsecret request; spend cap is unchanged with no paid calls; stop is unchanged; no duplicate sends because no sends occur; durable intake is unchanged. No terminal receipt becomes authority.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Additive installer preparation with no provider or authority operation.
Side effects: Creates one immutable nonsecret request and empty profile directories beneath the selected installation root. An interrupted preparation resumes. A different account cannot overwrite the request. Local owner control during setup remains required; pathname checks are not hostile-worker confinement.
Undo and recovery: Revert the additive command. Retain the saved request and directories; no runtime consumer treats them as authority and no credential migration is needed.
Multi-machine posture: Installation-local input and paths, deliberately. No new shared authority store; binding and grants remain with the existing owners.
Layer below: Read onboarding-state atomic durable publication, role setup's explicit non-authority receipt, login inventory's verifier, preview authority's desk seal and Rule-38 waiver, and the approved Part 06/08/14/15/17 bootstrap sequence. The 1.x wizard and SecretStore cannot supply that independent genesis chain unchanged.
Bug class: none
Bug evidence: none; additive preparation only
Hook bypass: none
Convergence: none
Decision: install-firstgrant-1025-D1 | Require the designed protected binding before subscription approval; preparation confers no standing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: install-firstgrant-1025-D2 | Reuse durable setup publication for a single immutable request and fixed root-contained profile paths. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: install-firstgrant-1025-D3 | Keep the missing ordinary bootstrap/grant/custody composition explicit and report partial work rather than simulated connected-login success. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Prompt review: No model prompt, parser or model-output acceptance changes. Input is an exact installer form. No model replay claim.
Validation: Thirteen preparation tests and eight onboarding tests pass; the five other direct-entry consumer files pass 89 tests with seven platform skips. An occupied-directory refusal failed before repair and passes afterward. Typecheck, architecture, lint, build and register check pass. The command explicitly states protected enrollment is unimplemented. Final check outcomes are recorded in the handoff report. No ordinary-login success or independent custody proof is claimed.

## Closing block

simplestRobustRoute: Reuse the existing durable setup primitive to retain the account selection, without inventing an authority store or terminal approval route. Fixed paths and link rejection prevent preparation escaping the installation. The start guard is completed role setup; the end guard is the exact saved pending request. No autonomous first-login completion is claimed; the approved independently administered enrollment owners remain required.
80/20: Submit the bounded preparation portion with its explicit remaining seam. Independent review and ordinary-install acceptance remain outstanding.
VERDICT: incomplete first-grant implementation; author submission only
