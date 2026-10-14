# Change review — rolling summary producer

Subject base: 6e5f5b67cc72c2fe319a27d829392c1d2cd9a4bf
Review state: open
Reviewed content: none
Outcome: Extract the selected-frontier rolling summary producer into the core, call it from the existing background tick, preserve the journal protocol and record exact coverage visible after reopen.
Affected rules: Rules 1, 4, 5, 7, 30, 32, 33, 34, 35, 36, 38, 41, 42, 45, 49, 55, 60, 63, 67, 74, 75, 86, 95, 96, 101, 102, 111, 113, 116.
Affected floors: secrets — existing redaction before prompts, audit and commit; spend cap — the same durable reservations before every paid call, UNKNOWN remains charged; stop — checks after await before further calls and commit with completed metering retained; no duplicate sends — no sender in the producer and existing UNKNOWN retry fencing retained; durable intake — original encrypted messages remain intact and full raw coverage is the refusal fallback.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Existing model-facing acceptance orchestration moves into src; both boundaries and real recorded shapes must be exercised. The brief exempts publication pins, recorded-replay certificates and R105 certificate as READY preconditions. The desk owns live proof-room and Studio gate execution.
Side effects: New accepted summary frames have an optional covers field. Legacy frames keep their read projection. New frames are validated against the shared received-message projection, and the read port refuses stale/mismatched coverage. A changed source during a call now refuses immediately before another paid call. The current owner still selects spans, validates memory and enforces retries. Shared decoders retain their bytes behind compatibility exports.
Undo and recovery: Revert this extraction to restore the previous orchestration. Old readers ignore the optional covers field, so no data migration or destructive rollback is required. Reopen preserves reservations and unknown outcomes; original conversation frames are never deleted.
Multi-machine posture: One authenticated journal owner and its existing physical append/fence. Core source revision includes conversation, corrections, retractions, open work and recorded authority state. No new shared store, owner election or independent retry loop; a changed owner revision refuses acceptance. Other machines continue using their existing host ownership and transfer protocol.
Layer below: Read both constitutional documents in full and compared them with origin/main (identical). Inspected runSummary, summary reserve/candidate/check/failure/commit folds, UNKNOWN/call-cap accounting, groundingHistory/liveSummaries, read-port prefix selection, correction validation and the shared decoder. Preserved the existing faithfulness-stop refusal disposition and integrity-stop exception, including completed token metering.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: summary-producer-1013-extract | Move one selected-frontier transition and pure decoders; keep selection, retry and source validation with the journal owner. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-producer-1013-PROGRESS.md
Decision: summary-producer-1013-revision | Check semantic source revision after awaited work and before commit, excluding the attempt's own accounting frames. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-producer-1013-PROGRESS.md
Decision: summary-producer-1013-coverage | Persist exact received-message IDs, share the producer/read projection and preserve legacy-row compatibility and full-history fallback. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-producer-1013-PROGRESS.md
Decision: summary-producer-1013-evidence | Reuse captured writer/Jev/review regressions and recorded-walk encrypted lifecycle tests; synthetic neighbors supplement rather than replace them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-producer-1013-PROGRESS.md
Prompt review: The old audit regression expected a summary to commit across an operator correction; it now verifies the required stale-source refusal with intact correction audit lineage after reopen. No prompt wording or semantic threshold changes. Faithful descriptions of uncertainty are accepted; uncertain paid outcomes stay UNKNOWN. Exact coverage and source-revision checks are structural, never keyword judgments. Missing coverage refuses without dropping the source.

Prompt finding: e8708c7fea24 | protocol-literal | The existing general recall instruction requires source attribution and disclosure of unknown sources; it is unchanged from the base and does not classify intent by a fixture phrase.
Prompt finding: 849db3a6296a | protocol-literal | The existing fixed empty-memory-list response and its consumer are unchanged from the base; the fixture asserts the protocol response, not a semantic trigger.

Subject: src/recall/README.md, src/recall/journal-summary-plan.md, src/recall/rolling-summary.ts, src/recall/summary-faithfulness.ts, src/recall/summary-check.ts, src/recall/model-json.ts, tests/preview/journal.ts, tests/preview/journal-history-adapter.ts, tests/preview/journal-history-adapter.test.ts, tests/preview/journal-audit.test.ts, tests/preview/summary-faithfulness.ts, tests/preview/summary-check.ts, tests/preview/model-json.ts, tests/recall/rolling-summary.test.ts, generated/

## Closing block

simplestRobustRoute: This is the simplest robust route: extract the established acceptance transition behind existing owner ports, without copying the journal or adding a second scheduler/store/retry authority. Exact coverage prevents a missing-prefix summary from displacing history; semantic source revision prevents committing stale model work. Start guards are owner snapshot and admission, end guards are unchanged faithfulness/integrity checks plus source freshness, and limits remain the existing spend, prompt and attempt caps. Recorded unattended tick replays establish wiring; live-provider and live-user acceptance are not claimed by this builder.
80/20: Preserve prompt/decoder behavior, test both sides of new coverage and revision checks, run recorded shapes through the actual driver, then the targeted importers and required checks. Studio-only proof remains the desk's gate under the brief.
VERDICT: author submission; independent review belongs to the desk
