# Constitutional decision sweep — 2026-09-13

Status: audit harvest; not a governing document. Candidate amendments below are proposals, not adopted authority.

Audited branch: `decisions-sweep`, exact audited base `eac87b07f54b316e85db82a4b71ef40f205ad5a7`: the merge of main `212966f6c58797c3f5f1f27bc1eee8bb4d9957f8` into the reviewed harvest head `64f78366739365df03ad0b2243191dc4793fe72e`. All 92 dispositions were re-audited against the complete purpose at this merged base, after reading the Repair 1 verdict in full. Constitutional texts read in full: [docs/00-the-purpose.md](../../docs/00-the-purpose.md), [docs/01-the-rules.md](../../docs/01-the-rules.md), [docs/04-the-big-picture.md](../../docs/04-the-big-picture.md).

The supplied range names document numbers, not internal part numbers: docs/05 is Part One, docs/20 is Part Sixteen. The snapshot has **16 design indexes/documents and 70 linked sections, 86 files and 15,908 lines**. **There is no docs/21 index or section at this commit.** The explicit docs/21 coverage row below records that absence; no seventeenth design or question has been invented. Section files were included by each index's numbered links; historical changelogs and the approved decision sheet were consulted as answer evidence. Questions-for-the-operator lists in `.instar/lanes` were excluded.

**92 separately disposed questions/subquestions:** 10 DECIDED-BY, 26 AGENT'S, 33 CANDIDATE AMENDMENT, 23 ALREADY-ANSWERED. The 33 amendment dispositions consolidate into **19 candidate amendments** (CA-01–11 and CA-13–20; CA-12 is dropped). Counts use the atomic IDs below, not repetitions of a question in fixtures or seam tables. The 82 original decision-list items have four supplemental entries: the conflict matrix, the substantive retention question beneath its accepted deferral, and two index-level product-scope questions; split suffixes separate different decision grounds.

The [purpose approval history](../../docs/00-the-purpose.changelog.json) binds all three approved additions: revision 1 (four pillars, constraints and decision boundary), PR #19, `192bf356e7fe1eb01ace74f8d1c91bc79bbf1d77`; revision 2 (wisdom and the gap rule), PR #69, `c83db01063b62cf309448bc8b8f859cb9be812ae`; revision 3 (consequential, ordinary, user-facing, significant and critical), PR #71, `e281a2c2751a6d71efc41d592212336fcc2561c8`. All three are ancestors of the audited base. The original `808ca2424d9c6ec5e0920142b62ebd3f4738e5b9` audit lacked revision 3 and is not this repair's constitutional input.

## Summary table

The question column links to the exact source line in the audited tree. The deciding-text column uses Purpose, the numbered rules, recorded answers or a proposed CA identifier; the full answer and qualification follow by part.

| Part / document | Question | Disposition | Deciding text |
|---|---|---|---|
| 05 / Part 1 | [05.1 — Language capability floor and timing](../../docs/05-the-types.md#L886) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): agent decides technical correctness and sequencing; [R1](../../docs/01-the-rules.md#L209), [R13](../../docs/01-the-rules.md#L258), [R42](../../docs/01-the-rules.md#L278) |
| 05 / Part 1 | [05.2a — Non-agent repository approval anchor](../../docs/05-the-types.md#L889) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revisions 8–9, decision 2; [R82](../../docs/01-the-rules.md#L293), [R98](../../docs/01-the-rules.md#L306) |
| 05 / Part 1 | [05.2b — Only constitution and docs protected initially](../../docs/05-the-types.md#L889) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6, decision 7 |
| 05 / Part 1 | [05.3 — Capacity outcome inside Success](../../docs/05-the-types.md#L893) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R40](../../docs/01-the-rules.md#L277), [R42](../../docs/01-the-rules.md#L278); [Big picture](../../docs/04-the-big-picture.md) §1 |
| 05 / Part 1 | [05.4 — Central package decoders](../../docs/05-the-types.md#L897) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R1](../../docs/01-the-rules.md#L209), [R30](../../docs/01-the-rules.md#L211); [Big picture](../../docs/04-the-big-picture.md) §1 |
| 05 / Part 1 | [05.5 — Preserve unresolved senders as values](../../docs/05-the-types.md#L900) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): coherence, constraint 2; [R14](../../docs/01-the-rules.md#L259), [R28](../../docs/01-the-rules.md#L268), [R46](../../docs/01-the-rules.md#L281) |
| 05 / Part 1 | [05.6a — When to design the runtime reference monitor](../../docs/05-the-types.md#L903) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): sequencing; constraint 3; [R71](../../docs/01-the-rules.md#L223) |
| 05 / Part 1 | [05.6b — Which external runtime trust boundary](../../docs/05-the-types.md#L903) | CANDIDATE AMENDMENT | [CA-01](#ca-01) |
| 05 / Part 1 | [05.7 — Requester on an attested authenticated channel](../../docs/05-the-types.md#L908) | ALREADY-ANSWERED | [F1](../../docs/05-the-types.changelog.json) revision 5 approvedIn PR13; revision 4 change 2 |
| 05 / Part 1 | [05.x1 — Who may resolve ordinary versus authority conflicts](../../docs/05-the-types.md#L557) | ALREADY-ANSWERED | [F1](../../docs/05-the-types.changelog.json) revision 5 change 2 and approvedIn PR13 |
| 06 / Part 2 | [06.1 — Growth and replay trigger](../../docs/06-the-fact-envelope.md#L1044) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface |
| 06 / Part 2 | [06.2 — Two-anchor rule-90 reading](../../docs/06-the-fact-envelope.md#L1049) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 8 (decision 2), revision 9; decision-list preface |
| 06 / Part 2 | [06.3 — Retraction audiences](../../docs/06-the-fact-envelope.md#L1055) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface |
| 06 / Part 2 | [06.4 — Narrow redaction and register growth value](../../docs/06-the-fact-envelope.md#L1061) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface |
| 06 / Part 2 | [06.5 — No machine-local facts](../../docs/06-the-fact-envelope.md#L1070) | ALREADY-ANSWERED | [Decision-list preface](../../docs/06-the-fact-envelope.md#L1041); [F2](../../docs/06-the-fact-envelope.changelog.json); approved revision 9 / PR16 |
| 06 / Part 2 | [06.6 — Full history on every machine](../../docs/06-the-fact-envelope.md#L1073) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface |
| 06 / Part 2 | [06.7 — Stale authority and partition flagging](../../docs/06-the-fact-envelope.md#L1079) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface |
| 06 / Part 2 | [06.8 — Carry capture-retention reconciliation](../../docs/06-the-fact-envelope.md#L1086) | ALREADY-ANSWERED | [Decision-list preface](../../docs/06-the-fact-envelope.md#L1041); [F2](../../docs/06-the-fact-envelope.changelog.json); approved revision 9 / PR16 |
| 06 / Part 2 | [06.9 — Glossary fact/field homonym](../../docs/06-the-fact-envelope.md#L1093) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface; [F3](../../docs/07-the-declarations.changelog.json) revision 6 atomic bundle |
| 06 / Part 2 | [06.10 — Deterministic governed-state blocks](../../docs/06-the-fact-envelope.md#L1097) | ALREADY-ANSWERED | [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface; [F3](../../docs/07-the-declarations.changelog.json) revision 6 atomic bundle |
| 06 / Part 2 | [06.x1 — Substantive rule-7 / bounded-retention reconciliation](../../docs/06-the-fact-envelope.md#L1086) | CANDIDATE AMENDMENT | [CA-02](#ca-02) |
| 07 / Part 3 | [07.1 — Committed generated register](../../docs/07-the-declarations.md#L595) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults |
| 07 / Part 3 | [07.2 — Dated gaps](../../docs/07-the-declarations.md#L598) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults |
| 07 / Part 3 | [07.3 — Dead versus missing terms](../../docs/07-the-declarations.md#L601) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults |
| 07 / Part 3 | [07.4 — Atomic amendment convention](../../docs/07-the-declarations.md#L602) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults |
| 07 / Part 3 | [07.5 — Minimal author input](../../docs/07-the-declarations.md#L605) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults |
| 07 / Part 3 | [07.6 — Separation for governed-state gates](../../docs/07-the-declarations.md#L608) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults |
| 07 / Part 3 | [07.7 — Protected toolchain](../../docs/07-the-declarations.md#L611) | ALREADY-ANSWERED | [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults |
| 08 / Part 4 | [08.1 — Accept steering risk from stolen platform token](../../docs/08-the-intake.md#L595) | CANDIDATE AMENDMENT | [CA-03](#ca-03) |
| 08 / Part 4 | [08.2 — Five interdependent amendments](../../docs/08-the-intake.md#L602) | CANDIDATE AMENDMENT | [CA-16](#ca-16) |
| 08 / Part 4 | [08.3a — Bounded authorization routing and quoted sender](../../docs/08-the-intake.md#L608) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness and drafting; R28/52/82/98 |
| 08 / Part 4 | [08.3b — Hide approver identity from requester](../../docs/08-the-intake.md#L608) | CANDIDATE AMENDMENT | [CA-04](#ca-04) |
| 08 / Part 4 | [08.4a — Standing candidates never exceed approval](../../docs/08-the-intake.md#L612) | CANDIDATE AMENDMENT | [CA-05](#ca-05) |
| 08 / Part 4 | [08.4b — Surface candidate grants only on recurrence](../../docs/08-the-intake.md#L612) | CANDIDATE AMENDMENT | [CA-05](#ca-05) |
| 08 / Part 4 | [08.5 — Public unresolved-sender acknowledgment default](../../docs/08-the-intake.md#L614) | CANDIDATE AMENDMENT | [CA-04](#ca-04) |
| 08 / Part 4 | [08.6 — Emergency stop before grounding and minting](../../docs/08-the-intake.md#L617) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness and sequencing; R4/60/61/95 |
| 09 / Part 5 | [09.1 — Unknown effects delay completion](../../docs/09-the-run-graph.md#L988) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): coherence, constraint 3; [R24](../../docs/01-the-rules.md#L265), [R26](../../docs/01-the-rules.md#L266), [R42](../../docs/01-the-rules.md#L278), [R97](../../docs/01-the-rules.md#L305) |
| 09 / Part 5 | [09.2 — Graph limits, attempts and semantic-gap ceiling](../../docs/09-the-run-graph.md#L995) | CANDIDATE AMENDMENT | [CA-17](#ca-17) |
| 09 / Part 5 | [09.3 — Single owning parent versus shared ownership](../../docs/09-the-run-graph.md#L1001) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R83](../../docs/01-the-rules.md#L227), [R114](../../docs/01-the-rules.md#L320) |
| 10 / Part 6 | [10.1a — Scoped quorum realization and voter count](../../docs/10-the-transport-and-leases.md#L907) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R31](../../docs/01-the-rules.md#L270), [R63](../../docs/01-the-rules.md#L240); [Big picture](../../docs/04-the-big-picture.md) §4 |
| 10 / Part 6 | [10.1b — Exclusive ownership versus partition execution](../../docs/10-the-transport-and-leases.md#L907) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): coherence, sovereignty; [R63](../../docs/01-the-rules.md#L240), [R95](../../docs/01-the-rules.md#L303) |
| 10 / Part 6 | [10.2 — Indefinitely uncertain obligations](../../docs/10-the-transport-and-leases.md#L914) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): constraint 3; [R26](../../docs/01-the-rules.md#L266), [R42](../../docs/01-the-rules.md#L278), [R83](../../docs/01-the-rules.md#L227), [R97](../../docs/01-the-rules.md#L305), [R99](../../docs/01-the-rules.md#L307) |
| 11 / Part 7 | [11.1 — Capture retention versus new-call availability](../../docs/11-the-judgment-doorway.md#L847) | CANDIDATE AMENDMENT | [CA-02](#ca-02) |
| 11 / Part 7 | [11.2 — Dashboard/runtime approval trust root](../../docs/11-the-judgment-doorway.md#L850) | CANDIDATE AMENDMENT | [CA-01](#ca-01) |
| 12 / Part 8 | [12.1 — Replicated durability versus single-machine execution](../../docs/12-the-effect-doorway.md#L823) | CANDIDATE AMENDMENT | [CA-06](#ca-06) |
| 12 / Part 8 | [12.2 — Uncertain external effects retain exposure](../../docs/12-the-effect-doorway.md#L826) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): constraint 3; [R26](../../docs/01-the-rules.md#L266), [R42](../../docs/01-the-rules.md#L278), [R55](../../docs/01-the-rules.md#L236), [R60](../../docs/01-the-rules.md#L238), [R83](../../docs/01-the-rules.md#L227) |
| 12 / Part 8 | [12.3 — Base-bound changes on unconditional services](../../docs/12-the-effect-doorway.md#L829) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): sovereignty, constraint 5; [R82](../../docs/01-the-rules.md#L293), [R98](../../docs/01-the-rules.md#L306) |
| 13 / Part 9 | [13.1 — Retain evidence or permit universal age expiry](../../docs/13-the-verification-holders.md#L796) | CANDIDATE AMENDMENT | [CA-02](#ca-02) |
| 13 / Part 9 | [13.2 — External administration and recovery responsibility](../../docs/13-the-verification-holders.md#L803) | CANDIDATE AMENDMENT | [CA-01](#ca-01) |
| 13 / Part 9 | [13.3 — Observation cadences and grading cost](../../docs/13-the-verification-holders.md#L809) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; wisdom; [R38](../../docs/01-the-rules.md#L275), [R39](../../docs/01-the-rules.md#L276), [R58](../../docs/01-the-rules.md#L237), [R60](../../docs/01-the-rules.md#L238) |
| 14 / Part 10 | [14.1 — Administrator and authorized-reader compromise residual](../../docs/14-the-assembly.md#L1033) | CANDIDATE AMENDMENT | [CA-01](#ca-01) |
| 14 / Part 10 | [14.2 — Refuse opaque or unsupported protected modes](../../docs/14-the-assembly.md#L1035) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): constraints 3 and 5; [R26](../../docs/01-the-rules.md#L266), [R82](../../docs/01-the-rules.md#L293), [R95](../../docs/01-the-rules.md#L303) |
| 14 / Part 10 | [14.3a — Finite replay, maintenance and resource thresholds](../../docs/14-the-assembly.md#L1037) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R39](../../docs/01-the-rules.md#L276), [R60](../../docs/01-the-rules.md#L238) |
| 14 / Part 10 | [14.3b — Recoverable encryption-key custody before live claims](../../docs/14-the-assembly.md#L1037) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; R7/26/33/43; [CA-01](#ca-01) for loss-model acceptance |
| 15 / Part 11 | [15.1 — Accept broker administration and loss-of-root procedure](../../docs/15-the-operator-surfaces.md#L432) | CANDIDATE AMENDMENT | [CA-01](#ca-01) |
| 15 / Part 11 | [15.2 — Default authentication gesture](../../docs/15-the-operator-surfaces.md#L437) | CANDIDATE AMENDMENT | [CA-07](#ca-07) |
| 15 / Part 11 | [15.3 — Published safety margins](../../docs/15-the-operator-surfaces.md#L441) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R39](../../docs/01-the-rules.md#L276) |
| 16 / Part 12 | [16.1 — Platform activation order](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L6) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): sequencing; [R62](../../docs/01-the-rules.md#L283), [R72](../../docs/01-the-rules.md#L288), [R105](../../docs/01-the-rules.md#L313) |
| 16 / Part 12 | [16.2 — Recipients of private group-chat receipts](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L12) | CANDIDATE AMENDMENT | [CA-04](#ca-04) |
| 16 / Part 12 | [16.3 — Slack thread or channel as conversation](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L19) | CANDIDATE AMENDMENT | [CA-08](#ca-08) |
| 16 / Part 12 | [16.4 — Personal WhatsApp/iMessage sending scope](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L25) | CANDIDATE AMENDMENT | [CA-09](#ca-09) |
| 16 / Part 12 | [16.5 — Label platform acceptance](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L32) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): presentation/drafting; R26/42/89 |
| 16 / Part 12 | [16.6 — Allow public Telegram webhook ingress](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L38) | CANDIDATE AMENDMENT | [CA-10](#ca-10) |
| 16 / Part 12 | [16.7 — Push unresolved-delivery notices or digests](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L45) | CANDIDATE AMENDMENT | [CA-18](#ca-18) |
| 16 / Part 12 | [16.x1 — Telegram, Slack, WhatsApp, iMessage and web product set](../../docs/16-conversation-adapters.md#L5) | ALREADY-ANSWERED | [Big picture](../../docs/04-the-big-picture.md) §10; [approved revision 2](../../docs/04-the-big-picture.changelog.json), PR #12 / `0d525aef088c75da9e0c7b6d92a2860a4f700374` |
| 17 / Part 13 | [17.1 — Advisory mode without context-consumption proof](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L3) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md) revision 3; R96, with applicable R38/43 and history checks |
| 17 / Part 13 | [17.2 — Compact events versus diagnostic snapshots](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L20) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; wisdom; [R26](../../docs/01-the-rules.md#L266), [R41](../../docs/01-the-rules.md#L235), [R58](../../docs/01-the-rules.md#L237); [H](../../docs/harvests/standards-and-registries-harvest.decisions.md) ruling 15 |
| 17 / Part 13 | [17.3 — Age-only removal of diagnostics](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L39) | DECIDED-BY | R7; [F2](../../docs/06-the-fact-envelope.changelog.json) approved revision 9 / narrow tombstone policy; retained-evidence contracts |
| 17 / Part 13 | [17.4 — Use models without proof of understanding](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L56) | DECIDED-BY | [Purpose](../../docs/00-the-purpose.md): wisdom; verification is a mechanism; [R3](../../docs/01-the-rules.md#L329), [R38](../../docs/01-the-rules.md#L275), [R58](../../docs/01-the-rules.md#L237) |
| 17 / Part 13 | [17.5 — Provider conversation loss with durable local recovery](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L73) | CANDIDATE AMENDMENT | [CA-11](#ca-11), provider-retention clause |
| 17 / Part 13 | [17.6 — Named machines and trusted administrators](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L91) | CANDIDATE AMENDMENT | [CA-01](#ca-01) |
| 17 / Part 13 | [17.7 — Paid service with delayed final bill and enforced cap](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L112) | CANDIDATE AMENDMENT | [CA-11](#ca-11), delayed-settlement clause |
| 17 / Part 13 | [17.x1 — Supported harness-mode product scope and confinement cost](../../docs/17-harness-adapters.md#L5) | CANDIDATE AMENDMENT | [CA-11](#ca-11), supported-mode/confinement-cost clause |
| 18 / Part 14 | [18.1 — Length of watch-only safety trials](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L3) | CANDIDATE AMENDMENT | [CA-17](#ca-17) |
| 18 / Part 14 | [18.2 — Recovery classes that may act automatically](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L15) | CANDIDATE AMENDMENT | [CA-19](#ca-19) |
| 18 / Part 14 | [18.3 — Hourly limit on failed-repair notifications](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L27) | CANDIDATE AMENDMENT | [CA-18](#ca-18) |
| 18 / Part 14 | [18.4 — Per-machine timing and automatic-action limits](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L39) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R31](../../docs/01-the-rules.md#L270), [R39](../../docs/01-the-rules.md#L276), [R55](../../docs/01-the-rules.md#L236), [R60](../../docs/01-the-rules.md#L238) |
| 18 / Part 14 | [18.5 — Additional readers of full process inventory](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L51) | CANDIDATE AMENDMENT | [CA-13](#ca-13) |
| 19 / Part 15 | [19.1 — Missed scheduled work default](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L3) | CANDIDATE AMENDMENT | [CA-14](#ca-14) |
| 19 / Part 15 | [19.2 — Repeated local clock time](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L16) | CANDIDATE AMENDMENT | [CA-15](#ca-15) |
| 19 / Part 15 | [19.3 — Admission when provider quota is unknown](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L32) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R15](../../docs/01-the-rules.md#L260), [R26](../../docs/01-the-rules.md#L266), [R60](../../docs/01-the-rules.md#L238), [R75](../../docs/01-the-rules.md#L225), [R95](../../docs/01-the-rules.md#L303) |
| 19 / Part 15 | [19.4 — Maintenance share and urgent-start delay](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L49) | CANDIDATE AMENDMENT | [CA-20](#ca-20) |
| 19 / Part 15 | [19.5 — Bounded automatic half-open trial versus human restart](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L73) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; R23/55/60/61/88; [CA-19](#ca-19) for new recovery/retry authority |
| 19 / Part 15 | [19.6 — Direct legacy job import support window](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L91) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): sequencing and technical correctness; [R44](../../docs/01-the-rules.md#L214), [R45](../../docs/01-the-rules.md#L280), [R78](../../docs/01-the-rules.md#L242), [R90](../../docs/01-the-rules.md#L299) |
| 20 / Part 16 | [20.1 — 30/90/365-day detailed presentation](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L3) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R7](../../docs/01-the-rules.md#L252), [R39](../../docs/01-the-rules.md#L276); section 9 |
| 20 / Part 16 | [20.2 — Subscription allocation method](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L14) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R39](../../docs/01-the-rules.md#L276), [R75](../../docs/01-the-rules.md#L225) |
| 20 / Part 16 | [20.3 — Native currencies and optional conversion](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L27) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266) |
| 20 / Part 16 | [20.4 — Show tentative and ready-to-rely-on comparisons](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L36) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R58](../../docs/01-the-rules.md#L237), [R107](../../docs/01-the-rules.md#L314) |
| 20 / Part 16 | [20.5 — Anomalous-spend thresholds](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L50) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R39](../../docs/01-the-rules.md#L276), [R58](../../docs/01-the-rules.md#L237) |
| 20 / Part 16 | [20.6 — Unknown quota with local usage context](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L63) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): technical correctness; wisdom; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R39](../../docs/01-the-rules.md#L276) |
| 20 / Part 16 | [20.7 — Complete signed history now or wait for storage redesign](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L74) | AGENT'S | [Purpose](../../docs/00-the-purpose.md): sequencing; constraint 2; [R7](../../docs/01-the-rules.md#L252), [R39](../../docs/01-the-rules.md#L276); [F2](../../docs/06-the-fact-envelope.changelog.json) decisions 1 and 6 |
| 20 / Part 16 | [20.8 — Does a positive budget arm paid service](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L87) | ALREADY-ANSWERED | [H](../../docs/harvests/standards-and-registries-harvest.decisions.md) ruling 20 at line 27; [Purpose](../../docs/00-the-purpose.md): constraint 5, authority boundary |
| 21 / Part Seventeen | No index or sections in the audited git tree | No question to classify | Coverage absence; excluded from disposition counts |

## Basis and counting discipline

DECIDED-BY requires cited text that uniquely settles the choice at the original breadth asked. A constraint that merely bounds multiple conforming answers is not a deciding text: use AGENT'S only where the purpose delegates that choice, otherwise CANDIDATE AMENDMENT. Coherence alone does not choose a storage replica count, a Slack conversation boundary or an acceptable administrator. A numbered rule can decide a floor while a distinct product trade still needs an amendment. When the question is technical method, sequencing or tuning, the purpose's **agent decides** delegation supplies the authority: initial numbers are labelled unmeasured, and existing operator ceilings are never widened. The word “policy” on a timer does not by itself make it an operator question. Conversely, acceptance of an unprotected interval, a service objective, disclosure grants and residual-risk policy are not mere tuning. An explicit exception to an existing rule is a proposal to change that rule, outside this gap sweep.

ALREADY-ANSWERED means there is a recorded approved answer, identified below. F2 and F3 contain explicit operator-acceptance notes; F1 contains exact approved-version records. The part-four bundle has a verifiable landing but no operator-approved record in the cited evidence; 08.2 remains unresolved under CA-16, rather than being treated as a metadata-only repair. A draft status line, a recommendation, a reviewer's acceptance, a build passing or an implementation landing by itself does not answer every residual policy question. The purpose and big-picture documents themselves retain draft wording despite the supplied merged baseline; their approved changelog records (purpose revisions 1–3 and big-picture revision 2 / PR #12) establish the constitutional inputs; this harvest does not repair those status lines.

“Accept carrying it?” is a sequencing decision distinct from the question being carried: 06.8 records approval of carriage, while 06.x1 records the still-unresolved retention policy. The same external-anchor question in 05.6b is followed to its later owner decisions, not silently declared answered because an owner was named. Duplicate mentions in inherited-duty tables and fixtures point back to these IDs. Runtime questions such as “Did this effect happen?” and the sentinel-family diagnostic predicates are executable subject questions with specified evidence, not unanswered operator-design decisions; they are excluded from the counts. Fixed Value choices without an open question or an explicit operator decision are not added as new questions. Counts retain the 92 original atomic IDs. Each row has one primary disposition; separately labelled constitutional floors, delegated realizations and cross-references within it do not create additional questions. A mixed question remains CANDIDATE AMENDMENT while its operator policy is unresolved; its delegated subchoices are answered explicitly, not substituted for the original question.

Every disposition uses revision 3's vocabulary: consequential means any of the four purpose tests holds, and ordinary means none holds. Messages that change what a person knows are consequential, including advisory answers; operator-visible surfaces are user-facing. Significant features have consequential effects, and critical pipelines/outcomes are those on which such effects depend. Consequently the applicable history, supervision and live-proof requirements remain attached to the choices below, including notification and reporting implementations. Classification neither creates authority nor requires a fresh prompt for an already covered action. Historical source quotations retain their original words; the audited answers resolve those words to the current purpose.

All 92 answers were reconsidered against the pillars, wisdom/complete relevant recall, the gap rule, the definitions, and the five constraints. The review's 70 retained dispositions still fit their cited approval, uniquely entailed floor or delegated choice under that complete source; the 22 flagged dispositions are repaired below. No pillar supplies an unnamed grant, selects an audience or provider, or turns a preferred mechanism into an entailed answer.

The layer below this audit is the constitutional source, the design decision surfaces, their linked section bodies, approved answer records and actual git presence/ancestry. This harvest does not claim an independent convergence verdict, runtime implementation, or ratification of any amendment. Its documentation-only posture is shared through git; no runtime state, authority, machine placement or installed agent file changes. Reversal removes this harvest commit while preserving the audit in git history.

## Per-part detail

### Document 05 — Part 1: Constitutional types

Coverage: [05-the-types.md](../../docs/05-the-types.md).

#### 05.1 — Language capability floor and timing

Exact location: [docs/05-the-types.md:886](../../docs/05-the-types.md#L886). The quoted question is verbatim with line wrapping normalized.

> **The language capability floor.** Three static-checker capabilities are fixed here and the language is chosen later by compiling the fixtures. Is it right to constrain the choice this way now, or would you rather choose the language in this part?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): agent decides technical correctness and sequencing; [R1](../../docs/01-the-rules.md#L209), [R13](../../docs/01-the-rules.md#L258), [R42](../../docs/01-the-rules.md#L278).** Keep the capability floor and select the language by executing the negative fixtures when implementation needs it.

This is evidence-driven engineering, not an operator preference for syntax.

#### 05.2a — Non-agent repository approval anchor

Exact location: [docs/05-the-types.md:889](../../docs/05-the-types.md#L889). The quoted question is verbatim with line wrapping normalized.

> **The repository anchor is the host's non-agent approval record, not the merge.** Rule 82 has the agent merge; the branch rules require a non-agent approval on protected paths, and that approval record is what an authorization binds to. Is that the anchor you want, and should the constitution and `docs/` be the only protected paths at first?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revisions 8–9, decision 2; [R82](../../docs/01-the-rules.md#L293), [R98](../../docs/01-the-rules.md#L306).** Use the verified non-agent review approval as authorization and the merge commit as the landing locator.

The later operator answer confirms the two-anchor reading; a merge performed by the agent cannot itself create the explicit yes.

#### 05.2b — Only constitution and docs protected initially

Exact location: [docs/05-the-types.md:889](../../docs/05-the-types.md#L889). The quoted question is verbatim with line wrapping normalized.

> **The repository anchor is the host's non-agent approval record, not the merge.** Rule 82 has the agent merge; the branch rules require a non-agent approval on protected paths, and that approval record is what an authorization binds to. Is that the anchor you want, and should the constitution and `docs/` be the only protected paths at first?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6, decision 7.** Include the generator, resolver, walker, encoder and fixtures in the protected toolchain as well as the governing documents.

The later recorded all-seven-defaults approval resolves the earlier narrower-list question; this does not protect arbitrary application code.

#### 05.3 — Capacity outcome inside Success

Exact location: [docs/05-the-types.md:893](../../docs/05-the-types.md#L893). The quoted question is verbatim with line wrapping normalized.

> **A budget applied as designed rides inside `Success`.** The approved parent fixes `Result` as two arms, so the capacity signal is a required field on `Success` rather than a third arm. Rule 40 is met (it cannot be routed as an error); do you accept this over amending the parent?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R40](../../docs/01-the-rules.md#L277), [R42](../../docs/01-the-rules.md#L278); [Big picture](../../docs/04-the-big-picture.md) §1.** Keep capacity-applied as a required Success field within the existing two-arm Result.

The rule requires an honest success outcome, not a third union arm; no constitutional amendment is needed to choose this representation.

#### 05.4 — Central package decoders

Exact location: [docs/05-the-types.md:897](../../docs/05-the-types.md#L897). The quoted question is verbatim with line wrapping normalized.

> **Decoders inside the types package.** One implementation per invariant, at the cost of a central package that knows every adapter's byte shape through its fixtures. Alternative: one decoder per adapter, with the fixtures shared. I recommend the first.

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R1](../../docs/01-the-rules.md#L209), [R30](../../docs/01-the-rules.md#L211); [Big picture](../../docs/04-the-big-picture.md) §1.** Keep a single implementation of each invariant in the type package with adapter byte shapes exercised by fixtures.

This resolves package layout, subject to actual fixture and dependency evidence.

#### 05.5 — Preserve unresolved senders as values

Exact location: [docs/05-the-types.md:900](../../docs/05-the-types.md#L900). The quoted question is verbatim with line wrapping normalized.

> **`UnresolvedInput` as a value.** An unresolvable sender's message is kept and queued as an authority-free value rather than refused. This is the one place the boundary is soft, and it is soft toward delivery on purpose. Is that the right place for the softness?

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): coherence, constraint 2; [R14](../../docs/01-the-rules.md#L259), [R28](../../docs/01-the-rules.md#L268), [R46](../../docs/01-the-rules.md#L281).** Preserve and drain unresolved input without granting it principal or approval authority.

Delivery-oriented preservation does not mean executing an unauthenticated instruction.

#### 05.6a — When to design the runtime reference monitor

Exact location: [docs/05-the-types.md:903](../../docs/05-the-types.md#L903). The quoted question is verbatim with line wrapping normalized.

> **Protected artifacts beyond the repository.** This part holds the protected list for repository merges only and says so; dashboard-governed and runtime artifacts have no anchor outside the agent's write authority yet. Do you accept carrying that open question to the verification and operator-surface parts, or do you want a reference monitor designed before any code part starts?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): sequencing; constraint 3; [R71](../../docs/01-the-rules.md#L223).** Carry the explicitly owned reference-monitor work to verification and operator surfaces, while refusing any protected-runtime claim until the monitor is proved.

The question is ordering, not permission to call an unprotected artifact protected; later sections do supply a design.

#### 05.6b — Which external runtime trust boundary

Exact location: [docs/05-the-types.md:903](../../docs/05-the-types.md#L903). The quoted question is verbatim with line wrapping normalized.

> **Protected artifacts beyond the repository.** This part holds the protected list for repository merges only and says so; dashboard-governed and runtime artifacts have no anchor outside the agent's write authority yet. Do you accept carrying that open question to the verification and operator-surface parts, or do you want a reference monitor designed before any code part starts?

**CANDIDATE AMENDMENT — [CA-01](#ca-01).** Proposed answer: use an independently administered operator-controlled broker and explicit deployment trust record.

The need for separation is decided; which administrator, custody and residual risk are acceptable is not. This carried question also occurs at lines 499–520, 691 and 880.

#### 05.7 — Requester on an attested authenticated channel

Exact location: [docs/05-the-types.md:908](../../docs/05-the-types.md#L908). The quoted question is verbatim with line wrapping normalized.

> **Requester standing on an attested channel.** A principal with requester standing may rest on `channel-attested` provenance — the adapter's word that the message came through a channel it authenticated — which is what the glossary's definition of *verified* allows. The stricter reading would require package-verified evidence even for requester standing, which today's Telegram channel cannot provide. Which do you want?

**ALREADY-ANSWERED — [F1](../../docs/05-the-types.changelog.json) revision 5 approvedIn PR13; revision 4 change 2.** Allow channel-attested authenticated evidence for requester standing, with the stronger verified-evidence floor for authority-conferring acts.

The approved revision records the explicit lower provenance design and its residual; the later exercise split does not make requester attestation an approval. Unlike a mere draft recommendation, this has a recorded approved version.

#### 05.x1 — Who may resolve ordinary versus authority conflicts

Exact location: [docs/05-the-types.md:557](../../docs/05-the-types.md#L557). The quoted question is verbatim with line wrapping normalized.

> No rule says who may resolve which conflict.

**ALREADY-ANSWERED — [F1](../../docs/05-the-types.changelog.json) revision 5 change 2 and approvedIn PR13.** Use live above-requester standing for non-authority conflicts and operator standing in scope for grants, revocations, authorizations and principals.

The approved change explicitly records the matrix as a Value; do not falsely attribute its exact hierarchy to rules 82 or 104.

### Document 06 — Part 2: Fact envelope

Coverage: [06-the-fact-envelope.md](../../docs/06-the-fact-envelope.md).

#### 06.1 — Growth and replay trigger

Exact location: [docs/06-the-fact-envelope.md:1044](../../docs/06-the-fact-envelope.md#L1044). The quoted question is verbatim with line wrapping normalized.

> **Unbounded growth, now with a gauge.** No deletion, no compaction; the record only grows. The instruments section attaches the measurements and a replay-duration threshold that mechanically re-opens the compaction question as a registered loop. Do you accept unbounded growth on those terms — and is replay-duration (rather than bytes) the right trigger?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface.** Accept growing retained history with a replay-duration threshold that reopens storage design as an owned loop.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.2 — Two-anchor rule-90 reading

Exact location: [docs/06-the-fact-envelope.md:1049](../../docs/06-the-fact-envelope.md#L1049). The quoted question is verbatim with line wrapping normalized.

> **The two-anchor reading of rule 90.** `approvedIn` is the host's review-approval record (the authority — a merge event never qualifies, per part one), `landedIn` is the merge commit (the locator rule 90's text names). I believe this reads the rule faithfully alongside part one; the alternative is a formal amendment to rule 90's wording through its own version chain. Confirm the reading, or direct the amendment?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 8 (decision 2), revision 9; decision-list preface.** Use approvedIn for the authority-bearing review record and landedIn for the merge locator, with human approval restricted to governing changes.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.3 — Retraction audiences

Exact location: [docs/06-the-fact-envelope.md:1055](../../docs/06-the-fact-envelope.md#L1055). The quoted question is verbatim with line wrapping normalized.

> **Retraction visibility and its audience.** A retracted fact stays visible as retracted — hidden corrections hide recurrence. But visible *to whom* is a real question: an operator-facing view showing repudiated history is honest; the same in a user-facing view may be noise or harm. Default: operator surfaces show retractions; user surfaces show them only on request. Right line?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface.** Show retractions on operator surfaces and on user surfaces only on request.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.4 — Narrow redaction and register growth value

Exact location: [docs/06-the-fact-envelope.md:1061](../../docs/06-the-fact-envelope.md#L1061). The quoted question is verbatim with line wrapping normalized.

> **The redaction carve-out, and the register amendment it needs.** For incidental third-party content, an operator-standing redaction — reason from a closed list, protected references unredactable, a surfaced delay window — tombstones capture *bytes* while every envelope, hash, and the redaction record stay permanent. It is cooperative deletion with no proof of erasure, and the document says so. It also needs one register-shape amendment: a `growth: redacts` value for the capture store, since the existing closed list cannot describe "deletes bytes only under a permanent operator tombstone." Do you want the mechanism, this narrow, and do you approve routing the register amendment with it?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface.** Allow the closed-reason, operator-standing, delayed tombstone mechanism with protected references retained and the redacts register value.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.5 — No machine-local facts

Exact location: [docs/06-the-fact-envelope.md:1070](../../docs/06-the-fact-envelope.md#L1070). The quoted question is verbatim with line wrapping normalized.

> **No machine-local facts — stricter than rule 32.** A machine-local *store* is permitted with a reason; a machine-local *fact* is forbidden outright. Keep the stricter line?

**ALREADY-ANSWERED — [Decision-list preface](../../docs/06-the-fact-envelope.md#L1041); [F2](../../docs/06-the-fact-envelope.changelog.json); approved revision 9 / PR16.** Retain the shared-fact rule while allowing justified machine-local stores and sidecars.

F2 revision 9, `changes[0].why`, explicitly records questions 5 and 8 answered in conversation with their recommendations accepted, bound by approvedIn PR #16 / `d403a070468126278c4dae54f27107009fcd7c99`. For question 8, that approves carrying the reconciliation, not deleting evidence or deciding the retained policy gap.

#### 06.6 — Full history on every machine

Exact location: [docs/06-the-fact-envelope.md:1073](../../docs/06-the-fact-envelope.md#L1073). The quoted question is verbatim with line wrapping normalized.

> **Full history on every machine.** Every machine holds all segments — each can audit, rebuild, and serve alone (bounded by capture availability, stated in the text), at the cost that the smallest disk governs fleet retention and storage is machine-count × history. The alternative (bounded local suffix, older segments fetched on demand) stays open behind the same measurements. Start with full copies?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface.** Start with full segment copies on every machine, measuring the cost and retaining the stated capture-availability limits.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.7 — Stale authority and partition flagging

Exact location: [docs/06-the-fact-envelope.md:1079](../../docs/06-the-fact-envelope.md#L1079). The quoted question is verbatim with line wrapping normalized.

> **Authority fails closed on staleness — and partitions flag retroactively.** Standing, authorization, ownership, and spend projections refuse past a staleness bound and serve the narrower answer under conflict. Admission itself carries the one carve-out: a partitioned machine keeps appending within locally-provable standing, and a late-arriving revocation retroactively flags the facts it undercuts as conflicts rather than silently invalidating or silently keeping them. Accept the split, including the retroactive-flagging trade?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface.** Refuse stale or contested authority while preserving locally provable partition appends as provisional and flagging conflicting revocations on reconciliation.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.8 — Carry capture-retention reconciliation

Exact location: [docs/06-the-fact-envelope.md:1086](../../docs/06-the-fact-envelope.md#L1086). The quoted question is verbatim with line wrapping normalized.

> **The capture-retention tension, stated not solved.** The big picture promises judgment captures are machine-local with bounded retention; this part makes facts that reference them permanent. A retention-expired capture leaves a permanent fact pointing at absent bytes, so facts must carry enough in-body to stay *reviewable* after capture expiry — but the full reconciliation of rule 7 with bounded capture retention is carried to part nine, explicitly. Accept carrying it?

**ALREADY-ANSWERED — [Decision-list preface](../../docs/06-the-fact-envelope.md#L1041); [F2](../../docs/06-the-fact-envelope.changelog.json); approved revision 9 / PR16.** Carry the rule-7 versus bounded-capture-retention reconciliation to part nine as an explicit obligation, without deciding routine deletion.

F2 revision 9, `changes[0].why`, explicitly records questions 5 and 8 answered in conversation with their recommendations accepted, bound by approvedIn PR #16 / `d403a070468126278c4dae54f27107009fcd7c99`. For question 8, that approves carrying the reconciliation, not deleting evidence or deciding the retained policy gap.

#### 06.9 — Glossary fact/field homonym

Exact location: [docs/06-the-fact-envelope.md:1093](../../docs/06-the-fact-envelope.md#L1093). The quoted question is verbatim with line wrapping normalized.

> **The glossary homonym.** This part keeps **fact** for the record (matching the approved parent's usage) and proposes renaming the glossary's term-kind value `fact` to `field` through its own supersedes chain. Approve routing that small amendment?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface; [F3](../../docs/07-the-declarations.changelog.json) revision 6 atomic bundle.** Route the term-kind rename from fact to field through its governing version chain.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.10 — Deterministic governed-state blocks

Exact location: [docs/06-the-fact-envelope.md:1097](../../docs/06-the-fact-envelope.md#L1097). The quoted question is verbatim with line wrapping normalized.

> **A third category for rule 4's blocking sites.** The admission ladder (and every decoder part one already ships) blocks deterministically without a model, yet is neither on rule 4's ruled-three list nor "names the model that decides." Rather than game the `decidesAlone` field, this part proposes amending rule 4 / the register's blocking-site kind with a third recognized category — *deterministic enforcement of recorded governed state* (an exact test that refuses malformed, unverifiable, or standing-uncovered input and preserves it — covering the integrity/decode rungs and the standing rungs alike) — under which part one's decoders and this boundary both register honestly. Approve routing that amendment?

**ALREADY-ANSWERED — [F2](../../docs/06-the-fact-envelope.changelog.json) revision 9; decision-list preface; [F3](../../docs/07-the-declarations.changelog.json) revision 6 atomic bundle.** Add the governed-state blocking category for exact enforcement of recorded state with input preservation.

The recorded decision answers the proposal; its obligations and limits still apply.

#### 06.x1 — Substantive rule-7 / bounded-retention reconciliation

Exact location: [docs/06-the-fact-envelope.md:1086](../../docs/06-the-fact-envelope.md#L1086). The quoted question is verbatim with line wrapping normalized.

> The capture-retention tension, stated not solved.

**CANDIDATE AMENDMENT — [CA-02](#ca-02).** Proposed answer: bound working capture tiers and admission, while preserving unique relevant evidence losslessly and allowing only separately authorized tombstones.

Decision 8 approved carrying this question; it did not answer it. The permanent pointer versus absent payload conflict is followed through parts seven and nine. The separate carried runtime-anchor question at lines 642–647 is covered by 05.6b and its later owner decisions.

### Document 07 — Part 3: Declarations

Coverage: [07-the-declarations.md](../../docs/07-the-declarations.md).

#### 07.1 — Committed generated register

Exact location: [docs/07-the-declarations.md:595](../../docs/07-the-declarations.md#L595). The quoted question is verbatim with line wrapping normalized.

> **The register is a committed, generated file with a two-phase landing.** Reviewable diffs and a doctored-copy check, at the cost of merge noise plus the pending-landing machinery. Right trade?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults.** Keep the committed generated register with its two-phase landing and doctored-copy check.

This is a recorded operator answer, not an inference that the recommendation was probably accepted.

#### 07.2 — Dated gaps

Exact location: [docs/07-the-declarations.md:598](../../docs/07-the-declarations.md#L598). The quoted question is verbatim with line wrapping normalized.

> **Gaps live within deadlines you set.** A `gap` builds while its rule's deadline is in the future — the approved glossary machinery — and a past deadline fails the build. The red count is permanent and current, but never indefinitely tolerable. Accept?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults.** Keep visible gaps only until the operator-set deadlines, with overdue gaps failing the prescribed check.

This is a recorded operator answer, not an inference that the recommendation was probably accepted.

#### 07.3 — Dead versus missing terms

Exact location: [docs/07-the-declarations.md:601](../../docs/07-the-declarations.md#L601). The quoted question is verbatim with line wrapping normalized.

> **Dead terms warn; missing terms fail.** The asymmetry as designed. Right line?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults.** Warn for unused terms and fail for unresolved required terms.

This is a recorded operator answer, not an inference that the recommendation was probably accepted.

#### 07.4 — Atomic amendment convention

Exact location: [docs/07-the-declarations.md:602](../../docs/07-the-declarations.md#L602). The quoted question is verbatim with line wrapping normalized.

> **The six amendments ride this pull request atomically.** One approval event covering the three routed from part two and the three this part's own review surfaced; striking any item returns the whole to review. Confirm this as the standing convention for routed amendments?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults.** Land the six related amendments atomically; a struck item returns the bundle to review.

This is a recorded operator answer, not an inference that the recommendation was probably accepted.

#### 07.5 — Minimal author input

Exact location: [docs/07-the-declarations.md:605](../../docs/07-the-declarations.md#L605). The quoted question is verbatim with line wrapping normalized.

> **The author-supplied surface is minimal by design.** Authors declare only what the build cannot know; everything else is generated and unfakeable. Accept the split, with its generator complexity?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults.** Have authors declare only information the generator cannot derive, generating the rest.

This is a recorded operator answer, not an inference that the recommendation was probably accepted.

#### 07.6 — Separation for governed-state gates

Exact location: [docs/07-the-declarations.md:608](../../docs/07-the-declarations.md#L608). The quoted question is verbatim with line wrapping normalized.

> **`governed-state` requires separation of powers.** A gate may only enforce a record it cannot author (P3-NF-27). This is stricter than the amendment's minimum reading and closes the self-authored-blocklist shape. Keep the stricter line?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults.** Retain the stricter separation: a gate may enforce only a governing record it cannot author.

This is a recorded operator answer, not an inference that the recommendation was probably accepted.

#### 07.7 — Protected toolchain

Exact location: [docs/07-the-declarations.md:611](../../docs/07-the-declarations.md#L611). The quoted question is verbatim with line wrapping normalized.

> **The toolchain is protected from day one.** Generator, resolver, walker, encoder, and fixtures on the protected-artifact list — every change to a checker asks you, within the rare-approval scope, because those files are the constitution's teeth. Accept the added approval surface?

**ALREADY-ANSWERED — [F3](../../docs/07-the-declarations.changelog.json) revision 6: operator accepted all seven defaults.** Protect the generator, resolver, walker, encoder and fixtures from day one.

This is a recorded operator answer, not an inference that the recommendation was probably accepted.

### Document 08 — Part 4: Intake

Coverage: [08-the-intake.md](../../docs/08-the-intake.md).

#### 08.1 — Accept steering risk from stolen platform token

Exact location: [docs/08-the-intake.md:595](../../docs/08-the-intake.md#L595). The quoted question is verbatim with line wrapping normalized.

> **The conversation binding, and the risk you are accepting with chat.** Operator standing anchors to a recorded, verified binding; a chat message can only select within it and steer already-granted work. The honest residual: if a chat platform's bot token is ever stolen, the thief can steer every conversation bound on that platform — each within its own scope, never the walls or the PIN surfaces, never granting or approving anything. The exercise-split amendment in question 2 is what makes this the constitution's position rather than a reading around it. Accept that residual as the price of directing work over chat?

**CANDIDATE AMENDMENT — [CA-03](#ca-03).** Proposed answer: permit chat to steer only an explicitly approved binding whose platform-wide token compromise exposure is disclosed and bounded.

Trust and sovereignty prohibit new authority from chat, but do not select an acceptable blast radius across already-bound conversations.

#### 08.2 — Five interdependent amendments

Exact location: [docs/08-the-intake.md:602](../../docs/08-the-intake.md#L602). The quoted question is verbatim with line wrapping normalized.

> **Five amendments ride this bundle, atomically** (part three's convention): part one gains the exercise split (authority-conferring vs directive — the wall's honest answer to chat); the glossary's operator clause reads "selected … within the recorded conversation binding"; the parsers kind gains `authenticationClass`, `eventIdAuthority`, and `ackPolicy`; the glossary's profile-declaring kinds gain parsers; and the blocking-site kind gains the `enforces` companion row. Striking any item returns the whole to review. Approve the bundle?

**CANDIDATE AMENDMENT — [CA-16](#ca-16).** Proposed answer: adopt the five specified intake amendments atomically through an exact-content operator approval; striking any item returns the bundle to review.

`d532ec9d046e780ccfe76b98ab366253c51e0e35` proves PR #18 landed, not that the operator approved the bundle. F4 revisions 4–6 are draft/review records and F1 revision 7 is draft; neither supplies the required approval anchor. Authorization remains unresolved in this harvest. CA-16 records the adoption proposal, and CA-03's exposure proposal is conditional on a verified exercise split, never a substitute approval for it.

#### 08.3a — Bounded authorization routing and quoted sender

Exact location: [docs/08-the-intake.md:608](../../docs/08-the-intake.md#L608). The quoted question is verbatim with line wrapping normalized.

> **Beyond-standing requests route, bounded and quoted.** The approver sees the system's framing with the sender quoted as untrusted content; needed standing is computed from the operation, not the phrasing; requests coalesce per requester and class. The receipt does *not* name the approver by default. Right lines?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness and drafting; R28/52/82/98.** Choose system framing with sender prose quoted and explicitly untrusted, and coalesce requests by requester × classified operation class. These are delegated rendering and aggregation choices; other bounded untrusted renderings and keys could comply.

**DECIDED-BY floor — R28/52/82/98:** sender prose creates no authority; required standing derives from the operation; requests are bounded, explicit and pre-filled, and preserved input or waiting never becomes consent. The selected rendering and coalescer must preserve that floor, not borrow constitutional inevitability from it.

#### 08.3b — Hide approver identity from requester

Exact location: [docs/08-the-intake.md:608](../../docs/08-the-intake.md#L608). The quoted question is verbatim with line wrapping normalized.

> **Beyond-standing requests route, bounded and quoted.** The approver sees the system's framing with the sender quoted as untrusted content; needed standing is computed from the operation, not the phrasing; requests coalesce per requester and class. The receipt does *not* name the approver by default. Right lines?

**CANDIDATE AMENDMENT — [CA-04](#ca-04).** Proposed answer: omit the approver identity unless an approved disclosure policy permits that requester to see it.

The current rules require verified authority and truthful provenance but do not choose whether internal organizational structure is visible to a requester; body lines 393–398 explicitly call this a per-org Value.

#### 08.4a — Standing candidates never exceed approval

Exact location: [docs/08-the-intake.md:612](../../docs/08-the-intake.md#L612). The quoted question is verbatim with line wrapping normalized.

> **Candidate standing grants appear only on recurrence, and never exceed the approval.** Less one-tap convenience on first contact, no grooming ratchet. Confirm?

**CANDIDATE AMENDMENT — [CA-05](#ca-05).** Proposed answer: cap an automatically derived standing suggestion at the exact actions and scope of the authorization that generated it. The operator may deliberately request and explicitly approve a different grant, including a broader one.

**DECIDED-BY floor — purpose constraint 5 and R98/104:** each authorization is reviewed as a candidate; standing requires explicit approval before issuance. R57 bounds executable model actions, not the breadth of a separately approvable grant proposal. The automatic suggestion ceiling is new policy, not an entailment of that floor.

#### 08.4b — Surface candidate grants only on recurrence

Exact location: [docs/08-the-intake.md:612](../../docs/08-the-intake.md#L612). The quoted question is verbatim with line wrapping normalized.

> **Candidate standing grants appear only on recurrence, and never exceed the approval.** Less one-tap convenience on first contact, no grooming ratchet. Confirm?

**CANDIDATE AMENDMENT — [CA-05](#ca-05).** Proposed answer: review every approval immediately but surface a standing-grant proposal only on genuine recurrence within its proposed term.

Rule 104 requires every-authorization review and repeat-ask prevention, but does not decide first-contact versus recurrence-only presentation; the two stages must stay distinct.

#### 08.5 — Public unresolved-sender acknowledgment default

Exact location: [docs/08-the-intake.md:614](../../docs/08-the-intake.md#L614). The quoted question is verbatim with line wrapping normalized.

> **Unresolved senders: held, drained, and — on public transports — not acknowledged.** A holding notice where the relationship warrants it; silence toward strangers, because an unconditional ack is an enumeration oracle. Right default?

**CANDIDATE AMENDMENT — [CA-04](#ca-04).** Proposed answer: preserve and drain all input, but send no unsolicited acknowledgment to an unresolved public sender.

R14 does not justify abandoning authenticated protected input; it also does not decide whether a stranger gets an enumeration-revealing acknowledgment.

#### 08.6 — Emergency stop before grounding and minting

Exact location: [docs/08-the-intake.md:617](../../docs/08-the-intake.md#L617). The quoted question is verbatim with line wrapping normalized.

> **The emergency stop's doorway fast path** — deterministic recognition from the bound operator, acting before grounding and minting. Confirm the shape?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness and sequencing; R4/60/61/95.** Choose the authenticated bound-operator emergency-stop path before grounding and run minting, retaining its causal record. Verify the chosen ordering with stop-before-grounding, missing-run, contested-binding and duplicate-stop cases before claiming it works.

**DECIDED-BY floor — R4 and the authority bounds:** the exact authenticated operator stop may use its deterministic exception; an unauthenticated stop string may not. R4 does not uniquely select where the exception sits in this pipeline. The separately authorized stop remains an exception under the consequential-effect definition, not a grant created by this sequencing choice.

### Document 09 — Part 5: Run graph

Coverage: [09-the-run-graph.md](../../docs/09-the-run-graph.md).

#### 09.1 — Unknown effects delay completion

Exact location: [docs/09-the-run-graph.md:988](../../docs/09-the-run-graph.md#L988). The quoted question is verbatim with line wrapping normalized.

> **Value — preserve uncertainty even when it delays a result.** No automatic check chooses the right patience for a person's work. The proposed policy keeps unknown effects, unresolved remote cancellation, and unsettled maximum spend visible rather than declaring completion or replaying blindly. The operator question is whether that availability cost is acceptable; technical implementation must still satisfy the existing no-unknown-retry and authority rules. A new policy cannot silently weaken those constitutional constraints.

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): coherence, constraint 3; [R24](../../docs/01-the-rules.md#L265), [R26](../../docs/01-the-rules.md#L266), [R42](../../docs/01-the-rules.md#L278), [R97](../../docs/01-the-rules.md#L305).** Keep unknown effects, cancellation and maximum charge as owned unresolved obligations and do not claim completion or blindly repeat them.

Availability preference cannot turn missing evidence into a fact; finite observation effort is compatible with an indefinitely unresolved obligation.

#### 09.2 — Graph limits, attempts and semantic-gap ceiling

Exact location: [docs/09-the-run-graph.md:995](../../docs/09-the-run-graph.md#L995). The quoted question is verbatim with line wrapping normalized.

> **Value — finite starting limits and review deadlines need an accepted policy.** No automatic check chooses optimal node/depth/fan-out limits, retry count, or the calendar ceiling for semantic holding gaps. Section 3 proposes initial limits and section 12 proposes 2026-10-05. The operator question is whether those starting values fit the intended workload. Testable constraints and measured exhaustion remain mandatory whichever finite values are selected.

**CANDIDATE AMENDMENT — [CA-17](#ca-17).** Proposed answer: accept 2026-10-05 as the calendar ceiling for Part Five's semantic holding gaps, as a governing deadline rather than merely a review date. F3 decision 2 leaves that ceiling to the operator; the date is proposed, not approved.

**AGENT'S — purpose technical correctness/sequencing:** choose the proposed 1,024 outstanding nodes per root, 32 children, depth 16 and three attempts as unmeasured starting limits within actual resource authority; measure exhaustion and schedule reviews within the adopted ceiling. These engineering choices do not accept the gap interval or establish its absent governing deadline.

#### 09.3 — Single owning parent versus shared ownership

Exact location: [docs/09-the-run-graph.md:1001](../../docs/09-the-run-graph.md#L1001). The quoted question is verbatim with line wrapping normalized.

> **Value — the shape of delegation favors one accountable return path.** No automatic check proves a single owning parent is the best topology. The proposal supports many dependencies but exactly one owning edge per child, with explicit accepted transfer. The operator question is whether shared ownership is ever a product requirement; if it is, it needs an explicit joint-accountability design rather than several parents each assuming another collected.

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R83](../../docs/01-the-rules.md#L227), [R114](../../docs/01-the-rules.md#L320).** Use one accountable owning edge with explicit transfer and multiple non-owning dependencies; choose a different proven topology only when the work requires it.

The constitution delegates orchestration and explicitly refuses a platform-fixed topology; no requirement for shared ownership has been supplied.

### Document 10 — Part 6: Transport and leases

Coverage: [10-the-transport-and-leases.md](../../docs/10-the-transport-and-leases.md).

#### 10.1a — Scoped quorum realization and voter count

Exact location: [docs/10-the-transport-and-leases.md:907](../../docs/10-the-transport-and-leases.md#L907). The quoted question is verbatim with line wrapping normalized.

> **Value — recommended decision: scoped quorum authority.** No automatic check chooses whether the availability cost is acceptable. Adopt the scoped conditional-append design, with three voters where automatic one-voter-loss failover is required, or one voter with explicitly unavailable failover for smaller installations. This does not change the spine into a global ordered stream. A demand for full conversation execution through every partition conflicts with strict ownership; changing that policy belongs to the operator, not the transport adapter.

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R31](../../docs/01-the-rules.md#L270), [R63](../../docs/01-the-rules.md#L240); [Big picture](../../docs/04-the-big-picture.md) §4.** Use scoped conditional append with three voters for one-voter-loss automatic failover, or one voter with no such failover claim.

Voter placement and latency need measured evidence; a quorum is a proposed mechanism, not a purpose pillar.

#### 10.1b — Exclusive ownership versus partition execution

Exact location: [docs/10-the-transport-and-leases.md:907](../../docs/10-the-transport-and-leases.md#L907). The quoted question is verbatim with line wrapping normalized.

> **Value — recommended decision: scoped quorum authority.** No automatic check chooses whether the availability cost is acceptable. Adopt the scoped conditional-append design, with three voters where automatic one-voter-loss failover is required, or one voter with explicitly unavailable failover for smaller installations. This does not change the spine into a global ordered stream. A demand for full conversation execution through every partition conflicts with strict ownership; changing that policy belongs to the operator, not the transport adapter.

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): coherence, sovereignty; [R63](../../docs/01-the-rules.md#L240), [R95](../../docs/01-the-rules.md#L303).** Preserve and queue on the partition lacking execution authority while keeping independently authorized communication and repair available.

The desire to execute from both sides would require changing rule 63; it is not a constitutionally undecided choice. Also stated at lines 56–62 and 660–666.

#### 10.2 — Indefinitely uncertain obligations

Exact location: [docs/10-the-transport-and-leases.md:914](../../docs/10-the-transport-and-leases.md#L914). The quoted question is verbatim with line wrapping normalized.

> **Value — recommended decision: preserve uncertain effects indefinitely as obligations.** Bound active retries and observation episodes, not truth. A destination with no decisive lookup can leave an operation uncertain permanently until a standing-covered resolution supplies evidence or explicitly accepts an outcome risk. No check decides whether that product trade is desirable; the checks ensure it is not silently presented as failure or success. An operator-authorized new risk-taking action is separately recorded, never relabeled proof that the old action did not happen.

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): constraint 3; [R26](../../docs/01-the-rules.md#L266), [R42](../../docs/01-the-rules.md#L278), [R83](../../docs/01-the-rules.md#L227), [R97](../../docs/01-the-rules.md#L305), [R99](../../docs/01-the-rules.md#L307).** Retain the uncertainty and exposure with bounded observation and a recheck owner until evidence settles it.

A separately authorized risk-taking action records acceptance of risk, never proof that the earlier action did not occur.

### Document 11 — Part 7: Judgment doorway

Coverage: [11-the-judgment-doorway.md](../../docs/11-the-judgment-doorway.md).

#### 11.1 — Capture retention versus new-call availability

Exact location: [docs/11-the-judgment-doorway.md:847](../../docs/11-the-judgment-doorway.md#L847). The quoted question is verbatim with line wrapping normalized.

> Does the proposed conservative retention posture fit the intended privacy policy: retain unresolved evidence, stop new affected model calls at capacity, and have part nine settle routine-age retention through the existing amendment path rather than silently deleting it?

**CANDIDATE AMENDMENT — [CA-02](#ca-02).** Proposed answer: retain pinned or unique evidence and refuse affected new capture admission at capacity, using lossless archival tiers to bound active-tier retention.

Rule 7 supplies the no-loss floor, but B §5 and the later contracts disagree about universal raw capture expiry; the amendment must reconcile those words, not silently pick one.

#### 11.2 — Dashboard/runtime approval trust root

Exact location: [docs/11-the-judgment-doorway.md:850](../../docs/11-the-judgment-doorway.md#L850). The quoted question is verbatim with line wrapping normalized.

> Which independent trust boundary should protect dashboard/runtime artifacts? This part requires honest evidence of it but does not select a host, signing principal or hardware anchor on behalf of parts nine/eleven or the operator.

**CANDIDATE AMENDMENT — [CA-01](#ca-01).** Proposed answer: choose the separately administered operator-controlled broker with a named custodian and recovery policy.

The mechanical need for a non-agent authority does not decide who is trusted to administer it.

### Document 12 — Part 8: Effect doorway

Coverage: [12-the-effect-doorway.md](../../docs/12-the-effect-doorway.md).

#### 12.1 — Replicated durability versus single-machine execution

Exact location: [docs/12-the-effect-doorway.md:823](../../docs/12-the-effect-doorway.md#L823). The quoted question is verbatim with line wrapping normalized.

> **Durability versus single-machine availability.** Adopt replicated(1) for ordinary irreversibles, with explicit approved per-operation local-durable demands for installations accepting permanent-machine-loss risk? Stops retain their approved local-durable fast path.

**CANDIDATE AMENDMENT — [CA-06](#ca-06).** Proposed answer: require a second independently failing durable copy before a non-emergency irreversible effect, with a separately approved, explicitly scoped local-loss exception.

The quoted source's “ordinary irreversibles” is incompatible with purpose revision 3: an effect the agent cannot undo is consequential. CA-06 selects the non-emergency irreversible subset, not all consequential effects. Constraint 2 requires a loss detector and R32 a declared scope; neither mandates exactly one peer or accepts permanent machine-loss risk. The separately authorized emergency-stop exception remains intact.

#### 12.2 — Uncertain external effects retain exposure

Exact location: [docs/12-the-effect-doorway.md:826](../../docs/12-the-effect-doorway.md#L826). The quoted question is verbatim with line wrapping normalized.

> **Indefinite uncertainty.** Accept blocked automatic repetition and retained exposure when an external service cannot provide decisive evidence, with finite observation effort and an owned unresolved record? This follows six/seven and does not authorize timeout-to-truth.

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): constraint 3; [R26](../../docs/01-the-rules.md#L266), [R42](../../docs/01-the-rules.md#L278), [R55](../../docs/01-the-rules.md#L236), [R60](../../docs/01-the-rules.md#L238), [R83](../../docs/01-the-rules.md#L227).** Block automatic repetition and keep maximum exposure and an owned unresolved record while limiting observation effort.

The constitution decides honesty and bounded effort; a timeout cannot manufacture a settled result.

#### 12.3 — Base-bound changes on unconditional services

Exact location: [docs/12-the-effect-doorway.md:829](../../docs/12-the-effect-doorway.md#L829). The quoted question is verbatim with line wrapping normalized.

> **Supported operation modes.** Accept that base-bound changes remain unsupported on services lacking a target-side conditional mechanism, rather than claiming an approval snapshot protects an unconditional mutation? Eight proposes no waiver of exact approval.

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): sovereignty, constraint 5; [R82](../../docs/01-the-rules.md#L293), [R98](../../docs/01-the-rules.md#L306).** Leave base-bound mutation unsupported where the target cannot enforce the approved condition at mutation.

R82 binds the actual artifact and base; an unconditional call cannot inherit safety from an earlier read.

### Document 13 — Part 9: Verification holders

Coverage: [13-the-verification-holders.md](../../docs/13-the-verification-holders.md).

#### 13.1 — Retain evidence or permit universal age expiry

Exact location: [docs/13-the-verification-holders.md:796](../../docs/13-the-verification-holders.md#L796). The quoted question is verbatim with line wrapping normalized.

> **Value — operator decision: retention policy.** The recommended implementable default preserves pinned/unique evidence and limits new capture admission. No check chooses whether the resulting availability cost is acceptable. A universal age cap requires a separately explicit atomic policy amendment; this draft does not smuggle one into a holder. The precise operator question is whether to keep this default or authorize that policy redesign with an explicit acceptable knowledge-loss boundary.

**CANDIDATE AMENDMENT — [CA-02](#ca-02).** Proposed answer: keep unique and pinned evidence, bound active storage losslessly, and disable age-only destruction.

The existing no-deletion floor decides current behavior, but the incompatible promised raw-age bound requires a written policy reconciliation, explicitly noted at lines 463–473.

#### 13.2 — External administration and recovery responsibility

Exact location: [docs/13-the-verification-holders.md:803](../../docs/13-the-verification-holders.md#L803). The quoted question is verbatim with line wrapping normalized.

> **Value — operator decision: external administration.** No check decides who should control the trust root. The proposal requires an independently administered monitor/loader and denies the agent administrative override. The operator question is whether that deployment boundary and its recovery responsibility are acceptable. Without it the product must label runtime/dashboard artifacts unprotected even if repository protection works.

**CANDIDATE AMENDMENT — [CA-01](#ca-01).** Proposed answer: require the independently administered broker and a concrete operator-approved administrator, custody and root-recovery record.

The necessity of separation is already decided by constraint 5 and F3 decision 6; acceptance of a named deployment risk is not.

#### 13.3 — Observation cadences and grading cost

Exact location: [docs/13-the-verification-holders.md:809](../../docs/13-the-verification-holders.md#L809). The quoted question is verbatim with line wrapping normalized.

> **Value — operator decision: observation cost.** Cadences, grading tradeoffs and complete per-generation semantic review consume storage and model budget. No check establishes optimal rates. The proposal starts with section 4's cadences and requires actual deployment measurements before claiming a detection bound; the operator may choose different governed finite limits.

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; wisdom; [R38](../../docs/01-the-rules.md#L275), [R39](../../docs/01-the-rules.md#L276), [R58](../../docs/01-the-rules.md#L237), [R60](../../docs/01-the-rules.md#L238).** Start with the proposed five-minute critical probes, fifteen-minute fixture replay, daily retrospective and weekly full semantic review, then tune to measured harm horizons within authorized budgets.

These are configured starting values, not demonstrated detection bounds; an operator spend ceiling remains binding. Critical probes cover outcomes on which consequential effects depend, resolving scope through purpose revision 3 rather than a separate severity vocabulary.

### Document 14 — Part 10: Assembly

Coverage: [14-the-assembly.md](../../docs/14-the-assembly.md).

#### 14.1 — Administrator and authorized-reader compromise residual

Exact location: [docs/14-the-assembly.md:1033](../../docs/14-the-assembly.md#L1033). The quoted question is verbatim with line wrapping normalized.

> Accept separate administration of protection and key custody, with host administrator and already-authorized plaintext extraction outside the prevention guarantee?

**CANDIDATE AMENDMENT — [CA-01](#ca-01).** Proposed answer: accept that residual only for a named operator-approved deployment trust boundary, with scope, custody and recovery disclosed.

Technical encryption cannot answer whether a particular administrator should be trusted; lines 591–599 explicitly put this trade to the operator.

#### 14.2 — Refuse opaque or unsupported protected modes

Exact location: [docs/14-the-assembly.md:1035](../../docs/14-the-assembly.md#L1035). The quoted question is verbatim with line wrapping normalized.

> Accept governed-mode refusal for opaque/unconfined harnesses and unsupported protected host modes, while retaining independently admitted communication and supported ordinary work?

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): constraints 3 and 5; [R26](../../docs/01-the-rules.md#L266), [R82](../../docs/01-the-rules.md#L293), [R95](../../docs/01-the-rules.md#L303).** Refuse governed/protected modes lacking actual confinement or verified approval evidence and keep independently admitted communication available under its own grounding and effect requirements.

This is scoped enforcement of the promised contract. Advisory labeling does not waive grounding; 17.1 records the existing R96 answer and excludes the proposed relaxation from this gap sweep.

#### 14.3a — Finite replay, maintenance and resource thresholds

Exact location: [docs/14-the-assembly.md:1037](../../docs/14-the-assembly.md#L1037). The quoted question is verbatim with line wrapping normalized.

> Approve the requirement for finite per-installation replay/maintenance/resource thresholds and independently recoverable encryption keys before the corresponding live claims? The deployment selects the actual values within governance and records its measurements. Routine capture deletion or weaker approval provenance would amend earlier governed contracts; this part proposes neither. Technical choices within those contracts—separate custodian, per-store encrypted wrappers, exact package pinning and observed activation—are recorded and reversible through compatible new admissions. They do not add user permission prompts to ordinary standing-covered work.

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R39](../../docs/01-the-rules.md#L276), [R60](../../docs/01-the-rules.md#L238).** Set finite per-installation thresholds from recorded workload and hardware measurements before the matching live claims.

Do not request a new permission merely to choose a measurable threshold inside existing budgets; money above the operator ceiling is different.

#### 14.3b — Recoverable encryption-key custody before live claims

Exact location: [docs/14-the-assembly.md:1037](../../docs/14-the-assembly.md#L1037). The quoted question is verbatim with line wrapping normalized.

> Approve the requirement for finite per-installation replay/maintenance/resource thresholds and independently recoverable encryption keys before the corresponding live claims? The deployment selects the actual values within governance and records its measurements. Routine capture deletion or weaker approval provenance would amend earlier governed contracts; this part proposes neither. Technical choices within those contracts—separate custodian, per-store encrypted wrappers, exact package pinning and observed activation—are recorded and reversible through compatible new admissions. They do not add user permission prompts to ordinary standing-covered work.

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; R7/26/33/43; [CA-01](#ca-01) for loss-model acceptance.** Choose an independently recoverable key mechanism and exercise its recovery tests within the approved deployment loss model. Independent recoverability is the selected engineering arrangement, not a mechanism uniquely selected by the preservation and probe rules.

**DECIDED-BY floor — purpose constraint 3 and R26/43:** no recoverability claim beyond the tested recovery model. Choosing the custodian and accepting administrator compromise or root-loss residuals remain operator policy in CA-01; no technical test accepts those residuals on the operator's behalf.

### Document 15 — Part 11: Operator surfaces

Coverage: [15-the-operator-surfaces.md](../../docs/15-the-operator-surfaces.md).

#### 15.1 — Accept broker administration and loss-of-root procedure

Exact location: [docs/15-the-operator-surfaces.md:432](../../docs/15-the-operator-surfaces.md#L432). The quoted question is verbatim with line wrapping normalized.

> **Value — external administration.** The proposed surface trusts part nine's independently administered broker and verifier. The operator decides whether its separate OS/service identity, recovery custody and loss-of-root procedure are acceptable. Without that separation the affected surface must say unprotected.

**CANDIDATE AMENDMENT — [CA-01](#ca-01).** Proposed answer: use the independent broker only after its administrator, recovery custodian and loss-of-root procedure have a concrete recorded approval.

A separate OS user that the agent can administer is not a separate authority.

#### 15.2 — Default authentication gesture

Exact location: [docs/15-the-operator-surfaces.md:437](../../docs/15-the-operator-surfaces.md#L437). The quoted question is verbatim with line wrapping normalized.

> **Value — authentication gesture.** A PIN-gated confirmation and a signed hardware-backed action have different phishing, recovery and accessibility costs. No check chooses the right deployment default. Whichever is selected must pass the identical subject-binding, replay and mobile tests.

**CANDIDATE AMENDMENT — [CA-07](#ca-07).** Proposed answer: prefer a phone-complete device-held signing factor outside agent custody, with an independently verified accessible recovery alternative.

R79/82 decide mobile completeness and bound approval, but not the phishing/accessibility trade between conforming gestures; a locally readable PIN cannot by itself supply independent authority.

#### 15.3 — Published safety margins

Exact location: [docs/15-the-operator-surfaces.md:441](../../docs/15-the-operator-surfaces.md#L441). The quoted question is verbatim with line wrapping normalized.

> **Value — published margins.** No check chooses how much safety margin to add to the worst measured genesis replay and live-response samples. The operator approves deployment budgets and margins after the raw distributions, failures and hardware profiles are visible; the measurements themselves cannot be replaced by that approval.

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R39](../../docs/01-the-rules.md#L276).** Choose and publish replay/response margins from complete measured distributions and deployment budgets, retaining failures and hardware profiles.

A chosen margin is policy/tuning metadata, never a measured bound; do not widen an operator-approved service or spending ceiling.

### Document 16 — Part 12: Conversation adapters

Coverage: [16-conversation-adapters.md](../../docs/16-conversation-adapters.md), [01-ownership-and-boundaries.md](../../docs/16-conversation-adapters/01-ownership-and-boundaries.md), [02-the-family-contract-and-capability-declaration.md](../../docs/16-conversation-adapters/02-the-family-contract-and-capability-declaration.md), [03-inbound-custody-before-platform-acknowledgment.md](../../docs/16-conversation-adapters/03-inbound-custody-before-platform-acknowledgment.md), [04-durable-conversation-identity-and-binding-selection.md](../../docs/16-conversation-adapters/04-durable-conversation-identity-and-binding-selection.md), [05-telegram-as-the-reference-adapter.md](../../docs/16-conversation-adapters/05-telegram-as-the-reference-adapter.md), [06-slack-whatsapp-imessage-and-web.md](../../docs/16-conversation-adapters/06-slack-whatsapp-imessage-and-web.md), [07-outbound-effects-formatting-and-platform-limits.md](../../docs/16-conversation-adapters/07-outbound-effects-formatting-and-platform-limits.md), [08-delivery-evidence-durable-recovery-and-no-silent-loss.md](../../docs/16-conversation-adapters/08-delivery-evidence-durable-recovery-and-no-silent-loss.md), [09-the-real-worker-to-conversation-path.md](../../docs/16-conversation-adapters/09-the-real-worker-to-conversation-path.md), [10-what-instar-1-x-does-today-and-what-carries-forward.md](../../docs/16-conversation-adapters/10-what-instar-1-x-does-today-and-what-carries-forward.md), [11-non-functional-checks-and-activation.md](../../docs/16-conversation-adapters/11-non-functional-checks-and-activation.md), [12-negative-contract-fixtures.md](../../docs/16-conversation-adapters/12-negative-contract-fixtures.md), [13-inherited-duties-and-disposition.md](../../docs/16-conversation-adapters/13-inherited-duties-and-disposition.md), [14-operator-decisions-and-honest-limits.md](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md).

#### 16.1 — Platform activation order

Exact location: [docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:6](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L6). The quoted question is verbatim with line wrapping normalized.

> after Telegram is proven, should the other platforms follow a fixed order or should each go live when its own proof is ready?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): sequencing; [R62](../../docs/01-the-rules.md#L283), [R72](../../docs/01-the-rules.md#L288), [R105](../../docs/01-the-rules.md#L313).** Prove Telegram first and then activate each other admitted platform on its own complete evidence.

The listed order is work priority, not evidence that later platforms depend on all earlier ones.

#### 16.2 — Recipients of private group-chat receipts

Exact location: [docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:12](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L12). The quoted question is verbatim with line wrapping normalized.

> when someone writes in a public or group chat, who should receive a brief private message confirming that the agent received it?

**CANDIDATE AMENDMENT — [CA-04](#ca-04).** Proposed answer: acknowledge only the verified bound person privately by default and never substitute a public response when private delivery is unproved.

Recognizing a participant does not establish disclosure standing; wisdom requires reasoning about costs but does not select one of these recipient policies.

#### 16.3 — Slack thread or channel as conversation

Exact location: [docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:19](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L19). The quoted question is verbatim with line wrapping normalized.

> when someone asks the agent to do something in a Slack thread, should that work belong to the thread or to the whole channel?

**CANDIDATE AMENDMENT — [CA-08](#ca-08).** Proposed answer: use the Slack thread as the work/authority conversation and provide relevant channel history through a recorded background handoff.

Both choices can preserve coherence; the constitution does not select the product unit of interaction.

#### 16.4 — Personal WhatsApp/iMessage sending scope

Exact location: [docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:25](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L25). The quoted question is verbatim with line wrapping normalized.

> after the required checks pass, may these personal-device channels only read, reply to received messages, or also start new conversations?

**CANDIDATE AMENDMENT — [CA-09](#ca-09).** Proposed answer: require a recorded personal-account grant and default that grant to replies, with proactive conversation initiation named separately.

R18 decides that the human owns the account; it does not decide read-only, reply-only or proactive scope for a new deployment grant. Existing explicit grants are not revoked by this proposal.

#### 16.5 — Label platform acceptance

Exact location: [docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:32](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L32). The quoted question is verbatim with line wrapping normalized.

> when a platform has taken the message but not confirmed delivery, what should the user see?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): presentation/drafting; R26/42/89.** Choose an accurate “accepted by platform” indicator or an unambiguous equivalent over the source's other conforming option, no status. That is a presentation choice, including whether to show the intermediate state at all.

**DECIDED-BY floor — purpose constraint 3 and R26/42/89:** never claim a stronger delivery stage than the evidence proves. The indicator is user-facing under purpose revision 3 and carries the applicable proof requirements; those requirements do not mandate showing it.

#### 16.6 — Allow public Telegram webhook ingress

Exact location: [docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:38](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L38). The quoted question is verbatim with line wrapping normalized.

> may an installation let Telegram push messages to its public web address?

**CANDIDATE AMENDMENT — [CA-10](#ca-10).** Proposed answer: record internet-facing ingress permission per installation and otherwise use a proven outgoing polling path.

Existing sovereignty over owned infrastructure does not settle a fleet-wide default that exposes other installations; ingress mechanics after the scope is known are engineering.

#### 16.7 — Push unresolved-delivery notices or digests

Exact location: [docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:45](../../docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md#L45). The quoted question is verbatim with line wrapping normalized.

> when that bounded watch ends without an answer, how should your attention be requested?

**CANDIDATE AMENDMENT — [CA-18](#ca-18).** Proposed answer: after bounded repair/observation fails, select one immediate grouped action-needed or result notice per incident, subject to a shared ceiling of two pushed notices in any rolling hour per operator across failed repair and unresolved delivery. Keep unchanged uncertainty on the pull surface, with no automatic unchanged daily digest.

R52/53/54/87/88 constrain eligibility, route and bounds; they do not select push over pull-only or immediate over a qualifying digest. CA-18 makes that attention trade explicitly. Formatting, grouping and implementation within an adopted ceiling are AGENT'S; a message to a person remains consequential under purpose revision 3.

#### 16.x1 — Telegram, Slack, WhatsApp, iMessage and web product set

Exact location: [docs/16-conversation-adapters.md:5](../../docs/16-conversation-adapters.md#L5). The quoted question is verbatim with line wrapping normalized.

> Whether these five platforms are the right product set is an operator judgment, not an automatic check.

**ALREADY-ANSWERED — [Big picture](../../docs/04-the-big-picture.md) §10; [approved revision 2](../../docs/04-the-big-picture.changelog.json), PR #12 / `0d525aef088c75da9e0c7b6d92a2860a4f700374`.** The approved conversation family already names Telegram, Slack, WhatsApp, iMessage and web. Preserve that family.

The index repeats a settled product roster; it creates no new gap. Which implementations prove first remains AGENT'S sequencing, with each activation requiring its own evidence. CA-11 covers the distinct harness-mode and confinement-cost acceptance question, not this approved list.

### Document 17 — Part 13: Harness adapters

Coverage: [17-harness-adapters.md](../../docs/17-harness-adapters.md), [01-ownership-and-boundaries.md](../../docs/17-harness-adapters/01-ownership-and-boundaries.md), [02-one-adapter-family-and-one-conformance-shape.md](../../docs/17-harness-adapters/02-one-adapter-family-and-one-conformance-shape.md), [03-capability-account-quota-and-launch-pins.md](../../docs/17-harness-adapters/03-capability-account-quota-and-launch-pins.md), [04-launching-a-worker-for-durable-work.md](../../docs/17-harness-adapters/04-launching-a-worker-for-durable-work.md), [05-delivering-live-inbound-and-observing-a-turn.md](../../docs/17-harness-adapters/05-delivering-live-inbound-and-observing-a-turn.md), [06-resume-continuation-and-compaction.md](../../docs/17-harness-adapters/06-resume-continuation-and-compaction.md), [07-honest-liveness-progress-and-completion.md](../../docs/17-harness-adapters/07-honest-liveness-progress-and-completion.md), [08-interruption-kill-and-recovery.md](../../docs/17-harness-adapters/08-interruption-kill-and-recovery.md), [09-claude-code-codex-and-future-runtime-mappings.md](../../docs/17-harness-adapters/09-claude-code-codex-and-future-runtime-mappings.md), [10-what-instar-1-x-does-today-and-what-carries-forward.md](../../docs/17-harness-adapters/10-what-instar-1-x-does-today-and-what-carries-forward.md), [11-non-functional-checks-and-activation.md](../../docs/17-harness-adapters/11-non-functional-checks-and-activation.md), [12-negative-contract-fixtures.md](../../docs/17-harness-adapters/12-negative-contract-fixtures.md), [13-inherited-duties-and-disposition.md](../../docs/17-harness-adapters/13-inherited-duties-and-disposition.md), [14-operator-decisions-and-honest-limits.md](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md).

#### 17.1 — Advisory mode without context-consumption proof

Exact location: [docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md:3](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L3). The quoted question is verbatim with line wrapping normalized.

> Should a safely confined setup remain available for clearly labeled advisory work when we cannot verify that it used the supplied background, or should we turn it off?

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md) revision 3; R96, with applicable R38/43 and history checks.** A mode without the required grounding evidence cannot claim or perform work requiring that evidence. Disable the proposed ungrounded advisory use unless a separately authorized rule change supplies an exact exception; a label or confinement alone cannot waive R96.

CA-12 is dropped: it is **a proposal to change rule 96, outside this sweep**, not an undecided gap. A human-facing advisory answer can change what a person knows and is consequential; calling it advisory does not exclude critical downstream reliance or remove applicable history, supervision and probe duties. Any separate proposal would need exact permitted consumers and consequential-effect coverage, and operator-controlled authority review.

#### 17.2 — Compact events versus diagnostic snapshots

Exact location: [docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md:20](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L20). The quoted question is verbatim with line wrapping normalized.

> Beyond the required record of what was sent to and returned by the model, should diagnosis keep only compact session events, or may it also keep short snapshots of what appeared in a session?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; wisdom; [R26](../../docs/01-the-rules.md#L266), [R41](../../docs/01-the-rules.md#L235), [R58](../../docs/01-the-rules.md#L237); [H](../../docs/harvests/standards-and-registries-harvest.decisions.md) ruling 15.** Keep complete required model-call records and compact extra session events by default, taking bounded diagnostic snapshots when an actual problem category needs them within existing observation standing.

This is measurement method, not permission to sample unrelated activity; the approved internal-capture ruling rejects a blanket privacy excuse for losing required evidence. New observation authority is assessed separately.

#### 17.3 — Age-only removal of diagnostics

Exact location: [docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md:39](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L39). The quoted question is verbatim with line wrapping normalized.

> Should we keep diagnostic content until an already permitted removal reason applies, or open a separate policy change that allows removal just because content is old?

**DECIDED-BY — R7; [F2](../../docs/06-the-fact-envelope.changelog.json) approved revision 9 / narrow tombstone policy; retained-evidence contracts.** Keep diagnostic evidence until an already permitted removal reason applies; age alone is not one. Do not open an age-only-removal change as part of this gap harvest.

Retaining the current rule answers the question today. A request to change it would be a separate policy-change proposal. Remove 17.3 from CA-02, whose genuine gap remains the active-tier meaning, reconstruction path and capacity-admission reconciliation in 06.x1/11.1/13.1.

#### 17.4 — Use models without proof of understanding

Exact location: [docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md:56](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L56). The quoted question is verbatim with line wrapping normalized.

> Should an otherwise fully tested assistant remain available even though we can prove what background it received but cannot prove that it understood that background?

**DECIDED-BY — [Purpose](../../docs/00-the-purpose.md): wisdom; verification is a mechanism; [R3](../../docs/01-the-rules.md#L329), [R38](../../docs/01-the-rules.md#L275), [R58](../../docs/01-the-rules.md#L237).** Allow properly grounded, tested and reviewed model work with the understanding limit disclosed and outcomes graded.

The purpose explicitly says wisdom cannot be conferred by a rule; an impossible proof of comprehension is not the constitutional activation bar.

#### 17.5 — Provider conversation loss with durable local recovery

Exact location: [docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md:73](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L73). The quoted question is verbatim with line wrapping normalized.

> Should a tested setup remain available when the provider may lose its saved conversation, provided our durable work and current history remain available for a replacement?

**CANDIDATE AMENDMENT — [CA-11](#ca-11), provider-retention clause.** Proposed answer: permit a tested mode despite possible loss of the provider's saved conversation, accepting a slower fresh start when authoritative durable work and full recoverable current history survive and the replacement re-grounds.

R47/68/96 require preservation and grounding; they do not choose this residual-risk policy over requiring a provider's permanent-retention promise. The recovery implementation and its tests are AGENT'S within the adopted policy.

#### 17.6 — Named machines and trusted administrators

Exact location: [docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md:91](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L91). The quoted question is verbatim with line wrapping normalized.

> Should we allow fully safeguarded work only on computers named in an approved deployment proposal with their responsible administrator identified, or leave it disabled everywhere?

**CANDIDATE AMENDMENT — [CA-01](#ca-01).** Proposed answer: admit safeguarded work only on concrete approved machine/administrator trust records, with no machines enabled by the abstract policy alone.

This is acceptance of external administrative power, not a claim that the adapter can prevent host-root compromise.

#### 17.7 — Paid service with delayed final bill and enforced cap

Exact location: [docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md:112](../../docs/17-harness-adapters/14-operator-decisions-and-honest-limits.md#L112). The quoted question is verbatim with line wrapping normalized.

> Should a paid service remain available when its final charge cannot be seen promptly, but the company charging us enforces a cap on the total possible charge?

**CANDIDATE AMENDMENT — [CA-11](#ca-11), delayed-settlement clause.** Proposed answer: offer a capped paid mode despite delayed final billing, accepting the bounded charge uncertainty and unavailable reserved budget while maximum possible exposure remains reserved.

A provider-enforced cap, existing spend authority and explicit first arming are inherited requirements, not acceptance of the billing residual. R4/18/60/75 and decision-sheet ruling 20 do not select offering this mode over disabling it. Keep no uncertain repetition and no premature reservation release; arming and residual acceptance are distinct approval subjects.

#### 17.x1 — Supported harness-mode product scope and confinement cost

Exact location: [docs/17-harness-adapters.md:5](../../docs/17-harness-adapters.md#L5). The quoted question is verbatim with line wrapping normalized.

> No automatic check decides whether the supported modes are useful enough or whether their confinement cost is acceptable; the operator retains those judgments.

**CANDIDATE AMENDMENT — [CA-11](#ca-11), supported-mode/confinement-cost clause.** Proposed answer: accept the supported modes that prove their exact grounding, confinement, observation and recovery contracts within approved deployment resource budgets, including their measured isolation/observation overhead and scoped loss of availability when that proof fails. Retain unsupported modes as unavailable and cost-over-budget modes pending their own budget decision.

The approved B §10 harness family already includes Instar Native, Codex, Claude Code, Gemini, Grok Build and future runtimes; implementation order and equivalent process drivers are AGENT'S. This candidate accepts the usefulness/cost trade for qualifying modes; it neither narrows the roster nor treats a vendor name as an answer to a mode question. Provider-history loss and delayed settlement have separate explicit CA-11 clauses.

### Document 18 — Part 14: Sentinel holders

Coverage: [18-sentinel-holders.md](../../docs/18-sentinel-holders.md), [01-ownership-and-boundaries.md](../../docs/18-sentinel-holders/01-ownership-and-boundaries.md), [02-the-registered-holder-family.md](../../docs/18-sentinel-holders/02-the-registered-holder-family.md), [03-fresh-proof-and-the-four-state-package-view.md](../../docs/18-sentinel-holders/03-fresh-proof-and-the-four-state-package-view.md), [04-the-silently-stopped-matrix.md](../../docs/18-sentinel-holders/04-the-silently-stopped-matrix.md), [05-context-wedges-and-compaction-continuity.md](../../docs/18-sentinel-holders/05-context-wedges-and-compaction-continuity.md), [06-presence-promises-and-crash-loops.md](../../docs/18-sentinel-holders/06-presence-promises-and-crash-loops.md), [07-session-watchdogs-and-reapers.md](../../docs/18-sentinel-holders/07-session-watchdogs-and-reapers.md), [08-every-recovery-enters-the-effect-doorway.md](../../docs/18-sentinel-holders/08-every-recovery-enters-the-effect-doorway.md), [09-the-guard-posture-tripwire-and-watcher-independence.md](../../docs/18-sentinel-holders/09-the-guard-posture-tripwire-and-watcher-independence.md), [10-what-instar-1-x-does-today-and-what-carries-forward.md](../../docs/18-sentinel-holders/10-what-instar-1-x-does-today-and-what-carries-forward.md), [11-behavioral-seams-and-shared-failure-traces.md](../../docs/18-sentinel-holders/11-behavioral-seams-and-shared-failure-traces.md), [12-non-functional-checks-and-activation.md](../../docs/18-sentinel-holders/12-non-functional-checks-and-activation.md), [13-negative-contract-fixtures.md](../../docs/18-sentinel-holders/13-negative-contract-fixtures.md), [14-inherited-duties-and-disposition.md](../../docs/18-sentinel-holders/14-inherited-duties-and-disposition.md), [15-operator-decisions-and-honest-limits.md](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md).

#### 18.1 — Length of watch-only safety trials

Exact location: [docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md:3](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L3). The quoted question is verbatim with line wrapping normalized.

> How long may a safety feature watch and report without acting before it must be turned on or rolled back?

**CANDIDATE AMENDMENT — [CA-17](#ca-17).** Proposed answer: permit individually approved watch-only safety trials with feature-specific deadlines under a system-wide maximum of seven elapsed days from trial start, subject to any earlier governing gap deadline. This accepts a disclosed interval without automatic protection; it is not merely timer tuning.

**AGENT'S — purpose sequencing/technical correctness:** inside an actually accepted trial, set the shorter evidence-based schedule, measure it and graduate or roll back by the approved deadline. The proposed maximum does not approve any trial or call watch-only protection live; existing stronger enforcement and required user-facing fixes remain governed by their current rules.

#### 18.2 — Recovery classes that may act automatically

Exact location: [docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md:15](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L15). The quoted question is verbatim with line wrapping normalized.

> Which kinds of recovery may happen without asking for approval each time?

**CANDIDATE AMENDMENT — [CA-19](#ca-19).** Proposed answer: choose individually approved reversible, low-risk recovery kinds after their watch-only trials and failure review as the initial automatic-authority policy. Each grant names actions, scope and restart coverage; no new class receives authority merely from passing tests.

**DECIDED-BY floor — purpose constraint 5 and R18/23/57/98/104:** existing live grants may be exercised within their tested floors without redundant approvals. That floor does not choose which new recovery classes the operator should authorize. New irreversible or permission-changing restart authority is outside this initial grant default and needs a separate explicit operator decision under CA-19.

#### 18.3 — Hourly limit on failed-repair notifications

Exact location: [docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md:27](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L27). The quoted question is verbatim with line wrapping normalized.

> After self-repair fails, how many action-needed or result messages should the system be allowed to send?

**CANDIDATE AMENDMENT — [CA-18](#ca-18).** Proposed answer: choose one grouped action-needed/result notice per incident under the same two-notice rolling-hour ceiling used for uncertain delivery, with overflow and unchanged uncertainty retained on the alerts/pull surface.

This selects interruption versus pull-only and the finite ceiling, both operator policy. R52/53/54/87/88 supply constraints but not that selection. Formatting, coalescer implementation and tuning inside an adopted ceiling remain AGENT'S; repeating unchanged daily status does not qualify merely because it is grouped.

#### 18.4 — Per-machine timing and automatic-action limits

Exact location: [docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md:39](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L39). The quoted question is verbatim with line wrapping normalized.

> Should timing and automatic-action limits be the same everywhere or tuned after real measurements on each kind of machine?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R31](../../docs/01-the-rules.md#L270), [R39](../../docs/01-the-rules.md#L276), [R55](../../docs/01-the-rules.md#L236), [R60](../../docs/01-the-rules.md#L238).** Tune timing and action limits for measured machine/installation classes beneath the common authorized safety ceilings.

A slow machine is not evidence of a stall until its actual workload and capacity are considered; tuning does not expand the action set.

#### 18.5 — Additional readers of full process inventory

Exact location: [docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md:51](../../docs/18-sentinel-holders/15-operator-decisions-and-honest-limits.md#L51). The quoted question is verbatim with line wrapping normalized.

> Beyond the three protections that require it, which additional protections may read the computer's complete list of running programs?

**CANDIDATE AMENDMENT — [CA-13](#ca-13).** Proposed answer: authorize the stuck-session watcher and idle-session cleanup as the only additional full-inventory consumers, with scoped read capability and no implied kill authority.

Wisdom asks whether sharing or withholding is costly, but supplies no specific observation grant or reader list; naming two readers is a policy proposal, not an inference from needing context.

### Document 19 — Part 15: Scheduled work

Coverage: [19-scheduled-work.md](../../docs/19-scheduled-work.md), [01-ownership-and-boundaries.md](../../docs/19-scheduled-work/01-ownership-and-boundaries.md), [02-declarative-job-packages.md](../../docs/19-scheduled-work/02-declarative-job-packages.md), [03-occurrences-durable-runs-and-exactly-once-scheduling.md](../../docs/19-scheduled-work/03-occurrences-durable-runs-and-exactly-once-scheduling.md), [04-quota-aware-admission-placement-and-concurrency.md](../../docs/19-scheduled-work/04-quota-aware-admission-placement-and-concurrency.md), [05-execution-gates-and-supervision.md](../../docs/19-scheduled-work/05-execution-gates-and-supervision.md), [06-recovery-crash-loop-control-and-honest-reporting.md](../../docs/19-scheduled-work/06-recovery-crash-loop-control-and-honest-reporting.md), [07-what-instar-1-x-does-today-and-what-carries-forward.md](../../docs/19-scheduled-work/07-what-instar-1-x-does-today-and-what-carries-forward.md), [08-non-functional-checks-and-activation.md](../../docs/19-scheduled-work/08-non-functional-checks-and-activation.md), [09-negative-contract-fixtures.md](../../docs/19-scheduled-work/09-negative-contract-fixtures.md), [10-inherited-duties-and-disposition.md](../../docs/19-scheduled-work/10-inherited-duties-and-disposition.md), [11-operator-decisions-and-honest-limits.md](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md).

#### 19.1 — Missed scheduled work default

Exact location: [docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md:3](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L3). The quoted question is verbatim with line wrapping normalized.

> When a repeating job misses several scheduled times, should it run once for the newest missed time or run none of them?

**CANDIDATE AMENDMENT — [CA-14](#ca-14).** Proposed answer: admit only the newest missed maintenance/observation occurrence, provided the job is not time-sensitive and that occurrence is inside its explicitly declared usefulness window. Missing window means no catch-up. Time-sensitive work (even in-window or also maintenance) and otherwise unclassified work default to no catch-up; a different policy must be explicit before admission.

R93 preserves directives and R46 accepted intake, but neither selects a missed opportunity. Every missed instant retains its disposition, and skipping never closes accepted unfinished work. CA-14 supplies exhaustive precedence and window defaults.

#### 19.2 — Repeated local clock time

Exact location: [docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md:16](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L16). The quoted question is verbatim with line wrapping normalized.

> When a local clock repeats the same time during a seasonal clock change, should the job use the earlier occurrence, the later occurrence, or both?

**CANDIDATE AMENDMENT — [CA-15](#ca-15).** Proposed answer: use the earlier occurrence once by default, with an explicit job policy required for later or both.

Deterministic expansion is engineering; choosing the human meaning of a daily job at a repeated time is not settled by coherence.

#### 19.3 — Admission when provider quota is unknown

Exact location: [docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md:32](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L32). The quoted question is verbatim with line wrapping normalized.

> When the system cannot see how much model usage remains, which new jobs should wait?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R15](../../docs/01-the-rules.md#L260), [R26](../../docs/01-the-rules.md#L266), [R60](../../docs/01-the-rules.md#L238), [R75](../../docs/01-the-rules.md#L225), [R95](../../docs/01-the-rules.md#L303).** Pause low-priority new model work and admit higher priorities only inside independently confirmed bounded allowances and the protected reachability reserve.

Use the proposed conservative admission profile as unmeasured tuning; local usage is not remaining provider quota and cannot create a budget.

#### 19.4 — Maintenance share and urgent-start delay

Exact location: [docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md:49](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L49). The quoted question is verbatim with line wrapping normalized.

> Under sustained heavy demand, what share of job starts should maintenance receive, and how long may ready urgent work wait for its turn?

**CANDIDATE AMENDMENT — [CA-20](#ca-20).** Proposed answer: select the service objective of at least 20 maintenance starts in every 100 eligible start credits after protected reserves, and at most 60 seconds waiting for continuously ready urgent work. The original denominator and readiness predicate are preserved in CA-20.

The choice among 10/100–30 seconds, 20/100–60 seconds and 25/100–120 seconds is a product service trade, not merely a measured tuning profile. Algorithms and feasibility measurement are AGENT'S; an adopted objective remains a target until real evidence supports the corresponding live guarantee.

#### 19.5 — Bounded automatic half-open trial versus human restart

Exact location: [docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md:73](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L73). The quoted question is verbatim with line wrapping normalized.

> After repeated failures automatically pause a job, should it try one small test after a cool-down or wait for a person to restart it?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; R23/55/60/61/88; [CA-19](#ca-19) for new recovery/retry authority.** Choose one bounded half-open trial after cooldown for a paused job when its existing recovery/retry grant explicitly covers that restart and the current effect checks pass; otherwise preserve the paused work pending the required authorization. Measure that strategy and its failure cuts; the breaker rules do not uniquely require exactly one trial.

The original class-policy question is separately answered by CA-19: new automatic grants initially cover individually approved reversible, low-risk kinds, with irreversible or permission-changing restarts requiring separately explicit authority. Consequential does not automatically mean a fresh prompt, and it does not automatically mean retry-authorized. No repeated action may bypass unresolved-outcome checks.

#### 19.6 — Direct legacy job import support window

Exact location: [docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md:91](../../docs/19-scheduled-work/11-operator-decisions-and-honest-limits.md#L91). The quoted question is verbatim with line wrapping normalized.

> For how many published updates should Instar support bringing job definitions directly from an old installation into the new scheduler?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): sequencing and technical correctness; [R44](../../docs/01-the-rules.md#L214), [R45](../../docs/01-the-rules.md#L280), [R78](../../docs/01-the-rules.md#L242), [R90](../../docs/01-the-rules.md#L299).** Use two published updates of direct import as the proposed implementation window while retaining an automatic tested lossless intermediate-upgrade path and readable history for older installs.

The window is replaceable compatibility engineering; migration parity forbids stranding old installations or making the user reconstruct their jobs.

### Document 20 — Part 16: Measurement ledgers

Coverage: [20-measurement-ledgers.md](../../docs/20-measurement-ledgers.md), [01-ownership-and-boundaries.md](../../docs/20-measurement-ledgers/01-ownership-and-boundaries.md), [02-vocabulary-and-the-registered-measurement-plane.md](../../docs/20-measurement-ledgers/02-vocabulary-and-the-registered-measurement-plane.md), [03-model-call-census-tokens-and-attribution.md](../../docs/20-measurement-ledgers/03-model-call-census-tokens-and-attribution.md), [04-price-manifests-settlement-and-spend-views.md](../../docs/20-measurement-ledgers/04-price-manifests-settlement-and-spend-views.md), [05-quota-observations.md](../../docs/20-measurement-ledgers/05-quota-observations.md), [06-cpu-memory-and-process-footprint.md](../../docs/20-measurement-ledgers/06-cpu-memory-and-process-footprint.md), [07-feature-benchmark-and-burn-joins.md](../../docs/20-measurement-ledgers/07-feature-benchmark-and-burn-joins.md), [08-spend-caps-and-freeze-through-the-effect-doorway.md](../../docs/20-measurement-ledgers/08-spend-caps-and-freeze-through-the-effect-doorway.md), [09-retention-reconstruction-and-multiple-machines.md](../../docs/20-measurement-ledgers/09-retention-reconstruction-and-multiple-machines.md), [10-holders-runs-loops-and-surfaces.md](../../docs/20-measurement-ledgers/10-holders-runs-loops-and-surfaces.md), [11-what-instar-1-x-does-today-and-what-carries-forward.md](../../docs/20-measurement-ledgers/11-what-instar-1-x-does-today-and-what-carries-forward.md), [12-behavioral-seams-and-shared-failure-traces.md](../../docs/20-measurement-ledgers/12-behavioral-seams-and-shared-failure-traces.md), [13-non-functional-checks-and-activation.md](../../docs/20-measurement-ledgers/13-non-functional-checks-and-activation.md), [14-negative-contract-fixtures.md](../../docs/20-measurement-ledgers/14-negative-contract-fixtures.md), [15-inherited-duties-and-disposition.md](../../docs/20-measurement-ledgers/15-inherited-duties-and-disposition.md), [16-operator-decisions-and-honest-limits.md](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md).

#### 20.1 — 30/90/365-day detailed presentation

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:3](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L3). The quoted question is verbatim with line wrapping normalized.

> Should the detailed local history show 30 days, 90 days, or 365 days?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R7](../../docs/01-the-rules.md#L252), [R39](../../docs/01-the-rules.md#L276); section 9.** Start with the proposed 90-day bounded detailed presentation and retain full source facts for reconstruction, tuning query cost with real workloads.

This changes the everyday view, not raw evidence retention or permission to delete accounting facts.

#### 20.2 — Subscription allocation method

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:14](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L14). The quoted question is verbatim with line wrapping normalized.

> Should reports use only the existing active-day method, show an optional usage-share view beside it, or replace the active-day method with usage share?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R39](../../docs/01-the-rules.md#L276), [R75](../../docs/01-the-rules.md#L225).** Keep the corrected active-day accounting view and offer usage share only as a separately labelled planning allocation.

An allocation is not a provider bill, and changing view grain must not change the same population's cost; no real price or exchange-rate lookup is needed for this audit.

#### 20.3 — Native currencies and optional conversion

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:27](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L27). The quoted question is verbatim with line wrapping normalized.

> Should the main spend total keep each currency separate, or also show one converted total?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266).** Keep native-currency totals primary and allow a separate converted view only with its recorded rate source, date and uncertainty.

Different currencies cannot be silently added as though they measured the same subject.

#### 20.4 — Show tentative and ready-to-rely-on comparisons

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:36](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L36). The quoted question is verbatim with line wrapping normalized.

> Should the product show a clearly labelled early signal as well as a result that is ready to rely on, or wait until the stronger result is ready before showing anything?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R58](../../docs/01-the-rules.md#L237), [R107](../../docs/01-the-rules.md#L314).** Show both with explicit evidence tiers, reserving primary/published claims for independently adequate current evidence.

The display choice is delegated reporting design; presenting it to a person is user-facing and can be consequential under purpose revision 3, so applicable evidence requirements remain; approval does not turn ten cases or a configured confidence interval into an adequate benchmark.

#### 20.5 — Anomalous-spend thresholds

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:50](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L50). The quoted question is verbatim with line wrapping normalized.

> Should warning levels be the same everywhere, differ by feature, or be chosen for each installation after observing its normal activity?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; [R13](../../docs/01-the-rules.md#L258), [R39](../../docs/01-the-rules.md#L276), [R58](../../docs/01-the-rules.md#L237).** Use measured installation baselines with hysteresis and only justified feature exceptions, retaining an unmeasured status during baseline collection.

The numerical warning levels do not create a spending cap or a permission to block outside the governed gate.

#### 20.6 — Unknown quota with local usage context

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:63](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L63). The quoted question is verbatim with line wrapping normalized.

> Should the main view show only “unknown,” or show “unknown” beside the locally observed usage total?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): technical correctness; wisdom; [R13](../../docs/01-the-rules.md#L258), [R26](../../docs/01-the-rules.md#L266), [R39](../../docs/01-the-rules.md#L276).** Show quota as unknown beside a separately labelled local usage total, without converting that total into remaining allowance.

This is measurement presentation: the constitutional floor forbids inventing provider quota, while the agent chooses to expose useful local context separately; wisdom alone does not prescribe a particular screen layout.

#### 20.7 — Complete signed history now or wait for storage redesign

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:74](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L74). The quoted question is verbatim with line wrapping normalized.

> Should the system keep complete signed history with bounded everyday views, or delay approval until a separate lossless storage redesign is approved?

**AGENT'S — [Purpose](../../docs/00-the-purpose.md): sequencing; constraint 2; [R7](../../docs/01-the-rules.md#L252), [R39](../../docs/01-the-rules.md#L276); [F2](../../docs/06-the-fact-envelope.changelog.json) decisions 1 and 6.** Proceed with complete signed history, bounded views and growth monitoring, keeping lossless storage optimization as measured follow-through.

The retention floor is already decided; delaying this implementation for a replaceable storage design is sequencing, not a new value decision.

#### 20.8 — Does a positive budget arm paid service

Exact location: [docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md:87](../../docs/20-measurement-ledgers/16-operator-decisions-and-honest-limits.md#L87). The quoted question is verbatim with line wrapping normalized.

> Should setting a spending budget also turn paid service on, or should turning it on be a separate action?

**ALREADY-ANSWERED — [H](../../docs/harvests/standards-and-registries-harvest.decisions.md) ruling 20 at line 27; [Purpose](../../docs/00-the-purpose.md): constraint 5, authority boundary.** Require an explicit first arming of the paid doorway; changing a cap alone does not supply that first authorization.

The decision sheet already records the operator's first-arming requirement. The current part-eight/ten designs lack that operation and sixteen says the choice is open, but absence of an implementation or a seam refusal is not a recorded repeal. This resolves a separate authorization subject, not a mandatory number of taps: an exact request could explicitly include both actions, and a later cap change may use an existing live arm within its scope. A fresh assembly readiness contract remains technical work, not something ruling 20 itself specifies.

### Document 21 — Part 17: No design present at the audited base

Checked the tracked tree at the exact base: `git ls-tree -r --name-only eac87b07f54b316e85db82a4b71ef40f205ad5a7 -- docs` contains no `docs/21*` paths; filesystem enumeration agrees. This is a missing requested input, not proof that Part Seventeen has no operator questions. The audit covers every supplied part that exists and makes no claim about an absent design.

## Consolidated candidate amendments

Each paragraph below is proposed text in the purpose document's Rule/Check or Value style. It supplies the missing decision rather than claiming that a broad pillar already selected the proposal. Adoption belongs to the operator and requires the corresponding downstream contracts to agree; recording this harvest grants none of these powers.

<a id="ca-01"></a>

### CA-01 — Independent administration and explicit deployment trust

Questions: 05.6b, 11.2, 13.2, 14.1, 15.1, 17.6.

**Rule — protection names the power it must trust.** Protected execution uses a small broker under an operator-controlled service or operating-system identity that the agent cannot administer, debug, impersonate, or replace. The operator accepts a concrete deployment record naming the machines, administrators, key and approval custodians, recovery procedure, and the consequences of losing the root; an abstract approval admits no unnamed machine. Authorized-administrator compromise and already-disclosed plaintext remain outside the prevention claim and remain visible. **Check:** every protected deployment resolves to that approved record and passes replacement, impersonation, key-loss and recovery tests; a missing or broken boundary reports the affected scope unprotected without closing independently admitted communication.

<a id="ca-02"></a>

### CA-02 — Active-tier retention, reconstruction and capacity admission

Questions: 06.x1, 11.1, 13.1.

**Rule — bounded payload retention names a storage tier, not a knowledge lifetime.** The big picture's bounded full-payload retention means the active readable tier and its caches. Before releasing that tier's source, move unique or pinned judgment and diagnostic evidence into a tested lossless archive with a durable locator and reconstruction manifest that can recover the complete credential-scrubbed input/output and its decision context. When no verified archive capacity is available, keep the evidence in place and refuse new affected capture admission at capacity; independently admitted communication and repair remain available. **Check:** age and capacity boundary tests reconstruct the complete record, verify archive bytes and required keys before source release, preserve unresolved pins, and prove bounded admission when either archive or reconstruction fails.

The new decision is this active-tier interpretation, reconstruction path and admission cost, reconciling B §5 with parts two, seven and nine. Coherence, complete relevant recall, constraint 2 and R7 already provide the no-loss floor; they are not another gap. The approved narrow operator tombstone exception remains intact with permanent envelopes, hashes and removal reasons, and visible unavailable evidence. Age alone remains unauthorized; 17.3 is DECIDED-BY and outside this candidate's gap coverage.


<a id="ca-03"></a>

### CA-03 — Recorded acceptance of chat steering exposure

Questions: 08.1.

**Rule — chat steering carries a disclosed and accepted exposure.** Subject to an operator-approved exercise split, a verified conversation binding may accept channel-attested steering of its previously approved work scope only with its platform-token compromise exposure recorded and accepted by the operator. Channel-attested exercise always excludes authority changes, new grants and approvals: it can select existing verified standing, never supply authority-conferring provenance. A verified binding change may change the previously approved work scope and its disclosed steering exposure, with a recovery plan; that change and every other authority-conferring act still require independent verified provenance. **Check:** pairing records the platform-wide set of affected bindings, tests a stolen-token actor against each bound scope and the invariant authority wall, and proves revocation and independent stop remain usable without trusting the compromised credential.

The new policy is acceptance of the disclosed token-compromise exposure. The exercise/authority split is not a configurable default; its bundle approval remains unresolved in 08.2 / CA-16.


<a id="ca-04"></a>

### CA-04 — Receipt audiences and organizational disclosure

Questions: 08.3b, 08.5, 16.2.

**Rule — a receipt does not disclose a relationship by accident.** The system preserves and drains input independently of whether it acknowledges the sender. On an open transport an unresolved stranger receives no unsolicited acknowledgment; in a group the default private receipt goes only to the verified bound person, and only where the platform proves that single-person audience. The requester does not learn an approver's identity merely by asking for approval. Other receipt audiences or organizational disclosures require recorded disclosure standing. **Check:** unknown, familiar-but-unbound and bound senders have separate fixtures; private-delivery failure never produces a public fallback, and every disclosed identity resolves to the recipient's disclosure basis.

<a id="ca-05"></a>

### CA-05 — Automatic candidate ceilings and recurrence-only presentation

Questions: 08.4a, 08.4b.

**Rule — automatic standing suggestions stay within the yes that generated them.** An automatically derived candidate proposes no actions or scope beyond the exact authorization from which it was derived. The default presentation surfaces that candidate only when the same classified need genuinely recurs within the proposed term, showing the recurrence evidence. An operator may deliberately request a grant earlier or request and explicitly approve a different, including broader, grant; the automatic suggestion ceiling does not cap that separate request. **Check:** first contact records a candidate without default presentation or issued standing; genuine recurrence presents it before a redundant ask; changed phrasing, aggregated approvals and repeated requests cannot enlarge the automatically suggested action set or scope; a deliberate different grant follows its own exact-content approval path.

R104's every-authorization candidate review and R98's explicit approval before issuance are inherited floors. The two new policies are the automatic candidate ceiling and recurrence-only default presentation; neither creates standing.


<a id="ca-06"></a>

### CA-06 — Durability floor for non-emergency irreversible effects

Questions: 12.1.

**Rule — a non-emergency irreversible act normally outlives one machine.** Before an effect that the agent cannot undo alone, excluding the separately authorized emergency stop, its required authorization and causal preparation have a local durable record and an acknowledged durable copy on one independently failing peer. A single-machine exception is a separately approved operation policy that states the permanent-loss risk and its scope; missing peers never select the exception automatically. The independently authorized emergency stop keeps its local durable fast path. **Check:** each operation resolves its classification to purpose revision 3, names its loss model and replica evidence, and undergoes crash tests removing the originating machine before and after dispatch; an unapproved or stale local-only exception refuses that effect while preserving admitted communication and repair.

This selects a replica count for non-emergency irreversible effects, which are consequential by the first purpose test. It does not extend the one-peer requirement to every consequential effect classified by the other three tests. Loss detection alone does not select this replica count or accept the local-loss exception.


<a id="ca-07"></a>

### CA-07 — Independent, accessible approval gesture

Questions: 15.2.

**Value — approval should be hard to impersonate and possible from a phone.** The default protected approval is an explicit action signed by a factor held on the operator's device and outside the agent's custody, bound to the exact request the operator sees. An accessible recovery route may use another independently verified factor with the same subject binding; it does not reduce approval to a secret the agent can read. The operator chooses the recovery custodian in the deployment record. This chooses the phishing and accessibility trade without pretending that one gesture can eliminate either risk. First paid-door arming and spend authority remain separately recorded approval subjects; changing the gesture erases neither requirement.

<a id="ca-08"></a>

### CA-08 — Thread-scoped Slack work with channel context

Questions: 16.3.

**Value — separate conversations keep their own commitments.** In Slack the thread is the default unit of work and authority; the channel supplies relevant background through an attributable handoff rather than making unrelated requests share one directive and approval trail. A deliberately channel-wide assignment is recorded as such with its scope and owner. The background handoff preserves source standing and provenance and never imports another thread's authority. This chooses a default interaction shape, not a claim that a thread is the only place coherent work can happen.

<a id="ca-09"></a>

### CA-09 — Personal-account communication grants

Questions: 16.4.

**Rule — a personal voice is a scoped loan.** Use of a human's personal messaging account begins with a recorded grant naming the account, recipients, channel and allowed actions. The default grant permits replies to received messages; initiating a new conversation is a separate named capability that the operator may include explicitly, and read-only access never implies either sending capability. Existing valid explicit grants retain their scope. **Check:** each personal-channel send resolves to the account's current grant, tests distinguish reply from initiation, and receiving a message or passing a platform test cannot widen that grant.

<a id="ca-10"></a>

### CA-10 — Internet-facing ingress by installation

Questions: 16.6.

**Rule — public ingress is a recorded installation choice.** An installation may expose an inbound conversation endpoint only within its recorded deployment standing, naming the public surface, custodian, capture-before-acknowledgment guarantee and recovery obligation. The framework does not expose every installation by default. Existing deployment standing explicitly covering that endpoint supplies the choice without a redundant fresh prompt. Where no such choice is recorded, an independently proved outgoing polling path keeps communication available; once the constraints are settled, choosing equivalent ingress mechanics is the agent's work. **Check:** activation verifies the exact ingress grant and custody evidence, and missing public permission selects only an admitted non-public path rather than abandoning the user.

<a id="ca-11"></a>

### CA-11 — Supported-mode costs and residual-risk acceptance

Questions: 17.x1, 17.5, 17.7.

**Value — supported modes earn their cost within the approved family.** Accept the usefulness and measured confinement/observation overhead of modes that prove their exact grounding, output-verification, confinement, observation and recovery contracts within already approved deployment resource budgets. Accept the scoped availability cost of refusing a mode while its proof is absent; do not relax its contract to reduce that cost. A mode exceeding those budgets remains unavailable pending its own budget decision. Exact tuple activation evidence is still required; this policy alone activates no mode or host.

**Value — provider conversation retention need not be permanent.** Permit a tested mode even if the provider can lose its saved conversation, provided authoritative durable work and complete recoverable current history survive and the replacement re-grounds. Accept the possible slower fresh start and restoration interruption rather than require a provider's forever-retention promise. The replacement mechanism and tests are delegated engineering; recoverable local history alone did not decide to accept this residual.

**Value — capped delayed settlement is an accepted mode.** Permit a paid mode whose provider enforces a cap on the total possible charge even when final billing is delayed. Accept that bounded billing uncertainty and the resulting unavailable budget while maximum still-possible exposure remains reserved. Existing spend authority, explicit first arming, no uncertain repetition and no premature reservation release remain mandatory; a cap supplies none of those permissions. Acceptance of the delayed-billing residual is a distinct subject from first arming and a spend ceiling.

B §10 / approved PR #12 already names the conversation family and the wider harness family: Instar Native, Codex, Claude Code, Gemini, Grok Build and future runtimes. This candidate preserves that roster. Which implementations prove first and which conforming process drivers they use remain AGENT'S sequencing/technical correctness. Family retirement or narrowing would be an explicit change to an approved choice, not an undiscovered gap.


<a id="ca-13"></a>

### CA-13 — Additional process-inventory consumers

Questions: 18.5.

**Rule — broad observation is a named capability.** Beyond the three required orphaned-work, process-population and unused-worktree consumers, the stuck-session watcher and idle-session cleanup may read the full current process inventory for their registered recovery decisions. No other holder receives it by family membership, and read permission grants no power to signal or stop a process. New readers require a separate scope change showing why narrower observations are insufficient. **Check:** the inventory service enumerates the five consumers, verifies their scoped read grants, exercises denied readers and stale or incomplete snapshots, and independently rechecks action-time authority for every resulting process effect.

<a id="ca-14"></a>

### CA-14 — Exhaustive missed-occurrence defaults

Questions: 19.1.

**Rule — catch-up selects an occurrence before admitting it.** Unless an explicit job policy already chooses otherwise, apply these defaults in order: time-sensitive sends or actions get no catch-up, even inside a usefulness window or when also maintenance/observation; otherwise maintenance/observation jobs select only the newest missed occurrence and admit it once only if it is still inside an explicitly declared usefulness window measured from that occurrence's due instant to catch-up admission; otherwise unclassified jobs get no catch-up. A missing usefulness window means no catch-up. If the newest occurrence has expired, skip it and all older occurrences; do not search backward for another. A different catch-up policy must be explicit before admission and remain within standing and resource limits. **Check:** restart/outage fixtures cover each class, overlapping classes, inside/exact-end/outside-window cases (admission must be strictly before the window ends), missing windows, expired newest occurrences, and explicit overrides; they enumerate every missed instant and prove only the selected bounded admission occurs.

Every missed instant retains its honest disposition. Skipping an opportunity never closes an accepted run, promise or directive: R46/93 already require that preservation, independently of this new catch-up choice.


<a id="ca-15"></a>

### CA-15 — Repeated civil time default

Questions: 19.2.

**Value — a daily promise normally happens once.** When a recurring local time occurs twice because the clock moves backward, the default schedule chooses the earlier occurrence once. A job that means the later instant or both records that choice explicitly before activation. This is a choice about what a person's calendar instruction usually means, not a fact derived from clock arithmetic; both the chosen time-zone data and the choice remain in the durable schedule history.

<a id="ca-16"></a>

### CA-16 — Atomic adoption of the five intake amendments

Questions: 08.2.

**Value — the intake exercise and declaration changes are one adoption subject.** Propose operator adoption of the exact five-item bundle quoted in 08.2: the authority-conferring/directive exercise split in Part One; the bound-operator glossary clause; parser `authenticationClass`, `eventIdAuthority` and `ackPolicy`; parsers as a profile-declaring glossary kind; and the blocking-site `enforces` companion row. Use the reviewed bundle content at PR #18 landing `d532ec9d046e780ccfe76b98ab366253c51e0e35` as the proposal locator, with its affected artifact digests and current base bound in the approval request. Striking any item returns the whole bundle to review. The verified-provenance wall for authority-conferring acts always holds; attestation selects only existing verified bindings.

No operator approval covering this bundle is established by the cited F4 draft/review or F1 revision 7 record. The landing is not consent. Adoption stays unresolved until an exact operator-approved record is supplied or this concrete proposal receives its own approval; downstream compatibility review must bind the content actually proposed at that time. CA-03 separately proposes acceptance of token-compromise exposure.

<a id="ca-17"></a>

### CA-17 — Semantic-gap ceiling and bounded watch-only trials

Questions: 09.2, 18.1.

**Value — unprotected intervals have explicit governing limits.** Propose 2026-10-05 at 00:00 UTC as the calendar ceiling for the Part Five semantic holding gaps named in its section 12. Separately, permit individually approved watch-only trials for new safety capabilities, each with a feature-specific deadline under a system-wide maximum of seven elapsed days from its first watch-only admission, or an earlier governing gap deadline, whichever is sooner. The operator accepts the named unprotected scope and interval before that trial; a restart, replacement or re-label does not reset its clock. At the deadline, graduate only with the required proof or roll back the trial, leaving the unheld duty and required repair visible under the governing gap rules. Neither rollback nor this maximum extends an existing deadline.

These are proposed governing values, not approval of any gap or feature trial. Existing enforcement is not removed to create a trial, and R76's live-by-default user-facing fixes are not reclassified as risky new capabilities. The agent sets shorter schedules, graph/retry limits and measurements within actual accepted trials and resource authority. A visible watch-only feature is never claimed as active protection.

<a id="ca-18"></a>

### CA-18 — Initial failed-repair and uncertain-delivery attention policy

Questions: 16.7, 18.3.

**Value — request incident attention promptly but finitely.** After self-repair has failed and any required bounded delivery observation has ended without resolution, select one immediate grouped action-needed or result notice per incident, with at most two such pushed notices in any rolling 60 minutes per operator across these two incident families and all machines/channels. Aggregate incidents that compete for a slot; count a grouped delivery as one notice and record each covered incident as notified. If no slot is available, preserve overflow on the pull surface and reconsider it when a slot opens, only while it still independently qualifies as action-needed or a result. Route pushes to the existing alerts destination. No repeated notice or daily digest is sent merely because uncertainty remains unchanged; the pull surface continues to show that uncertainty and its owner.

R52/53/54/87/88 continue to govern eligibility, aggregation, routing and failed-self-heal evidence. This selects push over pull-only and the two-per-hour ceiling; those rules did not select it. Formatting, coalescer implementation and tuning beneath an adopted ceiling are the agent's, while raising the ceiling or changing this attention policy needs operator adoption. Notification effects remain consequential and user-facing under purpose revision 3, with the applicable doorway, supervision and proof duties.

<a id="ca-19"></a>

### CA-19 — Individually approved initial recovery classes

Questions: 18.2; 19.5's new-class/retry-authority boundary (its in-grant strategy remains AGENT'S).

**Value — initial automatic recovery grants grow one evidenced kind at a time.** Choose individually approved reversible, low-risk recovery kinds after their watch-only trials and failure review. Each actual operator-issued grant names the allowed actions, scope, limits and whether it covers restart/half-open retries after a breaker pause. A passed trial, test suite or abstract policy grants no class any authority. New irreversible or permission-changing recovery/restart kinds are excluded from this initial grant default and require a separate explicit operator authority decision with their own scope and evidence. Existing live grants retain their exact coverage; do not add redundant approval to work already covered.

Within a recorded restart/retry grant, the agent may choose and test one bounded half-open trial after cooldown through the normal effect and uncertainty checks. Consequential classification alone neither confers retry authority nor demands a fresh permission prompt; actual grant coverage decides that boundary. This proposal authorizes no new recovery effect by itself.

<a id="ca-20"></a>

### CA-20 — Maintenance share and ready-urgent service objective

Questions: 19.4.

**Value — upkeep and ready urgent work share an explicit service target.** Under sustained heavy demand with eligible maintenance waiting, choose at least 20 maintenance starts in every 100 start credits after separate emergency, stop, diagnosis and repair reserves are protected. Each due occurrence consumes exactly one scheduling credit when accepted to start; subsequent steps consume no additional scheduling credits and still obey their own resource limits. Ready urgent work waits at most 60 seconds for its turn: ready means it has passed every current permission, safety, capability, placement and available-capacity check and waits only for scheduling. Measure the wait while that readiness continuously holds; a real lost prerequisite is recorded separately, never relabelled to hide scheduler delay.

This selects the source's 20/100–60-second trade over its other service promises. The agent chooses algorithms and measures feasibility without spending protected reserves or widening resource authority. Adoption establishes a target, not a live guarantee: only actual evidence can establish that the implementation meets it, and a miss remains a miss requiring repair rather than silently lowering the objective.

## Prior answer needing downstream reconciliation, not a new amendment

**20.8 — paid-door arming.** The approved decision sheet's ruling 20 requires a first arming act. Part sixteen's section 16 and sections 8/11/13 say the paid-door choice is open because parts eight and ten do not supply the arm/readiness contracts. Those are distinct claims: an absent or refused implementation seam does not repeal an operator ruling. Carry the explicit first-arming answer forward; add the necessary governed owner contracts and real production wiring before claiming support. The audit does not treat the 1.x helper as proof of production enforcement, and does not infer that the ruling mandates a particular readiness API or repeated arming for every cap adjustment.

## Validation record

Repair 1 validation: `node scripts/check-governed-docs.mjs docs` passed (23 governed bodies of 108 files scanned; 70 indexed section files covered). `git diff --check` passed. All 92 unchanged source quotations and locations, local links, matching table/detail dispositions, 19 candidate mappings, approved-commit ancestry and the 86-file/15,908-line coverage inventory passed their documentary checks. These checks validate document discipline, not constitutional convergence or adoption. This repair changes only this harvest; it introduces no code, runtime state, authority, deployment or installed-agent changes. The earlier harvest's test-suite result belongs to its earlier head and is not presented as a new execution here.

## Repair 1

Repaired findings F00–F19 from `CONVERGED — NO` in `.instar/lanes/astra-decisions-sweep-review-64f78366.md`, the independent Astra verdict on `64f78366739365df03ad0b2243191dc4793fe72e` / PR #73. Audited base after merging main: `eac87b07f54b316e85db82a4b71ef40f205ad5a7`. All 92 dispositions were re-audited against purpose revisions 1–3. Kept CA-01/04/07/08/09/10/13/15; reworded CA-02/03/05/06/11/14; dropped CA-12 as **a proposal to change rule 96, outside this sweep**. CA-16–20 record the additional genuine policy gaps required by the verdict. Counts: 10 DECIDED-BY, 26 AGENT'S, 33 CANDIDATE AMENDMENT, 23 ALREADY-ANSWERED; 19 consolidated candidates. None is adopted by this harvest, and this repair does not claim independent convergence.
