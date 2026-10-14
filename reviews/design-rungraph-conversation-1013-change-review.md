# Change review — continuing conversations in the durable run graph

Subject base: 7ef8f158d4129a4cf90cf3c546701f32e348fdd3
Review state: open
Reviewed content: none
Outcome: Specify how a many-turn conversation shares history across bounded assignments and replaceable sessions, including durable input attachment, summaries, compaction, tools, delegation and recovery. This is a docs-only joint-review submission; no runtime behavior or constitutional wording changes. Refresh only the design artifact hash and generated register publication so the final document pin is checkable.
Affected rules: Purpose constraints 2/4 and its role, durable-cause, single-machine and decision-gap rules; Rules 4, 7, 10, 14, 15, 28, 29, 30, 32, 33, 34, 41, 44, 45, 46, 47, 49, 55, 58, 60, 61, 63, 68, 74, 75, 83, 90, 91, 93, 96, 97, 100, 101, 102, 103, 110, 111, 113, 114, 115 and 116. The changed design names the applicable existing P5 checks and positive/negative conversation cases; runtime implementation remains declared.
Affected floors: secrets — account credentials remain with custodians and graph records contain references; spend cap — cumulative session/installation bounds, ancestor debits and uncertain exposure survive inputs and replacements; stop — fast-path inhibition and explicit resume remain; no duplicate sends — stable operation/delivery keys and no replay of uncertain effects; durable intake — input disposition and queued delivery remain owned across every crash cut.
Operator questions: The purpose's closed single-machine irreversible profile conflicts with general in-role irreversible connected-account work. Section 15 quotes both sides and stops that portion of step 4 pending an operator amendment; this design does not change the constitution or grant an exception. Joint design review, not a pull request or merge, is the requested next action.
Suggested tier: ordinary
Declared tier: significant
Tier rationale: Governing design changes at ownership, history and recovery seams warrant targeted contract checks and independent review; no executable path, prompt or parser is changed.
Side effects: Assignment grouping changes the design's intake/run seam and requires a versioned attachment transition. History consumers must share a conversation-scoped frontier and distinguish token coverage from the built message-count threshold. Existing signed run identities and pending operations must remain readable. Summary quality and consumption are separate evidence. Eight/sixteen must agree on logical reply identity; this unit does not expand their send authority.
Undo and recovery: Revert through a new governed document version, retaining the changelog and git history. No deployed data or code is changed. An implementation must preserve old signed records and perform the cutoff/adoption checks in section 2.2.
Multi-machine posture: Shared run/input/grounding facts and existing fenced ownership; one-machine operation has no peer dependency within the installed profile. Multi-lineage history is read at a causal frontier. Non-owners queue or forward, unknown effects remain held, and accepted transfers preserve ownership. No new replication protocol or authority is introduced.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md in full at 7ef8f158. Read the complete owning design, train-19 rungraph public types, root decoder, grounding fold, service and delegation seams; compared main's rungraph diff. Read src/rungraph, awareness and harness-adapter READMEs, the supplied live carry trace and complete plan of record. Read session-mouth-copy-1013 at f4a6b091, especially production-conversation-session.ts and the driver's delivery/reconnect/reconstruction path. The live trace contradicts the README's no-tools claim; the report preserves that distinction.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: rungraph-conversation-lifetimes | Keep Four's conversation, Five's bounded assignment and Ten's worker incarnation distinct; attach follow-ups durably rather than create an immortal root or a run for every input. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-rungraph-conversation-1013-PROGRESS.md
Decision: rungraph-context-coverage | Reuse history/capture, awareness and consumption ports; add token-based covered summaries, exact live-input extensions and pre-pause continuity accounting without deleting source history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-rungraph-conversation-1013-PROGRESS.md
Decision: rungraph-owned-subwork | Preserve per-operation uncertainty and cumulative budgets; complete the production delegated-run owner rather than add a separate subagent scheduler or infer authority from a transcript. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-rungraph-conversation-1013-PROGRESS.md
Decision: rungraph-authority-question | Quote the fixed-profile conflict and stop only the out-of-profile irreversible connected-account dispatch design at that boundary; other conversation work proceeds under unchanged floors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-rungraph-conversation-1013-PROGRESS.md

Deferral: docs/09-the-run-graph.md:122 | not-a-deferral=Describes causally late outcome admission against a current head, not postponement of this docs task.
Deferral: docs/09-the-run-graph.md:128 | not-a-deferral=Prohibits using a timeout as an assignment-boundary rule; no work is postponed.

Decision: rungraph-publication-pins | Refresh the existing rungraph design hash and generated register publication without changing runtime or checker code; retain explicit shape-only authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-rungraph-conversation-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: retain conversation bindings, immutable runs, linear steps, existing durable facts, admission, awareness and adapter ports; add durable input attachment and finish summary/compaction and delegated-owner joins. Attachment prevents loss or duplication of clarifications; coverage and consumption prevent a replacement from guessing history; existing operation identities and reservations prevent duplicate effects and cap resets. No new global conversation root, store, scheduler or review gate is proposed. Start guards are standing, fence, resource admission and grounding; end guards are exit evidence and settlement; limits retain stop, spend and bounded recovery. This design claims no unattended shipped-path completion.
80/20: Deliver the bounded design and exact consumer gaps for the five-unit joint review. Required docs, architecture, typecheck, register and targeted checks are reported with their actual outcomes. The Studio owns full-suite and independent-review evidence.
VERDICT: author submission; independent joint review pending
