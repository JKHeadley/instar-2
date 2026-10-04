# Change review — w4-dashboard repair round 1: truthful message outcomes, scheduled updates, the shared-access disclosure, the outbox read boundary, and staleness on every view

Subject base: 1a3a85f0a46923a6698a912a2cf947f7eca3161b
Review state: open
Reviewed content: none
Outcome: Unit review round 1 (Astra, VERDICT NO) named five must-fix defects; each is fixed at its source. (1) The page's snapshot check treated a turn's update as an integer, so a scheduled reminder's due turn (the journal's 1/1024 grid, e.g. the live 6230515.0009765625) refused the whole snapshot and its detail route 404ed; the page now accepts exactly the journal's update domain (isDashboardUpdate) and one DETAIL_PATH serves the renderer and the HTTP route, while off-grid values are still refused. (2) The request projection dropped operatorRequestsReport's sharedAccess; each request now carries { account, disclosure } or null, and the request detail and the waiting list's earlier requests show the disclosure. (3) The snapshot carries message excerpts but was written 0644 into a 0755 outbox; publish now refuses an outbox open to other accounts and writes 0640, and the README installation prescribes a 0750 outbox whose group is shared with the page's user. (4) The age or unavailability notice moved into the common page path, so every view and detail page says a snapshot is stale, missing or unreadable (a stale stop reads as last reported), and F6 now checks every view with a negative control for a stale detail page that drops it. (5) Each message's state and reply come from sendOutcomeOf/replyTarget and the limited answer's lead: accepted, refused and UNKNOWN are settled and say so (never "Sending"), an unrecorded outcome says it is not confirmed, and every turn a limited answer covers shows that answer and its lead's outcome.
Affected rules: 81 (F6 now holds on every view, with its negative control), 2 (the loss detector on every view), 26 and 42 (message states read the journal's settled send outcome; refused and UNKNOWN are never shown as in progress or delivered), 106 (the recorded live scheduled-update shape publishes and its link resolves), 36 (both sides of each boundary: on-grid vs off-grid update, shared vs independent approval, 0750 vs 0755 outbox, stale vs fresh, accepted vs refused vs UNKNOWN vs unrecorded, delivered vs refused limited answer), 37 (fixed at source, nothing quarantined), purpose least revelation (excerpts readable only by owner and the page's group), purpose approval-account exception (the disclosure rides every display of such an approval), 74
Affected floors: secrets — unchanged: excerpts stay redacted, and now are not readable by other local accounts; spend cap — unchanged: the dashboard grants nothing; stop — unchanged in mechanism; a stale stop view now says it shows the last reported state; no duplicate sends — unchanged: nothing is sent, and refused/UNKNOWN sends are shown as not resent; durable intake — unchanged: the snapshot is derived from the journal and never feeds back
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes the operator-facing page behind the operator's credential and the local access boundary of transcript excerpts.
Side effects: the snapshot request record gains sharedAccess (the page refuses the old shape, so a runner and page must be on the same build; the snapshot is disposable and republished every cycle); publish refuses an outbox with any other-account permission bit, so an installation with a 0755 outbox stops receiving dashboard snapshots until it is set to 0750 with the page's group (approval requests are unaffected); turnState is replaced by turnOutcome(view, turn).
Undo and recovery: revert these commits and this record; the journal format is unchanged and the snapshot file is disposable.
Multi-machine posture: machine-local, unchanged.
Layer below: the journal's sendOutcomeOf, replyTarget and operatorRequestsReport (unchanged, now read), the approval surface's route handling (one shared path check), writeOnce (unchanged; an explicit chmod makes the group bit independent of umask).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: dashboard-r1-unconfirmed | an intent with no recorded outcome (in flight or the crash gap) is shown as "Sending ...: not confirmed delivered yet" rather than UNKNOWN, because a just-dispatched send is genuinely unconfirmed and the wording claims no delivery either way; a recorded UNKNOWN says UNKNOWN | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-dashboard-PROGRESS.md
Decision: dashboard-r1-read-boundary | publish enforces the boundary at the outbox directory (no other-account bits) and the file (0640), instead of an ACL or encryption; it is the simplest check that makes the documented installation the only one that publishes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-dashboard-PROGRESS.md
Prompt review: no model-facing text changed; the dashboard is read by the operator, never by a model.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (15 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/approval-surface.mjs, scripts/check-dashboard-floors.mjs, scripts/operator-dashboard.mjs, tests/preview/README.md, tests/preview/approval-surface-client.mjs, tests/preview/operator-dashboard-launcher.test.ts, tests/preview/operator-dashboard.test.ts, tests/preview/operator-dashboard.ts

## Closing block

simplestRobustRoute: read the journal's existing outcome, disclosure and update-domain facts instead of re-deriving them; one shared notice in the common page path; one permission check before publishing. No new service, monitor or protocol, and no agent ability removed.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
