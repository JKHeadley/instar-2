# Changelog — `18-sentinel-holders.md`

_Generated from `18-sentinel-holders.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 4 · 2026-10-03 · draft — Unit w4-guidance Astra review repair (plan row #403, MUST-FIX 1): the guidance outcome measurement counted a send intent as a delivered correction. No constitution change.

- **Section 16's measurement rule: a sent landing counts only with the transport's receipt; a send with no receipt (crash, refusal, unknown outcome, or an older capture that kept none) is recorded as no receipt with its selection kept beside it, never as landed.** — The send record is written before dispatch, so a revision whose send failed or ended unknown was counted as a landed correction (Rules 26, 58). _(lanes/w4-guidance-PROGRESS.md (Pipeline repair); tests/preview/guidance.test.ts)_

## Revision 3 · 2026-10-03 · draft — Unit w4-guidance (plan rows #399/#403): the guidance sentinel family, on the operator's direction of 2026-10-03 (Justin, topic 102965, message 121996 at 10:15 and the 10:45 re-grounding: a powerful sentinel collection for guidance and empowerment). No constitution change.

- **New section 16, the guidance sentinel family: four members (tone and self-stop, deferral, claim verification, correction learning) ported in substance from Instar 1.x, each a named set of questions on the one pre-send reply review; two context questions (self_state_claim, breaks_preference) ride every full-context review and are never asked of Jev; a finding is a signal the agent answers; every member's verdict is projected from durable history; each member is proved on recorded live replies.** — The re-grounding audit (plan row #399) found Part 18 had no guidance sentinels; the reply review already held most of the 1.x self-stop and deferral questions but no claim verification or preference check, and nothing measured whether a correction reached the send. _(lanes/w4-guidance-PROGRESS.md; LIVE-PATH-PLAN.md rows #399 and #403; tests/preview/guidance.test.ts)_
- **Section 16 also states the named-claim landing rule (an elided, comma-ended or ellipsis-ended reviewer quote is located; a paraphrase is not) and the reply-only verdict wrapper.** — On the recorded live journal the 22:36 false cannot-do (update 969390016) and update 969390038 were reviewed and named, but the named sentence was never located, so the reply went unchanged. _(lanes/w4-guidance-PROGRESS.md; tests/preview/fixtures/guidance-live-2026-10-03.json)_
- **Section 13 gains fixtures P14-NF-70 to P14-NF-75; section 14 records the four 1.x mechanisms' disposition; the index and purpose name the family.** — Every new rule names executable checks with a positive neighbor, and every inherited duty has a disposition. _(lanes/w4-guidance-PROGRESS.md)_

## Revision 2 · 2026-09-28 · approved — Operator's standing direction in topic 52075 at 09:09 PDT 2026-09-28 ('For the 2.0 work the only thing I need to approve are changes to the constitution'): design parts need no separate operator approval; this part is approved as written.

- **Mark the design approved as written.** — Only changes to the constitution require the operator; design parts implement it and are approved on the operator's standing direction. _(topic-52075-2026-09-28T16:09Z)_

## Revision 1 · 2026-09-11 · draft — Initial design

- **Initial Part Fourteen design: the sentinel and watchdog holders.** — Define the registered holders that detect stopped work and recover through the effect doorway. _(d0692ad3)_
