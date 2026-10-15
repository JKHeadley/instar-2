import type { SessionProtocolIO } from '../src/harness-adapters/session-protocol.js';
export function createSessionProtocolIO(directory: string, stopped?: () => boolean): SessionProtocolIO;
