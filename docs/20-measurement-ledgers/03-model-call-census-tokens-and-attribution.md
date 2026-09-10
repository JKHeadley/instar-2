## 3. Model-call census, tokens and attribution

**Rule — the attempt census is complete even though coverage uses the exchange subset.** Rules 39,
41, 58, 69, 75 and 86; **checks: P16-NF-07–11**. Every route through a model boundary creates or
references one seven-owned `JudgmentAttemptRecord` before exchange. The census includes provider
errors, cancellations, timeouts, streamed partials, breaker refusals, swaps, retries admitted by
six, benchmark candidates, supervisors, background features and interactive work. Each
non-conflicted canonical attempt resolves at the pinned frontier into exactly one of proven
no-exchange, observed exchange or dispatch-uncertain; unresolved/conflicting classification is displayed separately and cannot
enter a percentage. A provider exchange is counted once even when its response is later rejected
by a parser. A metered zero-token exchange is an observed, usage-supported exchange, while a
zero-call refusal is a proven no-exchange attempt.
The read obtains accepted/prepared and dispatch membership clocks from complete envelopes in its
pinned owner-issued source history input. The attempt bodies and body-only projection cannot supply
those missing clocks.

The complete production census in P16-NF-07 is not executable at this head. The landed seven
slice excludes benchmark execution and rerun admission. It also lists production activation gaps
owned by five, eight, ten and nine. The census is non-executable until the granted benchmark work
in `seam-response-judgment.md` and `seam-response-assembly-followup.md` lands together with that
production wiring. A fake-provider call or a census of only current callsites cannot satisfy the
benchmark positive neighbor.

**Rule — exchange identity and observation identity are separate.** Rules 32, 33, 58 and 75;
**checks: P16-NF-07–09/12–14**. The canonical exchange key is six's stable operation and consumed
one-use claim mapping joined to seven's exact attempt id. The provider's own operation id is
optional, verified supporting metadata when returned; it is not part of the canonical key. A
complete metered response with `providerOperation: null` therefore remains one keyable exchange.
A causally later observation may add the provider operation id to that same exchange without
adding an exchange, quantity or charge. Two incompatible non-null provider ids remain conflicting
supporting metadata for the one exchange; they cannot mint two exchanges. A usage observation key
is the canonical exchange key plus measurement category, authenticated producer authority,
source-event id and phase. Its observation stream links partial → final → later correction with
part two's causal successor/correction relation. A fold uses the causally maximal compatible head
per stream; it does not add both a partial and its final successor. Equal replay of one observation
key is idempotent. Incompatible content under one key, or concurrent competing corrections without
a causal winner, creates `Conflict`; a later compatible final observation or late charge is a
refinement, not a conflict. Input, cache-read input, cache-write or cache-creation input, output,
reasoning, tool and provider-billed categories stay separate when the provider distinguishes them.
The latter categories cannot be implemented until the requested part-ten usage payload lands. An
adapter maps categories only through its registered conformance contract.

After stream-head selection, the exchange key, category, unit and registered category semantics
form the quantity key. Producer and source-event identities remain witness identity and never
create another quantity by themselves. Thus a response observation and an independently captured
billing observation that each report 100 compatible input tokens support one 100-token quantity,
not two addends. If they report 100 and 110, the quantity is unresolved and contributes no amount
until a causally later owner-produced resolution names both witnesses and resolves the value under
the registered contract. Both original evidence records remain visible. Two different exchange
keys that each resolve to 100 tokens remain two quantities and add to 200 in an authorized
cross-instance aggregate.

Charge observations use the same separation: operation/exchange identity binds the subject, while
source event and phase identify the observation in eight's causal settlement chain. An unknown or
partial charge can therefore gain a final successor without conflicting merely because the amount
changed; six applies each supported settlement identity at most once.

**Rule — coverage counts absence instead of normalizing it away.** Rules 13, 39, 41, 58, 75 and
86; **checks: P16-NF-09–11/14**. For a declared window, the view reports the three disjoint attempt
classes; usage-supported and unmetered subsets of observed exchanges; provider-settled exchanges;
pending and overdue evidence; unsupported-by-adapter exchanges; and conflicted joins. The only
displayed usage-coverage percentage is `usage-supported exchanges / observed exchanges`.
The separately displayed overdue-evidence rate uses only past-horizon observed-or-uncertain
attempts. Pending attempts remain visible but enter neither overdue numerator nor denominator.
Coverage is partitioned by adapter artifact, provider doorway, model, account, machine, feature
and outcome. An unsupported exchange remains in the usage denominator and is not healthy
coverage. A pre-exchange refusal never depresses exchange coverage, and a crash after claim
consumption remains dispatch-uncertain rather than being guessed into or out of that denominator.
An error response without usage remains unknown even if successful calls from the same provider
usually report it. Raw `SettlementApplication` history may show a lower charge while six still
retains the reserved maximum after restart. Current exposure changes only when the requested
six-owned qualified accounting read reports that live settlement consumption and the original
durability demand both succeeded.

**Rule — cumulative session observations do not become fictional calls.** Rules 13, 26, 39, 58,
75 and 86; **checks: P16-NF-08/10/12**. A Codex-style source that exposes only a growing session
total uses the cumulative-session subject. Each source snapshot has its own quantity identity,
and its observation streams reconcile independent witnesses or corrections of that snapshot. A
separate current-total fold selects the causally maximal snapshot for the registered session;
equal replay changes nothing and a growing later snapshot replaces rather than adds to the earlier
total. Earlier snapshots remain historical points. Cache, reasoning and quota-window fields
remain separate. Each category also retains whether the source reported it. The 1.x Claude
event path and Codex cumulative-session path both lose that distinction. Claude
`TokenLedger.ingestLine()` coerces an absent or null input, output, cache-creation or cache-read
category to zero, and its `token_events` rows retain no category-presence field. The Codex
rollout parser likewise coerces absent or malformed token categories to zero before the session
upsert. Migration reparses the original Claude transcript bytes or Codex rollout bytes when
available, so absent, null, malformed and explicitly reported numeric zero remain distinct. When
the applicable source bytes are unavailable, a stored legacy zero whose origin cannot be
recovered is an `origin-lost legacy zero` and remains uncertain rather than becoming evidence
that the source reported zero. The cumulative aggregate appears in its own coverage-limitation row and is excluded from attempt
coverage, per-feature call attribution and burn unless independent evidence maps exact deltas to
canonical attempts. Absence of that mapping is `per-call attribution unsupported`, not zero usage
and not a synthesized `JudgmentAttemptRecord`.

**Rule — feature attribution is re-resolved, never trusted from the usage row.** Rules 26, 32,
58, 69 and 86; **checks: P16-NF-12–14/30/31/36**. The read joins the attempt's run, judgment
point, registered feature and benchmark identities from signed history at the requested causal
frontier. That join consumes the exact `FactStatus` envelopes and status evidence in the pinned
source history input and records its digest; it does not reconstruct causal links or authority from
projection values. A source-supplied feature string is retained only as evidence. No match produces
unattributed usage. Several incompatible matches produce `Conflict`. A later lawful correction
can change the derived attribution without rewriting the measurement. Per-feature totals show
unattributed and conflicted amounts beside named features; they never hide them in a synthetic
feature that can dominate a burn ranking.

---
