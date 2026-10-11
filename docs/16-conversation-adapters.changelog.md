# Changelog — `16-conversation-adapters.md`

_Generated from `16-conversation-adapters.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 3 · 2026-10-10 · draft — operator review on PR #157; Astra round 1, head 309cf8e22f305c5490d9220608497076c380d14c; docs-align-1010 round 2 repair.

- **Align P12-NF-52 with the three migration cases: preserve explicit opt-outs, refuse missing standing with the needed grant, and admit covered ordinary output without another opt-in.** — MF1: the fixture must agree with section 4 while retaining authority-inert imports, missing-payload/receipt holds and uncertain-send no-repeat. _(`309cf8e22`, lanes/astra-unit-docs-align-1010-review.r1.md; reviews/docs-align-1010-r2-change-review.md)_

## Revision 2 · 2026-10-10 · draft — Justin, docs-align-1010: align design parts with PR #154; final-head code-owner approval pending.

- **Replace blanket inherited send-disabled defaults with current onboarding grants and preserved explicit opt-outs; test ordinary covered output without another prompt.** — The purpose requires role-covered capabilities by default and reserves sign-off for its fixed list. _(`fc0e3c20`, docs/00-the-purpose.md; reviews/docs-align-1010-change-review.md)_

## Revision 1 · 2026-09-09 · draft — Initial conversation adapter design.

- **Initial design and indexed sections.** — Define conversation adapters under shared intake, effect and recovery owners. _(`6c25455e0`)_
