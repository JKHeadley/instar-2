# Change review — connected abilities census at train-236

Subject base: d1823a36e8b0a3c155dbc723dd6aebc0666e9934
Review state: open
Reviewed content: none
Outcome: establish what the base actually ships for signed-in browsing, default tools, login swapping and sign-in repair, and avoid queuing duplicate implementations. The smallest estimated complete gap needs broader owner scope; no product code changes.
Affected rules: 1, 18, 26, 30, 34, 36, 49, 62, 74, 88, 100, 101, 102, 103, 104, 111, 113, 116, 118, 120, 123
Affected floors: secrets — no credential or browser state is copied; spend cap — no paid calls or new resource grants; stop — no runtime changes; no duplicate sends — no messages sent and no dispatch changes; durable intake — no live stores changed.
Operator questions: general authenticated reads beyond the existing two-page GitHub grant require the owner to approve the prepared broader account scope; this census does not grant it.
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: one assessment Markdown file under docs/ and its formal review record only; zero product and test lines changed.
Side effects: future planning uses a code-grounded snapshot rather than the old inventory. Estimates are explicitly estimates; source/test availability is not presented as new live acceptance.
Undo and recovery: revert the census commit; there is no product state or runtime migration.
Multi-machine posture: read-only assessment on M5; repository findings are base-specific and host-independent, while signed-in profiles, installed login availability, temporary paths and runtime certificates are machine-local. No Studio/live evidence is claimed from this host.
Team posture: no new access or sharing. Account/profile data remains in its existing owner scope; a future general browser path must preserve owner/member/guest visibility and can widen only through the owner's signed team record. A team of one loses no capability.
Layer below: read the setup request and its real policy/MCP consumers, the admission hook and owner-browser contract, pool selection/CLI observation/installed manifest launch, the missing-login custody join and notice delivery, and the 1.x bootstrap/repair implementations. Distinguish the 2.0 Threadline protocol port from a shipped MCP bootstrap.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model prompt, parser, acceptance, escalation or refusal code changed. Existing recorded-shape tests were replayed as census evidence.

1.x comparison: actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987, verified by ls-remote. Sources: src/commands/setup.ts ensurePlaywrightMcp; src/core/SessionManager.ts buildSessionMcpFlags; src/core/frameworkSessionLaunch.ts; src/threadline/ThreadlineBootstrap.ts; src/core/PlaywrightProfileRegistry.ts and PlainChromeReloginBrowser.ts; src/monitoring/AccountSwitcher.ts, SessionMigrator.ts, QuotaManager.ts and MissingLoginSessionDetector.ts; src/core/QuotaPoller.ts and SubscriptionReloginRuntime.ts. Searched src/, docs/specs/ and history; exact fits, mismatches and inspected revisions are in docs/connected-abilities-census-1112.md. ONEX-LESSONS was unavailable after the named local searches and the brief supplied no remote URLs/auth mechanism; that evidence gap remains explicit. No code transplant is claimed.

Decision: census-1112-D1 | no product build: A's smallest estimated complete slice needs owner approval beyond the existing two-page scope; default public browser reads and next-call login swap already exist. B and D's complete gaps are estimated above 200 product lines. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/connected-abilities-census-1112-build-report.md
Decision: census-1112-D2 | use the installed byte-matching Node 24.14.1 and canonical temporary path to validate unchanged source; do not alter the native certificate or relax profile validation to fit this host. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/connected-abilities-census-1112-build-report.md
Decision: census-1112-D3 | preserve the missing remote evidence and canonical PROGRESS write as an explicit handoff gap; do not substitute a local .instar/lanes record or claim a Studio write. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/connected-abilities-census-1112-build-report.md

Verification: build/typecheck pass; lint and register:check pass with the pinned runtime; 273 distinct focused tests pass after correcting the host temporary path. Initial failures and exact tests/captures are in the census. No live proof or independent review is asserted. Final-head checks and push evidence belong in the handoff report.

## Closing block

simplestRobustRoute: inspect existing code and executable tests before adding machinery. This is that route: reuse working defaults and pool selection, and submit the remaining bounded account-scope decision instead of widening the fixed owner grant or inventing a competing sign-in system. No new runtime mechanism or authority is introduced.
80/20: sufficient code and both-side test evidence to reject duplicate browser-default/login-swap units; full automatic repair and Threadline bootstrap are separate larger gaps. Studio lessons, canonical progress handoff, the missing pinned-test selector and independent review remain unavailable and are not represented as completed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
