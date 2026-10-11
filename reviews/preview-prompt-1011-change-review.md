# Change review — Correct runtime agent identity

Subject base: 4faadbfc2f87946519f8750f546bb1dd50c5bb08
Review state: open
Reviewed content: none
Outcome: Runtime introductions describe Justin's Instar 2.0 agent in a private Telegram conversation with the verified operator; the identity briefing supersedes historical preview/trial labels.
Affected rules: Purpose self-knowledge; 28, 34, 36, 37, 47, 49, 58, 70, 74, 78, 84, 101, 111, 112, 113, 116
Affected floors: secrets — unchanged custody and outbound checks; spend cap — same finite caps; stop — unchanged; no duplicate sends — unchanged durable fence; durable intake — unchanged journal
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Model-facing identity wording with existing protocol, constraints and safeguards retained.
Side effects: Prompt bytes and invocation-policy digests change. The single-turn byte pin changes from 1424 to 1465 because the introduction now names the agent and verified private Telegram conversation. Existing policy-successor activation is required for changed provider policies; no activation is rewritten here. Briefing growth is checked against existing packet floors.
Undo and recovery: Revert this change and regenerate derived register output; no durable schema or record changes.
Multi-machine posture: Shared repository wording on all machines; no new state, ownership, replication or machine-local behavior.
Layer below: Provider prompt inheritance for tools, native and sessions; invocation-policy hash validation; generated capability note and current self-state labels; immutable recorded history and delivery/parser paths.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-carry.test.ts
Hook bypass: none; core.hooksPath inspected unset and common hooks directory contains only sample hooks
Convergence: none
Decision: preview-prompt-wording | Correct only runtime identity wording, preserve safeguards and internal identifiers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-prompt-1011-PROGRESS.md
Decision: preview-prompt-history | Explicitly supersede earlier preview/trial identity labels after the first real replay repeated them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-prompt-1011-PROGRESS.md
Prompt review: Identity wording only, with no fixed-answer gate. Existing quoted history is retained. Replay recorded summary/uncertain summary, Jev uncertain/undecided, reply review, delivered and empty reply shapes through the worker; fresh capability answer uses recorded update 840342287 and the unchanged K11 rubric. First two answers still described a preview and is retained as red evidence; the identity replacement wording explicitly supersedes those historical labels.
Prompt finding: 034c5250da92 | protocol-literal | Unchanged protocol or tool/grant guidance, checked with recorded fixtures; no new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 450c79237a95 | protocol-literal | Unchanged protocol or tool/grant guidance, checked with recorded fixtures; no new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/journal-people.test.ts: "if two active memory items match the question but disagree, or refer to differen"
Prompt finding: 45e37ea2e9e9 | protocol-literal | Unchanged protocol or tool/grant guidance, checked with recorded fixtures; no new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | protocol-literal | Unchanged protocol or tool/grant guidance, checked with recorded fixtures; no new phrase gate — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | protocol-literal | Unchanged protocol or tool/grant guidance, checked with recorded fixtures; no new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: b00ed403060a | protocol-literal | Unchanged protocol or tool/grant guidance, checked with recorded fixtures; no new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"

Subject (6 paths): src/assembly/production-codex-provider.ts, src/assembly/production-provider.ts, tests/assembly/production-provider-subscription.test.ts, tests/preview/briefing.ts, tests/preview/journal-awareness.test.ts, tests/preview/self-state.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: edit existing identity text and moved pins without adding machinery. Start guards are the assigned source head and captured inputs; end guards are targeted tests, fresh K11 and source checks. Secret, spend, stop, send and intake floors remain unchanged. No unattended deployment claim.
80/20: Targeted foreground tests only, nice -n 10 with one worker; pipeline owns the full suite and independent landing judgment.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Evidence: Fresh recorded-update 840342287 replay with the final briefing and tools system prompt passed unchanged k11a-rubric-v2, uncached digest c6f12536f21ef9ab767097aee174251c8b53e5c1ca0f4ea162a0a87ce5c243bb. Its answer contains no preview self-description; exact inputs, output and judge are in tests/preview/fixtures/preview-prompt-2026-10-11.json. Earlier captures remain unchanged. K11 accepts the retained approval-checkpoint imprecision; this change does not claim perfect wording or deployed acceptance.

Pin rationale: Provider introductions change the decision and conversation invocation-policy hashes; the existing stale-policy refusal remains enforced. The transitive native composition digest changes to b62be0f71ef95e83ca7d7eb464e3dbe41ed278879813283e6e201f647d57bae8 because the providers are in its source closure. Its existing contract is rerun; generated capability/register output is regenerated from source. The historical system assertion applies only the declared identity replacement, leaving all protocol bytes pinned.

Verification: Required provider files pass (107 tests); final pinned briefing and recorded-shape run passes 9 files / 89 tests; native contract and ordinary/tool packet floors pass 2 files / 16 tests. Typecheck, architecture, lint and register:check pass. Generated output binds source commit da7e73c9408ded403fe879672e09857bb65b990e; the final source note, instructions and system prompt match the new capture byte-for-byte after regeneration. Full commands, red evidence and output are in the absolute preview-prompt-1011 PROGRESS record.
