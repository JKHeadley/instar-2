import { describe, expect, it } from 'vitest';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { findForbiddenMeasurementPermissionExports } from '../../scripts/check-p16-contract-map.mjs';

const scan = (source: string, index = "export * from './permission.js';") =>
  findForbiddenMeasurementPermissionExports({
    'src/measurement/permission.ts': source,
    'src/measurement/index.ts': index,
  });

describe('Part 16 A1 round 10 independent-review regressions', () => {
  const reviewerCases = [
    ['computed-constant-permission', "const key='allow'; export const decisions={[key]:()=>true};", undefined],
    ['factory-permission', 'export function measurementDecisions(){return {allow:()=>true};}', undefined],
    ['arrow-factory-permission', 'export const measurementDecisions=()=>({allow:()=>true});', undefined],
    ['array-spread-permission', 'const decisions=[{allow:()=>true}]; export default [...decisions];',
      "export { default as decisions } from './permission.js';"],
    ['class-inherits-permission', 'class Base {allow(){return true;}} export class Decisions extends Base {}', undefined],
  ] as const;

  it.each(reviewerCases)(
    'P16-NF-23 [behavior:observational-port] %s refuses its reachable callable permission',
    (_id, source, index) => expect(scan(source, index)).toEqual(['allow']),
  );

  it('P16-NF-23 [behavior:observational-port] accepts every matching reviewer helper neighbor', () => {
    expect(scan("const key='normalize'; export const helpers={[key]:(v:number)=>v};")).toEqual([]);
    expect(scan('export function measurementHelpers(){return {normalize:(v:number)=>v};}')).toEqual([]);
    expect(scan('export const measurementHelpers=()=>({normalize:(v:number)=>v});')).toEqual([]);
    expect(scan('const helpers=[{normalize:(v:number)=>v}]; export default [...helpers];',
      "export { default as helpers } from './permission.js';")).toEqual([]);
    expect(scan('class Base {normalize(v:number){return v;}} export class Helpers extends Base {}')).toEqual([]);
  });

  it('P16-NF-23 [behavior:observational-port] follows getters, returned closures, default re-exports, and cross-module inheritance', () => {
    expect(scan('export const decisions={get current(){return {allow:()=>true};}};')).toEqual(['allow']);
    expect(scan('export const decisions=()=>()=>({allow:()=>true});')).toEqual(['allow']);
    expect(scan('export default {allow:()=>true};',
      "export {default as decisions} from './permission.js';")).toEqual(['allow']);
    expect(findForbiddenMeasurementPermissionExports({
      'src/measurement/base.ts': 'export class Base {allow(){return true;}}',
      'src/measurement/permission.ts': "import {Base} from './base.js'; export class Decisions extends Base {}",
      'src/measurement/index.ts': "export * from './permission.js';",
    })).toEqual(['allow']);
    expect(scan('export const helpers={get current(){return {normalize:(v:number)=>v};}};')).toEqual([]);
    expect(scan('export const helpers=()=>()=>({normalize:(v:number)=>v});')).toEqual([]);
  });
});
