# Consistent fact learning and conversational acknowledgements

Subject base: 206bc77026aae10e4acb3ae6b177f2d0882295c8
Review state: open
Reviewed content: none
Outcome: Equivalent direct facts receive the same automatic-learning instructions throughout answers, summary recovery and retrospective review. Valid saves keep the agent’s own answer. Malformed person attributes receive the existing single declaration repair; an exhausted save failure reports plainly that the message remains in the conversation.
Affected rules: Purpose constraints 2 and 3; Rules 4, 7, 10, 12, 18, 36, 41, 49, 55, 57, 58, 70, 74, 75, 77, 78, 80, 85, 89, 100, 101, 111, 113, 116.
Affected floors: Secrets, spend cap, stop, durable intake, and no duplicate sends retain their existing validators, admission and send paths. No new effect, authority, storage or provider route.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes model guidance and operator-visible memory acknowledgement behavior.
Multi-machine posture: Same deterministic packet and journal rules on every host. No new machine-local state. Conversation ownership and durable send intents remain authoritative; replay never resends a delivered answer.
Side effects: Successful remember actions now deliver model prose instead of replacing it with a template; existing outbound review, secret guards and delivery bookkeeping still apply. An empty model bubble with an admitted fact gets a plain infrastructure receipt; an exhausted rejected write gets a plain failure notice. These fallbacks cannot invent agent prose when none was produced. Corrections and forgets retain their existing exact history-withholding rendering. Repeated guidance and memory-shape prose were shortened to preserve the existing default/tool context floor and review reserve; limits are unchanged. A malformed person-attribute declaration can spend the one already-budgeted format repair; no extra retry allowance is introduced. Summary recovery uses the same learning policy, only for its authenticated memoryRequest.
Undo and recovery: Revert this change to restore the previous prompts/rendering. Journal schemas and saved facts are unchanged. Remembered counts are derived from durable events; no migration is needed. Old retrospective findings remain evidence and are explicitly subordinate to current policy. Already delivered replies are never rewritten or resent.
Layer below: Read the exact encrypted proof-room journal O_RDONLY, its model-call outputs/reasons, retrospective pass, source/quote validation and intent records. Checked memoryFrom, attributesFrom, declarationDefect, durable answer projection, memoryAcknowledgement, summary recovery and retrospectivePopulation/followUps. The two failed turns had empty memory arrays: the invalid values were paraphrased person attributes. The retrospective had seen save acknowledgements without their durable write evidence and invented an explicit-request requirement.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/memory-consistency.test.ts; live=tests/preview/fixtures/memory-consistency-1025.json
Hook bypass: none; core.hooksPath is unset and the checked shared hooks directory contains sample hooks only.
Convergence: none
Decision: consistent-memory-policy | Reuse model judgment with one shared automatic-learning policy, actual write evidence for retrospective review, existing declaration repair and the model’s valid reply. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memory-consistency-1025-PROGRESS.md

simplestRobustRoute: This is the simplest robust route through existing memory and reply paths. The named failures are contradictory model instructions plus retrospective advice based on missing write evidence, a sender that discarded the agent’s prose, and an exact attribute failure that missed the existing repair. No new engine, semantic keyword rule, model pass, state machine, store or retry budget. Start guards: verified operator, eligible model proposal, exact source/quote, existing audience standing. End guards: durable admitted facts, truthful reply, retained failed input, one send across restart. Stop and spend caps bound repair. Captured shipped-path outputs run unattended in isolated journals; fresh provider and user-channel acceptance belongs to the desk’s proof gate, not these offline tests.

Evidence: Five new regression failures were observed before implementation. Recorded S f2-f26 (6236456–6236480) are replayed through intake, answer and send selection. f12/f23’s exact malformed attribute outputs exercise the new repair; repaired fixtures and still-invalid/stop/cap neighbors verify both sides. f1 (6236455) is replayed twice locally from the read-only journal without exporting or printing its lock value. Its ordinary fact count stays zero. A supplemental repeated-exclusion fixture asserts the new guidance and no permission offer. Historical model outputs replay as historical decisions; prompt tests establish delivered policy consistency, not a claim that replaying old outputs can measure a fresh model’s judgment.

Recorded shape coverage: Summary writer summary:715672480, uncertain summary 715672483, Jev undecided 715672482 and unsure 969389570, reply review 969389923, delivered reply 715672479, and empty bubble 715672550 are consumed as the existing repair’s second response. Existing reply-review tests also exercise their actual review roles. No stub-only readiness claim.

ELI16: The agent was getting two different instructions: remember useful facts, and only save when asked. A later self-review repeated the second instruction because it could not see the saves that had happened. Now both paths say the same thing and the review can see the save evidence. When a save works, you get the agent’s own reply. If it cannot save, it says so plainly and keeps your message.

Validation so far: 154 focused tests across nine files pass, plus the full recorded conversation-pressure boundary and complete-history headroom boundary. Typecheck passed before the final text compaction; final gates are recorded in PROGRESS. Architecture reports only the charter-exempt stale native macOS self-host composition certificate; its declaration is unchanged.

VERDICT: author submission; independent convergence and fresh live acceptance are not claimed
