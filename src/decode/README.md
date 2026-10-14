# Part One decoding

The single decoding boundary: `decode.ts` checks every constitutional value (provenance, verified principals, grants, measurements) against its schema and invariants, and `canonical.ts` gives the one canonical byte encoding and hash. `framework.ts` lets later parts register owned decoders. Design: `docs/05-the-types.md` and `docs/06-the-fact-envelope.md`. `explicit-yes.ts` decides, in one place, what counts as an explicit yes behind an `Authorization`: a verified approval record, or an `account-assented` yes (an operator chat reply or operator-account review approval), a provenance class assigned only while its single declaration, `accountAuthenticatedAssent`, is enabled and the sealed admission of that exact record, which only `admitExplicitYes` issues and only after admitting the recorded request, the P-02 record, the reply/head relationship, the lifetime and one-use consumption (the raw constructor is not exported), is in `DecodeContext.accountAssent`; a record label alone stays `channel-attested`, and an `Authorization` refuses an admission that names another request; such a yes never produces a principal. It is enabled since the approval-gesture amendment (PR #139) landed.

Historical field reads reuse only the last verified origin frame's exact bytes
and public key. The private single-slot memo retains no standing: current key
registration and owner, capture hash/status, origin/path, body and causal history
are checked on every read. Changing bytes or key forces signature verification.

Canonical byte encoding validates and emits JSON in one walk; the mutable
snapshot boundary remains independent. The same depth, shape and data restrictions
hold, and schema-1 bytes remain pinned against the prior two-pass oracle.
