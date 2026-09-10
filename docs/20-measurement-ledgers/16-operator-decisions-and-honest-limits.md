## 16. Operator decisions and honest limits

**Value — decision 1: How long to show individual calls and processes.**
Question: Should the detailed local history show 30 days, 90 days, or 365 days?
Background: Older detail is useful for investigations, but it makes everyday queries heavier and
keeps sensitive operational detail easy to browse for longer.
Choices: 30 days; 90 days; or 365 days, with older information shown only as daily totals.
What it changes: Thirty days minimizes exposure and query cost but shortens investigations; 90 days
balances both needs; 365 days makes long investigations easiest but costs the most to query and
exposes detail for longest.
Recommendation: Choose 90 days because it gives useful investigation depth without making a full
year of individual activity the everyday view.

**Value — decision 2: How to spread subscription cost across usage.**
Question: Should reports use only the existing active-day method, show an optional usage-share view
beside it, or replace the active-day method with usage share?
Background: The active-day method divides the monthly price across average calendar days and counts
the result once for every day the subscription was used; usage share instead spreads cost according
to recorded activity.
Choices: Active-day only; active-day plus an optional usage-share view; or usage-share only.
What it changes: Active-day only is easiest to compare with today's reports; showing both adds a
useful planning view without hiding the old basis; replacing it makes reports simpler but breaks
that comparison and may look more like provider billing than it is.
Recommendation: Keep the active-day view and add usage share only as an optional labelled view
because that preserves continuity while making the new estimate honest.

**Value — decision 3: Whether to combine different currencies.**
Question: Should the main spend total keep each currency separate, or also show one converted total?
Background: A converted total depends on which exchange-rate source and date are chosen.
Choices: Separate currencies only; or separate currencies plus an optional converted total.
What it changes: Separate totals are harder to scan but never hide conversion uncertainty; an
optional converted total gives a convenient headline while adding rate-source and timing risk.
Recommendation: Keep native-currency totals as the default and offer conversion as an optional view
because the headline should not conceal an uncertain rate.

**Value — decision 4: How much evidence a model comparison needs.**
Question: Should the product show a clearly labelled early signal as well as a result that is ready
to rely on, or wait until the stronger result is ready before showing anything?
Background: An early signal appears sooner, but it is based on less evidence and may change as more
real cases arrive. A ready-to-rely-on result waits for enough recent cases from a broad mix of
machines to make important choices safer.
Choices: Show both the early signal and the ready-to-rely-on result; or show only the
ready-to-rely-on result.
What it changes: Showing both gives earlier direction, but the early signal should not guide an
important change on its own. Showing only the stronger result is simpler and safer to act on, but
the operator waits longer for any feedback.
Recommendation: Show both, but make the ready-to-rely-on result the only one used for primary or
published claims, because early direction is useful when its limits and proper use are unmistakable.

**Value — decision 5: Where unusual-spending warning levels come from.**
Question: Should warning levels be the same everywhere, differ by feature, or be chosen for each
installation after observing its normal activity?
Background: A warning compares recent use with normal use, and it needs a lower recovery level so
small changes do not repeatedly open and close the same alert.
Choices: One universal setting; a setting for every feature; or an installation setting based on a
measured baseline, with feature exceptions only for named risks.
What it changes: One setting is simplest but produces the most false alarms; per-feature settings
are flexible but hard to maintain; measured installation settings fit real workloads but need an
observation period before alerts can be trusted.
Recommendation: Use measured installation settings with rare documented feature exceptions because
warning levels should reflect the workload they judge.

**Value — decision 6: What to show when a provider does not reveal quota.**
Question: Should the main view show only “unknown,” or show “unknown” beside the locally observed
usage total?
Background: Local usage can help explain activity, but it cannot reveal the provider's remaining
allowance.
Choices: Unknown only; or unknown plus a separately labelled local total.
What it changes: Unknown only is simplest but withholds useful context; adding the local total helps
investigation while requiring clear wording that it is not remaining quota.
Recommendation: Show unknown beside the labelled local total because useful evidence should remain
visible without being promoted into a provider percentage.

**Value — decision 7: Whether to keep complete signed accounting history.**
Question: Should the system keep complete signed history with bounded everyday views, or delay
approval until a separate lossless storage redesign is approved?
Background: Complete history lets the system rebuild current views and inspect past facts, while
bounded views keep routine reads manageable; storage growth is measured and investigated rather
than solved by silent deletion.
Choices: Keep complete history now with bounded views and growth monitoring; or wait for a separate
lossless storage redesign.
What it changes: Keeping history allows this package to proceed while storage needs grow over time;
waiting may reduce future migration work but blocks the package on a separate design.
Recommendation: Keep complete history with bounded views and growth monitoring because it preserves
evidence without making everyday queries unbounded.

**Value — decision 8: Whether a spending limit also opens a paid service.**
Question: Should a paid service be open whenever its spending limit is above zero and the emergency
freeze is off, or should it also need a separate on/off switch?
Background: The older system used an extra switch, but the approved new design does not currently
include that switch or a separate readiness check.
Choices: Let a positive limit and no freeze mean open; or add a separate on/off switch and readiness
check by revising the two approved designs that own those controls.
What it changes: The first choice is simpler and deliberately leaves the old extra switch behind;
the second adds another safety step but requires more design, implementation and operator action.
Recommendation: Let a positive limit and no freeze mean open because the limit and emergency freeze
already provide clear control without adding another state that can disagree with them.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 80, 82 and 90;
**checks: P16-NF-35/45/49/51/52** and the governed review process. Decision 8 is required because
`SEAM-LEDGER.md` row 65 refuses `P16-P8-P10-paid-door-readiness-v1`, recorded in
`design-measurement-ledgers-seam-request-paid-door-readiness.md`, as outside the approved Part Eight
and Part Ten designs. This document claims no deployment,
runtime measurement, review convergence, holder adequacy or operator approval. Implementation
becomes eligible only after the real three-tier, production-lifecycle, reconstruction,
isolation, privacy, load and independent-holder evidence exists. The operator's answers above and
explicit approval remain separate from every technical pass.

---

*Depends on: the approved rules, register, glossary, big-picture design, and parts one through
eleven, especially parts one, two, seven, nine, ten and eleven, and their changelogs.*
