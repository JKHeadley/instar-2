import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export { resolve } from '../loader.mjs';
import { load as baseLoad } from '../loader.mjs';
export async function load(url,context,next){
 if(url.endsWith('/scripts/transport-file-storage.mjs')){let source=readFileSync(fileURLToPath(url),'utf8').replace('export function createTransportFileStorage','function originalStorage');source+=`\nexport function createTransportFileStorage(...args){const base=originalStorage(...args);return Object.freeze({...base,append(...args){const r=base.append(...args);globalThis.__astraAfterAppend?.(JSON.parse(args[0]));return r;}});}`;return {format:'module',shortCircuit:true,source};}
 if(url.endsWith('/scripts/judgment-captures.mjs')){let source=readFileSync(fileURLToPath(url),'utf8').replace('export function createJudgmentCaptures','function originalCaptures');source+=`\nexport function createJudgmentCaptures(...args){const base=originalCaptures(...args);return Object.freeze({...base,putReserved(...args){const r=base.putReserved(...args);globalThis.__astraAfterCapture?.();return r;}});}`;return {format:'module',shortCircuit:true,source};}
 return baseLoad(url,context,next);
}
