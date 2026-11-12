# Change review — record reply attribution after delivery

Subject base: d3d563cd1c2396a72bf08fc08c7a7740be419ca8
Review state: open
Reviewed content: none
Outcome: With --attribution-replies record, delivered reply text is checked in the existing post-send review lane. The journal records credited spans, people, references and whether each reference resolved to a logged message. The option is absent by default. It never revises, refuses, excises or waits before sending a reply, and does not turn on note-write checks.
Affected rules: Rules 10, 36, 41, 58, 60, 74, 75, 77, 86, 101, 102, 113, 116, 121.
Affected floors: secrets — unchanged recorded model doorway and encrypted journal; spend cap — existing attribution reservation and token settlement; stop — existing gate and halted checks; no duplicate sends — no send-path changes; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Dark reversible signal-only addition through existing journal and model-call mechanisms, no new enforcement authority.
Side effects: When enabled, post-send recording consumes existing model allowance and competes within the serial review lane. No source-found flag claims authorship or semantic support. Missing or unreadable judgment remains unchecked. A split reply records only parts carrying delivery receipts.
Undo and recovery: Relaunch without --attribution-replies. Existing rows remain readable by the existing attribution journal projection. Reservations survive restart as unchecked and are not paid again. No schema migration or new store.
Multi-machine posture: Runs only on the journal-owning host. Uses existing journal replication and authenticated turn/import lookup, with no new peer service.
Layer below: Read the constitution in full, 979a1282 attribution.ts and change review, the base note-write slice fad825fb1, source resolver, journal reservation/projection, post-send serial review lane, launcher model recorder and startup capability observation. Existing note-write enforcement remains untouched in behavior.
Bug class: integration
Bug evidence: reproducer=tests/preview/attribution.test.ts
Hook bypass: none
Convergence: none
Prompt review: Existing attribution-judge-2.0-v2 question and parseAttributionAnswer reused unchanged. New send caller replays captured attribution outputs and the existing live/proofroom summary, Jev, review and delivered-empty shapes. Those unrelated shapes remain unchecked, never permission to alter a reply.

1.x comparison: Searched actual JKHeadley/instar origin/main 3ae8208a69b027ad465dca78ec7db2eb2c16b66e src/, docs/specs/ and history. Read src/core/attribution/AttributionJudge.ts, findSources.ts, src/server/attributionRoutes.ts and docs/specs/attribution-paper-trail.md; history aeef135a8, c3529b2f7, 33628f375. Reuse extracted span/person/reference shape and exact source lookup. Find suggestions and trace history are evidence, not authority; a miss is not proof of falsity. ONEX-LESSONS sections 5/6 reinforce meaning-based recall, truthful scope and consumer-level tests. The 2.0 base already carries the 979a1282 parser/source/journal code through fad825fb1; this unit extends that code rather than recopying it.

Decision: attr-record-after-delivery | Reuse the existing serial post-send review lane so attribution never waits before a reply is sent; delivered parts are checked separately and unsent parts are excluded. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-record-1111-PROGRESS.md
Decision: attr-record-separate-switch | --attribution-replies accepts record only and leaves the existing note-write switch independent; startup capability observation includes either switch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-record-1111-PROGRESS.md
Decision: attr-record-found-is-lookup | sourceFound means the referenced journal message resolved, not that its sender or wording supports the claim; missing reference is false, unavailable judgment stays unchecked. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-record-1111-PROGRESS.md

Prompt finding: 105c1569b6bb | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

Prompt finding: 4106b49fff07 | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

Prompt finding: 7ef11b68103f | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

Prompt finding: 849db3a6296a | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

Prompt finding: 85544c20941f | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

Prompt finding: 9f0106c66027 | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

Prompt finding: bac6ce7485d9 | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

Prompt finding: e8708c7fea24 | protocol-literal | Existing fixed protocol or briefing wording in journal.ts, unchanged by this addition; no new decision branches on it.

## Plain-language review and side effects

An agent can say that someone set a rule without being able to show where that person said it. This change makes those credits inspectable without changing the answer the person receives. When the explicit recording option is enabled, the agent sends its reply normally. The existing background review pass then reads the delivered text, asks the existing attribution judge which words credit a person, and appends the resulting observations to the encrypted journal. Each credited span carries the person named and whether its source pointer found a logged message. A found message is not proof that the claim is faithful or that the person authored it; those remain separate judgments. When no judgment is available, the journal says unchecked. Recording has no permission to block, revise or remove words. It uses the existing call allowance and stop checks, so enabling it costs some of the allowance already granted rather than creating a new budget. Restarting preserves completed checks and reservations, preventing duplicate paid calls. Turning the option off stops new reply records while keeping existing history readable. The existing note-writing feature has its own switch and is not enabled by this option.

Over-block: none added; the new surface always returns no refusal. Under-block: deliberately no enforcement, unknown sources remain observable only. Abstraction: existing journal model-call and review owners. Signal vs authority: records only, no new authority. Interactions: serial with existing post-send reviews; consumes the same bounded allowance. External surfaces: existing model doorway only, no new notification or route. Rollback: switch off; journal remains compatible. Missing judgments and long inputs keep the existing explicit unchecked record.

Verification: See attribution-record-1111-PROGRESS.md for commands and exit codes; author submission does not claim live deployment.

## Closing block

simplestRobustRoute: Reuse the attribution parser, exact source lookup, reservation and journal projection already present on train-230, extending the existing post-send review lane. No new queue, timer, gate, provider or store.
80/20: Only reply recording is added. The desk's separately assigned refusal/revision/excision, write-check expansion, long-note chunking, trace command, status text, enforce mode and allowance tuning are not part of this unit.
VERDICT: author submission; independent landing verdict belongs to the desk
