// Session types

export type SessionStatus = 'running' | 'paused' | 'stopped' | 'replay';

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  workingDir: string;
  createdAt: number;
  updatedAt: number;
  agentType: 'claude-code' | 'cursor';
  tokensUsed: number;
  tokensLimit: number;
}

export interface SessionSummary {
  id: string;
  name: string;
  status: SessionStatus;
  agentType: string;
  tokensUsed: number;
  tokensLimit: number;
  eventCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ContextSummary {
  tokens: {
    used: number;
    limit: number;
    breakdown: {
      system: number;
      skills: number;
      mcp: number;
      messages: number;
      buffer: number;
    };
  };
  activeSkills: Array<{ name: string; source: string; tokens: number }>;
  activeMcp: Array<{ server: string; tools: string[] }>;
  recentTools: Array<{ name: string; status: string; timestamp: number }>;
  filesModified: string[];
}

export interface CreateSessionRequest {
  name?: string;
  workingDir: string;
  agentType?: 'claude-code' | 'cursor';
}

export interface SendPromptRequest {
  message: string;
}
