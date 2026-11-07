# Change review — A held result leaves with the next reply

Subject base: 59ed6fc245698b715ae748a4c2514aeb9d4cc92d
Review state: open
Reviewed content: none
Outcome: Every finished result shown to the answering model gets a declared decision, so it leaves with the next reply and is recorded delivered once at the accepted send, whatever words the model uses.
Affected rules: 2, 4, 8, 10, 22, 26, 42, 46, 49, 57, 70, 74, 83, 86, 92, 95, 102, 111, 113, 116
Affected floors: secrets — reply and marker pass the existing redaction and outbound wall; spend cap — one bounded re-ask under the existing call cap, no new call kind; stop — unchanged; no duplicate sends — existing boundTo and receipt identities, a carried result is bound and settled exactly like an attached one; durable intake — unchanged encrypted journal
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Small model-facing change to report disposition on the existing answer path; no new effect, authority, store, provider or call kind.
Side effects: A reply whose first answer leaves a waiting result undecided now costs the one existing format re-ask, so that turn is slower by one answer call. The operator sees a short marker line when the agent gave a result in its own words. Answer rows may carry a new optional carriedReports list; older rows replay unchanged. A carried closure quotes the sent reply rather than the unsent stored report.
Undo and recovery: Revert this change. Journals holding carriedReports rows then need the replay branch kept, since a reverted build would refuse the marker text as an invalid report; roll forward or retain that branch. Pending reports, send identities and receipts stay readable.
Multi-machine posture: Stateless decision on the owning machine from the shared journal; the new row field replays identically on every machine and existing owner and receipt fencing stay authoritative.
Layer below: 1.x revision bd24507b56afb7fd19e3f4a89c930ba7a2ebeb45: src/monitoring/CommitmentTracker.ts deliver(id, deliveryMessageId) (lines 679-697) records delivery as a terminal fact bound to a message id and never compares wording; verifyOne (line 1116) keeps unverifiable work pending. Reused both invariants: delivery is a declared fact settled by the accepted message, and an undecided report stays pending. Its filesystem verifiers and beacon heartbeats do not fit conversational results. ONEX-LESSONS.md is not in this tree and was not read. 2.0 inspected: pendingReports, obligationSchedule, schedulePromise, the answer packet, formatReask, answer and intent replay, settleDeliveredReply, withheldReports, the revision result lines, and the T1 change review.
Bug class: integration
Bug evidence: reproducer=tests/preview/held-result-delivery.test.ts
Hook bypass: none; core.hooksPath unset; plain git commit used
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: held-decide-every-report | Require one declared decision per offered result through the existing single re-ask, instead of leaving omission as silent waiting. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/held-result-delivery-1106-PROGRESS.md
Decision: held-keep-t1-floor | Do not attach on omission: tests/preview/t1-verified-answer.test.ts pins that a stored report cannot append without a current selection, so a model that stays undecided after the re-ask appends nothing and the result stays visibly owed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/held-result-delivery-1106-PROGRESS.md
Decision: held-carried-marker | Add carriedReports with a fixed runner marker line, so own-words delivery is the model's declaration, settles once at the accepted send, repeats no result, and needs no wording comparison. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/held-result-delivery-1106-PROGRESS.md
Decision: held-register-replay | Refresh the generated register in replay mode from the pushed source commit 03f80e4ed, as earlier units did, so lint and register:check pass on this head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/held-result-delivery-1106-PROGRESS.md
Prompt review: The answering mind still judges each report from its own packet; no keyword or wording test decides support or delivery, and exact offered keys only admit its declaration. Recorded room-four reply bytes, the recorded hi answer reason and status counters are replayed; the raw model declarations were not in the evidence, so the declarations are labelled stand-ins and no fresh real-model run is claimed.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/held-result-delivery.test.ts:57 | not-a-deferral=Product guidance or regression data about durable pending work; no builder deferral.
Deferral: tests/preview/held-result-delivery.test.ts:72 | not-a-deferral=Product guidance or regression data about durable pending work; no builder deferral.
Deferral: tests/preview/journal.ts:2709 | not-a-deferral=Product guidance or regression data about durable pending work; no builder deferral.

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/README.md, tests/preview/fixtures/held-result-delivery-1106.json, tests/preview/held-result-delivery.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: This is the simplest route that keeps the T1 floor: one more list on the existing answer declaration, the existing re-ask, and the existing bind and receipt settlement. Attaching on omission is simpler but reopens the T1 stale appendix, and widening fulfilled still needs an exact quote and left the live case refused. Start: a finished result waits. End: it is delivered once at the accepted send, reworked on an objection, or visibly owed if undecided. Limits: existing call cap, answer size, stop and unique send identity. No unattended live proof is claimed; the desk live proof decides.
80/20: One optional row field and one sentence of guidance reuse the whole delivery lifecycle; no new service, store, call kind or semantic filter.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
