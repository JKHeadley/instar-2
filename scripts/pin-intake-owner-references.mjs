// Owner-maintained derived pins, not an authority/approval producer. Run after
// changing a referenced artifact, commit sources, then regenerate via P3 replay.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { canonical, consumeResult } from '../dist/index.js';
const hash = path => consumeResult(canonical(readFileSync(path, 'utf8')), {
  Success: v => v.hash, Refused: r => { throw new Error(r.detail); },
});
const artifact = path => ({ path, hash: hash(path) });
const decoders = [
  ...['intakeDedupDefinition', 'intakeWorkRegistration', 'intakeStopRegistration', 'intakeVerifiedActRegistration'].map(id => [id, 'src/intake/index.ts', 'src/intake/records.ts']),
  ['readProjection', 'src/projections/index.ts', 'src/projections/fold.ts'],
  ['authorAndAppend', 'src/facts/index.ts', 'src/facts/store.ts'],
  ['decode:Provenance', 'src/index.ts', 'src/decode/decode.ts'],
  ['decode:VerifiedPrincipal', 'src/index.ts', 'src/decode/decode.ts'],
].map(([id, module, source]) => ({ id, module: artifact(module), artifact: artifact(source) }));
const manifest = { schemaVersion: 1, owner: 'part-four',
  fixtures: [
    { id: 'P4-NF-06', stage: 'build', artifact: artifact('tests/intake/governance.test.ts') },
    ...Array.from({ length: 9 }, (_, i) => ({ id: `P4-VA-${String(i + 1).padStart(2, '0')}`, stage: 'build', artifact: artifact('tests/intake/verified-act.test.ts') })),
  ],
  probes: [], decoders, documents: [{ id: 'intake.contract', artifact: artifact('docs/08-the-intake.md') }] };
mkdirSync('register-source/owner-references', { recursive: true });
writeFileSync('register-source/owner-references/part-four.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Pinned P4 consumer sources and inspection tests; no production probe or approval implied.');
