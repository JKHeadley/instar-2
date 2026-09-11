import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = resolve('scripts/build-register.mjs');
const worker = resolve('tests/e2e/register-normal-restart-worker.mjs');
const emitted = pathToFileURL(resolve('dist/index.js')).href;

describe('round-three normal writer restart lifecycle', () => {
  it('P3-NF-01/21/22/23/24 real SIGKILL after every normal repin write recovers one byte-identical witnessed result', async () => {
    const root = mkdtempSync(join(tmpdir(), 'register-normal-restart-'));
    try {
      for (const path of ['docs', 'src', 'register-source', 'package.json', 'tsconfig.json'])
        cpSync(path, join(root, path), { recursive: true });
      rmSync(join(root, 'src/intake'), { recursive: true, force: true });
      rmSync(join(root, 'src/rungraph'), { recursive: true, force: true });
      const emptyManifest = (owner: string) => ({ schemaVersion: 1, owner, fixtures: [], probes: [], decoders: [], documents: [] });
      writeFileSync(join(root, 'register-source/owner-references.json'), JSON.stringify(emptyManifest('part-five')));
      writeFileSync(join(root, 'register-source/owner-references/part-four.json'), JSON.stringify(emptyManifest('part-four')));
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
        '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      git('init'); git('add', '.'); git('commit', '-qm', 'restart source');
      const sourceCommit = git('rev-parse', 'HEAD');
      const replay = spawnSync(process.execPath, [script, '--replay', '--commit', sourceCommit, '--now', '100'],
        { cwd: root, encoding: 'utf8' });
      expect(replay.status, replay.stderr).toBe(0);
      const conversionPath = join(root, 'generated/conversion.json');
      const conversion = JSON.parse(readFileSync(conversionPath, 'utf8'));
      for (const source of conversion.sources) if (source.declaration.requiredFacts.number)
        Object.assign(source.declaration.requiredFacts, { deadline: 1000, owner: 'fixture-operator', overdueAction: 'surface' });
      writeFileSync(conversionPath, JSON.stringify(conversion));
      git('add', 'generated'); git('commit', '-qm', 'witnessed parent generation');
      const parentCommit = git('rev-parse', 'HEAD');
      const parentRegister = JSON.parse(readFileSync(join(root, 'generated/register.json'), 'utf8'));
      const workflowPath = 'register-source/workflows/restart-round3.json';
      mkdirSync(join(root, 'register-source/workflows'), { recursive: true });
      const workflow = { type: 'RegisterWorkflow', schemaVersion: 1, mode: 'normal', branch: 'restart-round-three',
        parent: { commit: parentCommit, register: 'generated/register.json', source: 'generated/source.json', conversion: 'generated/conversion.json' },
        extract: parentRegister.extract, runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] },
        landedParts: [], references: [], claims: parentRegister.shape.kinds.map((kind: { name: string }) => ({ kind: kind.name, complete: false })), instances: {} };
      writeFileSync(join(root, workflowPath), JSON.stringify(workflow));
      git('add', workflowPath); git('commit', '-qm', 'normal candidate');
      const candidate = git('rev-parse', 'HEAD');
      const parentSource = JSON.parse(readFileSync(join(root, 'generated/source.json'), 'utf8'));
      const generation = { type: 'RegisterGeneration', schemaVersion: 1, id: parentSource.generation,
        commit: parentSource.commit, vector: parentRegister.extract.vector };
      const providerPath = join(root, 'restart-provider.mjs');
      writeFileSync(providerPath, `import { consumeResult, defineDecoder } from ${JSON.stringify(emitted)};
const context={preserved:'restart fixture',site:'types.decode',register:{generation:{owner:'part-three',name:'RegisterGeneration',id:'restart-fixture'},sites:{'types.decode':'closed'}}};
const decoder=consumeResult(defineDecoder({name:'RestartReply',owner:'test-only',currentVersion:1,
  versions:{1:{validate:value=>({ok:true,value})}},migrations:{},decodeCurrent:value=>({ok:true,value:value.payload})},context.preserved),
  {Success:value=>value,Refused:error=>{throw new Error(error.detail)}});
const reply=payload=>decoder.decode({type:'RestartReply',schemaVersion:1,payload},context);
const generation=${JSON.stringify(generation)};
const at={type:'Measurement',schemaVersion:1,subject:{kind:'clock',instance:'build-machine'},value:100,unit:'unix-ms',at:100,by:'register.generator'};
export const provider={owner:'part-two',verifyExtract:extract=>reply(extract.vector),
  enteringForce:()=>reply({type:'GenerationRecord',schemaVersion:1,generation,at}),isCurrent:()=>reply(true),
  resolveReference:()=>reply(true)};
`);
      const control = join(root, 'control');
      const normal = spawnSync(process.execPath, [script, '--workflow', workflowPath, '--provider', providerPath,
        '--commit', candidate, '--now', '100', '--out', control], { cwd: root, encoding: 'utf8' });
      expect(normal.status, normal.stderr).toBe(0);
      const names = ['register.json', 'rules.md', 'glossary.md', 'capabilities.md', 'coverage.md', 'shape.json',
        'fact-schemas.json', 'conversion.json', 'source.json'];
      for (let cut = 1; cut <= names.length; cut++) {
        const output = join(root, `cut-${cut}`); mkdirSync(output);
        const invoke = (n: number, check = false) => spawnSync(process.execPath,
          [worker, pathToFileURL(script).href, root, output, String(n), candidate, workflowPath, providerPath, ...(check ? ['check'] : [])],
          { cwd: root, encoding: 'utf8' });
        const killed = invoke(cut); expect(killed.signal, killed.stderr).toBe('SIGKILL');
        await new Promise<void>(done => setImmediate(done));
        const incomplete = invoke(0, true); await new Promise<void>(done => setImmediate(done));
        if (cut < names.length) expect(incomplete.status, `cut ${cut} unexpectedly complete`).not.toBe(0);
        else expect(incomplete.status, incomplete.stderr).toBe(0);
        const recovered = invoke(0); expect(recovered.status, recovered.stderr).toBe(0);
        await new Promise<void>(done => setImmediate(done));
        const verified = invoke(0, true); expect(verified.status, verified.stderr).toBe(0);
        await new Promise<void>(done => setImmediate(done));
        expect(names.filter(name => !readFileSync(join(output, name)).equals(readFileSync(join(control, name))))).toEqual([]);
        rmSync(output, { recursive: true, force: true });
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 240_000);
});
