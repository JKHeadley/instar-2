# Change review — train-26 parser wiring repair

Subject base: 2384ae4ff722db7a63e5235cfaae252d8ab1f0ab
Review state: open
Reviewed content: none
Outcome: Restore the launcher parser wiring regression check after continuing topic sessions added their answer-only readAnswer call.
Affected rules: Rules 26, 37, 49, 70, 74, 95, 101, 102, 111, 112, 113, 116; Purpose 3.
Affected floors: secrets — wrapper-discard regression remains; spend cap — no runtime change; stop — no runtime change; no duplicate sends — no runtime change; durable intake — no runtime change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair and review record; no parser, prompt, launcher or production behavior changes.
Side effects: The exact call-site inventory now permits the existing continuing-session answer reader, while still rejecting extra readers and direct parser bypasses. A scoped assertion requires that reader inside the Telegram continuing-session branch and retains the uncertain-outcome guard. Existing strict and tolerant parser boundary tests stay intact.
Undo and recovery: Revert this repair commit; no runtime state or migration is involved.
Multi-machine posture: Repository test wiring is identical across hosts. No shared or machine-local runtime state is added. Studio remains the full-suite gate host.
Layer below: Read both readAnswer sites in tests/preview/journal-agent.mjs: invokeSubscription derives wrappedPolicyOf(role), and the continuing-session branch only admits Telegram update answer ids after a complete outcome. Inspected the existing journal-topic-sessions test's extraction of the same shipped model closure.
Bug class: integration
Bug evidence: reproducer=tests/preview/model-json.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: train-26-repair-parser-inventory | Repair the stale exact parser-site test and pin the answer-only branch; preserve the reviewed continuing-session implementation and strict review-consumer policy. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-repair-004642-PROGRESS.md

Decision: train-26-repair-repin | Run the delegated desk rehash and repin chain, then replay the generated register from committed source; no manual pin edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-repair-004642-PROGRESS.md

Subject: tests/preview/model-json.test.ts; register-source/owner-references/preview.json; generated register replay
Generated register: replayed from source 3be5ed09058b1858ab971442262b5cd13ffb72fd, generation sha256:770ed9b8b2d8f4cf67f1bd25c50c52327b0f4d3cf73d734439e919a954ae7411; shape-only evidence.

simplestRobustRoute: This is the simplest robust route: update the existing wiring test to enumerate the two actual shared-reader calls and check the answer branch, without adding runtime machinery. The start guard is the continuing-session Telegram update predicate, the outcome guard requires completion, and existing strict consumer and malformed-output checks remain; this test-only change makes no autonomous completion claim.
80/20: Reproduced the exact reported assertion locally, then passed all 51 tests in that file. Run typecheck and the required cheap checks; leave the full suite to the Studio gate as directed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
