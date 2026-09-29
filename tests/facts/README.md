# Fact envelope tests

Test suites for the fact envelope and store (Part Two). The fixture module here is also loaded at runtime by `tests/preview/agent.mjs` and `tests/preview/journal-agent.mjs`, so it is shipped code: the preview drivers build their stand-in owners from it (see `tests/preview/README.md`, stand-in ledger). Changes to it change the live preview.
