# Change review — train-95 reviewed delivery and reply fixes

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: Combine the three exact reviewed heads: bounded retries for proven never-sent Telegram attempts, memory-list guidance naming reply replacement, and route-check maintenance kept off ordinary replies.
Affected rules: 3, 10, 12, 34, 36, 37, 42, 49, 55, 56, 66, 69, 74, 87, 88, 90, 95, 101, 102, 111, 112, 113, 116
Affected floors: Secrets and spend-cap enforcement are unchanged; no model call is added. Stop brakes retries after each wait. No duplicate sends: unknown send outcomes are never retried; all retries consume the existing durable intent. Durable intake is unchanged. Context guard constants remain unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combines delivery retry behavior and model-facing guidance on the live build.
Side effects: Proven never-sent attempts can now occupy up to 42 seconds of backoff before exhaustion. Ordinary replies no longer carry doorway maintenance notices; historical notice records still replay and status retains the check. The model still chooses memoryList; the member's failing Fable case remains unproven.
Undo and recovery: Revert the individual member changes through review and regenerate the register. Preserve journal history and durable send receipts; never repeat an uncertain send.
Multi-machine posture: Unchanged owner-gated send and journal paths; no new store, queue, worker, replication rule or cross-machine authority. Backoff is local to the admitted dispatch.
Layer below: Read the full constitution, exact member diffs and Studio member report, existing send-intent and not-sent classifications, reply-notice status path, context-floor measurement, and the cint-L37 desk-chain instructions.
Bug class: integration
Bug evidence: reproducer=tests/preview/delivery-failure-notice.test.ts; live=tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples.
Convergence: none
Prompt finding: 4106b49fff07 | protocol-literal | Existing tool-attempt honesty guidance is unchanged; this is a protocol disclosure, not keyword interpretation.
Prompt finding: 849db3a6296a | protocol-literal | Existing saved-memory response contract is unchanged; this is a response contract, not an intent classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label and uncertainty guidance is unchanged; this is a provenance contract.
Prompt review: Carries the reviewed memoryList consequence sentence unchanged. The member report records Sonnet replays of run A update 6235088 and run B update 6235112 and explicitly states that the failing Fable shape was not proven because its per-call replay was refused. This integration makes no new model-effectiveness or live-acceptance claim. Recorded summary, Jev, review and delivered-reply shapes are replayed by the existing targeted tests.
Decision: train-95-connect | Merge exact reviewed e87fdce0f36056a1fb1f74b9269533337ebf9d88, fast-forward from the exact live base. Member report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/walk-findings-1020-PROGRESS.md, read through the Studio API. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md
Decision: train-95-memorylist | Merge exact reviewed c69933585db325d2d6d3bbe3f5836b5b29c3e406 with an ordinary merge. Preserve the reviewed sentence and its explicitly unproven Fable limitation. Member report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/walk-findings-1020-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md
Decision: train-95-routecheck | Merge exact reviewed 6441c52de436b12d552789d100faba670d1cb1d7 with an ordinary merge. Keep historical notice decoding and status reporting. Member report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/walk-findings-1020-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md
Decision: train-95-A | Preserve all three intended behaviors; journal.ts merges automatically without overlapping conflicting hunks. No member behavior is discarded. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md
Decision: train-95-B | Create the new branch directly at e44d3ce1985cc2e47620541d55ab03ae0bba8f8b. Keep live ancestry and avoid a main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md
Decision: train-95-C | No genuine product conflict and no head left out. Generated files are rebuilt by the existing chain, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md
Decision: train-95-D | Run macOS targeted checks here; list any unchanged host-dependent failures separately. Studio owns its native conformance certificate and final live acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md
Decision: train-95-desk | Use the downloaded desk repin/build/rehash/register replay chain, with unchanged context guards and conformance declarations. Use a writable temporary npm cache because the default cache is outside this session's writable roots. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing declaration reproduced by the generator; no new deferred repair.
Verification: Changed tests, direct consumers, explicitly requested journal/subscription/register checks, recorded-shape replays, pinned READY tests, typecheck, lint, architecture, register and review checks; exact results recorded in the handoff report.
simplestRobustRoute: This is the simplest robust route: three ordinary merges of reviewed heads and the existing regeneration chain. No new machinery. The existing send classification and intent hold uniqueness, bounded retries retain stop and resource guards, and the existing prompt states the consequence of a model choice. No new unattended-completion claim.
80/20: Only changed/direct-consuming and explicitly required tests; no full suite, load test, or comparison worktree.
VERDICT: author submission for the desk gate, not independent convergence or live acceptance
