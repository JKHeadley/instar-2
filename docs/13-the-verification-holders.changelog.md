# Changelog — `13-the-verification-holders.md`

_Generated from `13-the-verification-holders.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 3 · 2026-09-19 · draft — M2 independent design review 1 check-reference cleanup

- **Point the installation-specific verifier-readiness rule to P10-SI-13 instead of colliding Part Nine check numbers.** — The behavior belongs to the fixed-installation predicates and must not reuse established debt and rebuild check identifiers. _(`f106575`)_

## Revision 2 · 2026-09-19 · draft — operator-directed M2 closure of the verifier binding and readiness join

- **Separate an installed verifier selection from current independently evidenced verifier readiness.** — Installation metadata cannot certify that its selected challenge service is independent, fresh, healthy, or replay-safe. _(`1b960e7`)_

## Revision 1 · 2026-09-05 · draft — verification holders, independent probes, and outcome grading

- **Initial Part Nine design.** — Define independent evidence holders and honest verification posture. _(`0a971ba47`)_
