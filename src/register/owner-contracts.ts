// Source-resolution routes only. These documents/implementations belong to the
// named owners; this table grants neither approval nor runtime authority.
export const ownerDocuments = {
  'intake.contract': { owner: 'part-four', location: 'docs/08-the-intake.md', declarationPath: 'src/intake/port.declarations.json' },
  'rungraph.contract': { owner: 'part-five', location: 'docs/09-the-run-graph.md', declarationPath: 'src/rungraph/rungraph.declarations.json' },
} as const;
