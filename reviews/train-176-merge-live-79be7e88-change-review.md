# Change review — train-176 merge live 79be7e88

Subject base: 501be1b6198ef1b6d32bfc27de4fade021d7408f
Review state: open
Reviewed content: none
Outcome: Merge the newly live build without losing either train-176 deterministic timeout controls or the live assessment matrix slow-response regression.
Affected rules: 26, 34, 37, 42, 49, 55, 60, 70, 74, 90, 91, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no credential changes; spend cap — unknown charge retains exposure; stop — imported live finalizer remains intact; no duplicate sends — timeout controls still refuse redispatch; durable intake — existing custody unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The merge includes already-live launcher and bounded session volume work; the authored conflict resolution is test-only.
Side effects: The assessment identity matrix injects a 150ms server delay and requires a complete receipt before mutating evidence. It uses train-176's existing invocationTimeoutMs option at 10000ms; the live branch's admittedTimeout option was already superseded in this fixture. All other incoming paths merge without authored behavior changes. Generated register outputs are rebuilt from committed merged source.
Undo and recovery: Revert this merge relative to its first parent and regenerate the register; do not rewrite either parent's history. No migration or production store edit is involved.
Multi-machine posture: The authored fixture remains local HTTP test evidence. Imported live changes preserve their own shared-authority outcome and bounded local-volume posture. No new state, authority or machine dependency is added.
Layer below: Inspected providerFixture invocationTimeoutMs propagation through lease, loop, operation and judgment deadline; injected timeoutSignal and bounded fetch signal; localProvider delayed response and request recording; both parent diffs and live train-193 repair record. The nine assessment mutations require complete transport, while separate timeout cases preserve uncertainty and retained charge.
Bug class: integration
Bug evidence: reproducer=tests/integration/model-provider-refusals.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks directory contains sample files only.
Convergence: none
Prompt review: This resolution changes no model prompt, parser, acceptance policy, escalation or refusal semantics. Imported live changes and their evidence/review records remain intact; no new model-facing behavior or real-journal replay is claimed by this merge repair.
Decision: train176-merge-provider | Keep injected 150ms latency and complete-receipt assertions using the existing 10000ms invocationTimeoutMs fixture option; retain all deterministic timeout/no-retry controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-140517-PROGRESS.md
Decision: train176-register | Preserve both parent histories and regenerate derived register files from committed merged source using the delegated desk repin tools if needed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-140517-PROGRESS.md

## Verification

Typecheck and build passed. The repaired integration file passed all 19 tests, including nine identity mutations after a complete delayed response, both injected timeout boundaries, retained unknown charge and no redispatch. Architecture passed; initial wiring check identified the expected stale generated journal-agent source pin. Delegated desk tools refreshed zero owner pins and zero inventory entries. Rebuilt the generated register from merge commit 49424cf87b9287df95c9812b03fd7c7a2aa566a0 to bind the merged source bytes. Final cheap checks are recorded in the builder report; full-suite verification belongs to Studio under the brief.

## 1.X FIRST

Searched JKHeadley/instar origin/main 149377310f9b586641a05eddf196df4543dc031a src/, docs/specs/ and history. Read src/core/CodexCliIntelligenceProvider.ts caller timeout/abort/refusal paths; inspected its history d34a499bc, 5676fc194 and 01e98a8ca. Inspected docs/specs/outbound-timeout-408-ambiguous.md and REVIEWER-DOOR-REWIRING-SPEC.md, and ONEX-LESSONS delivery and resource/testing sections. Fit: ambiguous timeout is not proof of non-occurrence and caller budgets remain bounded. Mismatch: the 1.x CLI/messaging owners do not implement this 2.0 HTTP assessment fixture, so preserve the existing 2.0 tests instead of transplanting unrelated code.

simplestRobustRoute: Combine the two existing test fixes at their single conflict and regenerate existing derived files. No new machinery, quarantine, ability reduction or production timeout change is needed. Start with both named parent commits; finish with the targeted refusal tests, typecheck and cheap checks; leave full-suite and independent qualification to the Studio pipeline.
80/20: Resolve the named integration conflict without redesigning already-live features or expanding the test campaign beyond the brief.
VERDICT: author submission; no independent verdict or deployment acceptance claim
