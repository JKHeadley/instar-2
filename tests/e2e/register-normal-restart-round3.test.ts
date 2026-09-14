import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { factId } from '../../src/facts/index.js';
import { value } from '../register/fixtures.js';

const script = resolve('scripts/build-register.mjs');
const worker = resolve('tests/e2e/register-normal-restart-worker.mjs');
const emitted = pathToFileURL(resolve('dist/index.js')).href;

describe.skip('round-three normal writer restart lifecycle SKIPPED: HELD-BY-SCOPE:SEAM-LEDGER-row-124', () => {
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
      let parentCommit = git('rev-parse', 'HEAD');
      const parentRegister = JSON.parse(readFileSync(join(root, 'generated/register.json'), 'utf8'));
      const parentSource = JSON.parse(readFileSync(join(root, 'generated/source.json'), 'utf8'));
      parentRegister.extract.vector = { owner: 'part-two', name: 'FactPositionVector',
        id: factId({ machine: 'machine-a', epoch: 0, position: 0 }) };
      parentSource.generation = value(canonical(parentRegister)).hash;
      writeFileSync(join(root, 'generated/register.json'), JSON.stringify(parentRegister));
      writeFileSync(join(root, 'generated/source.json'), JSON.stringify(parentSource));
      git('add', 'generated/register.json', 'generated/source.json'); git('commit', '--amend', '-qm', 'witnessed parent generation');
      parentCommit = git('rev-parse', 'HEAD');
      const workflowPath = 'register-source/workflows/restart-round3.json';
      mkdirSync(join(root, 'register-source/workflows'), { recursive: true });
      const workflow = { type: 'RegisterWorkflow', schemaVersion: 1, mode: 'normal', branch: 'restart-round-three',
        parent: { commit: parentCommit, register: 'generated/register.json', source: 'generated/source.json', conversion: 'generated/conversion.json' },
        extract: parentRegister.extract, runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] },
        landedParts: [], references: [], claims: parentRegister.shape.kinds.map((kind: { name: string }) => ({ kind: kind.name, complete: false })), instances: {} };
      writeFileSync(join(root, workflowPath), JSON.stringify(workflow));
      git('add', workflowPath); git('commit', '-qm', 'normal candidate');
      const candidate = git('rev-parse', 'HEAD');
      const generation = { type: 'RegisterGeneration', schemaVersion: 1, id: parentSource.generation,
        commit: parentSource.commit, vector: parentRegister.extract.vector };
      const providerPath = join(root, 'restart-provider.mjs');
      writeFileSync(providerPath, `import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from ${JSON.stringify(resolve('node_modules/typescript/lib/typescript.js'))};
import {consumeResult} from ${JSON.stringify(emitted)};
import {createFactStore,registerOwnedBody} from ${JSON.stringify(pathToFileURL(resolve('dist/facts/index.js')).href)};
import {createPartTwoRegisterAuthority,createPartTwoRegisterProvider,decodeRegisteredFact} from ${JSON.stringify(pathToFileURL(resolve('dist/register/index.js')).href)};
async function fixture(path,root){let js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 if(js.includes("'../fixtures.js'"))js=js.replace("'../fixtures.js'",JSON.stringify(await fixture(resolve(root,'tests/fixtures.ts'),root)));
 js=js.replace(/(['"])(?:\\.\\.\\/)+src\\/([^'"]+)\\1/g,(_a,_q,suffix)=>JSON.stringify(pathToFileURL(resolve(root,'dist',suffix)).href));
 js=js.replace("'register-source/bootstrap-shape.json'",JSON.stringify(resolve(root,'register-source/bootstrap-shape.json')));
 return 'data:text/javascript;base64,'+Buffer.from(js).toString('base64');}
const original=${JSON.stringify(resolve('.'))};
const {factsFixture}=await import(await fixture(resolve(original,'tests/facts/fixtures.ts'),original));
const {setup}=await import(await fixture(resolve(original,'tests/register/fixtures.ts'),original));
const f=factsFixture(),s=setup();s.f.ctx.register.entries.push('build-machine');s.f.ctx.register.producers.push('register.generator');
const take=r=>consumeResult(r,{Success:v=>v,Refused:r=>{throw new Error(r.detail);}});
const generation=${JSON.stringify(generation)};
const record={type:'GenerationRecord',schemaVersion:1,generation,at:f.now};
const policy=v=>v===null?{kind:'null'}:typeof v==='string'?{kind:'text',maxLength:1000}:typeof v==='number'?{kind:'integer'}:typeof v==='boolean'?{kind:'boolean'}:Array.isArray(v)?{kind:'array',maxLength:1000,items:policy(v[0])}:{kind:'object',fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,policy(v)]))};
const registration=take(registerOwnedBody({owner:'part-three',name:'GenerationRecord',currentVersion:1,versions:{1:{validate:input=>({ok:true,value:input})}},migrations:{},decodeCurrent:input=>consumeResult(decodeRegisteredFact('generation-record',input,s.context),{Success:value=>({ok:true,value}),Refused:r=>({ok:false,reason:r.reason,detail:r.detail})})},policy(record),f.c));
const schema={...f.schema,kind:'generation-record',fields:{record:{kind:'owned',owner:'part-three',name:'GenerationRecord'}}};
const facts={...f.ctx,facts:[],schemas:[f.schema,schema],ownedBodies:[registration]};
const rootFact=f.fact({},facts),force=f.next(rootFact,{kind:'generation-record',body:{record}},facts);
const store=createFactStore(facts,{owner:'part-ten',read:()=>[rootFact,force],append:()=>{throw new Error('read-only provider, no append claimed');}});
const authority=createPartTwoRegisterAuthority({facts,scope:f.scope,landing:{owner:'part-ten',merges:[]},context:s.context});
export const provider=createPartTwoRegisterProvider({store,authority,horizon:{lineages:{'machine-a':{head:{epoch:0,position:1},observedAt:100,closed:false}},stalenessBound:100},context:s.context});
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
