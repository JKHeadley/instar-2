// Trusted main-process companion to the per-worker assertion ledger. Load with
// node --import (also inherited through NODE_OPTIONS by the complete npm gate).
// Vitest's JSON success flag does not include every unhandled worker RPC error.
import {appendFileSync,existsSync,mkdirSync,readFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=realpathSync(fileURLToPath(new URL('../..',import.meta.url)));
const entry=process.argv[1]&&existsSync(process.argv[1])?realpathSync(process.argv[1]):'';
if(entry.endsWith('/vitest/vitest.mjs')&&realpathSync(process.cwd())===root){
  const started=Date.now(),args=process.argv.slice(2);
  const flag=args.find(arg=>arg.startsWith('--outputFile='));
  const at=args.indexOf('--outputFile');
  const output=flag?.slice('--outputFile='.length)??(at>=0?args[at+1]:undefined);
  if(output){
    const path=resolve(root,output);
    const {productionGroundingSourceDigest}=await import('../../scripts/check-assembly-contracts.mjs');
    const sourceDigest=productionGroundingSourceDigest(root);
    const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
    process.on('exit',code=>{
      if(!path.startsWith(root+'/')||!existsSync(path))return;
      const report=JSON.parse(readFileSync(path,'utf8'));
      if(report.startTime<started-1000)return;
      const dir=resolve(root,'.instar/lanes/round4c-artifacts');mkdirSync(dir,{recursive:true});
      appendFileSync(resolve(dir,'process-exits.jsonl'),JSON.stringify({root,revision,sourceDigest,
        reportDigest:createHash('sha256').update(JSON.stringify(report)).digest('hex'),
        started,ended:Date.now(),reportStart:report.startTime,code})+'\n');
    });
  }
}
