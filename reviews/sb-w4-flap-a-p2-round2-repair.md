# Change review — supervised requested-action declaration retries

Subject base: cadc62e3eacd187a4c4b2ea190f9855ea60031b6
Review state: open
Reviewed content: none
Outcome: A requested-action declaration repair validates due selection and the exact replacement packet before reserving or dispatching the retry. A refused or unavailable replacement check holds the action without a second model call or send.
Affected rules: 1, 4, 10, 12, 28, 36, 37, 38, 41, 42, 49, 55, 57, 58, 60, 69, 70, 74, 75, 86, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing redaction and outbound custody preserved; spend cap — existing bounded retry and metered reservations preserved, cap rechecked after supervision; stop — existing stop gate and a post-check stop read; no duplicate sends — no send before replacement checks, repeated scans still send at most once; durable intake — original intake, model evidence and all step judgments remain journaled
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The requested-action model-call admission path is consequential and requires exact packet supervision.
Side effects: The existing initial requested-action checkpoint becomes one shared helper. Declaration and malformed-format repairs both reuse it; a changed packet consumes its own bounded supervision attempts. Matching evidence is reused by validateBefore. Ordinary operator turns retain their previous behavior. No recovery capability, tool, framework, or validator is removed. Other replacement mechanisms are outside this narrowly requested repair.
Undo and recovery: Revert this repair and regenerate the register; journal schema and existing records are unchanged. Reversion restores the supervision bypass and must not be described as an acceptable final state. Held actions retain their original reservation and recorded reason; no unrecorded retry or send is introduced.
Multi-machine posture: The current conversation journal owner enforces the checkpoint identically on each host. Existing ownership and replicated durability paths are unchanged; no new store or machine dependency.
Layer below: Inspected validateBefore/runStep's bounded reservations, exact step IDs, recorded verdicts and unavailable direction; format-retry's prompt projection and one-retry accounting; proofs.ts's exact packetDigest matching; drainTurns's persistent hold handling; and declarationDefect's existing exact promise/fulfillment validators. No proof reader is loosened.
Bug class: live-path
Bug evidence: reproducer=tests/preview/business-step-supervision.test.ts; live=tests/preview/fixtures/flap-a-declarations-2026-10-04.json
Hook bypass: none
Convergence: none
Decision: flapa-r2-checkpoint | Reuse initial requested-action supervision for the replacement packet; retain the exact digest, failure direction and bounded recovery | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-a-p2-repair-PROGRESS.md
Prompt review: Prompt wording and parsers are unchanged. Captured invalid fulfillment 715674119 now drives a supervised requested-action retry. Existing declaration replays retain successful 6232373/6232374/6232376, invalid date 715674175, flat answer 715674172, and unknown replacement 715673614. The separate recorded-shape replay preserves summary uncertain 6232410, review uncertain 6232376/715674127, unsure Jev c182dfc8c408e7f6/6adc15a46aef6bd4 and undecided Jev 46f8217294f99c8c. The existing read-only delivered-reply replay retains its outcomes, including empty-text negative controls; those controls are synthetic mutations, not invented live captures.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed empty-memory protocol reply; existing test asserts its literal.
Prompt finding: bd01de21286a | protocol-literal | Unchanged sourceLabel instruction; existing test verifies it is delivered.
Prompt finding: fb5fa7e706c8 | protocol-literal | Unchanged operator-history guidance; existing test checks its delivery.

Verification: nice -n 10 npm run typecheck passed. Foreground nice -n 10 npx vitest run tests/preview/business-step-supervision.test.ts tests/preview/flap-a-declarations.test.ts --maxWorkers 1 passed all 29 tests. New cases cover repaired and repeatedly invalid promise outputs, captured invalid fulfillment, and violation/unavailable on each replacement business step. Architecture passed. Delegated owner-manifest rehash and inventory repin found no changed pins; source wiring/register replay is required for the journal edit.

Saved-gate evidence limitation: All eleven contract checkers were run against the copied gate report (6280 passed, zero failed). Four initially passed; copied model-provider receipts allow three more to pass. The saved report names the gate checkout, so register and rungraph file matching reject those paths here. An explicitly labelled diagnostic changing only file paths passes register mapping and reaches the real process-exit requirement in rungraph. Assembly and boot checks correctly require a fresh full Vitest process receipt bound to this checkout, source digest and commit; transplanted old evidence cannot satisfy it. No checker or result status is changed, no quarantine is added, and the original report is restored byte-for-byte. Fresh full-suite provenance must come from the authorized Mama PC pipeline; it is not claimed by this submission.

## Closing block

simplestRobustRoute: This is the simplest robust route: call the existing requested-action checkpoint for the exact retry packet. The credible failure is a model call and send justified only by judgments on different bytes. One shared helper prevents that bypass without a new framework, store, validator, or review process. Start is a malformed declaration on a due answer; end is one supervised replacement or an explicit hold before dispatch; stop, cap and one-retry bounds remain. Recorded-output worker replay exercises the shipped path unattended but is not a new live provider exchange.
80/20: Limit the repair to the identified checkpoint, prove accepted and refused/unavailable neighbors with the existing fixture, replay recorded shapes, and regenerate provenance. Submit the remaining full-process proof requirement honestly to the pipeline without running a full suite on the Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
