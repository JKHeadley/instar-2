## 3. Front admission and standing

**Rule — verify a pseudonym and separately resolve its standing.** **Checks: P22-NF-03/05/06.**
A pseudonym is a substitute identifier; its use can still link contributions and does not prove anonymity.
Enrollment binds a destination-scoped key to verified principal evidence through the identity
owner. Verification checks issuer trust, challenge/signature, intended destination, current
epoch, expiry and revocation. It does not require public real names. A role grant separately
binds subject, scope, delegation and current validity. Transport signature alone authenticates
bytes, not the factual claim or the signer's entitlement to grade it. Cross-commons keys and
case ids are unrelated by default; rotation retains only explicitly authorized local linkage.
Unproved unique operator identity means unknown independence, not one more independent person.

Basis: Rule 28, Know Your Principal; rule 29, Session Input Is a Principal, verifies actors able to inject session input. Role scope, delegation and current standing come from Part One’s [VerifiedPrincipal and StandingGrant model](../05-the-types.md#standinggrant--what-a-principal-may-decide-and-where), including grant provenance, live grantor authority, revocation and the org-intent limit on re-delegation; rules 103 (governed boundaries) and 104 (recorded scoped standing grants); purpose wisdom/sovereignty and non-widening authority; R4; section 14 ID seam.

**Rule — standing is scoped ordinal precedence, never an exchange rate.** **Checks: P22-NF-03/10.**
Ordinal precedence means an ordered priority within the relevant decision scope, not a score
that enough lower-priority votes can outweigh.
Apply constitutional floors and scope first, verified standing second, current evidence
eligibility third, independent outcome evaluation fourth, and exact human promotion authority
last. No arithmetic sum can buy the next class.

| Class in the relevant scope | Treatment | Boundary |
|---|---|---|
| Operator | First consideration for local criteria and preferences beneath the purpose | No authority over another operator or someone else's confidential material |
| Verified user | Next consideration for that person's experience under their grants | No implicit operator role or expanded audience |
| Other agent | Advisory evidence under verified delegation | Repeating another model's judgment does not make it independent |
| Anonymous fleet | Bounded signal-only lane | No accepted grade, standing grant or independent-operator support count |

A delegated act retains the principal and exact delegation; it does not globally upgrade the
agent's role. Ten thousand agent reports do not equal an operator decision. Equal-standing
conflicts remain disputed until scoped adjudication. A credible anonymous counterexample can
open bounded investigation and be independently reproduced; it does not starve behind a
popularity queue. An operator's refuted factual reason stays refuted without transferring
policy authority to the refuter. Reliability and standing are stored separately.

Basis: Purpose wisdom, trust/alignment and authority constraint; rules 28/57/86/103/104/108; Part One StandingGrant scope/delegation model; R4, standing and weighting; OD-04.

**Rule — admission is closed, bounded and durable.** **Checks: P22-NF-03/05/06/07.**
Validate length/shape before expensive cryptography and models, then authenticate and validate
all fields before collective adoption. A rejected unauthenticated body is not copied into
logs or the canonical store; retain only bounded safe rejection metadata. Quarantine that
requires payload custody must itself be authorized. Unknown schema stays rejected, with a
supported-version response, and never invokes a permissive fallback.
Use durable per-enrollment and per-operator contribution limits, plus bounded anonymous/network
abuse limits, total byte/work ceilings and finite review capacity. Network identity is not
human identity. Restart, rotation, multiple agents and concurrent front workers cannot reset
an operator's budget. Rates, bursts and backoff intervals (waiting periods before another
permitted attempt) are agent-owned settings bounded by
resource caps and reachable service, versioned and tested at zero, equality and one over.
A full queue holds admission visibly; it never evicts an unreviewed accepted case silently.

Basis: Constraints 1/2; rules 39/41/55/60/61/77/95; R1 rate-control failures; OD-03; G4 resource authority.

**Rule — receipt language names the achieved state.** **Checks: P22-NF-06/07/20.**
A network acknowledgment is `received` only. `front-stored` requires an authenticated receipt
binding destination, export id, payload digest, schema, custody policy and durable commit.
The front produces it after storage; it is joined to the outbox outside the immutable payload.
Until recovered, the front receipt is `not-yet-received` and storage remains unknown locally.
Duplicate submissions already in flight return the same stored custody result without another
adoption; changed bytes under the same identity are rejected as conflict. This is idempotency
(repeated arrival has no additional effect), not permission to resend uncertain work. Unknown
deduplication state holds admission. Recovery follows section 2's lookup and owner-settlement
gates. `admitted`, `signal-only` and `rejected` are later explicit decisions.
Neither HTTP 200 nor a honeypot/probe response proves storage, review, a fix or installation.

Basis: Constraint 3; rules 13/45/49/69; R1, receipt and persistence ordering.
