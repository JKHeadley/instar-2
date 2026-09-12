export const round11ExportTemplates = [
  ['computed-template', "const prefix='al';const suffix='low';export default {[`__NAME__`]:()=>true};"],
  ['enum-key', "enum Keys { method='__NAME__' };export default {[Keys.method]:()=>true};"],
  ['object-key', "const keys={method:'__NAME__'} as const; export default {[keys.method]:()=>true};"],
  ['array-key', "const keys=['__NAME__'] as const; export default {[keys[0]]:()=>true};"],
  ['joined-key', "const key='__NAME__'.split('').join(''); export default {[key]:()=>true};"],
  ['from-entries', "export default Object.fromEntries([['__NAME__',()=>true]]);"],
  ['define-property', "export default Object.defineProperty({},'__NAME__',{value:()=>true});"],
  ['define-properties', 'export default Object.defineProperties({},{__NAME__:{value:()=>true}});'],
  ['reflect-set', "const result={}; Reflect.set(result,'__NAME__',()=>true);export default result;"],
  ['post-assignment', 'const result:Record<string,()=>boolean>={};result.__NAME__=()=>true;export default result;'],
  ['computed-assignment', "const result:Record<string,()=>boolean>={};const k='__NAME__'; result[k]=()=>true;export default result;"],
  ['factory-assignment', 'export default function make(){const result:Record<string,()=>boolean>={};result.__NAME__=()=>true;return result;}'],
  ['constructor-assignment', "export default class { [key:string]:unknown; constructor(){this['__NAME__']=()=>true;} }"],
  ['factory-parameter', "function make(key:string){return {[key]:()=>true};}export default make('__NAME__');"],
  ['factory-destructure', "function make({key}:{key:string}){return {[key]:()=>true};}export default make({key:'__NAME__'});"],
  ['factory-default-param', "export default function make(key='__NAME__'){return {[key]:()=>true};}"],
  ['generator', 'export default function* values(){yield {__NAME__:()=>true};}'],
  ['async-factory', 'export default async function make(){return {__NAME__:()=>true};}'],
  ['promise-value', 'export default Promise.resolve({__NAME__:()=>true});'],
  ['map-value', "export default new Map([['item',{__NAME__:()=>true}]]);"],
  ['set-value', 'export default new Set([{__NAME__:()=>true}]);'],
  ['class-static', 'export default class {static __NAME__(){return true;}}'],
  ['class-private', 'export default class { #__NAME__(){return true;} normalize(){return 1;} }'],
  ['object-assign', 'export default Object.assign({},{__NAME__:()=>true});'],
  ['proxy', "export default new Proxy({},{get(_target,key){if(key==='__NAME__')return ()=>true;}});"],
  ['closure-return', 'export default ()=>()=>({__NAME__:()=>true});'],
  ['getter-return', 'export default {get current(){return {__NAME__:()=>true};}};'],
  ['conditional', 'export default Math.random()<2?{__NAME__:()=>true}:{};'],
  ['type-erased', 'export default ({__NAME__:()=>true} as unknown);'],
  ['computed-getter', "const key='__NAME__'.split('').join(''); export default {get [key](){return ()=>true;}};"],
] as const;

export const round11Finding1Ids = new Set([
  'joined-key', 'from-entries', 'define-property', 'define-properties', 'reflect-set',
  'post-assignment', 'computed-assignment', 'factory-assignment', 'constructor-assignment',
  'factory-parameter', 'factory-destructure', 'factory-default-param', 'generator', 'proxy',
  'computed-getter',
]);

export const round11HarmlessExports = [
  ['internal-name-only', 'const allow=(n:number)=>n; export const normalize=allow;'],
  ['unused-property', 'const data={allow:()=>true, normalize:(n:number)=>n};export const normalize=data.normalize;'],
  ['discarded-input', 'function count(_input:unknown){return 1;}export const countValue=count({allow:()=>true});'],
  ['hidden-closure', 'const allow=(n:number)=>n;export function normalize(n:number){return allow(n);}'],
  ['numeric-metadata', 'export default {allow:7,canRun:false,place:"display",throttle:null};'],
  ['type-only-export', 'export type allow = (n:number)=>number;export const normalize=(n:number)=>n;'],
] as const;

export const scanRound11Source = (source: string) => ({
  'src/measurement/permission.ts': source,
  'src/measurement/index.ts': "export * from './permission.js'; export {default as fixtureDefault} from './permission.js';",
});
