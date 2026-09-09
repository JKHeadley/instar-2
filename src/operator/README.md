# Part Eleven operator surfaces

This package is the Part Eleven consumer layer. It defines no constitutional, authorization,
binding, delivery, verification, projection, or session-liveness type. It consumes Part One
values and the public ports of Parts Two, Four, Nine, and Ten.

`createOperatorSurface` renders only from a Part Two-issued current snapshot, validates the
durable Part Four request kind and every referenced dependency, fixes approve/decline first,
keeps requester prose in a labelled untrusted region, and re-resolves the request immediately
before confirmation. A confirmation can complete only through an injected Part Four-owned
`admitVerifiedAct` operation, which re-resolves the exact signed request and owns the durable
disposition. The surface performs no parallel authority admission.

The six minimal-plane projection declarations are informational and cover every admitted kind.
Replay admission uses complete cold/warm deployment samples, includes failures, checks canonical
digest equality, and compares the observed maximum plus explicit margins to a finite budget.
The live-path evaluator distinguishes ordinary outages from loss of a required minimal dependency;
it never promises a response while replication, lease/fence, identity, route, or witness is absent.

Shared seam and failure-trace validators make retry/duplicate/cancellation/stale-authority behavior
one executable contract. The section-7 executable enters through Part Ten's production coordinator,
uses its returned Part Four-through-Nine handles, and displays the independently witnessed result.
Activation remains dark until an independently administered live phone verifier, semantic review,
objective mobile floor, and real platform/provider evidence exist.
