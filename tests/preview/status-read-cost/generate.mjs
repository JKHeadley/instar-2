// Offline fixture only: synthetic key and messages; writes solely into a fresh temporary root.
import { openPreviewJournal } from '../journal.js';
import { mkdtempSync, realpathSync, writeFileSync, copyFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = realpathSync(mkdtempSync(join(tmpdir(), 'status-read-cost-models-')));
if (!process.argv[2]) throw Error('usage: generate.mjs <root-pointer-file> [model-call-count]');
writeFileSync(process.argv[2], root);
const genesis = {kind:'genesis',bot:'12345678',chat:'7654321',operator:'7654321',grant:'grant:preview',configurationDigest:'sha256:offline',expires:9999999999999,maxCalls:10000,maxReplies:10000,maxTurns:10000,maxBytes:262144,cursor:969390726};
const journal=openPreviewJournal(join(root,'journal.encrypted'),new Uint8Array(32).fill(7),genesis,undefined,false,1024*1024*1024);
const repeated='A recorded synthetic conversation with stable instructions and repeated context. '.repeat(2500);
for(let i=0;i<Number(process.argv[3] ?? 1600);i++) {
 const input=repeated+randomBytes(30*1024).toString('base64');
 journal.append({kind:'model-call',id:'call:'+i,judgment:'answer',route:'preview-subscription',model:'synthetic',input,inputSha256:createHash('sha256').update(input).digest('hex'),output:'recorded answer',outcome:'complete',latencyMs:100,usage:null,usageException:'synthetic measurement',at:i+1});
 if(i%200===0) console.log({i,bytes:journal.size});
}
console.log({root,uncompactedBytes:journal.size});
copyFileSync(root+'/journal.encrypted',root+'/uncompacted.encrypted');
journal.compact(); console.log({compactedBytes:journal.size}); journal.close();
