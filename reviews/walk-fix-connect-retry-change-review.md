# Change review — walk-fix-connect-retry: proven never-sent answers retry with bounded backoff

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: a send the transport proves never reached Telegram is tried up to four times with 2 s, 10 s and 30 s waits instead of twice back to back (walk-24 run A msg 6).
Affected rules: 14, 42, 55, 74, 77, 95, 113, 116
Affected floors: secrets — unchanged; spend cap — no model call added; stop — checked after every wait, a stop settles the send refused; no duplicate sends — retries only on the transport's never-sent proof, same intent and verification, unknown outcomes never repeated; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: touches the one outbound dispatch funnel.
Side effects: a persistent connect outage now holds the worker up to about 42 s per send before the refusal notice; phase-timing rows show up to four attempts.
Undo and recovery: revert the commit; two back-to-back tries return. Recorded outcomes keep their meaning.
Multi-machine posture: machine-local send funnel; no shared state or ownership change.
Layer below: inspected the bridge's connectionNeverOpened/observedNeverSent proof and its own inner retry (unchanged), classifyTelegramSend not-sent mapping, and the refused-notice path.
Bug class: unit
Bug evidence: reproducer=tests/preview/delivery-failure-notice.test.ts (recorded reason 'ETIMEDOUT/connect'; two and three outages now deliver, four still refuse; an unknown outcome is never retried)
Hook bypass: none
Convergence: none
Decision: connect-retry-in-dispatch | widen the existing bounded loop rather than add a durable re-dispatch queue; a later redispatch would need a new intent state and is a larger unit | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/walk-findings-1020-PROGRESS.md
Prompt review: not model-facing. Recorded shape replayed: run A frame 149 send-outcome reason.
Prompt finding: 4106b49fff07 | protocol-literal | existing tool-attempt honesty guidance in journal.ts, unchanged by this unit.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response contract in journal.ts, unchanged by this unit.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label and uncertainty guidance in journal.ts, unchanged by this unit.

Subject (6 paths): tests/preview/delivery-failure-notice.test.ts, tests/preview/journal-send-outcome.test.ts, tests/preview/journal-test-worker.ts, tests/preview/journal.ts, tests/preview/phase-timing.test.ts, tests/preview/renewal-result-send-outcome.test.ts

## Closing block

simplestRobustRoute: extend the existing in-process retry loop with a backoff. This is that route.
80/20: outages longer than about 42 s still lose the answer; a durable later re-dispatch is a separate unit.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
