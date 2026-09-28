**Status: approved. Governed.**

# Part twenty-one — the recall doorway

**Value — purpose.** A person should not have to repeat a relevant earlier exchange just
because the agent changed sessions, topics, channels, or machines. When a later conversation
or action calls for it, Instar should find the permitted evidence, understand who said what
and when, and use it correctly. Remembering an exchange and having permission to reveal it
are separate responsibilities. Beyond-human memory coherence is a goal to measure, not a
property conferred by this design.

**Rule — reading convention and evidence discipline.** Rules 1, 7, 13, 26, 49, 69, 77,
90, 91, 95, 105, 108, 111 and 113; **checks: P21-NF-01/02/20/21**. Every claim belongs
to its nearest Rule or Value block. Requirements below describe the proposed contract;
they do not say that Part Twenty-One is implemented, activated, independently reviewed,
or operator-approved. Named runtime checks are implementation obligations until their
named dependencies land and real evidence passes. Source existence, actual context delivery,
model use, and the user's outcome are four separate evidence claims.

The design combines **Proposal A**, accounting for what actually reached the model, with
**Proposal B**, bounded recall before drafting the main answer or choosing an external action.
**Proposal C**, selective live semantic review—comparing a claim’s meaning with its supporting
evidence—is a separately governed intervention for history-review candidates (a policy-selected subset of consequential effects).
Fixed checks enforced by the component responsible for the action run first; review after
the fact is the default elsewhere.
The [accepted research](21-the-recall-doorway/research/05-proposals-and-evaluation.md)
supplies the hypotheses and the procedure for testing whether they are wrong. No paid experiment or production effect
is authorized by this document.

---

## Sections

This design is split into one file per section so each renders on GitHub and can take line comments. The Governed status covers this index and every numbered section below as one governed body. The files below, read in order, are the complete document. Supporting research and artifact READMEs are explanatory evidence, not additional requirements; executable artifact shapes are specified by the indexed Rules.

1. [Ownership and boundaries](21-the-recall-doorway/01-ownership-and-boundaries.md)
2. [The PRINCIPAL recall contract](21-the-recall-doorway/02-the-principal-recall-contract.md)
3. [Evidence packets and the auditable manifest](21-the-recall-doorway/03-evidence-packets-and-the-auditable-manifest.md)
4. [The replaceable retriever family](21-the-recall-doorway/04-the-replaceable-retriever-family.md)
5. [Identity, scope, and cross-conversation joins](21-the-recall-doorway/05-identity-scope-and-cross-conversation-joins.md)
6. [Write-side indexing and non-deleting projections](21-the-recall-doorway/06-write-side-indexing-and-non-deleting-projections.md)
7. [Budgets, freshness, and recovery](21-the-recall-doorway/07-budgets-freshness-and-recovery.md)
8. [Selective live review and memory sentinels](21-the-recall-doorway/08-selective-live-review-and-memory-sentinels.md)
9. [Coherence outcomes and user-perspective measurement](21-the-recall-doorway/09-coherence-outcomes-and-user-perspective-measurement.md)
10. [The pilot, human comparison, and incident replay](21-the-recall-doorway/10-the-pilot-human-comparison-and-incident-replay.md)
11. [What Instar 1.x does today and what carries forward](21-the-recall-doorway/11-what-instar-1-x-does-today-and-what-carries-forward.md)
12. [Non-functional checks and activation](21-the-recall-doorway/12-non-functional-checks-and-activation.md)
13. [Negative contract fixtures](21-the-recall-doorway/13-negative-contract-fixtures.md)
14. [Inherited duties and disposition](21-the-recall-doorway/14-inherited-duties-and-disposition.md)
15. [Operator decisions and honest limits](21-the-recall-doorway/15-operator-decisions-and-honest-limits.md)
