# Part one implementation

Parent: docs/05-the-types.md; rules 1, 4, 13, 14, 26, 28, 29, 31, 33, 40, 42, 57,
69, 82, 90, 93, 94, 95, 96, 98, 100, 103, 104, 108, 109, 110, 113.

This package implements the constitutional values and their decoding boundary. Its public
entry is src/index.ts. Runtime code uses only the standard library's deterministic crypto
operations. Register generations, captures, authentication evidence, and clock measurements
are explicit inputs. Every schema is shared across machines.

## Decision journal

- The current build brief authorizes code despite the older README's documents-only status.
  The checked-out branch is impl-types and its remote is JKHeadley/instar-next. The local
  coherence warning is an absent topic binding; these independently checked paths match the brief.
- No scaffold existed. Added strict TypeScript, Vitest, a lockfile, and a CI contract job.
  Node's type declarations are a development dependency needed for standard-library crypto.
- All current schemas start at version 1; no historical serialized version is invented.
- Nominal brands and a package export boundary close ordinary TypeScript construction. Runtime
  authority contexts additionally require objects issued by this package. Deliberate unsafe
  casts are outside the compiler guarantee and are checked where authority enters decoding.
- Register and conversation-binding ownership stays with parts three and four. Consumer input
  ports describe the facts this package needs; they do not implement those parts' records.
- The design's evidence paragraph says refusal reason `stale`, but Result's closed list excludes
  it. Use `stale-base` with a specific evidence-expired detail, preserving the closed list.

## Side effects and undo

This adds an isolated library, tests, development tooling, and a CI job. It opens no runtime
files, connections, sessions, or timers. Integration work must supply the declared context
ports. Reverting the implementation commits restores the documents-only tree. The independent
review session owns review and convergence; passing these tests is a builder's verification.
