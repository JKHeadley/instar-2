## 5. Quota observations

**Rule — quota is a measurement, not a scheduler verdict.** Rules 13, 26, 41, 49, 69, 86 and 95;
**checks: P16-NF-21–23/35**. A quota adapter records what a provider exposed for one registered
account and window, with source, observation time, reset time, quantity semantics and freshness.
Missing files, corrupt responses, stale snapshots and providers with no advance-usage surface
remain distinct unknown states. Unknown is never coerced to 0% used, 100% available or a
placeable account. Repeated missing-state notices coalesce by episode so the instrument does not
drown the condition it is meant to expose.

**Rule — this package exports no `canRun`, `place`, `throttle` or `allow` decision.** Rules 4,
30, 41, 49 and 86; **checks: P16-NF-02/22/23/35/51**. Part six owns capacity admission, leases
and retry. Part eight owns any throttling, account change or refusal effect. Those owners may
consume their own registered current policy inputs and may display these observations as
evidence, but cannot import a part-sixteen projection as permission. A quota measurement failure
therefore degrades the view and opens verification work; it neither admits nor blocks a run.

---
