# Row 90 research and authorized private-report continuation

Subject base: d1823a36e8b0a3c155dbc723dd6aebc0666e9934
Review state: open
Reviewed content: none
Outcome: This record covers the original research and its authorized implementation continuation, as reviewed in carryover-90-private-view-1112-p2-change-review.md. The answering agent can save this operator's own private-conversation reply as a bounded, seven-day Markdown report. The durable reply includes the report link when the existing dashboard listens on its configured private address; loopback-only operation states that the page exists but cannot yet open from the phone.
Affected rules: 7, 28, 32, 33, 34, 36, 43, 47, 49, 57, 60, 62, 63, 74, 78, 79, 80, 81, 84, 89, 101, 102, 106, 111, 113, 116, 120, 122, 123; Purpose least revelation and durable cause.
Affected floors: Secrets are checked on the page title/body before intent and again at HTTP lookup. Spend, stop, durable intake and no duplicate sends retain their existing worker and journal gates. No new effect dispatcher or credential is introduced.
Operator questions: none; the desk authorized option 1 of C90-SIZE-STOP, up to 300 measured changed product lines, and owns private dashboard installation and phone proof.
Suggested tier: significant
Declared tier: significant
Tier rationale: A user-facing private-content surface and model output contract, on existing authentication and durable send machinery.
Side effects: Adds marked 17.0.5 (the 1.x GFM renderer), optional answer/intent fields, generated capability awareness, and a report-only return path after PIN sign-in. Existing answers without the explicit field create no reports. Report content is also delivered in the ordinary reply so existing promise/fulfillment and disclosure handling stays intact.
Undo and recovery: Revert the feature commit and regenerate the register; no existing field or store format is replaced. Old readers ignore the optional report fields, retain the original intent and send fence, and stop serving the new route. Restart reconstructs reports from encrypted journal records and invalidates dashboard sessions as before.
Multi-machine posture: The report is part of the owning conversation's existing durable intent, with source turn/update and operator/chat binding. The existing journal store declaration (preview.journal.openPreviewJournal) applies: local durable operation with one machine; lease-holder working journal replicated and acknowledged before send with an enrolled peer. No independent file store, remote fetch or new routing authority. The URL identifies the issuing dashboard; a host without the retained journal cannot serve the content, and this slice adds no failover URL rewriting.
Team posture: Explicit team-of-one exception for this first slice: creation requires the verified operator's private conversation, viewing requires that operator's existing dashboard PIN session. A group, member or guest receives no report ownership or shared access. Sharing requires the owner's signed team record and separately authenticated roles; this slice cannot widen access.
Layer below: Inspected the live-runner dashboard wiring, readOnlyDashboardOf/checkListen private address restriction, PIN verifier/session map, encrypted journal replay and compaction, operatorWriter/verifiedOperatorTurn source binding, final reply review/secret checks, signed intent and send-claim restart behavior; compared the actual 1.x renderer/routes/middleware. The desk supplied one loopback-only live listener; a reachable phone address is not assumed.
Bug class: none
Bug evidence: Feature carryover with worker/HTTP positive and negative tests, durable restart and recorded-shape replay; not a claim of installed phone acceptance.
Hook bypass: none
Convergence: none
Prompt review: The new privateViewTitle field requests a page of the current complete reply. It does not infer user intent from keywords or specify a judge's verdict. Existing recorded summary/uncertain/Jev/review/empty reply outputs do not create pages; an explicit creation envelope around a genuine delivered reply exercises the new path. Independent Astra judgment remains the desk's acceptance step.
Decision: C90-SIZE-STOP | Stop implementation at the assigned size gate: estimated complete slice 190-260 product lines, excluding tests and documentation; present reuse and prerequisite options. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-90-private-view-1112-build-report.md

Integration continuation: train-239 extends this open record through the reviewed implementation so its checked subject is the implemented feature. The original research below is historical evidence from 42807267ed1e69a0b1238579a39ada8231b1649d: its zero-product and size-stop statements describe that earlier research stage only. The p2 record and canonical p2 report hold the authorized implementation, measurements and limits. Product bytes are unchanged by this record repair.

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

simplestRobustRoute: This is the simplest robust route: port 1.x create/get/GFM onto existing dashboard authentication and durable reply intent. Reusing the final reviewed answer prevents a separate unreviewed body; a seven-day access lifetime and existing answer bounds prevent unbounded serving; source/operator binding prevents cross-person disclosure. Start is an explicit field on an admitted operator answer, end is the durable send intent plus authenticated GET, and limits are the existing stop/spend/secret/send gates plus exact owner/size/expiry checks. The desk's live phone installation/proof remains unclaimed.
80/20: One bounded create/get slice reuses current ownership, storage, delivery, phone style and authentication. No public publishing, file API, extra port, bearer-link service or sharing machinery was added.
VERDICT: author submission for independent desk/Astra review; local proofs and remaining installation limits are reported separately
