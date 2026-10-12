# Change review — distinguish UNKNOWN answers from their delivery notices

Subject base: a7d2514cf2ef1216244154833b0111f12a136305
Review state: open
Reviewed content: none
Outcome: Repair the train-15 pipeline assertions that treated the new, separately fenced delivery-unknown notice as a duplicate answer. Verify exact answer and notice text, one dispatch of each effect, independent UNKNOWN outcomes, correct reply accounting and unchanged recall across restart.
Affected rules: Purpose continuity and least revelation; Rules 1, 26, 37, 42, 49, 52, 70, 74, 87, 101, 102, 111, 112, 113, 116
Affected floors: secrets — runtime outbound checks unchanged; spend cap — runtime budgets unchanged, test accounting includes notice intents; stop — existing stopped boundary retains no notice; no duplicate sends — independently assert original answer and notice fences across restart; durable intake — original journal, cursor and recall assertions retained
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Assertion-only integration repair with no runtime behavior, model instruction, parser, permission or policy change.
Side effects: Tests now admit exactly the independently authorized content-free notice and still reject repeated answer or notice sends. Launcher status counts both uncertain effects when its fake endpoint drops the thread on both responses. Recall checks allow only the two notice history fields and their packet digest; all other packet content remains exact. Generated pins/publications may change to bind the altered test sources.
Undo and recovery: Revert these assertion changes and regenerate pins/publications using existing tools. Runtime behavior and durable journal format are unaffected; never erase journal intents or retry uncertain effects. Reverting restores the stale pipeline assertions.
Multi-machine posture: No new state or runtime changes. Tests exercise the existing durable effect fences on reopen; ownership admission remains unchanged. The reported two-machine stall timeout is a Studio verification item under the remote-host instruction.
Layer below: Read needsDeliveryNotice, noticeUnknownReplies, replyOutcomeOf, delivery-notice projection and the existing send-unknown-notice suite. A notice has a separate durable target and receipt, shares reply capacity and audience checks, aggregates eligible turns, and never upgrades the original answer's UNKNOWN outcome. Crash fixtures and the launcher endpoint still use the real journal worker and their existing dispatch ports.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-continuity.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only; ordinary commits used
Convergence: none
Decision: train15-notice-contract | Preserve the already shipped loss-notice capability; repair stale consumers that equated one update with exactly one outbound effect, retaining exact no-duplicate assertions for both effects. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-15-repair-135621-PROGRESS.md
Decision: train15-notice-recall | Compare the entire reopened recall packet with exactly the new notice fields added and its digest changed, retaining the original UNKNOWN outcome and all remembered content. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-15-repair-135621-PROGRESS.md
Decision: train15-repair-publication | Refresh source hashes and generated publications only through the delegated desk scripts and existing register generator; no hand-edited pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-15-repair-135621-PROGRESS.md
Prompt review: No model-facing runtime text, parser, acceptance, escalation or refusal logic changes. Existing captured-shape tests retain provenance: send-stage replay uses group-audience update 969390330 and proofroom summary rows; held-reply replay retains 969389576, 969389578, 969389581 and 969389583, while its unattributed UNKNOWN-send count is explicitly exercised with a synthetic turn. Frozen14 and frozen15 journals test upgrade continuity. These are offline replays, not new live evidence.


Publication preparation: The delegated rehash script refreshed three preview owner-reference hashes; the delegated repin chain refreshed zero inventory entries. Compilation and build passed. Targeted portable regression runs passed (146 tests across seven files, plus the status, dated-memory and carried-request files); independent notice-floor checks also passed. The two topic-launcher cases refuse during unchanged WSL startup before reaching the repaired assertions; Studio must execute that surface.

Publication evidence: The existing replay generator published source commit 23b62fdb56ec49ad417bed56deab62060f90ac88 as generation sha256:4520aa11eb33f9636dd426a45f1adba63d6d97100934e9ab0d6ba200203d720d. Ten portable affected files passed 214 tests in the final per-file runs; the separate send-unknown-notice suite passed all ten tests. Typecheck and build exited 0.

Final checks: lint (architecture plus register wiring) and register:check exited 0. The six required portable pinned-text files passed 89 tests. The local review checker cannot resolve Studio-only report and live-evidence paths; this repair has three expected Rule 102 report-path findings until the desk copies its report. No missing commit coverage, prompt or runtime finding was reported.

simplestRobustRoute: This is the simplest robust route: update the exact assertions invalidated by the existing separately fenced notice. No runtime mechanism, optional behavior switch or quarantine is introduced. The original intent remains the answer's end guard; the notice's separate intent prevents repeated notices. Stop, audience, ownership and reply caps remain at their existing dispatch boundaries. No autonomous-completion or live-release claim.
80/20: Repair the shared test-contract cause, run focused affected cases and required cheap checks, and hand platform-specific launcher and two-machine execution to the Studio gate without investigating unrelated WSL startup failures.
VERDICT: author submission; this record asserts no independent verdict
