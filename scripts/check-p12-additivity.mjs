import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const baseline = '15f70b7a13a7bb90a5ae28000f1b82e8f32247e7';
const workspace = process.cwd();

// The row-127 brief grants a single additive Part Ten source extension: the exclusive validUntil
// precondition on appendIfSubjectFrontier. That one baseline path is permitted to differ; every
// other pinned-main source/test path must remain byte-identical.
const grantedExtensions = new Set(['src/assembly/conditional-append.ts']);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: workspace, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

// Every source and test path owned by the pinned main baseline must remain byte-identical.
// Additive Part Twelve paths do not appear in this set and are intentionally allowed.
const baselinePaths = new Set(run('git', ['ls-tree', '-r', '--name-only', baseline, '--', 'src', 'tests'])
  .split('\n').filter(Boolean));
const changed = run('git', ['diff', '--name-only', baseline, '--', 'src', 'tests'])
  .split('\n').filter(path => baselinePaths.has(path) && !grantedExtensions.has(path));
if (changed.length > 0) throw new Error(`P12 additivity: pinned-main source/test paths changed:\n${changed.join('\n')}`);

const temporary = mkdtempSync(join(tmpdir(), 'instar-p12-additivity-'));
try {
  const archive = spawnSync('git', ['archive', baseline], {
    cwd: workspace, encoding: null, maxBuffer: 64 * 1024 * 1024,
  });
  if (archive.status !== 0) throw new Error(`git archive failed: ${String(archive.stderr)}`);
  const unpack = spawnSync('tar', ['-xf', '-', '-C', temporary], {
    input: archive.stdout, encoding: null, maxBuffer: 64 * 1024 * 1024,
  });
  if (unpack.status !== 0) throw new Error(`baseline extraction failed: ${String(unpack.stderr)}`);
  symlinkSync(join(workspace, 'node_modules'), join(temporary, 'node_modules'), 'dir');
  const compile = spawnSync(process.execPath, [join(workspace, 'node_modules/typescript/bin/tsc'), '-p', join(temporary, 'tsconfig.build.json')], {
    cwd: temporary, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (compile.status !== 0) throw new Error(`pinned-main compile failed:\n${compile.stderr || compile.stdout}`);

  const runner = root => `
import { intakeFixture, route, message, stop } from ${JSON.stringify(join(root, 'tests/intake/fixtures.ts'))};
import { effectFixture } from ${JSON.stringify(join(root, 'tests/effects/fixture.ts'))};
import { transportFixture } from ${JSON.stringify(join(root, 'tests/transport/fixture.ts'))};
import { decodeOutboundMessage } from ${JSON.stringify(join(root, 'src/effects/index.ts'))};
import { writeFileSync } from 'node:fs';
const rows = []; const row = (name, result) => rows.push({ name, result });
for (const mode of ['unbound','bound','duplicate','changed-bytes','missing-event','malformed','held','requester-stop','bound-stop','expiry']) {
  const f = intakeFixture(); if (['bound','duplicate','changed-bytes','bound-stop'].includes(mode)) f.bind(); const port = f.port();
  if (mode === 'duplicate' || mode === 'changed-bytes') port.receive(message(), route);
  if (mode === 'expiry') { port.receive('{"schemaVersion":1,"kind":"media"}', route); f.setTime(1200); row('intake:' + mode, port.expireHolds()); continue; }
  const raw = ['requester-stop','bound-stop'].includes(mode) ? stop : mode === 'malformed' ? 'bad-json' : mode === 'held' ? '{"schemaVersion":1,"kind":"media"}' : mode === 'changed-bytes' ? message('changed') : message();
  row('intake:' + mode, port.receive(raw, mode === 'missing-event' ? { ...route, eventId: '' } : route));
}
{
  const f = effectFixture();
  for (const [name, patch] of Object.entries({ valid:{}, extra:{unexpected:1}, empty:{text:''}, limit:{text:'x'.repeat(4096)}, oversize:{text:'x'.repeat(4097)}, wrongPurpose:{purpose:'reaction'}, missingSpeaker:{speaker:''}, wrongSource:{sourceResult:'missing'} })) row('effects:' + name, decodeOutboundMessage({ ...f.message, ...patch }, f.host));
  row('effects:prepare', f.api.prepare({ definition:f.d.id, message:f.message, run:f.run, pending:f.pending.id, attempt:'attempt:1', verificationOwner:'reply-verifier', obligation:f.obligation, closure:[], fence:f.fence }));
}
for (const mode of ['acquire','zero-lease','reserve','over-budget','stopped','stale-fence']) {
  const f = transportFixture(); if (mode === 'zero-lease') { row('transport:' + mode, f.api.acquire('acquire','',0)); continue; }
  const acquired = f.api.acquire('acquire','',500); if (mode === 'acquire') { row('transport:' + mode, acquired); continue; } if (acquired.kind !== 'Success') throw Error('control acquire failed');
  const token = acquired.value; f.api.schedule('schedule', token, f.run, f.policy); if (mode === 'stopped') f.stop(); if (mode === 'stale-fence') f.advance(600);
  row('transport:' + mode, f.api.reserve(f.input(token, mode === 'over-budget' ? { charge:101 } : {})));
}
writeFileSync(process.argv[2], JSON.stringify(rows, null, 2));
`;

  const roots = { baseline: temporary, head: workspace };
  const results = {};
  for (const [name, root] of Object.entries(roots)) {
    const entry = join(temporary, `${name}.ts`); const bundle = join(temporary, `${name}.mjs`); const output = join(temporary, `${name}.json`);
    writeFileSync(entry, runner(resolve(root)));
    await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', target: 'node24', logLevel: 'silent' });
    run(process.execPath, [bundle, output]);
    results[name] = JSON.parse(readFileSync(output, 'utf8'));
  }
  if (results.baseline.length !== 25 || results.head.length !== 25)
    throw new Error(`P12 additivity: expected 25 complete legacy Results, got ${results.baseline.length}/${results.head.length}`);
  if (JSON.stringify(results.baseline) !== JSON.stringify(results.head))
    throw new Error('P12 additivity: a complete legacy intake/effects/transport Result changed from pinned main');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

console.log(`${baselinePaths.size} pinned-main source/test paths; ${[...grantedExtensions].join(', ')} is the granted additive extension; ${baselinePaths.size - grantedExtensions.size} remain byte-identical; 25 complete legacy Results are identical.`);
