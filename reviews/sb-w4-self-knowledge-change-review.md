# Change review — sb-w4-self-knowledge

Subject base: 4683b8520c4a211fb7dd56a02f4425e073432420
Review state: open
Reviewed content: none
Outcome: merge w4-self-knowledge d6c408e2f8346f546e8ff51f7f3c359d38890c8d onto the live pickup head. The agent identifies itself as Instar 2.0, states its purpose and installed version, and describes abilities from current tool state in user language. Merge source is unchanged; seven generated-file conflicts are resolved by replay from merged source.
Affected rules: 1, 3, 4, 26, 30, 34, 36, 37, 47, 49, 58, 66, 69, 70, 74, 78, 80, 84, 85, 90, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — existing custody and outbound checks retained; spend cap — existing reservations and prompt floor retained, no new model call; stop — unchanged; no duplicate sends — existing durable turn/send path retained; durable intake — no row format or retention change.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: carried change affects the model-facing answer and retry path.
Side effects: generated capability prose, conversation/tools/native policy identities and prompt sizes change. Deployment needs the existing policy-successor installation path; this build changes no activation. Carried unit review metadata is completed for the existing checker.
Undo and recovery: revert the merge using its first parent plus the integration metadata/register commit, then regenerate the register. No persisted state migration is needed.
Multi-machine posture: same code on each owning runner, with abilities drawn from that runner's current route and service configuration; no ownership or replication change.
Layer below: inspected production-provider framing, journal-agent turnSources and live tool admission after the clean automatic source merge, journal routedContext refresh, generated inventory ownership, and unchanged default-context-floor guard. Replay artifacts carry real model and review shapes; the unit report distinguishes recorded empty context from actual delivered empty bubbles.
Bug class: none
Bug evidence: none
Hook bypass: none (core.hooksPath unset, common hooks directory sample-only; plain merge and commits).
Convergence: none
Decision: w4-self-knowledge | carry the reviewed unit and its recorded model evidence without new runtime changes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-self-knowledge-PROGRESS.md
Decision: sb-self-knowledge-merge | resolve all seven generated conflicts through the existing merged-source replay, preserving the ordinary merge and live base | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-PROGRESS.md
Decision: sb-self-knowledge-desk | reuse the desk repin build rehash replay chain and current owner references | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-PROGRESS.md
Decision: sb-self-knowledge-review | complete missing carried review metadata so the change checker can evaluate it without changing its runtime implementation | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-PROGRESS.md
Decision: sb-self-knowledge-tests | run targeted foreground checks with one worker and substitute a bounded packet compatibility probe for the forbidden Studio load profile | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-PROGRESS.md
Prompt review: no additional integration prompt changes. Carried system instructions define plain-language self-knowledge and preserve model judgment; fixture phrases describe identity or protocol rather than deciding a verdict. No delegation prompt added. Real-shape replay provenance and results are in the PROGRESS record.
Prompt finding: 0c09afcfe18c | quoted-evidence | constitutional purpose quoted by the capability note; test asserts that source, not a phrase that triggers a judgment.
Prompt finding: 3bb96951f29d | quoted-evidence | purpose explanation about memory and promises, tested as generated identity content, not an accept/refuse trigger.
Prompt finding: 450c79237a95 | protocol-literal | existing instruction for ambiguous memory questions, unchanged by the unit; fixture checks the instruction reaches the model.
Prompt finding: 4dc54feaf016 | protocol-literal | plain-language uncertainty response replacing an internal term; fixture verifies packet compatibility, not a fixed judgment trigger.
Prompt finding: 849db3a6296a | protocol-literal | existing empty-memory reply literal, unchanged by the unit.
Prompt finding: a62f8d789064 | quoted-evidence | framework independence is part of the source purpose explanation; no exact-match decision depends on it.
Prompt finding: bb353ee6aa92 | quoted-evidence | constitutional identity description, not a fixture-derived judgment trigger.
Prompt finding: bd01de21286a | protocol-literal | existing sourceLabel protocol instruction, unchanged by the unit.
Prompt finding: fb5fa7e706c8 | protocol-literal | existing evidence-grounded recall instruction, unchanged by the unit.
Deferral: generated/register.json:1 | not-a-deferral=generated constitutional text, not a new commitment.
Deferral: tests/preview/fixtures/self-knowledge-model-replays-2026-10-10.json:51 | not-a-deferral=retained historical model output, not a builder commitment.
Deferral: tests/preview/fixtures/self-knowledge-model-replays-2026-10-10.json:185 | not-a-deferral=retained historical model output, not a builder commitment.
Deferral: tests/preview/fixtures/self-knowledge-model-replays-2026-10-10.json:186 | not-a-deferral=retained historical model output, not a builder commitment.


Validation: the unchanged 22,959-byte floor guard passes: plain always-sent 22,208 bytes (751 spare), tools 23,933 including their larger system prompt (570 spare against the existing 24,503 bound). Targeted smoke and real-shape tests pass; exact remaining counts and skips are in the shared PROGRESS record. Lint, typecheck, architecture and register check pass. Change-review check exits 1: five new prompt overlaps require 359 dispositions across 242 older current records. Both this record and the unit record carry those dispositions. No historical record, checker or fixture is changed to evade this gate; no readiness or independent acceptance is claimed while it remains red.

simplestRobustRoute: ordinary merge of the reviewed unit and standard desk generation, plus required review metadata. This is the simplest route; no new runtime machinery. Existing route and availability are start guards, recorded-shape and packet tests check the outcome, and unchanged spend/stop/context limits bound it. No live deployment claim.
80/20: BLOCKED by the recorded change-review gate failure; targeted verification is in the shared PROGRESS report. The pipeline owns the full suite and live landing gate.
VERDICT: author submission; this record asserts no independent verdict
