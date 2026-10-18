# Sentinel holders

`unanswered-turn.ts` classifies a turn that received no answer (held, failed, limit, pending) so the Stage 1 driver can report it honestly. Design: `docs/18-sentinel-holders.md`.

`presence.ts` is the presence sentinel's pure decision (Part 18 §6): an admitted operator message unanswered past its threshold gets one self-heal request first, and a holding note is marked due only if it is still unanswered after that and its cause can be stated truthfully; anything else is signal only.

`promise.ts` is the promise sentinel's pure decision (Part 18 §6): an open agent-owned promise past its absolute due instant with no definite work result gets one request for the owner's bounded step, then a pull-visible report if it stays unacted; a promise waiting on the operator or an outside party is reported as waiting.

The live journal runner (`tests/preview/journal-agent.mjs`) runs both, with the context sentinel from `src/awareness/sentinel.ts`, on its own cycle through `tests/preview/live-sentinels.ts`; each decision is a `sentinel` journal row (`tests/preview/sentinel-record.ts`) read back by `status`. `--sentinels none` (or a comma subset of `context,presence,promise`) is the off-switch.
