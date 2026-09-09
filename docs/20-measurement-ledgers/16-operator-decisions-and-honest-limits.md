## 16. Operator decisions and honest limits

**Value — detail horizons.** How long should high-cardinality local read presentations and their
disposable caches expose per-call and per-process detail: 30 days, 90 days, or 365 days? I
recommend 90 days, with daily presentation aggregates for the wider read horizon, a complete
`all-identities` source projection and permanent signed facts underneath. The choice trades local
query cost and casual disclosure against convenient diagnosis; it does not authorize projection
identity removal or fact deletion.

**Value — subscription allocation.** Should 2.0 preserve the 1.x calendar-time compatibility view
as the only allocation, add a separately labelled token-share view beside it, or explicitly
replace it with token share? The existing view is monthly price divided by 30.4375 and multiplied
by distinct active calendar days, with the derivation shown and the door total counted once across
models. I recommend preserving that view and adding token share only as an optional additional
reporting view. Token share is a policy change, not the behavior 1.x has today; it must never
pretend the provider billed that call or influence a cap.

**Value — currency conversion.** Should the default spend total remain separated by native
currency, or include a converted reporting total from a governed exchange-rate manifest? I
recommend native-currency totals by default and an opt-in converted view. This avoids hiding
rate-source and effective-time uncertainty in a single headline.

**Value — benchmark comparison policy.** The threshold values here are proposed deployment policy,
not measurements derived from a pinned 1.x population. An exploratory comparison would require at
least 10 complete cases and at least 25% Grade coverage in each population, at most 80% of
production cases from one machine, evidence strictly younger than 30 days and 90% Wilson intervals
(`z=1.6448536269514722`). It would be labelled exploratory and could not be a published alignment
claim. A conservative published comparison would require at least 100 complete cases and at least
90% Grade coverage in each population, at most 50% of production cases from one machine, evidence
strictly younger than 14 days and 95% Wilson intervals (`z=1.959963984540054`). I recommend
exposing both tiers while allowing only the conservative tier in the primary/published comparison.
Should the operator approve that proposed two-tier policy, or require conservative-only output and
accept the longer evidence-collection delay?

**Value — burn policy.** Should burn thresholds be one universal package default, a per-feature
policy, or deployment-specific values approved after a measured baseline? I recommend
deployment-specific values with per-feature overrides only where a named risk justifies them.
The chosen policy must also name one registered amount selection per activity source; I recommend
carrying 1.x fresh model usage as an explicit derivation that excludes cache reads, with each
programmatic source selecting its one native quantity. The same selection must govern current,
baseline and comparison populations. Threshold values must include separate lower recovery
thresholds and recovery-window count. The signal should ship observed before any notification
policy is approved.

**Value — quota presentation.** For providers with no advance-usage surface, should the primary
view show only `unknown`, or `unknown` beside the separately labelled locally observed token total?
I recommend the latter. An estimated provider percentage from an invented plan denominator is
forbidden by the evidence rules and is not an operator option.

**Value — signed-spine growth posture.** Should the operator approve permanent signed accounting
history with published ten-owned growth observations, complete source projections and finite read
presentation caches, or withhold package approval pending a separately approved part-two lossless
storage change? I recommend the former.
Ten's existing growth episode still opens only one five-owned investigation under six's loop; this
choice neither creates a second trigger nor authorizes deletion.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 80, 82 and 90;
**checks: P16-NF-49/52** and the governed review process. This document claims no deployment,
runtime measurement, review convergence, holder adequacy or operator approval. Implementation
becomes eligible only after the real three-tier, production-lifecycle, reconstruction,
isolation, privacy, load and independent-holder evidence exists. The operator's answers above and
explicit approval remain separate from every technical pass.

---

*Depends on: the approved rules, register, glossary, big-picture design, and parts one through
eleven, especially parts one, two, seven, nine, ten and eleven, and their changelogs.*
