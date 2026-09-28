import type ts from 'typescript';
export function createProgram(extra?: Record<string, string>): ts.Program;
export function lintProgram(program: ts.Program, files: string[]): { file: string; line: number; rule: string; detail: string }[];
export const INTENT_DECISION_SITES: Readonly<Record<string, { variables?: string[]; decisionProperties?: boolean; functions?: string[] }>>;
export function lintIntentSites(sources?: Record<string, string>): { file: string; line: number; rule: string; detail: string }[];
