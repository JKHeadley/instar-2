# Row 90 private report view: base research and size gate

Subject base: d1823a36e8b0a3c155dbc723dd6aebc0666e9934
Review state: open
Reviewed content: none
Outcome: Record the existing authenticated dashboard, the exact 1.x port candidate and the estimated complete slice before implementation. Product changes stop at the task's 150-line size gate; no private report capability is claimed.
Affected rules: 28, 32, 33, 34, 36, 43, 49, 57, 60, 62, 63, 74, 79, 80, 81, 101, 102, 106, 111, 113, 116, 120, 122, 123; Purpose least revelation.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; this commit contains research only.
Operator questions: none; the assigned size gate already directs a stop and options above 150 changed product lines.
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: A research record with zero changed product lines, not an implemented user-facing feature.
Side effects: No runtime, prompt, parser, source declaration, dependency, credential or installation changes.
Undo and recovery: Revert this research record; no data migration or runtime recovery is needed.
Multi-machine posture: Research only. A future view must follow the conversation owner and its durable record; the existing dashboard is a deliberately local projection. No replicated or local store was added.
Layer below: Existing PIN/session and passkey/session verification, bounded dashboard projection, launcher wiring, journal provenance and durable outbound path; the 1.x view renderer, route, URL signer and middleware.
Bug class: none
Bug evidence: none; feasibility research, with existing dashboard tests as supporting evidence only.
Hook bypass: none
Convergence: none
Prompt review: No model-facing changes. No new-path recorded-model replay or live acceptance is claimed.
Decision: C90-SIZE-STOP | Stop implementation at the assigned size gate: estimated complete slice 190-260 product lines, excluding tests and documentation; present reuse and prerequisite options. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-90-private-view-1112-build-report.md

## Existing behavior on the requested base

The October inventory's blanket absence statement is stale for reports/status surfaces.
`scripts/operator-dashboard.mjs` renders mobile status, sessions, messages and message details.
`tests/preview/operator-dashboard.ts` supplies redacted journal excerpts: at most 500 characters,
the latest ten messages and up to sixteen active conversation details. This is not a complete
report/document store. `tests/preview/journal-agent.mjs:2153-2180` publishes the projection and
attaches the optional existing read-only listener.

`scripts/operator-dashboard-readonly.mjs:85-135` authenticates the configured operator's existing
PIN and gates views using bounded 30-minute sessions. Its listener supports loopback or the
machine's private Tailscale address. `scripts/approval-surface.mjs:35-60,145-167,253-271` supplies
the alternative operator-bound passkey dashboard under a separately configured ingress grant.
The PIN callback returns a boolean, not a team-member identity. Neither path currently exposes
an owner-scoped report creation contract.

The matching history includes `1a3a85f0a`, `4109c1f05`, `6e4d81442`, `08c35fab6` and
`24114ce066a8d052bba1e621ecc30978e341e32d`. Searches covered this base's `src/`, `scripts/`,
`tests/preview/`, `docs/` and git history. `src/operator/surface.ts` and
`docs/15-the-operator-surfaces.md` describe authorization-request views, not a report publisher.
The existing row-89 review explicitly leaves installed phone proof open. Code availability
does not prove the intended person's current deployed URL or sign-in.

## 1.x FIRST: exact source and fit

Fetched `JKHeadley/instar` main and researched
`db3ed6d3052cfcc24888b6c8bc86086abcfc2987`, including actual `src/`, `docs/specs/` and history.

- `src/publishing/PrivateViewer.ts:64-86,106-114,213-328`: UUID/title/markdown/timestamp creation,
  JSON storage, lookup and self-contained GFM HTML with a mobile viewport and bounded-width page.
- `src/server/routes.ts:28718-28818`: bounded title/markdown validation, `POST /view`, creation
  response with `localUrl`/`tunnelUrl`, `GET /view/:id`, missing-ID refusal and renderer dispatch.
- `src/server/viewTunnelUrl.ts:16-26` and `src/server/middleware.ts:418-425,875-891`: path-specific
  HMAC URL possession admits a GET. It grants that view to anyone holding the link; it does not
  establish the recipient's identity. This part cannot meet this unit's owner-only requirement.
- `src/server/middleware.ts:904-917` sandboxes all view responses. The current PIN page in
  `PrivateViewer.ts` says unlocking is unavailable there; do not port a nonfunctional PIN form.
- `CLAUDE.md:229-244` and `src/scaffold/templates.ts:723` teach creation and link use. Specs
  `dashboard-conversations-browser-device.md` section 4.12,
  `DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC.md` section 2.7 and
  `MULTI-MACHINE-SEAMLESSNESS-SPEC.md` WS4.4 document sandboxing, token-free handoff and holder routing.
- Relevant history: `e9ac0a725`, `0b0af029b`, `22de6cfdd`, `948d48d0a`.

Carried lines in this unit: **none**. New product lines: **none**. The proposed port retains
create/get, route bounds and markdown/phone presentation, adapted to existing 2.0 sessions,
conversation ownership, durable outbound delivery and an explicit view lifetime. It introduces
no filesystem access or list/update/delete interface. This is not a fresh replacement design.

`ONEX-LESSONS.md` was not present in the inspected worktree, instar-2 checkout, echo/.instar or
builders tree. The named Studio path could not be accessed from this host: no snapshot URLs or
INSTAR_AUTH_TOKEN were supplied. The row-89 review's lessons summary is indirect evidence only.

## Size and options, stated before implementation

Planning estimate, not a measured diff or a proved lower bound:

| Necessary adaptation | Changed product lines |
| --- | ---: |
| Agent creation/output contract and briefing | 35-50 |
| Bounded report record/projection, provenance, owner, lifetime | 40-55 |
| Existing-session GET route and content-only lookup | 35-45 |
| Markdown/phone renderer using existing style and resource restrictions | 35-50 |
| Private URL and existing durable-send integration | 30-40 |
| Capability/declaration wiring and ownership metadata | 15-20 |
| Total, excluding tests/docs/generated output | 190-260 |

Option 1: scope the full port at this size after establishing the already-running private
dashboard's address and operator binding. Option 2: commission the owner-aware report projection
as a prerequisite, then re-size the route/delivery slice. A link to today's clipped excerpt is
smaller but does not fulfill this goal. If no private dashboard is running, enabling the existing
read-only dashboard is an installation prerequisite outside this unit's no-new-port constraint.

Team posture: only the authenticated operator's own conversation output is a candidate for the
existing operator surface. Members/guests need their own verified identity and the owner's signed
team record; no sharing or impersonation of the operator is inferred. The future report route
must grant access to content only, never files or raw journals. Rules 28, 57, 123 and Purpose least
revelation are the governing access constraints. The existing store declaration is
`preview.approval-surface-client.createApprovalSurfaceClient` in
`tests/preview/approval-surface-client.declarations.json` (Rules 7, 32, 60); it describes a
disposable dashboard snapshot, not an authorization to introduce report memory. No register entry
was added or changed for this research-only commit.

## Evidence boundary and handoff

Build and typecheck passed. Existing dashboard tests passed: two files, 21 tests, including HTTP
PIN admission, session refusal and all eleven dashboard floors with negative controls. Register
replay passed. Final architecture/lint results and push evidence are in the build report.
These checks validate the reuse candidate; they are not proof of a newly implemented report page.

The desk must copy the explicitly requested M5 handoff report to the canonical Studio path in
the Decision row before its Rule 102 review. Creating that directory here returned Permission
denied. No desk file was placed in the worktree's `.instar/` directory.

Actual product size is zero. Row 90 remains OPEN. Public publishing, file editing and a file
browser are outside this slice. Live acceptance requires creation, a real conversation-delivered
private link, phone rendering, absent/other-person credentials refused, missing/expired views
refused, and restart/send uniqueness evidence. A model-facing creation contract also requires
the named genuine recorded-shape replays with update IDs; none is claimed here.

simplestRobustRoute: Port 1.x create/get and markdown presentation through the existing private dashboard session and durable conversation/send machinery. Do not introduce a port, bearer-link substitute, public service or file capability. The complete adaptation is estimated above this task's 150-line gate, so this submission records the finding without a partial implementation.
80/20: Existing surfaces and the exact 1.x implementation are identified; the explicit size exit condition is reached. Product completion and independent acceptance remain unclaimed.
VERDICT: author research submission; stopped before implementation under the assigned size gate, awaiting desk scope disposition
