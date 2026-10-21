# Change review — Repair train-98 pipeline replay boundaries

Subject base: df3dea5c6cbb3d624a70921787ed90fba8e3cb6d
Review state: open
Reviewed content: none
Outcome: Repair the train-98 gate failures by binding the real formatted-send dependency in the host replay, comparing delivered text at its rendered boundary, and recording a bounded step-check deadline without claiming graduation.
Affected rules: 1, 26, 34, 36, 37, 49, 70, 72, 73, 74, 90, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged signed send and disclosure gates; spend cap — existing replay checks retained; stop — existing negative controls retained; no duplicate sends — one provider call and one physical send across replay asserted; durable intake — journal recovery and commitment tests retained.
Operator questions: none
Suggested tier: critical
Declared tier: standard
Tier rationale: Test-boundary repairs and one append-only graduation deadline; no model prompt, parser, runtime decision or authority changes.
Side effects: The dark step-check observer has a new October 24 00:00 UTC evaluation deadline. No stage or live protection is claimed; the deadline still fails exactly at expiry. Replays now distinguish raw recorded input, Telegram HTML payload and displayed text.
Undo and recovery: Revert this repair and regenerate the register. The previous October 21 deadline becomes overdue again. Keep recorded inputs and all journal/send uniqueness evidence.
Multi-machine posture: No new machine-local state or transport. Committed tests and promotion records travel through git; existing ownership, disclosure and replay checks still enforce one sender.
Layer below: Read the full purpose and rules, the Telegram renderer and physical-send wrapper, recorded model/receipt fixtures, journal realpath guard, promotion record and capability deadline checker.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-carry-requests.test.ts; regression=tests/preview/capabilities.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: train98-pipeline-rendered-replays | Bind the real sendFormattedText helper and compare downstream rendered delivery while retaining raw capture inputs and all recovery assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-repair-170503-PROGRESS.md
Decision: train98-pipeline-step-deadline | Append a third bounded 72-hour extension to October 24 UTC; no stage evidence exists, so retain dark status and the desk graduation-or-retirement obligation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-repair-170503-PROGRESS.md
Prompt review: No prompt, model parser or accept/refuse logic changed. Real recorded replies, summary uncertain output, Jev unsure/undecided and empty bubbles remain the inputs; only downstream rendered-delivery expectations changed.

Subject (12 paths): tests/preview/README.md, tests/preview/capabilities.declarations.json, tests/preview/capabilities.test.ts, tests/preview/deferral-not-memory.test.ts, tests/preview/gap-progress-final.test.ts, tests/preview/group-carry-requests.test.ts, tests/preview/memory-prefer.test.ts, tests/preview/no-handback.test.ts, tests/preview/obligation-task-answer-live.test.ts, tests/preview/promotion-record.test.ts, tests/preview/promotion-record.ts, tests/preview/reply-acknowledgement.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the installed formatter and append-only deadline mechanism. Start guards are the recorded input and exact host body; end guards assert one complete delivery and retained commitments across restart; limit guards remain stop, cap, disclosure and no duplicate sends. No new machinery or autonomous live acceptance claim.
80/20: Nine targeted test files pass (129 tests). Typecheck, architecture, lint, register replay/check and change-review check are run separately; full suite belongs to the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
