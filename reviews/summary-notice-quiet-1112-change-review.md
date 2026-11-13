# Change review — Answer before summary disclosure; machinery health on status

Subject base: 384bad285f51c5c132d9474fb3d5fc2cc9835e75
Review state: open
Reviewed content: none
Outcome: ordinary replies start with the answer. The first reply after compaction still speaks its required disclosure, now as the last paragraph in the desk's plain wording. Model-route health and idle-worker cleanup no longer attach to new answers; status retains both and names the summary boundary.
Affected rules: 26, 36, 49, 70, 74, 77, 80, 87, 89, 96, 101, 102, 110, 113, 116, 123
Affected floors: secrets — existing outbound checks and audience standing unchanged; spend cap — no new model calls; stop — unchanged; no duplicate sends — recorded intent/receipts and unknown-send handling unchanged; durable intake — unchanged, no new store
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: bounded reply presentation and status projection changes. No prompt wording, model parser, standing, authorization or summary faithfulness change. Exact continuity validation accepts both historical text and new final-paragraph placement with the same capture, frontier and digest checks.
Side effects: new rendered text and digests differ; reply-body extraction and revision consumers handle both positions. Status gains two bounded lines. Suppressing machinery notices lets the next actionable candidate use the same one-line slot. Historical notices already recorded in an answer/intent are replayed as recorded.
Undo and recovery: revert the product commit and regenerate the register. Drain or preserve journals already containing the new suffix before running an older binary, because that binary's continuity validator only accepts the historical prefix. Never rewrite recorded sent text or repeat unknown sends.
Multi-machine posture: no new local state; every machine projects the same journal. New code reads historical prefix journals unchanged; new suffix journals require this reader version. Existing transport ownership and admission remain intact.
Team posture: existing verified conversation audience and status authorization retained. Counters carry no new identities or cross-topic text; member/guest visibility is not widened.
Layer below: continuityFor and continuitySpoken (same request accounting/discharge), projectRow (capture/frontier/digest validation), reply-parts (final paragraph preserved as a tail), existing status projection, typed notice keys and their durable delivery evidence.
Bug class: unit
Bug evidence: reproducer=tests/preview/summary-notice-quiet.test.ts; send-path repro=tests/preview/credential-reminders.test.ts; recorded replay=tests/preview/doorway-notice-replay.test.ts
Hook bypass: none
Convergence: none
Decision: summary-notice-position | apply the desk's round-two ruling: R110 disclosure remains spoken and last, with legacy replay retained; machinery-only route and cleanup lines stay on status | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-notice-quiet-1112-build-report.md
Prompt review: no model instructions or output parser changes. Review candidate assembly and stripping change with disclosure position; real recorded review/summary/output shapes are exercised. Fixed whole-answer outcomes remain protocol literals, not keyword-based model judgments.
Prompt finding: 105c1569b6bb | protocol-literal | existing exact stop/renewal outcome; unchanged, not a model meaning gate
Prompt finding: 4106b49fff07 | quoted-evidence | existing truthful tool-evidence instruction; unchanged, not a test phrase requirement
Prompt finding: 7ef11b68103f | protocol-literal | existing exact activation-loss notice; unchanged
Prompt finding: 849db3a6296a | protocol-literal | existing empty saved-memory inventory outcome; unchanged
Prompt finding: 85544c20941f | protocol-literal | existing durable-intake outage notice; unchanged
Prompt finding: 9f0106c66027 | protocol-literal | existing incomplete-attempt outcome; unchanged
Prompt finding: bac6ce7485d9 | protocol-literal | existing stopped-work outcome; unchanged
Prompt finding: e8708c7fea24 | quoted-evidence | existing source-citation instruction, not an exact phrase that decides meaning

## Step 0 (before implementation)
1.x FIRST: inspected actual JKHeadley/instar origin/main 648800021a7e584375b5458eefdc0ad72f922640 in /Users/adriana/echo-compute/instar-1: searched src/ and docs/specs/ for compaction, disclosure, recovery, folds and layered summaries. Read src/messaging/shared/compactionResumePayload.ts and docs/specs/compaction-preamble-tone-and-intent.md; history includes 211f3d77a, 1dd533f44 (calm acknowledgment and last-message intent), 45f1a1ed2 (rich recovery payload). 1.x explicitly instructs the FIRST sentence to disclose compaction, then answer the most recent message and retain commitments; it also logs file-based recovery in prepareInjectionText. The 2.0 existing continuity account implements the disclosure and request accounting with durable exact capture and reply digest; reuse it, adapting position to the desk's round-two decision. The first-sentence ordering is the deliberate mismatch. ONEX-LESSONS.md not available in either searched checkout or the named lanes location; no Studio fetch per desk instruction.

Rule 110: “When a session resumes from a compacted context it says so, and provably accounts for the last message it received before the pause rather than bluffing continuity.” Check: “The post-compaction injection carries the last inbound message id, and the first reply must account for it.” Round two decides spoken disclosure remains in the first reply, last paragraph; no constitutional wording change. Rule 87: “Only messages that need action or carry a result push to the user. Status and churn go to a pull surface.” Rule 96 retains full-history/summary grounding. No conflict after the desk decision.

The previous-request state is an evidence-backed loss account: sent ordinary answer => addressed; pending/unsent/unknown/failed/holding/size/memory failure => still open; later edit => superseded. Exact request capture, id, outcome reference, grounding and reply digest are retained. continuityFor's spoken-disclosure discharge remains unchanged.

Rules touched: 26 (only actual confirmed answer counts), 36/70 (recorded shapes and can-fail proof), 74/102 (review and decisions), 77/80/87 (answer first, machinery on status), 89 (existing provenance retained), 96/110 (summary boundary and spoken loss account), 101 (no hook bypass), 113 (journal replay shared across machines), 116 (reuse assembly/status; no new store), 123 (existing conversation audiences unchanged). Secrets, spend cap, stop, duplicate-send prevention and durable intake retain their existing enforcement.

## Fixed-text inventory (journal.ts reply assembly and imported producers)
| Text class | Audience / purpose | Disposition |
| --- | --- | --- |
| Summary / set-aside continuity | Person: history visibility and last request outcome (R110) | Last paragraph, spoken when owed; boundary also on status |
| Context-limit recovery | Person: resumed conversation/loss account (R110) | After answer; preserve |
| Model route check (doorway notice) | Internal model-map health, no requested human action | Status only |
| Credential expiry / missing approved sign-in | Person must renew or sign in | Keep bounded end notice |
| Effect / harness refusal | Person must know requested action or tools did not run | Keep result notice |
| Idle worker cleanup | Internal capacity housekeeping; history and accepted messages retained | Status count only; omit from answers |
| Upcoming dates | Person's imminent commitments | Keep |
| Memory/date/request/standing-instruction recorded, cancelled, refused, kept, forgotten, undone lines | Person needs accurate outcome of their request | Keep |
| Requested-action header, late reminder, overflow line | Person needs which request/date produced unsolicited result | Keep |
| Selected completed-work reports / carried results | Person receives owed result | Keep |
| Operator approval offer / inability to offer | Person's action needed | Keep |
| Shared-account approval disclosure | Person would otherwise be misled about approval attribution | Keep |
| Whole-answer replacements (unknown/failed answer, memory undecided, too-long input/reply, holding, credential shape, group review) | Truthful non-answer or loss report | Keep |
| PREVIEW marker removal | Presentation normalization | Unchanged |

simplestRobustRoute: change the existing disclosure placement and its stripping consumers, retain old recorded text acceptance and digest binding, suppress typed doorway and idle-cleanup notices from new reply candidates, and add a summary line to the existing status projection. No new store, gate or framework.


Verification: build, typecheck and pinned-runtime architecture pass; focused results and deliberate base failures are recorded. The memory-correction fixture now recognizes its exact fact before the final disclosure instead of assuming the fact ends the reply; production correction logic is unchanged. Changed owner-reference fixture hashes were recomputed mechanically with the existing canonical/value functions. See the handoff report at the Studio destination named above for exact commands, per-file results, can-fail base, recorded update IDs and final pushed-head checks. No independent review verdict is claimed here.

Product size: 59 changed lines (added plus removed) in journal.ts, status-command.ts, journal-agent.mjs, credential-reminders.ts and reap-notices.ts; tests, review and mechanical register artifacts counted separately.

Proof matrix: summary/open-loss/new-order/replay/status — summary-notice-quiet and journal-boundaries; quiet rolling seams — journal-longchat; route and idle cleanup excluded with actionable neighbor retained — credential-reminders; actual route/review replay — doorway-notice-replay; recovery disclosure and real recorded shapes — journal-conversation-session; approval request/shared access — replaced-answer-operator-request; memory outcomes — journal-memory-correction; standing instructions and selected results — journal-obligations; dates/upcoming — journal-dated-memory; requested/late/retained reminders — reminder-truth; cancellation/forget distinction — cancel-not-forget; effect refusals — effect-doorway; whole-answer loss/size/holding — journal, plain-task-stop and journal-boundaries. All run as one plain test file per foreground vitest invocation, nice -n 10, maxWorkers 1, with a real TMPDIR. No live send or live Studio journal was needed; the brief authorizes recorded-shape writer reconstruction.

## Closing block

simplestRobustRoute: reuse the existing disclosure, continuity account, notice candidate selection and status projection; change presentation order and remove machinery-only candidates, with no new store, gate or configuration. The unchanged floors still guard intake, spend, outbound secrets, stop and uniqueness.
80/20: the named failures have direct send-path regressions and base failures; historical replay and mandatory action/loss disclosures retain their existing evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
