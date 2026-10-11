# Change review — sb-w4-act-first: read-first unit on the live build

Subject base: 4683b8520c4a211fb7dd56a02f4425e073432420
Review state: open
Reviewed content: none
Outcome: Merge reviewed w4-act-first 7372ec71bf4d52e7935b26d9bb81c0bdc7f87145 onto the required live head without conflicts. Shared tool guidance directs already-authorized reads before answering, cites evidence and distinguishes failed reads from offering work back to the operator. Replay the register at merge 93c5ce6995535608eeaf2015eb3dc475295ef26c. Unit runtime bytes are unchanged by integration.
Affected rules: 10, 12, 20, 21, 23, 34, 36, 47, 49, 57, 65, 66, 69, 70, 74, 78, 84, 90, 101, 102, 103, 111, 113, 115, 116; same constraints as the carried unit review, plus exact register regeneration and integration evidence.
Affected floors: secrets — admission/redaction unchanged; spend cap — call/output limits and 22,959-byte fixed-parts guard unchanged, measured text 21,453 and tool 24,284 within its existing system-growth allowance; stop — unchanged; no duplicate sends — unchanged send path; durable intake — no schema or state change.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carry the unit tier: model-facing guidance and review wording alter tool-route behavior and native conformance bytes.
Side effects: Already-budgeted reads can happen sooner. Tool prompt growth relative to text-only is now 2,746 bytes (+1,202); matching successor activations for Claude tools/native and Codex tools are required at landing. The real malformed-JSON residual remains visible and refused by the unchanged parser; the existing format re-ask remains. No live activations are changed here.
Undo and recovery: Revert integration merge 93c5ce6995535608eeaf2015eb3dc475295ef26c with parent 1, regenerate the register, and restore matching prior tool-policy activations through the desk. No state migration or send replay is needed.
Multi-machine posture: Shared shipped tool instructions on whichever machine owns the conversation. Existing ownership and scoped admission remain authoritative; no new state or peer dependency.
Layer below: Read the constitution, live base, unit source diff, unit report and review, actual envelope assembly, read-answer/review parsers and recorded capture tests. Replayed real tool admissions, citations, failed reads and malformed answers plus summary, Jev and empty-reply shapes. Repin/build/rehash/replay validates the register underneath. Live docs and journal.ts are identical to base.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: w4-act-first | Carry unit 7372ec71 unchanged: shared tool-boundary guidance, availability-scoped memory protocol, semantic reviewer correction and native conformance update; the unit records real model evidence and its formatting residual. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-act-first-PROGRESS.md
Decision: sb-w4-act-first-merge | Ordinary conflict-free merge on the exact live base; no runtime repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-act-first-PROGRESS.md
Decision: sb-w4-act-first-desk | Execute cint-L37 repin/build/rehash/replay chain; zero owner-pin changes, seven generated files regenerated. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-act-first-PROGRESS.md
Prompt review: Carry reviews/w4-act-first-change-review.md: general semantic instructions with no copied fixture dispatch or new classifier. A lookup is offered only when available before/after compaction; the existing reviewer distinguishes an unperformed necessary read from failed/unavailable reads or necessary clarification. All three tool prompts share one constant; text-only prompts remain unchanged.
Prompt finding: 450c79237a95 | protocol-literal | Existing conflict-clarification instruction in the unchanged conversation framing; overlap does not dispatch on the test phrase.
Deferral: generated/register.json:1 | not-a-deferral=Quoted recorded output or generated constitutional text, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:73 | not-a-deferral=Quoted recorded output or generated constitutional text, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:112 | not-a-deferral=Quoted recorded output or generated constitutional text, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:138 | not-a-deferral=Quoted recorded output or generated constitutional text, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:139 | not-a-deferral=Quoted recorded output or generated constitutional text, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:151 | not-a-deferral=Quoted recorded output or generated constitutional text, not an implementation promise.

Subject (22 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/README.md, src/assembly/harness.declarations.json, src/assembly/production-codex-provider.ts, src/assembly/production-provider.ts, src/assembly/tool-answer-guidance.ts, tests/assembly/production-provider-tools.test.ts, tests/integration/act-first-live.test.ts, tests/preview/act-first.test.ts, tests/preview/briefing.ts, tests/preview/default-context-floor.test.ts, tests/preview/fixtures/act-first-2026-10-10.json, tests/preview/journal-envelope.ts, tests/preview/journal-longchat.test.ts, tests/preview/journal-recall-lookup.test.ts, tests/preview/reply-check.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the reviewed unit followed by the established desk chain. No runtime machinery was added by integration. Start guard is exact live base; end guards are targeted real-shape replay and register/check evidence; existing secret, spend, stop, send and intake floors remain. The unit report supplies actual unattended tool-route evidence; this record claims integration readiness, not deployment.
80/20: Targeted changed-file and direct-consumer checks, recorded model replays and unchanged floor measurement; full pipeline gate and independent combined review belong to the driver. macOS-only cases are excluded as directed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
