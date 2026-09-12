**Status: draft, awaiting approval. Governed.**

# Part sixteen — the measurement and spend ledgers

**Value — purpose.** The operator should be able to ask what Instar consumed, what it cost, what
work caused it, and how confident the answer is without turning observation into permission.
This part makes token, quota, resource, feature-call and spend history one inspectable package
over the signed record. It also makes missing metering visible. A model call that cannot be
accounted for is not made cheap by the absence of a number.

**Value — governed submission scope.** The executable acceptance target in this document is the
foundation tranche named in section 13. It covers only contracts that can be implemented through
the public owner ports landed at this head. The full measurement, pricing, live accounting,
measured-benchmark and spend-control package remains a tracked follow-on design. Approval of this
document cannot be represented as approval or activation of that follow-on package.

**Rule — reading convention and evidence discipline.** Rules 13, 26, 39, 41, 58, 69, 75, 86,
91 and 113; **checks: P16-NF-01/03–06/52** and `node scripts/check-governed-docs.mjs docs`.
Every claim belongs to its nearest Rule or Value block. Statements about Instar 1.x are limited
to the modules audited in section 11. A configured collector, a database file and a target rate
are not evidence of running. Measured means recorded execution on named hardware against a named
workload. A record's own feature, model, price, machine or authority label is a claim; every
consumer re-resolves those labels against signed history at its chosen causal frontier.

---

## Sections

This document is split into one file per section so each renders on GitHub and can take line comments. The files below, read in order, are the complete document.

1. [Ownership and boundaries](20-measurement-ledgers/01-ownership-and-boundaries.md)
2. [Vocabulary and the registered measurement plane](20-measurement-ledgers/02-vocabulary-and-the-registered-measurement-plane.md)
3. [Model-call census, tokens and attribution](20-measurement-ledgers/03-model-call-census-tokens-and-attribution.md)
4. [Price manifests, settlement and spend views](20-measurement-ledgers/04-price-manifests-settlement-and-spend-views.md)
5. [Quota observations](20-measurement-ledgers/05-quota-observations.md)
6. [CPU, memory and process footprint](20-measurement-ledgers/06-cpu-memory-and-process-footprint.md)
7. [Feature, benchmark and burn joins](20-measurement-ledgers/07-feature-benchmark-and-burn-joins.md)
8. [Spend caps and freeze through the effect doorway](20-measurement-ledgers/08-spend-caps-and-freeze-through-the-effect-doorway.md)
9. [Retention, reconstruction and multiple machines](20-measurement-ledgers/09-retention-reconstruction-and-multiple-machines.md)
10. [Holders, runs, loops and surfaces](20-measurement-ledgers/10-holders-runs-loops-and-surfaces.md)
11. [What Instar 1.x does today and what carries forward](20-measurement-ledgers/11-what-instar-1-x-does-today-and-what-carries-forward.md)
12. [Behavioral seams and shared failure traces](20-measurement-ledgers/12-behavioral-seams-and-shared-failure-traces.md)
13. [Non-functional checks and activation](20-measurement-ledgers/13-non-functional-checks-and-activation.md)
14. [Negative contract fixtures](20-measurement-ledgers/14-negative-contract-fixtures.md)
15. [Inherited duties and disposition](20-measurement-ledgers/15-inherited-duties-and-disposition.md)
16. [Operator decisions and honest limits](20-measurement-ledgers/16-operator-decisions-and-honest-limits.md)
