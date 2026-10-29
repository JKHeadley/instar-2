# Change review — terminal account preparation

Subject base: f2798733d43ee4460aac33c40e2f9364a0e52d04
Review state: open
Reviewed content: none
Outcome: Continue the fresh role-setup path with terminal account-selection prompts through prepare-login, retaining piped JSON compatibility. This is partial installation work, not a first-conversation claim.
Affected rules: 1, 4, 5, 26, 34, 35, 42, 44, 49, 62, 74, 80, 100, 101, 102, 111, 113, 116
Affected floors: Secrets: no credentials requested or provider invoked. Spend cap: no account admitted or paid use enabled. Stop and durable intake remain in the existing runner. No duplicate sends: no sends occur and outbound review is unchanged. Preparation keeps its existing fsync/no-replace publication and null authority/custody.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Human-facing installer behavior, with a real terminal subprocess test and durable state checks; no new authority or model behavior.
Side effects: Interactive prepare-login now asks for two nonsecret fields rather than refusing a terminal. A completed saved request is revalidated without asking again. EOF pauses without publishing a partial request. Setup prints the next command. Existing piped JSON and installed record shape stay unchanged.
Undo and recovery: Revert the code change; saved requests retain their original schema and remain readable by the earlier prepareLogin consumer. Invalid or conflicting records are retained and refuse. No migration or authority rollback is required.
Multi-machine posture: Deliberately installation-local, as the existing account preparation is. No shared authority is created and no peer durability demand changes.
Layer below: Read the constitution, clean-install report and LIVE-PATH-PLAN snapshot; 1.x setup-wizard/state-machine.ts, FrameworkLoginDriver.ts, SessionManager.ts and PostUpdateMigrator.ts; existing prepareLogin, onboarding-state, setup supervisor/owner contracts, product-run and open custody/recovery composition defect. A provider command or same-user profile does not supply independently held custody or initial standing.
Bug class: none
Bug evidence: none; additive terminal preparation before an explicitly incomplete installation boundary
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample files only.
Convergence: none
Decision: phase2-first-conversation-1028-A | Reuse the 1.x finite prompt/validate/action shape over the existing 2.0 prepareLogin writer, keeping the old JSON automation contract and record schema. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/phase2-first-conversation-1028-PROGRESS.md
Decision: phase2-first-conversation-1028-B | Report the custody/recovery and protected enrollment boundary explicitly rather than launching a provider under an unadmitted same-user profile or manufacturing runner records. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/phase2-first-conversation-1028-PROGRESS.md
Prompt review: Only human terminal prompts change. No model prompt, model-output parser, model acceptance/escalation/refusal path or model setting changes; recorded model-shape replay is not applicable.
Validation: tests/preview/login-preparation.test.ts covers both providers, saved-record replay, tamper, EOF, malformed input, role prerequisite and real PTY dispatch. Existing onboarding and direct CLI consumers are targeted. Typecheck, architecture, lint, register and change-review results are recorded in the handoff; no first-message or provider proof is claimed.
simplestRobustRoute: This is the simplest useful step at the existing prerequisite boundary: reuse the shipped writer and readline terminal input rather than adding a wizard engine, new records or desk flags. Current role setup and safe paths guard the start; the same exact request comparison and durable publication guard completion. Two finite questions and existing field bounds limit input. Saved selections are revalidated to prevent a forged completion marker from becoming success. Complete custody, protected enrollment, admission and first conversation remain tracked in docs/defects/install-custody-recovery-composition.md and docs/14-the-assembly.md; no unattended installed-agent completion is claimed.
80/20: Deliver the local terminal path with evidence and an honest partial report. Qualified independent custody/recovery, protected enrollment, genesis and ordinary account admission remain required before the vertical exit test can pass.
VERDICT: author partial implementation submission; full vertical path remains blocked
