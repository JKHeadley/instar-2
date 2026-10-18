/** Host-owned bounded process transport. Requests are never retried; frames are durably
 * captured before exposure. Identities bind an exact process lifetime, not a PID alone. */
export interface SessionProtocolConnection {
  readonly identity: string;
  request(method: string, params: Readonly<Record<string, unknown>>): Promise<unknown>;
  notify(method: string, params: Readonly<Record<string, unknown>>): void;
  drain(): readonly unknown[];
  alive(): boolean;
  close(): Promise<void>;
}
export interface SessionProtocolIO {
  open(input: Readonly<{ claim: string; incarnation: string; executable: string; args: readonly string[];
    env: Readonly<Record<string, string>>; cwd: string; deadline: number; maxProcesses: number;
    requestTimeoutMs: number }>): Promise<SessionProtocolConnection>;
  close(claim: string, incarnation: string, identity?: string): Promise<void>;
}
