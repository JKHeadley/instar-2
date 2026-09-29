# Part One decoding

The single decoding boundary: `decode.ts` checks every constitutional value (provenance, verified principals, grants, measurements) against its schema and invariants, and `canonical.ts` gives the one canonical byte encoding and hash. `framework.ts` lets later parts register owned decoders. Design: `docs/05-the-types.md` and `docs/06-the-fact-envelope.md`.
