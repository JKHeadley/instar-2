# Change review — w4-toolsfull repair round 1: mapped IPv6 refused, grant expiry withdraws tools, interrupted tool turns journaled before retention

Subject base: 35e400da68239183a6ad3148664ea092b40d6931
Review state: open
Reviewed content: none
Outcome: Unit review round 1 (Astra, VERDICT NO) named three must-fix defects; each is fixed at its source. (1) tests/preview/tool-admission.mjs publicAddress: an IPv6 address is now parsed to its 16 bytes in any textual form, and an IPv4-mapped (::ffff:0:0/96) or NAT64 (64:ff9b::/96) address is classified by the IPv4 address it carries; ::/96, fc00::/7, fe80::/10 and ff00::/8 stay refused. URL parsing writes [::ffff:127.0.0.1] as [::ffff:7f00:1], which the old dotted-only check let through. The new test drives the mapped loopback, private, metadata and fully written forms through admitToolCall as denied, and mapped/NAT64 public addresses as allowed. (2) tests/preview/journal-agent.mjs stillGranted: the bytes-only cache is removed; every tools check resolves the sealed authority again at the current time, so a grant crossing its expiry with unchanged bytes, and a missing or unreadable authority (including on the first check), withdraw tools. Two new real-launcher tests (expiry with unchanged bytes; authority deleted) fail on the old code and pass on the new; a dated grant with its expiry ahead still resolves. (3) tests/preview/tool-turn.mjs: retention never removes a turn directory the journal still holds open (openToolTurnSlugs), and at launch, before any new tool turn, reconcileToolTurns journals each open turn whose directory survived a crash from its synced hook record, under the authority its admission config now records, with every child that did not return marked unknown (nothing is re-run). An open turn with no surviving directory stays open. The new test reproduces the review's crash (reservation plus synced Agent and child-start rows, no trace), shows retention keeping it past 16 newer turns, reconcile closing it with one unknown edge, replay matching, then retention removing it; a normally completed neighbour reconciles nothing.
Affected rules: 2 (an interrupted child is recorded unknown, never dropped), 4 (web reads refused by the exact address class; grant scope checked at the current time), 34 (unit and real-launcher tiers; both sides of each new decision), 37 (fixed at source; nothing quarantined), 41 and 58 (the interrupted turn's admitted calls are journaled), 74 (this record), 94, 103 and 104 (tools only while the recorded grant is live now), 101 (plain commits), 113 (turn directories stay machine-local scratch), 114 (child edges survive a crash), 116; Purpose: scoped grants, no silent loss, nothing outward by default
Affected floors: secrets — a web read cannot reach this machine or its network through a mapped IPv6 literal; spend cap — unchanged; stop — an expired or unreadable grant now ends a live tool turn and stops new ones; no duplicate sends — unchanged; recovery never re-runs an uncertain turn; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it repairs the network boundary and authority check of a model-driven tool turn.
Side effects: the turn's admission config gains `authority`; the tools check reads the authority record and verifies its seal on every check instead of only on a byte change (a few milliseconds per poll); a launch may append tool-turn trace rows for turns a crash interrupted; pruneToolTurns takes an optional open set; new exports toolTurnSlug, openToolTurnSlugs, reconcileToolTurns.
Undo and recovery: revert these commits and this record; the trace rows recovery appends are the existing frame shape, so any root opens under either build.
Multi-machine posture: machine-local, unchanged: recovery runs on the owning runner at launch over its own turn directories; the journal rows it appends are what another machine replays.
Layer below: resolveActivationAuthority (unchanged; now consulted on every check); the journal's tool-turn projection (unchanged; a trace closes exactly one open turn); the hook's synced admission record (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: toolsfull-r1-ipv6-bytes | IPv6 is classified from its bytes, and an embedded IPv4 (mapped or NAT64) by the IPv4 rule, instead of matching text | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsfull-PROGRESS.md
Decision: toolsfull-r1-grant-now | the authority is re-resolved at the current time on every tools check (no cache), because liveness depends on the clock as well as the record's bytes; the cost is one file read and seal check per poll | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsfull-PROGRESS.md
Decision: toolsfull-r1-recover-before-prune | retention skips turns the journal holds open, and launch journals surviving interrupted turns with unknown child outcomes before any new turn; recovery runs only at launch because the process owner guarantees no turn of this root is live then | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsfull-PROGRESS.md
Prompt review: none; no model-facing text changed.
Deferral: generated/register.json:1 | not-a-deferral=generated register replay output

Subject (14 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent.mjs, tests/preview/tool-admission.mjs, tests/preview/tool-admission.test.ts, tests/preview/tool-turn.mjs, tests/preview/tool-turn.test.ts, tests/preview/tools-default.test.ts

## Closing block

simplestRobustRoute: the required outcome is that the three reviewed claims hold: web reads never reach this machine or its network, tools exist only while the recorded grant is live now, and a crash never loses a child's evidence. Each fix is the smallest that closes its named failure: byte-level IPv6 classification reusing the IPv4 rule; removing the cache rather than adding expiry tracking; a retention skip plus one launch-time reconcile using the existing trace frame, rather than a new recovery store.
80/20: 0 must-fix, 1 note — an interrupted turn whose directory did not survive stays open with an unknown outcome (status already says so); there is no evidence to journal.
VERDICT: author submission; the independent verdict is recorded as a pass
