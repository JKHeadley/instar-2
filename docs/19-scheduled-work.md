**Status: draft, awaiting approval. Governed.**

# Part fifteen — scheduled and recurring work

**Value — purpose.** A schedule should make useful work dependable without turning a clock into
authority. A due instant should survive a restart, compete honestly for finite capacity, and end
with a visible disposition even when no worker runs. This part packages that behavior over the
landed core. No automatic check proves that a chosen cadence, priority, or capacity policy is wise.

**Rule — reading convention and evidence discipline.** Rules 26, 49, 69, 91 and 113; **checks:
P15-NF-01/02** and `node scripts/check-governed-docs.mjs docs`. Every claim belongs to its nearest
Rule or Value block. This part defines no new core type. It consumes the public contracts of parts
one through eleven and supplies package, adapter, and holder behavior over them. A named check is
an implementation obligation, not evidence that software exists. Measured means recorded
execution on named hardware and workload, never a configured target, extrapolation, or estimate.

---

## Sections

This document is split into one file per section so each renders on GitHub and can take line
comments. The Governed status above covers this index and every linked section as one governed
body. `scripts/check-governed-docs.mjs` follows this stable numbered list and scans the complete
body. The files below, read in order, are the complete document.

1. [Ownership and boundaries](19-scheduled-work/01-ownership-and-boundaries.md)
2. [Declarative job packages](19-scheduled-work/02-declarative-job-packages.md)
3. [Occurrences, durable runs, and exactly-once scheduling](19-scheduled-work/03-occurrences-durable-runs-and-exactly-once-scheduling.md)
4. [Quota-aware admission, placement, and concurrency](19-scheduled-work/04-quota-aware-admission-placement-and-concurrency.md)
5. [Execution gates and supervision](19-scheduled-work/05-execution-gates-and-supervision.md)
6. [Recovery, crash-loop control, and honest reporting](19-scheduled-work/06-recovery-crash-loop-control-and-honest-reporting.md)
7. [What Instar 1.x does today and what carries forward](19-scheduled-work/07-what-instar-1-x-does-today-and-what-carries-forward.md)
8. [Non-functional checks and activation](19-scheduled-work/08-non-functional-checks-and-activation.md)
9. [Negative contract fixtures](19-scheduled-work/09-negative-contract-fixtures.md)
10. [Inherited duties and disposition](19-scheduled-work/10-inherited-duties-and-disposition.md)
11. [Operator decisions and honest limits](19-scheduled-work/11-operator-decisions-and-honest-limits.md)
