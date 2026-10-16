# Change review — operator-local packet times

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: model-facing journal dates and sibling dispatch facts carry the configured operator-local clock and explicit zone, including daylight saving changes.
Affected rules: 1, 26, 34, 36, 45, 49, 70, 74, 96, 101, 102, 111, 113, 116, 117
Affected floors: secrets — existing redaction and audience checks precede rendering. Spend cap — no new model call. Stop — dispatch guards unchanged. No duplicate sends — no send or effect changes. Durable intake — journal UTC timestamps and durable schemas unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: changes model context rendering, without changing interpretation, standing, scheduling or delivery.
Side effects: local strings take more bytes than epoch timestamps and UTC strings; existing packet and sibling bounds measure rendered bytes. The single cached Intl formatter avoids repeated allocation while keeping memory bounded. Source labels, summary provenance, channel imports, obligation context, concurrent-run context and carried memory use local dates. Literal quoted historical text stays verbatim. Machine-readable clock and resolution bindings retain their explicit UTC/epoch protocol. The packet auditor accepts exact legacy UTC and exact configured local representations, and rejects a UTC clock mislabeled Pacific. Historical packet pins require a reviewed update. Refreshed generated register artifacts with the shipped replay builder against the committed source; the downloaded desk repin chain and owner-manifest tool found no additional pins to change.
Undo and recovery: revert this change; there is no journal migration. Old UTC packets remain auditable and every future packet is reconstructed from original numeric instants.
Multi-machine posture: rendering uses the existing configured operator timezone on each runner, independent of the host timezone. Existing replication, topic ownership, receipts and freshness boundaries remain unchanged; no new state is replicated or claimed instantaneous.
Layer below: inspected isoMinute, localParts, timeZoneOf, packetFor, currentActionFacts and actual dispatch callback, journal receipt ordering and byte caps, groupCarryPacket and concurrentWorkItem, and date validation in the journal auditor. Sort and authority decisions still use numeric timestamps before formatting.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-packet-time.test.ts
Hook bypass: none
Convergence: none
Decision: sibling-time-render | render only model context dates using the existing configured zone; preserve raw journal and date-resolution protocol instants | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-time-1016-PROGRESS.md
Decision: sibling-time-audit | accept exact old UTC and new local audit shapes while rejecting mislabeled UTC clocks; update affected packet pins without rewriting captures | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-time-1016-PROGRESS.md
Prompt review: real recorded summary, uncertain summary, Jev undecided/unsure, reply-review, delivered and empty reply shapes are replayed by journal-topic-sessions with local times asserted in delivered input. twosession-1015.json.gz updates 715676486 and 715676488 replay actual packet construction, output parsing and review with Pacific sibling times asserted. No new live-provider success or live Telegram proof claimed.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged.
Prompt finding: e8708c7fea24 | protocol-literal | existing memory source-label guidance in journal.ts, unchanged.

Prompt finding: 4106b49fff07 | protocol-literal | unchanged historical grounding instruction restored by the pre-existing topic-awareness packet-pin test, not a new model trigger.

## Closing block

simplestRobustRoute: this is the simplest robust route: render existing timestamps with Intl in the already-configured operator zone at the context boundary. No new config, clock, journal field, watcher or model call. It prevents the observed UTC-as-Pacific error without asking the model to do timezone conversion. Start guards remain audience and receipt verification; the end state is local zoned text in the actual dispatch; limits remain existing measured packet budgets. No autonomous shipped-path completion claim.
80/20: prove PDT, PST and UTC neighbors, actual dispatch wiring and recorded model shapes; run targeted consumers and required machine checks before desk gate. No independent convergence claimed.
VERDICT: author submission; independent desk review pending
