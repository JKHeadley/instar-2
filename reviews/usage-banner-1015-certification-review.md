# Change review — usage-banner native certification and publication

Subject base: bad56e374b227a9a7984fdd81101ca1a74525d29
Review state: open
Reviewed content: none
Outcome: the repaired usage-banner composition has measured native Darwin conformance and current source pins and register publication, so the READY checks can verify it.
Affected rules: 26, 34, 37, 49, 70, 74, 90, 95, 101, 107, 111, 112, 113, 115, 116; architecture R105
Affected floors: secrets — captured provider frames and isolated test state; spend cap — existing counted calls and over-cap contract retained; stop — contract proves no dispatch after stop; no duplicate sends — restart contract retains exactly one send; durable intake — existing owner and journal paths unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: native conformance declaration and dependent register publication change; the usage-banner implementation remains unchanged.
Side effects: the supported native tuple now binds the tested composition and runtime; generated projections bind the refreshed source commit. No prompt, permission or executable behavior changes.
Undo and recovery: revert certificate and publication together with the matching composition, or rerun the same contract and replay publication for the desired composition; an old certificate must not certify new bytes.
Multi-machine posture: certificate is specific to the exact Darwin runtime measured on the Studio. The unchanged parser repair remains machine-independent.
Layer below: inspected compositionClosure/compositionDigest/currentRuntime, the ten native contract cases, desk guarded renewal, owner-manifest hash derivation, inventory repin and register replay.
Bug class: none
Bug evidence: evidence maintenance; actual before/after contract reports live at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/usage-banner-1015-conformance/ and final checks are recorded in the progress file.
Hook bypass: none
Convergence: none
Decision: usage-banner-certification | use the existing guarded Studio contract renewal, then derive dependent pins and register publication; no blind certificate edit or hand-maintained hash | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/usage-banner-1015-PROGRESS.md
Prompt review: no prompt or output interpretation changes; source implementation is identical to the already-replayed usage-banner fix.
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

simplestRobustRoute: this is the simplest robust route: run the existing native contract on the declared runtime, renew only after its behavior passes, require all ten cases afterward, and regenerate existing dependent publication. The guarded tool rolls back certification on a failed after-run. Existing test confinement, stop, spend and delivery guards remain intact; no new product mechanism or live subscription call is introduced.
80/20: targeted native contract, shipped-client certificate regression, lint, register, pinned-text and change-review checks establish the required evidence; the desk pipeline owns full-suite and independent landing review.
VERDICT: author submission; no independent verdict asserted
