# Change review — restore test answers on the reviewed Codex CLI

Subject base: 52ead9423d978a2061f7fc32e8d53e0befc32960
Review state: open
Reviewed content: none
Outcome: Admit the installed native Codex CLI 0.156.1 through the existing exact subscription activation checks, restoring a usable answer doorway for isolated test copies while the Claude test logins are exhausted.
Affected rules: Rules 1, 4, 18, 28, 30, 34, 35, 36, 41, 42, 49, 56, 58, 74, 75, 101, 104, 113, 116.
Affected floors: secrets — subscription-only isolated profile, no inherited API keys; spend cap — existing reservation and model-dispatch checkpoints; stop — existing admission and stop latch; no duplicate sends — no retry or send-path change; durable intake — existing journal unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: A reviewed executable version changes admission for real model calls; positive and negative version checks, captured-frame replay and a live registered doorway call are required.
Side effects: Existing 0.149.1 activation records now refuse until revalidated. The exact executable digest and policy binding still apply. The live test uses the application reader for the already-shipped flat answer protocol; it previously expected the retired nested Decision shape. Opt-in capture records only this test's fixed request and stdout, never its environment or login.
Undo and recovery: Revert this commit and restore the backed-up test launchers and prior records while those rooms are idle. Preserve journals and uncertain sends; do not retry them or fall back to a reserved login. Desk file backups and hashes are in the progress record.
Multi-machine posture: The product version pin applies on every host; each host still validates its own executable and profile. Test login custody, activation seals, launchers and captures are deliberately Studio-local. No replication, ownership or cross-machine send authority changes.
Layer below: Inspected the 1.x Codex event normalizer, its version-sensitive canaries, headless subscription launch and SessionManager framework path. Reused its real-frame/canary approach without transplanting its large modules. Inspected 2.0 subscription custody, exact version/artifact admission, event parser, tool admission records and model checkpoint.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-codex-provider.test.ts; reproducer=tests/e2e/codex-answer-live.test.ts
Hook bypass: none; core.hooksPath unset; shared git hooks directory contains sample hooks only.
Convergence: none
Decision: codex-tests-1021-version | Advance only the exact reviewed pin after recorded and live revalidation; keep historical capture provenance and reject adjacent versions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-tests-1021-PROGRESS.md
Decision: codex-tests-1021-test-profile | Use codex-dawn-sagemind and test-local gpt-6-astra with authority resolved from grant 121996; leave Justin's live settings untouched. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-tests-1021-PROGRESS.md

Prompt finding: 42faf877ba82 | quoted-evidence | The existing identity assertion quotes unchanged prompt wording; this change alters only the reviewed executable version, with no fixture phrase added to a prompt.

Subject (5 paths): src/assembly/production-codex-provider.ts, src/assembly/README.md, tests/assembly/production-codex-provider.test.ts, tests/e2e/codex-answer-live.test.ts, tests/preview/fixtures/codex-answer-0.156.1.json

simplestRobustRoute: This is the simplest robust route: one reviewed version-pin update, existing activation/profile/seal mechanisms, and existing test launchers. No new provider, fallback, authority, retry or polling daemon. Exact activation, subscription-only login, model admission, caps, stop and durable send guards remain in place. The live registered doorway returned a readable answer; desk copy/room outcomes are recorded in PROGRESS before any READY claim.
80/20: The failing version test reproduced the stale pin; the new pin passes neighboring-version refusals and real-frame replay. The live test exposed and corrected its stale nested-envelope assertion. Independent landing judgment belongs to the desk.
VERDICT: author submission; no independent convergence claimed
