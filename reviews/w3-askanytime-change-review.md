# Change review — w3-askanytime: an operator's explicit ask is answerable at any time

Subject base: 98ba391bd36176dab9107fbef9c51f308cf8fe15
Review state: open
Reviewed content: none
Outcome: Plan row #349. Live 2026-10-02 22:36 PDT (build cint-L34 98ba391b, both phone actions connected and admissible) the operator's "Please raise my model-call limit." (journal turn update 969390016) got a false cannot-do, because OPERATOR_ACTION_GUIDANCE rode only near a limit or within 48 hours of the end. It now rides whenever an explicit-yes source is admissible on the root (yesStatus(): chat or review admissible, read afresh each turn); configured-but-inadmissible roots keep the near-limit rule so the runner's why-not reaches the operator; a root with no port is unchanged (+0). Proven on fresh roots both sides, and on the recorded live turn from a copy of the live root (exact re-encoding of the recorded packet; base lacks the guidance, branch carries it); four real answer-model calls (claude-sonnet-5): the plain ask proposed raise-caps step twice, an unrelated directive proposed nothing twice; all four replayed through the live port's extraction.
Affected rules: Purpose "no false claim" via Rule 3 (the packet no longer withholds a route the runner has), 79 (the phone raise is reachable by asking at any time), 10 (no keyword list; the model judges the ask), 82 and 98 (unchanged: the runner writes the request, only an explicit yes applies it), Purpose approval-account exception (unchanged admission and disclosure), 106 (recorded live turn and real outputs replayed), 116, 74, 113
Affected floors: secrets — the storage key is read from the vault into the environment for the replay only and never printed; the model subprocess environment drops INSTAR_SECRET_*; nothing in the fixture is a secret; spend cap — a raise is still bounded by the governed step and applied only on an admitted yes; the only cost is 415 prompt bytes on admissible roots; stop — unchanged (no proposal after a stop); no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one model-facing condition widening when existing, already-reviewed guidance rides; no authorization, admission, journal or effect path changes.
Side effects: on roots with an admissible explicit-yes source every answer packet grows by 415 bytes (397 bytes of guidance text); the model may now propose a raise or renewal far from a limit, which opens one review pull request per proposal on the P-05 route (bounded by the existing request lifetime and one open request at a time). Roots without the port are byte-identical.
Undo and recovery: revert 4e031670 and this record; no journal format or state changes, so a reverted build reads every root unchanged.
Multi-machine posture: machine-local preview runner, unchanged; the condition reads the same per-machine installation record the issuer already reads.
Layer below: yesStatus()/explicitYesStatus (unchanged) decides admissibility; issueOperatorRequest and proposeOperatorRequest (unchanged) still decide whether a proposal becomes a request.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: askanytime-admissible-gate | the guidance rides whenever yesStatus() reports chat or review admissible; configured-but-inadmissible roots keep the near-limit rule so the honest why-not still reaches the operator | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-askanytime-PROGRESS.md
Decision: askanytime-one-wording | no new shorter standing sentence: the existing model-validated guidance rides unchanged, at 415 envelope bytes, rather than a second wording to keep true | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-askanytime-PROGRESS.md
Decision: askanytime-replay-by-insertion | the live branch packet is the exactly re-encoded recorded packet plus the one term at the worker's placement, rather than re-running the worker over a truncated journal; the placement is shown on fresh roots | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-askanytime-PROGRESS.md
Prompt review: no prompt text changed; only the condition under which the existing OPERATOR_ACTION_GUIDANCE rides. It copies no test phrase. Real model sampled on the recorded live packets (4 calls, fixture ask-anytime-live-2026-10-02.json).
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Skip: tests/preview/ask-anytime.test.ts:216 | scope=the live-copy replay runs only where a copy of the live root and the storage key are bound; it never reads the live root
Skip: tests/preview/ask-anytime.test.ts:253 | scope=the real-model capture runs only on explicit INSTAR_ASKANYTIME_LIVE=1; its outputs are recorded and always replayed

Subject (6 paths): reviews/w3-askanytime-change-review.md, tests/preview/README.md, tests/preview/ask-anytime.test.ts, tests/preview/fixtures/ask-anytime-live-2026-10-02.json, tests/preview/journal.ts, tests/preview/operator-yes.test.ts

## Closing block

simplestRobustRoute: the required outcome is that an operator's explicit ask for a raise or renewal is answered with a proposal whenever the runner can carry it. The simplest robust route is this proposal: one added term in the existing condition, using the existing admissibility function and the existing guidance; no new wording, state or machinery. A shorter standing sentence was considered and not taken: it would save about 130 bytes at the cost of an unvalidated second wording.
80/20: 0 must-fix, 1 note — the brief's update id 969390017 is 969390016 in the journal (same text and time).
VERDICT: author submission; the independent verdict is recorded as a pass
