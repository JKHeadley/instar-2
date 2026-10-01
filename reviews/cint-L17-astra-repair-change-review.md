# Change review — cint-L17 Astra repair: the floor's set-aside enters continuity accounting

Subject base: 859e49e0833e66af2394b4fed1e8cdf19ddb1da7
Review state: open
Reviewed content: none
Outcome: Astra's cint-L17 MUST-FIX 1 is repaired at its source. History the reachability floor set aside without a summary was shown to the model as a historySetAside field only: the packet still said historyMode complete, the grounding recorded no frontier, so no Rule 110 continuity account or disclosure reached the sent reply, and the inspect view omitted it. Now the grounding records setAsideThrough; one helper (continuityFrontier) picks the frontier that lost verbatim history (the set-aside always lies above a summary's, so the higher one is the account); the packet's continuity note, the sent reply's disclosure and the intent's account all come from the existing continuityFor path, with basis 'set-aside' and truthful wording ("no longer fits in my view; it is kept and I can search it, but it is not summarized"), the last inbound's actual disposition, and the existing confirmed-versus-UNKNOWN retirement unchanged. Replay binds the basis to its wording and to the grounding's frontier. A floored packet reports historyMode recent-only; the packet audit accepts recent-only only with historySetAside and no summary. The inspect projection carries historySetAside, and the read-only probe now reaches the same floor a real turn does (it reported a size hold the real path never makes). Astra's own reproducer, replayed on the repaired tree: update 29, recent-only, 14 set aside, continuity account basis set-aside disposition addressed, sent text opens with the set-aside disclosure, no audit findings.
Affected rules: 110 (set-aside history is accounted and disclosed on the sent reply), 26 (no complete-history claim; truthful unsummarized wording on the reply, packet and inspect view), 2 and 9 (the gap stays counted and audited), 95 and 96 (no size hold reintroduced; the floor remains degraded grounding, not summary coverage), 74 (this record), 102 (one decision below), 106 (Astra's recorded-overcap reproducer replayed), 69 and 90 (register regenerated with --replay), 116
Affected floors: secrets — unchanged (the disclosure carries update numbers and dates, never text; redaction untouched); spend cap — unchanged (no model call added; the probe floor is read-only and calls nothing); stop — unchanged (same gate() calls); no duplicate sends — unchanged (the account binds the exact sent text; an UNKNOWN send still retires nothing and is never replayed); durable intake — unchanged (one optional grounding field and one optional account field; older rows replay as before)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a preview-runner fix that routes an existing decision through the existing continuity owner; no new store, call, gate or authority path. The only send-path change is which disclosure text the existing Rule 110 path writes.
Side effects: a reply from a floored context now opens with the set-aside disclosure (once per new frontier, retired by a confirmed send, as for summaries); inspect shows recent-only and the set-aside instead of a context-overflow hold.
Undo and recovery: revert 3ac1922c, its register regeneration and this record. Rows written with setAsideThrough or basis would then be refused by the reverted replay check (an older reader cannot validate a set-aside account), so roll back only a journal that has no floored reply.
Multi-machine posture: machine-local: the single preview runner
Layer below: reviews/cint-L17-change-review.md (base); reviews/w3-summarystall-change-review.md (the floor)
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-overcap-frontier-stall.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L17-probe-reaches-floor | the read-only probe (the inspect view's "what would a next message get") now falls back to preparedWithFloor exactly as a real turn does after preparation fails; without it, inspection reported a context-overflow hold the real path never makes, which is the inspection-evidence half of the must-fix. No summary is attempted and nothing is appended | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L17-PROGRESS.md
Prompt review: changed operator-facing text: the Rule 110 disclosure gains a set-aside variant that says the earlier messages are kept and searchable but not summarized; model-facing packet: historyMode may now be recent-only and the continuity note may carry basis set-aside. Both are factual statements derived from journal evidence, not instructions.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as dispositioned in the carried record)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in the carried record)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in the carried record)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (14 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-agent.mjs, tests/preview/journal-audit.mjs, tests/preview/journal-boundaries.test.ts, tests/preview/journal.test.ts, tests/preview/journal.ts, tests/preview/recall-latency.test.ts, tests/preview/summary-overcap-frontier-stall.test.ts

## Closing block

simplestRobustRoute: carry the existing set-aside decision through the existing grounding and continuity owner with one frontier helper and a basis field; no new store, call or gate
80/20: 1 must-fix repaired, 0 open; targeted tests only (the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
