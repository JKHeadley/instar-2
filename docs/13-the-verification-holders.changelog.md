# Changelog — `13-the-verification-holders.md`

_Generated from `13-the-verification-holders.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 5 · 2026-09-21 · draft — Astra blocked-build adjudication (astra-g6-blocked-adjudication.md, section (b)) correcting the M4 G6 supplement approved in PR 100: only Nine's owned bodies gain version 2; FactEnvelope.schemaVersion stays 1.

- **Give only VerificationPlan, VerificationRequest and VerificationAssessment owned-body schemaVersion 2 under unchanged FactEnvelope.schemaVersion 1 and the existing record-owned field schema.** — The family schema is unchanged, so one genuine owned-body registration accepts exact v1 and output-use v2 bodies without a FactContext migration; existing producers and signed v1 history remain intact. _(/Users/dabombstudio/.instar/agents/echo/.instar/lanes/astra-g6-blocked-adjudication.md section (b), Exact correction for the desk to record, item 1)_
- **Require outer schema 1 and independent validation of the original body version; refuse decoder-local legacy-settlement wrappers as raw input in both origin and historical modes.** — Wire body schema 2 requires output-use; the lossless internal adapter must not bypass exact wire validation or promote legacy occurrence evidence. _(/Users/dabombstudio/.instar/agents/echo/.instar/lanes/astra-g6-blocked-adjudication.md section (b), Exact correction for the desk to record, item 1)_

## Revision 4 · 2026-09-21 · draft — Nine exact-response output-use supplement from astra-m4-g6-nine-adjudication.md; base 9e17a00fe95440ef8fbe878dc2f0cd3cca2a47ec. Unstaged docs-first draft; desk owns merge and final implementation grants.

- **Define two exact output-use predicates, a closed response subject, three version-2 record variants, registered version/history handling and public derivation/current-consumption ports.** — Occurrence and structural answer decoding cannot establish the authenticity and completeness required by G6; preserve all four settlement rows and all v1 histories. _(/Users/dabombstudio/.instar/agents/echo/.instar/lanes/astra-m4-g6-nine-adjudication.md §§2–4,6; docs-first task on design-m4-nine-exact-response-assessment; base 9e17a00fe95440ef8fbe878dc2f0cd3cca2a47ec)_
- **Add P9-NF-64–66 and the shared response-use duty, with source-strength, freshness, version, conflict and restart obligations.** — Approval of a contract cannot be mistaken for runtime evidence or semantic answer quality. _(/Users/dabombstudio/.instar/agents/echo/.instar/lanes/astra-m4-g6-nine-adjudication.md §§2–4,6; docs-first task on design-m4-nine-exact-response-assessment; base 9e17a00fe95440ef8fbe878dc2f0cd3cca2a47ec)_

## Revision 3 · 2026-09-19 · draft — M2 independent design review 1 check-reference cleanup

- **Point the installation-specific verifier-readiness rule to P10-SI-13 instead of colliding Part Nine check numbers.** — The behavior belongs to the fixed-installation predicates and must not reuse established debt and rebuild check identifiers. _(`f106575`)_

## Revision 2 · 2026-09-19 · draft — operator-directed M2 closure of the verifier binding and readiness join

- **Separate an installed verifier selection from current independently evidenced verifier readiness.** — Installation metadata cannot certify that its selected challenge service is independent, fresh, healthy, or replay-safe. _(`1b960e7`)_

## Revision 1 · 2026-09-05 · draft — verification holders, independent probes, and outcome grading

- **Initial Part Nine design.** — Define independent evidence holders and honest verification posture. _(`0a971ba47`)_
