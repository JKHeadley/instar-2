# Part Nine reference implementation

This module owns the ten verification payloads, their total decoders, holder and
probe runtime views, evidence assessment, retrospective/feedback/grade views,
retention admission, replica reconciliation, and the external protection broker
contract described by `docs/13-the-verification-holders.md`.

The support ports this module reads now exist: Part Five's admitted RunExit
read port (`readExit`, `src/rungraph/service.ts`), Part Six's durable fair-scan
cursor (`createBoundedDueScanPort`, `src/transport/authority.ts`) and Part
Seven's benchmark read port (`createJudgmentBenchmarkReadPort`,
`src/judgment/benchmark.ts`). Their existence does not mean a running
verification or review consumer calls them; no live runner does yet. The Part
One freshness endpoint convention also differs at the exact boundary. The source
therefore provides executable reference behavior and honest partial evidence,
not production activation or external OS isolation.

The current protected register owner-reference resolver admits only Parts Four
and Five. Until the filed resolver seam is owned and reviewed, the generated
register includes the governed document and protected source class, but no Part
Nine feature, probe or blocking-site declaration; it does not pretend that Part
Nine fixture/probe/decoder references resolve.

Nine only assesses evidence. `createEffectAssessmentPort` cannot settle an
effect, release a reservation, progress a run, or retry an operation. The
transactional protection broker requires independently administered Part Ten
journal and loader ports and otherwise reports `unprotected`.
