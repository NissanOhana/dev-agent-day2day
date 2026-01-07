import type { AgentEvent } from '../types';

export type EventHandler = (event: AgentEvent) => void;

export interface AgentAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  sendPrompt(message: string): Promise<void>;
  isRunning(): boolean;
}
