# Historical compatibility modules changed concurrent proof digests

Status: source repair submitted; full gate confirmation pending. No test quarantined.

The ae2b5848 Studio gate passed all executed tests but failed the Part Five
contract check on V93's current executed assertion evidence. Its assertion ledger
records V93 and V94 with the required three assertions, owner checkpoints and pass
states, but a source digest of
`51ea099c6c7dcb37c996efcbdd03b07f026a90aae45912e9c1ccffa496fea1a0`.
The other 409 records and the unchanged checkout have digest
`dc84cc6db5c46e69fb49a413436f9163c31624ff1be2f350873e38d432f7f99b`.

`renew-activation.test.ts` temporarily wrote historical provider and journal
modules beneath `src/assembly` and `tests/preview`. The concurrently running
source sampler correctly includes those directories. Its gate log places the
renewal tests next to the affected conformance file. The sampler's aggregate
digest does not identify individual files, so the exact transient bytes in that
run are not recoverable from its receipt alone. The sibling-file race is directly
reproduced by `historical-module.test.ts`; `restart-handoff-program.test.ts` had
the same unsafe placement for its frozen14 module.

Both tests now keep their historical modules in their existing temporary storage
and relocate static import/export specifiers to the original dependencies. The
historical implementation, dependency identities, refusal assertions and source
checker remain unchanged. Regression tests hold all four real historical modules
present while sampling the real checkout, and show that a sibling scratch file or
a changed source still changes the digest in an isolated fixture. No concurrency,
load burner, relaxed pin or ignored source path is needed.

Gate evidence: Studio `lanes/par-qual/sb-w4-rule106-auto-p2-ae2b5848/gate.log`
and the gate checkout's `round4b-artifacts/assertions.jsonl`. The full JSON report
exceeds the read-only Studio file API's 1 MiB limit; the desk owns rerunning the
full gate against the pushed repair. Until that run passes, this record makes no
whole-gate success claim. Rollback is the ordinary revert of the test repair.
