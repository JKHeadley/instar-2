import type ts from 'typescript';
export function createProgram(extra?: Record<string, string>): ts.Program;
export function lintProgram(program: ts.Program, files: string[]): { file: string; line: number; rule: string; detail: string }[];
