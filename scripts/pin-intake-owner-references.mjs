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
    ...Array.from({ length: 5 }, (_, i) => ({ id: `P4-ST-${String(i + 1).padStart(2, '0')}`, stage: 'build', artifact: artifact('tests/intake/scheduled.test.ts') })),
    { id: 'P4-ST-06', stage: 'build', artifact: artifact('tests/integration/intake-scheduled.test.ts') },
    ...Array.from({ length: 2 }, (_, i) => ({ id: `P4-ST-${String(i + 7).padStart(2, '0')}`, stage: 'build', artifact: artifact('tests/e2e/intake-scheduled.test.ts') })),
    ...Array.from({ length: 15 }, (_, i) => ({ id: `P4-ST-${String(i + 9).padStart(2, '0')}`, stage: 'build', artifact: artifact('tests/intake/scheduled-conformance.test.ts') })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `P4-ST-${String(i + 24).padStart(2, '0')}`, stage: 'build', artifact: artifact('tests/intake/scheduled-repair3.test.ts') })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `P4-ST-${String(i + 26).padStart(2, '0')}`, stage: 'build', artifact: artifact('tests/intake/scheduled-repair4.test.ts') })),
    { id: 'P4-PRESERVE-01', stage: 'build', artifact: artifact('tests/intake/preexisting-preservation.test.ts') },
  ],
  probes: [], decoders, documents: [{ id: 'intake.contract', artifact: artifact('docs/08-the-intake.md') }] };
mkdirSync('register-source/owner-references', { recursive: true });
writeFileSync('register-source/owner-references/part-four.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Pinned P4 consumer sources and inspection tests; no production probe or approval implied.');
