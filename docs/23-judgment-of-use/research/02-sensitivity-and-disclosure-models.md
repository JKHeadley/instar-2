# R2 — Dawn: disclosure, anchors, pins and approval binding

**Status: research evidence, awaiting design review. Governed.**

**Value — evidence boundary.** Inspected 2026-09-13. Paths and line numbers below
are relative to the read-only local mirror
`/Users/dabombstudio/.instar/dawn-src/repo/the-portal`. Its parent `MANIFEST.md`
identifies the filtered source archive as `SageMindAI/the-portal`, main commit
`68e25e2ee9903c5170b55d00f055f41514f39d7a`, captured 2026-09-12. The mirror has no
`.git`; the manifest supplies its identity. Runtime transcripts, stores, secrets,
telemetry and uncommitted source changes were excluded. SOURCE means inspected
code, INFERENCE means analysis, and UNKNOWN means evidence unavailable here.
No Dawn files, conversations or private case details are copied into Git. This
report paraphrases mechanisms and cites their locations only. Source comments
describing incidents are not treated as reproduced outcomes.

## 1. What per-recipient disclosure means in the inspected code

**Value — SOURCE.** The Portal context builder passes a user identity into
enhanced retrieval and requests exclusion of operations-tier memories
(`lib/portal/context.ts:574–590`). `lib/portal/memory/hybridRetrieval.ts:49–68`
implements strict user equality when a user is supplied; omitting the user returns
an empty filter. This is a useful correction to the earlier null-user fallback
described in its comment. The actual builder passes the user; the helper is not
intrinsically safe for an unspecified audience. Tenant and user scoping are
necessary parameters, not properties one may infer from a familiar name.

The ops-tier filter has its own deployment flag
(`lib/portal/memory/wisdomDistillation.ts:61–81`). Requesting the filter does not
mean it is active while that flag is off. Its filter includes legacy null-tier
rows (`:154`). The relationship-grounding script separately queries memory with
the resolved user's id (`.claude/scripts/relationship-grounding.ts:465`) and
renders bounded excerpts and recent-chat open threads (`:474–492`). These are
person-scoped preparation paths, not a general lattice of permission for every
person mentioned in each fact.

**Value — INFERENCE.** A row associated with person A can contain information
about person B; equality on A's user id does not decide B's disclosure rights.
An internal builder retrieving across users is another consumer with another
purpose. Nor does a user-scoped query alone establish permission for the model
provider, embeddings, summaries, caches or future recipients. A status such as
personal/shared/ops describes storage or routing; it does not encode all of
subject, source standing, intended use, audience and harm of withholding.

**Value — UNKNOWN.** This mirror does not establish a universal policy owner that
checks every retrieval boundary and final effect, or a per-recipient harm judgment
on every learned fact. That bounded absence finding is not a claim that Dawn's
deployed environment has no additional safeguards.

## 2. Experiential wisdom: a concrete declassification-like path

**Value — SOURCE.** `lib/portal/memory/wisdomDistillation.ts` offers the most direct
analogue to learning across relationships. Its default-off layer attempts
distillation after a high-significance personal or builder memory consolidates
(`:33–58`; `lib/portal/memory/consolidation.ts:456–490`). One model proposes a
transferable lesson, or none. A deterministic identifier screen can reject it;
a second model checks traceability. Malformed responses, exceptions and traceable
content produce no shared row (`wisdomDistillation.ts:263–291`, `:424–489`). The
privacy prompt explicitly considers distinctive events and rare details, not
just names (`:233`). This is broader than name redaction.

The screen accepts an optional known-name list (`:330`), which the distillation
orchestrator passes from its options (`:459`). The inspected consolidation caller
supplies a model option only (`consolidation.ts:490`); it does not populate that
known-name list. The second check uses the same resolved model choice as the
distillation call (`wisdomDistillation.ts:430`, `:475`). A second call is therefore
not evidence of an independently calibrated grader.

Successful rows are assigned `userId:null`, `memoryTier:'wisdom'`, consolidated
status, distilled content and a capped significance, while retaining source themes
(`:492–505`). The row deliberately contains no source-memory or conversation link
(`:15–18`, `:117`). Only count metrics are intended. Distillation failure preserves
the original consolidation (`consolidation.ts:461`).

**Value — INFERENCE.** There are four distinct limits to the name “wisdom” here:

| What the code can establish | What that does not establish |
|---|---|
| A model produced a transferable-sounding lesson | The lesson improves outcomes, follows a pillar, or reflects independent cases |
| Identifier screen and traceability judge accepted text | Formal privacy, consent to declassify, or safety against an audience with auxiliary knowledge |
| Source pointers are absent from the shared row | The lesson cannot reveal its source through content, themes, timing or unusual circumstances |
| A high-significance source generated a capped-significance lesson | The source was correct, its reason was sound, or its grader had standing |

The anonymization judge receives lesson text. The successful row also carries
source themes; therefore the inspected text-only decision is not an explicit
review of every returned field. This is an interface-level observation, not a
demonstrated leak. Removing source links limits onward exposure, but also removes
the obvious path for an authorized reviewer to re-open a false premise, assess
independence, or retract all lessons derived from a discredited case. Part 21's
draft section 5 instead requires authorized private provenance and an explicit
share/declassification decision. The two designs differ materially.

**Value — consequence for Part 23.** Distilling a public lesson, privately using
a confidential fact, and disclosing the fact itself are separate operations.
The first cannot silently authorize the other two. A lesson that cannot retain
permitted provenance needs an honest evidence limitation; severance alone cannot
serve as a proof of wise cross-person learning.

## 3. Anchors and pins protect salience, not disclosure authority

**Value — SOURCE.** Foundational-thread anchors store per-user thread selections,
memory ids, computed time and model identity in a tenant map
(`lib/portal/memory/anchorProfile.ts:61–83`). Reads return empty on missing or bad
state (`:93–112`). The selection helper maps an in-range integer to an actual
candidate id, accepts legacy ids only on exact membership, and otherwise drops
the pick (`lib/portal/memory/anchorSelect.ts:18`). This guards fabricated ids.
The profiler's intended role is to nominate under-surfaced foundational memories
for wake-time retrieval, without another hot-path model call
(`anchorProfile.ts:14–19`). Runtime population and retrieval efficacy are UNKNOWN.

Pins are user-curated, separate from ranking, with shared budget and rendering
constants (`lib/portal/pinnedMemories.ts:1–23`). The builder attempts a tenant-and-user
query every turn even when ordinary memory retrieval is skipped for a minimal
budget (`lib/portal/context.ts:852–876`). It records a retrieval failure if loading
throws, then continues the turn. Prompt formatting strips markup and special
prefixes and presents title/content (`pinnedMemories.ts:42–58`); the displayed
prompt block intentionally omits ids and dates.

**Value — INFERENCE.** An anchor is a selection directive and a pin is an explicit
salience request. Neither grants new audience permission, establishes truth, or
makes a learned instruction constitutional. Syntax cleanup is not a proof that
arbitrary user prose cannot steer a model. “Always present” describes the normal
assembly path, not a guarantee under database failure. A pinned fact can be stale,
private about another person, or relevant only in some circumstances. Good recall
must still be followed by a current use judgment; users should not have to pin
every consequential commitment to compensate for incomplete ordinary recall.

## 4. Approval binding: distinguish preparation, cache identity and permission

### 4.1 Person grounding before email

**Value — SOURCE.** The relationship-grounding hook extracts the destination but
allows an email when there is any recent grounding in the session
(`.claude/hooks/relationship-grounding-gate.py:195–197`). Its acknowledgement
alternative is recorded (`:198–204`). This is narrower than a requirement to
ground in the exact recipient's history. The compose guard checks preparation
age, platform, optional topic and consumed output
(`.claude/scripts/compose-guard.py:301`, `:595`). Those are preparation receipts,
not exact draft-and-recipient approval receipts.

### 4.2 Actual email sender

**Value — SOURCE.** `.claude/scripts/send-email.py:152` hashes stripped input body
text before signature/styling. Its ledger records destination, subject, optional
thread and body hash (`:169–200`), and deduplication checks those fields (`:208`).
The send path calls deduplication (`:777`) and records the completed send (`:842`).
Non-safe recipients normally require a terminal confirmation, but an explicit
`no_confirm` argument skips it (`:725–745`); the command-line flag is at `:962`.

**Value — INFERENCE.** A content-plus-recipient dedup key answers whether a similar
send occurred. It is not proof that an authorized person approved this content
for that recipient. A script parameter suppressing a prompt is not a verified
approval artifact. The body fingerprint is also not a digest of final rendered
bytes, all recipients, attachments, policy version and approval state. The audited
function does not supply that stronger contract. External workflow approval may
exist, but exact effect-time enforcement is UNKNOWN here.

### 4.3 X content approval

**Value — SOURCE.** `.claude/scripts/x-post-cdp.cjs:114–176` independently enforces
a content-guard token on the direct browser path: it verifies a hash and a
ten-minute age, preferring a hash-keyed sidecar over a shared token slot. This is
a real sender-side check, not only a skill reminder. However, normalization
strips URLs, lowercases, changes punctuation and collapses whitespace (`:133–140`).
The quote URL is parsed separately, and the comment explicitly says it does not
affect guard approval (`:84–94`). The check does not bind an audience/recipient or
quoted target in the compared hash. Shared draft-file defaults are refused (`:96–110`).

**Value — INFERENCE.** Two posts with identical normalized prose and different
linked or quoted targets can pass the same content identity test. That is an
equivalence-class approval for prose, not exact final content plus audience.
The target can change whom the post concerns and what the audience infers even
when the sentence is identical. Source safeguards against concurrent file
clobbering do not establish source-policy permission or a wise disclosure choice.

### 4.4 Recipient-bound recall cache

**Value — SOURCE.** `dawn-server/src/pre-reply-recall/cache.ts:38–52` keys cached
results on agent/provider/model/channel/skill, recipient, topic and a truncated
SHA-1 digest of full trigger text. Changing the recipient therefore changes the
normal key. Policy/consent epoch, source frontier and hint fields are absent.
The dispatcher itself uses supplied trigger context rather than historical tool
lookup (`pre-reply-recall/recall.ts:358–402`). The inspected Portal caller launches
recall in shadow and does not inject the returned result
(`lib/ai/UnifiedChatHandler.ts:592–639`).

**Value — INFERENCE.** Cache separation is useful, but a cache key is neither
recipient authentication nor approval. Reusing a result within its lifetime does
not establish current permission after revocation. A service called “pre-reply
recall” also does not prove that historical evidence was retrieved or used in the
reply. These distinctions matter before attributing an outcome to wisdom.

## 5. Research conclusions and evidence still needed

**Value — synthesis.** Dawn offers useful mechanisms: strict user-scoped retrieval
on the inspected Portal path, fail-closed lesson emission, stable salience channels,
grounding-consumption checks and actual sender-side content checks. Their names
overstate coverage if read as universal guarantees. No inspected mechanism alone
balances the harm of sharing against withholding, grades those outcomes over time,
and preserves the grader's verified standing beneath the constitution.

**Value — evaluation implications for R4/R5.** A future evaluation should vary the
recipient, source subject, quote/link target, provider, current permission and
later outcome independently while holding the message prose constant. It should
also include a permitted private-use action that unintentionally reveals its
cause, and an apparently anonymized lesson recognizable to its audience. Those
are proposed probe shapes, not executed cases or substitutes for the constitution's
real-case benchmark requirement.

Questions needing evidence are exact effect-path coverage, deployment flags,
false holds and disclosures, permitted private provenance after distillation,
late corrections, and whether lessons improve real outcomes. No Dawn runtime test,
private conversation review or human-comparison study was performed. This report
claims completed source research, not independent audit convergence or wisdom.
