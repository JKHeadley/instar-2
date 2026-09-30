# Part Three register

Generates the register of governed things from code-adjacent declarations (`*.declarations.json`, `*.parser.json`): decoding each declaration against the shape (`register-source/bootstrap-shape.json`), resolving references, rendering the rule book, glossary, capabilities and coverage, and the governance checks that pair declarations with the code that constructs them. The build adapter is `scripts/build-register.mjs`; the shipped-module inventory it checks is `scripts/register-inventory.mjs`. Design: `docs/02-the-register.md`, `docs/07-the-declarations.md`.

## Capabilities

- `register-tooling`: generates the register, rule book, glossary and this briefing from the declarations in code.
  Details: generates the register, rule book, glossary and this capability briefing from the declarations in code, and fails the build on an undeclared store, undocumented module, dangling rule reference or unused declared boundary.
