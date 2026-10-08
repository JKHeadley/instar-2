# Change review — due-turn declaration repair

Subject base: c693df00df67f002dc0dc41e9687011a27aa4f05
Review state: open
Reviewed content: none
Outcome: Runner-authored requested actions do not re-ask the model to repair date declarations that the existing answer consumer discards. Valid due answers retain their original supervised packet and use one model call. Operator turns keep exact date validation and their bounded repair opportunity.
Affected rules: 4, 28, 57 (operator standing unchanged); 26, 38, 41, 58 (coverage remains tied to the actual supervised packet); 34, 36, 37, 70 (reproduced regression and recorded-output tests); 49, 74, 111 (review and consumer inspection); 55, 60, 75 (avoid unnecessary reserved call); 69, 90 (generated pins/register); 101 (no bypass); 102 (decisions recorded); 112, 113 (history and ownership preserved); 116 (one existing-path condition).
Affected floors: secrets — no new exposure or credential path; spend cap — eliminates a needless call and preserves metering and caps; stop — unchanged stop gate; no duplicate sends — one send including a repeated due scan and unknown-send regression; durable intake — existing journal and records unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The repair changes when the answer model is re-asked, on an existing user-facing requested-action path.
Side effects: Requested actions no longer spend a retry on any dated declaration, including malformed or nonempty ones, because they cannot authorize dates. Promise and fulfillment validation remain unchanged. Operator dated declarations still retry and refuse exactly as before. No new state or protocol. A legitimate retry for other defects can still replace a prompt; this repair makes no broader coverage claim.
Undo and recovery: Revert the repair and regenerate pins/register. Journal compatibility is unchanged; no migration or production-state repair is required. The prior behavior can waste a model call and report missing due coverage again.
Multi-machine posture: The current journal owner follows the same logic on every machine; ownership, replication, forwarding and single-machine support are unchanged. No new machine-local store.
Layer below: Inspected datedFrom, operatorWriter, declarationDefect, the requestedAction projection that clears dates/invalidDate, format-retry prompt replacement, and stepCoverage packet-digest matching. Kept the existing authority checkpoint instead of weakening exact source validation or accepting unrelated supervision.
Bug class: live-path
Bug evidence: reproducer=tests/preview/business-step-supervision.test.ts; live=tests/preview/fixtures/flap-a-declarations-2026-10-04.json
Hook bypass: none
Convergence: none
Decision: flapa-repair-due | Skip dated repair only where the existing requested-action consumer discards dates; retain operator validation and existing supervision matching | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-a-p2-repair-002055-PROGRESS.md
Decision: flapa-repair-evidence | Use the five nearest regression files and captured model-shape replays; preserve the Studio file API limit and report unavailable saved gate results rather than alter Studio configuration or manufacture test evidence | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-a-p2-repair-002055-PROGRESS.md
Prompt review: No prompt text or parser changed. The repair removes a request to repair ignored fields. Real dated output 6232376 exercises the requested-action branch without retry, while the same recorded operator output remains single-call and invalid operator output 715674175 still selects repair. Recorded unsure, undecided and uncertain results retain those outcomes in the existing readers.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory reply is unchanged; its test asserts the literal.
Prompt finding: bd01de21286a | protocol-literal | Existing sourceLabel instruction is unchanged; its test checks delivery.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing operator-history guidance is unchanged; its test checks delivery.

Register validation: The delegated owner-manifest rehash and inventory repin both found zero changed pins. The register was replayed against repair commit 9337201ed22640c2566c15c71893df18cf144a36; only generated outputs changed. No pin was edited by hand.

## Closing block

simplestRobustRoute: This is the simplest robust route: align one retry predicate with the existing downstream authority rule, instead of adding state, a judge, or weakening packet-digest evidence. Start is a runner-authored requested-action turn; end is its unchanged answer/send path with no new operator dates; existing shared cap, stop and one-retry limit remain. Recorded-output worker replay proves branch selection, not a new unattended provider exchange.
80/20: Reproduce the exact full-gate failure, test ignored declarations and recorded positive/negative operator neighbors, then regenerate and run cheap checks. Full-suite and independent landing evidence belong to the desk pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
