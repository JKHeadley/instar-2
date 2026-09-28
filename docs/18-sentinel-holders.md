**Status: approved. Governed.**

# Part fourteen — the sentinel and watchdog holders

**Value — purpose.** Instar should notice when durable work, its worker, or the machinery that
notices failures has stopped making truthful progress. It should prove that it looked, distinguish
a warning from authority, and take only bounded recovery actions whose effects are independently
observable. This part packages the 1.x sentinel and watchdog family as ordinary registered part-nine
holders. It gives that family no private power.

**Rule — reading convention and evidence discipline.** Rules 9, 13, 26, 41, 42, 43, 49, 59,
61, 69, 90, 91, 107 and 111; **checks: P14-NF-01/02/05/08/09/45/49/50**. Every normative claim in
this document is in a Rule block and names executable checks. Value blocks are proposals for the
operator to accept or reject. A configured file, enabled flag, timer, process, log pathname, session
label or component self-report is never proof that a holder ran or that protection passed. A
measurement records the named subject, hardware, workload, clock basis, eligible failures and actual
observations. A target, configured interval, estimate or successful-only percentile is not measured.

---

## Sections

This document is split into one file per section so each renders on GitHub and can take line comments. The files below, read in order, are the complete document.

1. [Ownership and boundaries](18-sentinel-holders/01-ownership-and-boundaries.md)
2. [The registered holder family](18-sentinel-holders/02-the-registered-holder-family.md)
3. [Fresh proof and the four-state package view](18-sentinel-holders/03-fresh-proof-and-the-four-state-package-view.md)
4. [The silently-stopped matrix](18-sentinel-holders/04-the-silently-stopped-matrix.md)
5. [Context wedges and compaction continuity](18-sentinel-holders/05-context-wedges-and-compaction-continuity.md)
6. [Presence, promises and crash loops](18-sentinel-holders/06-presence-promises-and-crash-loops.md)
7. [Session watchdogs and reapers](18-sentinel-holders/07-session-watchdogs-and-reapers.md)
8. [Every recovery enters the effect doorway](18-sentinel-holders/08-every-recovery-enters-the-effect-doorway.md)
9. [The guard-posture tripwire and watcher independence](18-sentinel-holders/09-the-guard-posture-tripwire-and-watcher-independence.md)
10. [What Instar 1.x does today and what carries forward](18-sentinel-holders/10-what-instar-1-x-does-today-and-what-carries-forward.md)
11. [Behavioral seams and shared failure traces](18-sentinel-holders/11-behavioral-seams-and-shared-failure-traces.md)
12. [Non-functional checks and activation](18-sentinel-holders/12-non-functional-checks-and-activation.md)
13. [Negative contract fixtures](18-sentinel-holders/13-negative-contract-fixtures.md)
14. [Inherited duties and disposition](18-sentinel-holders/14-inherited-duties-and-disposition.md)
15. [Operator decisions and honest limits](18-sentinel-holders/15-operator-decisions-and-honest-limits.md)
