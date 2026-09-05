import { expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { createProgram } from '../../scripts/check-architecture.mjs';
const prelude = `
import { foldProjection } from '../src/projections/index.js';
import type { ProjectionDefinition, ProjectedView, ProjectionGeneration } from '../src/projections/index.js';
import type { FactStorePort, FactSchema } from '../src/facts/index.js';
declare const store: FactStorePort, view: ProjectedView, definition: ProjectionDefinition, generation: ProjectionGeneration, schema: FactSchema;
`;
const cases = {
  'P2-NF-15': ['store.update({});', 'store.read();'],
  'P2-NF-18': ['const field: FactSchema["fields"][string] = {kind:"secret"};', 'const field: FactSchema["fields"][string] = {kind:"constitutional",type:"SecretRef"};'],
  'P2-NF-19': ['const field: FactSchema["fields"][string] = {kind:"text"};', 'const field: FactSchema["fields"][string] = {kind:"text",maxLength:100};'],
  'P2-NF-46': ['view.values["authority"] = true;', 'const current = view.values["authority"];'],
  'P2-NF-49': ['const d: ProjectionDefinition = {...definition, fold: () => Date.now()};', 'const d: ProjectionDefinition = definition;'],
  'P2-NF-50': ['const g: ProjectionGeneration = {...generation, peerView: view};', 'const g: ProjectionGeneration = generation;'],
  'P2-NF-60': ['store.truncate();', 'store.read();'],
  'P2-NF-61': ['const s: FactSchema = {...schema,machineScope:"machine-local"};', 'const s: FactSchema = {...schema,machineScope:"shared"};'],
  'P2-NF-74': ['const d: ProjectionDefinition = {...definition,decisions:{note:{kind:"folds",identity:"id",value:"amount"}}};', 'const d: ProjectionDefinition = {...definition,decisions:{note:{kind:"folds",identity:"id",value:"amount",merge:"additive"}}};'],
} as const;
const sources = Object.fromEntries(Object.entries(cases).flatMap(([id, [bad, good]]) => [[`tests/virtual-${id}-bad.ts`, prelude + bad], [`tests/virtual-${id}-good.ts`, prelude + good]]));
const program = createProgram(sources), errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
for (const id of Object.keys(cases)) it(`${id} compiler rejects forbidden structure and accepts its positive counterpart`, () => {
  const at = (which: string) => errors.filter(d => d.file?.fileName === resolve(`tests/virtual-${id}-${which}.ts`));
  expect(at('bad')).not.toHaveLength(0); expect(at('good').map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});
