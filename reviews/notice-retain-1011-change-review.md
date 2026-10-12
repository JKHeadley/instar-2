# Change review — retain provider termination evidence

Subject base: 7002feeb7cd44c8ea2ec2500aa005999962ff3b1
Review state: open
Reviewed content: none
Outcome: A provider process that ends without an answer now carries its signal, cancellation category and bounded scrubbed stdout/stderr excerpts into the existing encrypted call-outcome journal, beside exit status and elapsed time. Update 969390396 demonstrated that those facts were lost. No provider outcome, review verdict, retry or send decision changes. The requested notice replacement is not submitted: two candidate-only substitutions into the recorded full-context review failed; evidence is in the desk progress record.
Affected rules: Purpose 2/3; Rules 1/4/26/34/35/36/41/49/58/59/60/70/74/75/100/101/105/111/113/115/116.
Affected floors: secrets — held-secret concealment and credential redaction run before clipping; raw excerpts stay encrypted and off status; spend cap — calls and reservations unchanged; stop — cancellation behavior unchanged and its category retained; no duplicate sends — no dispatch/retry changes; durable intake — existing journal and intake order unchanged.
Operator questions: none for retention. Any extension of the notice review context requires a separate scope decision; no extension is made here.
Suggested tier: critical
Declared tier: critical
Tier rationale: Physical provider evidence touches secret-bearing output and the owned-launch boundary; test scrubbing, bounds, admission, actual signal transport and unchanged logical outcomes.
Side effects: Every observed subscription model invocation retains at most 4096 UTF-8 bytes of scrubbed excerpts, including successful physical frames that a later answer parser may reject. Completed output is already retained elsewhere; early capture prevents the uncertain/malformed path from losing its source. Stderr capture uses at most 8192 raw bytes in memory and does not affect the stdout contract or output limit. A capture truncated before scrubbing is omitted with an explicit marker because a partial held secret cannot be reliably scrubbed. Public status omits the private diagnostic object. Older rows without diagnostics remain readable. The renamed test has its existing stall-coverage reference updated; native conformance is re-declared after the contract run.
Undo and recovery: Revert this source change and regenerate publications. Diagnostic fields are optional and do not control recovery; no journal migration or old-record rewrite is needed. Historical missing output remains unknown.
Multi-machine posture: Existing encrypted journal, owner fencing, replication and retention posture remain. Raw physical buffers are deliberately local to the process until scrubbed; no new store, network surface or credential transfer.
Layer below: Checked resource-owner process close/error/stop/limit paths, productionProviderIO and subscription IO forwarding, the pre-adapter diagnostic append, encrypted journal validation/reopen/compaction, and public status projection. Named signal and cancellation controls do not guess which occurred in the historical event.
Bug class: none
Bug evidence: Real read-only update 969390396 physical metadata and null model output are pinned in tests/preview/fixtures/uncertain-provider-969390396.json; the existing captured Claude failure frame exercises raw-output retention. This is instrumentation, not a claimed repair of the unknown provider cause.
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample files only. Plain commits.
Convergence: none
Decision: early-bounded-capture | Record the excerpt at the existing physical observation point before downstream parsing; this prevents another malformed terminal from discarding its only raw evidence without adding a second diagnostic store or deferred append. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/notice-retain-1011-PROGRESS.md
Decision: notice-not-submitted | Preserve failed candidate review evidence and keep the existing notice; do not relabel recorded unsure/violation outcomes as passes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/notice-retain-1011-PROGRESS.md
Prompt review: No final prompt, notice, model-output parser or accept/escalate/refuse decision changes. Both attempted notice variants were removed after unchanged contextual reviews rejected them. No observer-106 new-notice pass is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged memory-inventory response, not a new semantic classifier.
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged source-label instruction and grounding assertion.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged semantic memory retrieval instruction.
Deferral: generated/register.json:1 | not-a-deferral=Existing prerequisite descriptions are republished unchanged; no implementation is postponed.
Generated publication: Existing replay generator run from source commit ea49c0b9a7c0e73f6876d75d428e0bb55f1c0c60, generation sha256:5565b5b01447bd3a9dff8ecf2317c5f391a2dc36598fa5fe083917855f83469d.
Verification: Targeted diagnostic, journal, lost-answer, physical resource and native contract results, plus typecheck, architecture, lint, register and pinned-set results are recorded in the absolute desk progress report. Full suite and independent landing review remain pipeline-owned. No live runner or Telegram send.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing owned-launch result and encrypted call-outcome row using the existing secret scrubbers. Signal, cancellation and raw output were already available and discarded. A separate store, retry mechanism or semantic classifier is unnecessary. Start guards, resource bounds, stop and send/intake floors remain as shipped; end evidence is the physical result and durable append. No autonomous recovery or live acceptance claim is made.
80/20: Verify the actual boundary and its positive/negative neighbors, retain the failed notice evidence, and submit only the diagnostic work that is supported. This unit remains BLOCKED on the requested notice exit test.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
