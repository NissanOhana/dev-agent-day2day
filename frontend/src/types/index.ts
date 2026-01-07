// Event types matching the server
export type EventType =
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'thinking'
  | 'skill_activated'
  | 'mcp_call'
  | 'context_update'
  | 'error'
  | 'loop_event';

export type ToolStatus = 'pending' | 'running' | 'done' | 'error';

export interface TokenBreakdown {
  system: number;
  skills: number;
  mcp: number;
  messages: number;
  buffer: number;
}

export interface TokenInfo {
  added: number;
  total: number;
  limit: number;
  breakdown: TokenBreakdown;
}

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: number;
  sessionId: string;
  tokens?: TokenInfo;
}

export interface MessageEvent extends BaseEvent {
  type: 'message';
  data: {
    role: 'user' | 'assistant';
    content: string;
  };
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  data: {
    toolName: string;
    toolId: string;
    input: Record<string, unknown>;
    status: ToolStatus;
  };
}

export interface ToolResultEvent extends BaseEvent {
  type: 'tool_result';
  data: {
    toolId: string;
    toolName: string;
    result: string;
    isError: boolean;
    duration?: number;
  };
}

export interface ThinkingEvent extends BaseEvent {
  type: 'thinking';
  data: {
    content: string;
  };
}

export interface SkillActivatedEvent extends BaseEvent {
  type: 'skill_activated';
  data: {
    skillName: string;
    source: string;
    tokensAdded: number;
  };
}

export interface McpCallEvent extends BaseEvent {
  type: 'mcp_call';
  data: {
    server: string;
    tool: string;
    input: Record<string, unknown>;
    status: ToolStatus;
  };
}

export interface ContextUpdateEvent extends BaseEvent {
  type: 'context_update';
  data: {
    breakdown: TokenBreakdown;
    totalTokens: number;
    limit: number;
  };
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

export interface LoopEvent extends BaseEvent {
  type: 'loop_event';
  data: {
    loopType: string;
    taskId?: string;
    tasks?: Array<{ id: string; title: string; status: string }>;
    progress?: number;
    step?: string;
    check?: string;
    error?: string;
  };
}

export type AgentEvent =
  | MessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | ThinkingEvent
  | SkillActivatedEvent
  | McpCallEvent
  | ContextUpdateEvent
  | ErrorEvent
  | LoopEvent;

// Session types
export type SessionStatus = 'running' | 'paused' | 'stopped' | 'replay';

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  workingDir: string;
  agentType: 'claude-code' | 'cursor';
  tokensUsed: number;
  tokensLimit: number;
  createdAt: number;
  updatedAt: number;
  eventCount?: number;
}

export interface ContextSummary {
  tokens: {
    used: number;
    limit: number;
    breakdown: TokenBreakdown;
  };
  activeSkills: Array<{ name: string; source: string; tokens: number }>;
  activeMcp: Array<{ server: string; tools: string[] }>;
  recentTools: Array<{ name: string; status: string; timestamp: number }>;
  filesModified: string[];
}

// View types
export type ContextView = 'dashboard' | 'timeline' | 'cdd';
