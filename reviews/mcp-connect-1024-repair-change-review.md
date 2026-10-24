# Change review — Preserve MCP credential expiry

Subject base: 7af96f9ffa9b3e4ad72213ccd710ea2229291752
Review state: open
Reviewed content: none
Outcome: newly supplied MCP credentials with readable JWT expiry retain expiry metadata and escalating reminders in the existing encrypted custody registry.
Affected rules: 1, 26, 34, 49, 62, 70, 74, 84, 100, 101, 102, 113, 116
Affected floors: secrets — encrypted custody and read-back before reference publication; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. No new effect or authority is granted.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: reuse an existing parser and custody kind at one installer call site; no new store, scheduler, prompt, admission policy or model parser.
Side effects: newly installed exp-bearing values use the existing jwt custody kind and names; opaque values retain mcp kind. Repeated installs keep their reference and registry bytes. Existing stored records are not rewritten by this repair.
Undo and recovery: revert the installer selection and test changes to restore previous behavior; sealed credentials and references remain resolvable. No credentials are deleted or copied.
Multi-machine posture: deliberately installation-local, matching existing custody and MCP configuration. No cross-machine credentials or ownership changes.
Layer below: inspected jwtExpiry, createSecretCustody.store, reminderSchedule, dueCredentialReminders, encrypted read-back and installer repeat/reference handling. The existing parser reads exp metadata only; it grants no authentication or authorization.
Bug class: integration
Bug evidence: reproducer=tests/preview/mcp-setup.test.ts
Hook bypass: none
Convergence: none
Decision: mcp-connect-repair-expiry | select the existing jwt custody kind only when jwtExpiry returns a known expiry; preserve the opaque-token and no-write repeat paths | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-repair-102800-PROGRESS.md
Decision: mcp-connect-repair-live-proof | report the required copied-root MCP conversation as unverified Studio-local evidence; portable tests do not stand in for a model discovering and invoking a real MCP tool | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-repair-102800-PROGRESS.md
Prompt review: no prompt, model parser or accept/escalate/refuse policy changes. The existing recorded-shape replay remains an admission test only, not a live MCP conversation.
simplestRobustRoute: this is the simplest route: reuse jwtExpiry and custody's existing expiry/reminder mechanism at the new entry point. Existing validation guards start, encrypted read-back guards reference publication, and existing effect admission holds the limits. No machinery is added. The original feature's unattended copied-root proof remains unverified on this read-only remote builder.
80/20: one call-site correction with a focused real-custody regression proving known versus unknown expiry, due versus not-due reminders and repeat installation; no new credential registry or scheduler.
VERDICT: author submission; no independent convergence or live completion claim
