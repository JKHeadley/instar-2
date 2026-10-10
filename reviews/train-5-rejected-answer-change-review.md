# Change review — replace an ended zero-output rejected answer once

Subject base: e4f96d28eaa50f59a8a18dbb231e904c3dde97b6
Review state: open
Reviewed content: none
Outcome: A definite zero-output provider rejection no longer immediately becomes a failure reply. Reuse the existing single answer replacement under the same call cap, before any send, only after verified cleanup and no tool work. Preserve the original rejection and reported usage.
Affected rules: 4, 14, 15, 26, 36, 37, 41, 42, 46, 49, 55, 57, 58, 60, 70, 74, 75, 77, 95, 101, 102, 111, 112, 113, 116; purpose ability constraint
Affected floors: secrets — retain only a closed provider failure class, never provider error prose; spend cap — reserve the replacement before dispatch and leave review capacity, settle only measured usage; stop — existing stop and expiry checks still precede replacement; no duplicate sends — only before intent, one replacement survives restart and compaction; durable intake — original intake and failure remain recorded
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes answer recovery and durable call accounting on the live preview path; preserves model, tools, network, MCP, sessions and delegation.
Side effects: One additional admitted model attempt can occur after an ended zero-output rejection. A complete consistent tool trace must establish no tool attempts, and known policy/usage failures never qualify. Uncertain timeouts retain their old UNKNOWN liability; rejected calls settle only their observed usage. Existing format re-asks and their writer grounding remain unchanged. New failure metadata and trace consistency are backward-compatible optional fields; a rejected answer-replace state is refused by older writers rather than replayed unsafely.
Undo and recovery: Revert the code change before any rejected replacement has been written. Once such a row exists, keep the updated reader and revert only the scheduling predicate; never run an older writer on a journal containing the new rejected replacement. Do not erase the durable rejection, replacement or send evidence.
Multi-machine posture: Existing preview journal scope and replication only; replacement uses the existing model port and causal replication checkpoint. No new store, authority, peer dependency or machine-local bypass.
Layer below: Inspected physical subscription result parsing, resource cleanup, tool trace accumulation, journal projection and compaction, token settlement, call-cap reservation, writer grounding and the existing timeout replacement. The failed copy's original provider error text was discarded, so its exact cause cannot be reconstructed. Pinned-harness physical IO replays with the same credential, prompt and model now succeed; this supports recovery from a transient rejection, not a claim about its exact provider cause.
Bug class: live-path
Bug evidence: reproducer=tests/preview/rejected-answer.test.ts replays the actual failed call/trace of update 715675390, then the real successful same-prompt model output, through the journal worker and recorded Jev/review shapes; live=tests/preview/fixtures/rejected-answer-2026-10-10.json records the failed forum answer check and real pinned-harness physical-provider replay yielding probe-cb79e572. Telegram delivery in the regression is substituted; the pipeline supplies the new live answer check and full suite after push. Targeted timeout, writer, summary, reply-review and repaired self-description tests pass. No fresh full-suite result is claimed.
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample files only
Convergence: none
Decision: train-5-rejection-replacement | Reuse one bounded answer replacement after an ended zero-output rejection, preserve recorded outcomes and tool ability, and exclude known policy/usage refusals and unsafe tool traces. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-5-repair-PROGRESS.md
Prompt review: No prompt wording changes. The three existing literals below remain unchanged; recovery submits the same packet through the same model/tool port.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory response, unchanged; it describes deterministic inventory state, not a model keyword gate.
Prompt finding: bd01de21286a | protocol-literal | Existing sourceLabel protocol field instruction, unchanged.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing recall task guidance, unchanged; no fixture-specific trigger is added.

Generated evidence: Ran the delegated desk rehash and repin tools; all owner manifests and the inventory were already current (zero pin edits). Rebuilt generated/ with build-register --replay --commit ece70e0bf388a2d118390ea87f05bf94a0da5fbd. Generation contains 286 entries and all 116 rules. No pin was hand-edited.
Deferral: generated/register.json:1 | not-a-deferral=Generated projection of existing registered declarations; this repair adds no deferred work.
Validation: 44 targeted recovery/diagnostics/timeout/writer cases and 22 recorded summary/reply/self-description cases pass; all commands used nice -n 10 and --maxWorkers 1. The exact failed copy was read-only. Four bounded provider diagnosis/replay calls were made, no Telegram send. Saved contract report remains byte-for-byte unchanged and globally red on the previously repaired selfdesc-limits assertion; no new full suite is run on this machine.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing one-replacement journal record and call-cap checkpoint instead of adding a retry loop, model fallback or new store. The credible failure is a temporary ended provider rejection permanently consuming an otherwise answerable intake; complete cleanup, no tool work, known-refusal exclusions, stop, expiry, one replacement and durable send fences are the start/limit/end guards. Recorded failed update 715675390 reaches the real recovered answer in the worker replay and survives restart without another send. A new unattended live Telegram check remains the pipeline's responsibility, not a claim made by this author record.
80/20: Targeted recorded cases and refusal neighbors cover the changed branch and adjacent timeout/format recovery. Full tests remain delegated to the release pipeline by the operator's explicit machine constraint. The old saved report's single failed assertion is now targeted-green; its success=false remains unaltered.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
