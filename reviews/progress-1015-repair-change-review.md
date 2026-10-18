# Change review — shared progress cadence and native conformance

Subject base: cf8d3b2eed2ce74c45ebc91791fd32ede1240e46
Review state: open
Reviewed content: none
Outcome: A real batch shares one slow topic progress cadence at scheduling and durable intent admission. Native self-host conformance is renewed only after its exact contract passes on this composition and runtime.
Affected rules: 1, 2, 4, 26, 32, 33, 34, 36, 37, 49, 52, 63, 70, 74, 87, 89, 101, 102, 105, 111, 112, 113, 115, 116
Affected floors: secrets — unchanged plain and encoded outbound checks; spend cap — existing reply allowance and no added model calls; stop — current stop/expiry/ownership checks remain; no duplicate sends — existing signed per-turn ordinals, UNKNOWN intents and topic step guard remain; durable intake — unchanged encrypted custody.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Narrow integration repair of progress timing with durable replay and renewal of existing conformance evidence; no new authority or ability.
Side effects: Progress spacing counts all existing intents in the continuous overlapping answer window, including UNKNOWN. Completed siblings remain part of that window; a new intake after all earlier answers completed starts a new window. A signed progress ordinal still belongs to its turn. Earlier journal rows produced by this not-yet-accepted unit that violated topic spacing would fail replay under the strengthened admission check; no deployed journal migration or live rollout is claimed.
Undo and recovery: Revert this repair to restore the former per-turn timing; existing row shapes remain unchanged. Reverting cadence also restores the reviewed flooding defect. Renew any future composition certificate only from a passing contract on those exact bytes.
Multi-machine posture: Cadence derives solely from the existing encrypted replicated journal under the existing owner fence. No new store, machine-local authority or transport is added. Activity observation stays local and fresh. Native certificate describes the declared darwin tuple only.
Layer below: Constitution in full; held-notice projection and signature subjects; actual modelBatch preparation, reservation and collectModel path; intent admission and current checks; compacted journal replay; native composition closure/digest, current runtime and native full-port contract.
Bug class: integration
Bug evidence: reproducer=tests/preview/working-progress.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks directory contains only samples; ordinary commits.
Convergence: none
Decision: progress-repair-shared-window | Reuse recorded intake, answer intent and progress rows to share spacing across overlapping work; neither a sibling finishing nor later intake can mint a new slot. Completed independent work starts a new window. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-1015-repair-PROGRESS.md
Decision: progress-repair-native-certificate | Execute the named native contract on the actual macOS runtime, verify the complete composition closure is unchanged, then renew the declaration from that passing evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-1015-repair-PROGRESS.md
Prompt review: No prompt, output parser or model accept/escalate/refuse policy changes. Existing captured summary, uncertain writer, Jev uncertain/undecided, reply-review and delivered/empty-context cases still run in the touched test. Empty recorded context is not claimed as a delivered empty bubble.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged source-attribution guidance in journal.ts: "cite sourcelabel; disclose unknown sources." No new phrase gate.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed empty-memory reply in journal.ts: "i have no active saved memory items". Progress does not inspect this phrase.

## Closing block

simplestRobustRoute: This is the simplest robust route: one calculation over existing durable rows, reused by scheduling and intent admission. It prevents each batch member taking a first-progress slot and retains the bound after replay or sibling completion. Existing fresh-activity, stop, cap, ownership, duplicate-step and final-dispatch guards remain. Native renewal uses the existing named contract; no new machinery or ability restriction. No unattended deployment or live delivery claim.
80/20: Real-batch regression failed before the fix; all 24 progress tests pass afterward. Native contract and declared-certificate case pass on macOS; unchanged 264-file closure and runtime recorded in lanes/progress-1015-repair-native-before.json and progress-1015-repair-native-certificate.json. Architecture passes. Final typecheck, regenerated register and cheap gates are recorded in the repair report.
VERDICT: author submission; independent review pending
