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

`explicit-yes.ts` shapes the smallest production explicit yes (policy P-02): the operator account replying `yes` to the request's own message in the bound chat (recorded with the message id), or, where a P-05 grant lets the agent speak through that chat account, an APPROVED review by the operator's GitHub account of the request's exact head, on a pull request naming the request (recorded with the review id). Each needs the P-02 record that the agent holds no access to that account, is used once, and must fall inside the request's lifetime. It is the single route that issues the sealed one-use `AccountAssentAdmission` (reference, record hash, request id and digest, authorization id); Part One decodes the record as an `account-assented` yes only under the `accountAuthenticatedAssent` declaration AND with that admission for the exact record and request in `DecodeContext.accountAssent`. The same record without it is channel-attested and authorizes nothing.
