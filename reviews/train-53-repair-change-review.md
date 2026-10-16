# Change review — Preserve model-directed lookup ranking under packet pressure

Subject base: 6baa7e188e91bf950be07d82908b0250d0acf2ca
Review state: open
Reviewed content: none
Outcome: Keep the lookup owner's highest-ranked original fact in the bounded second answer packet when the operator's question is a paraphrase.
Affected rules: 11, 26, 34, 36, 37, 49, 60, 69, 70, 74, 96, 101, 102, 111, 112, 113, 116
Affected floors: Secrets retain redaction and source eligibility; spend retains both-call reservations and ceilings; stop remains checked before lookup dispatch; no duplicate sends retain existing receipts and UNKNOWN non-repetition; durable intake and journal identities are unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Changes optional recall selection in an existing model packet, without changing a safety decision, parser, prompt wording, authorization, model-call count or durable schema.
Side effects: Within the existing rank-1 optional tier, model-directed lookup hits now retain the recall owner's order ahead of original-question matches, reference ties and recency. Thus lookup hits also precede equally tiered dated/pinned candidates under pressure. Higher-priority commitments/person attributes remain ahead; absent a lookup every comparator is unchanged. The original byte ceiling still drops optional evidence. No source is deleted or newly admitted. Generated pins/publications are refreshed only with the delegated tools.
Undo and recovery: Revert the comparator and its regression test, then regenerate affected pins/publications. No journal migration or effect replay; never repeat uncertain sends. Reverting reintroduces the demonstrated paraphrase miss.
Multi-machine posture: Deterministic packet selection over the same eligible journal sources on each runner; existing ownership, replication and receipt checks remain. No new durable or machine-local state.
Layer below: Read both constitutional documents, lookupRecall and its lexical/owned recall ordering, candidate eligibility/redaction, packet tier/drop comparator, prepared envelope fitting, lookup journal evidence, second-call cap/stop handling, and the real captured P4 request. Diagnostic lookup order placed source 301 first while the old fitter retained only 121/131. Existing test helper and recorded shape provenance inspected.
Bug class: integration
Bug evidence: reproducer=tests/preview/realistic-recall.test.ts; regression=tests/preview/journal-recall-lookup.test.ts; negative=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-53-repair-negative.log
Hook bypass: none; core.hooksPath unset and common hooks directory inspected: samples only.
Convergence: none
Prompt review: No instruction text or output parser changes. Replay the real P4 lookup Decision for source 6230474/question 6230509. Seven additional captured shapes ride verbatim as historical reply data through both unconstrained and one-quote envelope fitting, proving the changed selection path fires. This is packet-selection evidence, not a new live semantic verdict.
Decision: train-53-repair-lookup-order | Preserve existing lookup ranking inside its optional tier rather than increasing the byte cap or re-deriving relevance from the original paraphrase. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-53-repair-PROGRESS.md
Prompt finding: 4106b49fff07 | protocol-literal | Existing historical-grounding instruction is unchanged; only the optional evidence comparator changes.
Prompt finding: 849db3a6296a | protocol-literal | Existing saved-memory response is unchanged by this repair.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label guidance is unchanged by this repair.

Validation: Original diary reproduced 56/57 current facts and 14/14 exclusions. Fixed diary reaches 57/57 and 14/14 at the unchanged cap. All seven new recorded-shape pressure regressions fail without the comparator repair, retaining the unrelated pharmacy number; each checks roomy and pressured neighbors. Targeted checks and final gate outputs are recorded in the repair progress file. Full-suite rerun remains desk-owned per the repair instruction.

simplestRobustRoute: This is the simplest robust route: preserve the existing recall owner's ordered results during existing bounded packet fitting. No new retrieval mechanism, model call, cache or store. Entry remains an eligible, bounded model-requested lookup; completion remains one second answer with recorded selected sources and one delivery; byte/call/stop/authority floors remain. No unattended product-acceptance claim.
80/20: Repair the demonstrated selection inversion, prove pressure and roomy neighbors with recorded shapes, and run the targeted tests plus required cheap checks. Independent convergence and exact-head full-suite acceptance remain desk-owned.
VERDICT: author submission; independent landing review remains desk-owned
