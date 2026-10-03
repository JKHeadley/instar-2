# Change review — w4-toolsreal repair round 2: the packet counts its unreserved base call; a partial tool-call excerpt says so

Subject base: 615af0c71c49e7307a234f480b3793a2b7ca02ba
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra, VERDICT NO) named two must-fix evidence defects; each is fixed at its source. (1) The packet was prepared before the answer's reserve (or the work's obligation-start) counted its base call, while the tool turn's own check ran after it, so at seven remaining calls the packet named tools that the dispatch then refused. The runner's toolRoute port now uses toolPacketFits (toolTurnFits with the one unreserved base call); the dispatch check after reservation is unchanged. A test through the real worker, for answers and for scheduled work, shows packet and dispatch agree at seven (none / text-only) and eight (as listed / tools) remaining calls, and fails against the old predicate. (2) The reply review carried at most eight of a turn's tool calls under a meaning that called them the turn's only calls. A trace longer than the bound now carries omitted (the count not shown) and a meaning stating that later calls are not shown and that absence from the excerpt does not show a call or result did not happen; a complete trace keeps the exhaustive meaning. Eight- and nine-call tests, including after reopening the journal.
Affected rules: 45 and 78 (the model and its reviewer receive true capability evidence: the packet names tools exactly when its dispatch runs them), 58 and 84 (the review is told truthfully what its excerpt covers), 34 (unit tier through the real worker and journal), 36 (both sides of each decision boundary tested), 37 (fixed at source, nothing quarantined), 60 (call cap unchanged), 74 (this record), 101 (plain commits), 116 (one added argument and one optional field; no new service)
Affected floors: secrets — unchanged; spend cap — unchanged: dispatch still checks the whole liability after reservation, and the packet is now no more permissive than the dispatch; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what a model and its reviewer are told about tool capability and tool evidence.
Side effects: toolTurnFits takes an optional unreserved count; new exports toolPacketFits and TOOL_ATTEMPTS_PARTIAL_MEANING; a Turn gains toolAttemptsOmitted (projected from the trace row; no frame kind changed); the review's toolAttempts gains omitted when the trace exceeds TOOL_ATTEMPTS_REVIEWED.
Undo and recovery: revert these commits and this record; no journal frame changed, so any root opens under either build.
Multi-machine posture: machine-local, unchanged.
Layer below: the journal projection of tool-turn trace rows (now also records the omitted count), declaredObligations (chooses the meaning), the answer and scheduled-work packet builders (unchanged; they consult the toolRoute port before their own reservation row).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: toolsreal-r2-packet-unreserved | the packet's predicate adds the one base call its own reserve/obligation-start has not yet counted; both packet builders call toolRoute before that row, so one constant serves both, and the dispatch check stays after reservation | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsreal-PROGRESS.md
Decision: toolsreal-r2-partial-excerpt | the review excerpt stays bounded at eight calls; when the trace is longer it carries the omitted count and a meaning that withdraws the exhaustive claim, rather than carrying every call | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsreal-PROGRESS.md
Prompt review: model-facing change to the reply reviewer only: when a tool turn made more than eight calls, toolAttempts.meaning is "The first tool calls this reply's turn made, in order, with their admission and result; `omitted` later calls are not shown. A refused call is not an attempt at an avenue. A tool result the reply reports may come from an omitted call, so its absence here does not show that the call or result did not happen." and toolAttempts.omitted is the count. Eight or fewer calls keep the existing meaning byte-identical. On the answer and work packets the wording is unchanged; only the boundary at which the tool wording appears moved by one call. No test phrase is copied. Real shape replayed: the recorded live task trace (fixtures/tool-turn/live-2026-10-03/task.json, three calls) still yields the exhaustive meaning through the real review-context builder; no new paid model run.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent.mjs, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: one optional argument to the existing predicate (the packet passes its unreserved base call) and one optional count on the existing review excerpt with a truthful meaning; no new retrieval service, no reordering of the reservation rows.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
