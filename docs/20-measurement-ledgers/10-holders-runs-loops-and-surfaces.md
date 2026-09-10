## 10. Holders, runs, loops and surfaces

**Rule — configured is not alive.** Rules 37, 39, 62, 69, 72 and 73; **checks:
P16-NF-42–44/49/52**. Each required collector, coverage projector, price resolver, retention
worker and surface has a part-nine holder with a fresh proof of running. Proof includes exact
artifact and adapter versions, register generation, last eligible input and output frontiers,
last successful tick, lag, failure counters, supported measurement families and an independent
probe. A file, table, timer declaration, process existence or successful startup log cannot
satisfy the holder.

**Rule — collection work is durable and loop-governed.** Rules 8, 46, 52, 60 and 88;
**checks: P16-NF-43–45**. Backfill means importing older observations that predate the currently
collected range. Backfill, reconciliation, retention and benchmark joins run as part-five
durable runs with six-owned cursor, lease, finite page, retry, backoff and recovery records. A
session may execute one step but does not own the assignment. Ticks do not overlap. A restart
resumes from an admitted cursor; an uncertain append is observed before another attempt. Retry
exhaustion leaves an open obligation and coverage deficit. It never turns the prior failure into
an empty successful page. The landed `BoundedDueScanPort` supplies selection and an admitted
cursor only; it does not schedule or execute the selected work. The landed recovery path operates
only on an existing claimed operation through eight's `OperationObservation`, advances by fixed
`minDelay` and exposes `breaker: 'stub-closed'`. It cannot implement this general collector loop
or its adaptive backoff. That full P16-NF-43 arm is non-executable until
`seam-response-loop-followup.md` item #25 lands. Part sixteen adds no private timer or retry loop
around the smaller public ports.

**Rule — public reads are bounded and scoped.** Rules 15, 28, 39, 43, 60, 69 and 98; **checks:
P16-NF-47–49**. Eleven's surfaces query registered projections through mediated reads. Windows,
dimensions, page size, sort keys and export bytes have finite limits. Default views contain no
prompt, response, command line, environment, secret, raw account credential or unrelated user
identity. Authorized diagnostic detail remains scoped and audited. A query timeout returns its
pinned partial horizon or a typed refusal, never an unbounded fallback scan.

The package-local bounded read and privacy renderer are pure and can satisfy the foundation arms
of P16-NF-47/48. They are not an operator surface. This head has no `src/operator` package or
operator export. The addendum to `seam-response-operator-followup.md` explicitly GRANTS
`P16-P11-measurement-spend-surface-v1`; `SEAM-LEDGER.md` row 64 records the authenticated bounded
pull operation and Ten composition, buildable after the Part Eleven implementation lands. The
real-surface arms of P16-NF-03/47/48/49 are non-executable until row 64 lands with its public Eleven
port and Ten composition. The earlier guard-and-repair grant is still a different surface and a
unit renderer is still not the positive. Part sixteen does not fill the gap with a private port,
route or surface record.

---
