# Change review — Keep the current answer when carrying an earlier correction

Subject base: ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387
Review state: open
Reviewed content: none
Outcome: An earlier correction is a separately recorded optional sentence. The current answer is reviewed and retained independently; the addition uses the existing bounded revision-review slot and only a passing result appends it. A failed addition remains pending. A rewrite on a turn carrying corrections is checked for coherence against the current question.
Affected rules: Purpose coherence and least revelation; Rules 1/4/8/10/34/36/41/42/44/49/52/55/57/58/60/63/70/74/75/77/84/86/95/101/102/106/111/112/113/116.
Affected floors: secrets — existing exact outbound wall also runs before disclosing the addition to its reviewer; spend cap — reuse one reserved revision-review operation inside the existing call cap and 60-second deadline; stop — existing gate runs before reservation and intent; no duplicate sends — one existing signed intent, UNKNOWN calls and sends never repeated; durable intake — existing intake-first journal unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes model-facing reply assembly, review selection and durable recovery on the operator surface.
Side effects: A valid correction can cost one review when the original answer passed without a rewrite; a turn that already used its revision-review slot retains the correction instead of making another call. A short correction can wait under repeated tight budgets. No-correction turns preserve their original call path. Corrections are bounded to one segment and 240 characters without truncating claims. A correction never forces a second outbound message.
Undo and recovery: Revert the output policy only with a reader that still recognizes the additive correction fields and correctionCandidate reservation shape; an old reader cannot recover a new correction reservation with no rewrite. Do not roll a used journal back to the old reader. Recovery replays the exact candidate/result, never repeats a reserved review, and requeues deferred sources at the durable send intent.
Multi-machine posture: All new state rides the existing authenticated journal and ownership-gated intent; no new store, timer, channel or authority. All readers of a journal using the new reservation shape need this reader version. Only the existing conversation owner sends. Unavailable peers and UNKNOWN effects retain existing semantics.
Layer below: Read both constitutional documents in full and confirmed hashes equal origin/main. Inspected answer parsing, grounded correction consumption at reserve, held-class review, claim excision, signed intent, paid-call reservation and restart replay. The actual Studio inspect/turns exports show a revised correction-only send with no claim excision; they do not expose the original draft or revision rows. Fixture provenance labels the separated arithmetic answer as reconstructed from the captured answerReason, not captured original draft bytes.
Bug class: integration
Bug evidence: reproducer=tests/preview/correction-keeps-answer.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory contains only sample files.
Convergence: none
Decision: correction-answer-separation | Record the optional correction separately so rejection or loss of that addition cannot replace the current answer; keep its grounded sources pending on failure. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-keeps-answer-1012-PROGRESS.md
Decision: correction-existing-review | Reuse the sole revision-review slot, existing coherence question and raw_path rule; preserve caps, deadline, floors and one outbound intent rather than add a new reviewer or retry loop. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-keeps-answer-1012-PROGRESS.md
Decision: correction-capture-evidence | Replay exact delivered correction and review findings from updates 840342530 and 840342531, and explicitly distinguish reconstructed output fields; request the missing raw draft rows rather than infer them as fact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-keeps-answer-1012-PROGRESS.md
Decision: correction-publication | Replay the register at the source commit after the supplied desk pin tools found no owner or inventory pins to refresh; generated files bind the shipped source bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-keeps-answer-1012-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Unchanged governed text emitted by the register generator, not postponed work.
Prompt review: The pending-correction guidance separates the current reply from an optional short addition and forbids quoting a disclosed path. The revision question keeps carried corrections outside the answer rewrite. The existing contextual coherence question is used on correction-bearing rewrites; no arithmetic string or expected answer is embedded in a production prompt. Captured correction-only output traverses the bound and rewrite-review paths; the safe answer fixture comes from the recorded reasoning. New reviewer verdicts in these tests are controlled evidence of routing, not a claim of a new live model run.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged memory-list output literal, not a new prompt expectation.
Prompt finding: bd01de21286a | protocol-literal | Unchanged source-label protocol guidance, not a test-derived answer.
Prompt finding: fb5fa7e706c8 | protocol-literal | Unchanged journal grounding guidance, not a test-derived answer.

## Closing block

simplestRobustRoute: This is the simplest robust route through the existing answer, optional output fields, journal and bounded review. Prompt-only advice already said to answer fully yet the recorded delivery lost the answer. Separating the optional correction prevents its failure from taking the answer with it; the existing coherence review rejects a correction-only rewrite. There is no new model route, retry, timer or send. The start guard is grounded correction provenance; the end state is one admitted answer with either a reviewed addition or durable pending sources; limits are the existing cap/deadline plus a bounded one-sentence addition. No unattended live deployment is claimed.
80/20: Use the recorded case, positive and negative neighbors, restart/UNKNOWN/cap/secret cases, direct-import tests and required machine gates. Platform-bound proofs remain the Studio desk's responsibility.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
