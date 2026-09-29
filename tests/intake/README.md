# Intake tests

Test suites for intake (Part Four). The fixture module here is also loaded at runtime by `tests/preview/agent.mjs`, so it is shipped code: the preview drivers build their stand-in owners from it (see `tests/preview/README.md`, stand-in ledger). Changes to it change the live preview. Its fixture fact segment is a durable store, declared in `fixtures.declarations.json`.
