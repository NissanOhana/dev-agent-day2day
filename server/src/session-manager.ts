import { nanoid } from 'nanoid';
import type { ServerWebSocket } from 'bun';
import type { AgentEvent, Session, ContextSummary, TokenBreakdown } from './types';
import { RingBuffer } from './utils/ring-buffer';
import * as db from './db/database';
import { ClaudeCodeAdapter } from './adapters/claude-code';
import type { AgentAdapter } from './adapters/types';

interface ActiveSession {
  session: Session;
  adapter: AgentAdapter | null;
  subscribers: Set<ServerWebSocket<{ sessionId: string }>>;
  recentEvents: RingBuffer<AgentEvent>;
  contextState: ContextSummary;
}

const activeSessions = new Map<string, ActiveSession>();

// Initialize context state
function createInitialContext(): ContextSummary {
  return {
    tokens: {
      used: 0,
      limit: 200000,
      breakdown: { system: 0, skills: 0, mcp: 0, messages: 0, buffer: 0 },
    },
    activeSkills: [],
    activeMcp: [],
    recentTools: [],
    filesModified: [],
  };
}

// Create a new session
export function createSession(workingDir: string, name?: string, agentType: 'claude-code' | 'cursor' = 'claude-code'): Session {
  const id = nanoid(10);
  const now = Date.now();
  const session: Session = {
    id,
    name: name || `session-${id.slice(0, 6)}`,
    status: 'stopped',
    workingDir,
    agentType,
    tokensUsed: 0,
    tokensLimit: 200000,
    createdAt: now,
    updatedAt: now,
  };

  db.createSession(session);

  activeSessions.set(id, {
    session,
    adapter: null,
    subscribers: new Set(),
    recentEvents: new RingBuffer(100),
    contextState: createInitialContext(),
  });

  return session;
}

// Get session by ID
export function getSession(id: string): Session | null {
  const active = activeSessions.get(id);
  if (active) return active.session;
  return db.getSession(id);
}

// Get all sessions
export function getAllSessions() {
  return db.getAllSessions();
}

// Start agent for session
export async function startSession(id: string): Promise<void> {
  const active = activeSessions.get(id);
  if (!active) {
    const session = db.getSession(id);
    if (!session) throw new Error(`Session ${id} not found`);

    activeSessions.set(id, {
      session,
      adapter: null,
      subscribers: new Set(),
      recentEvents: new RingBuffer(100),
      contextState: createInitialContext(),
    });
  }

  const sessionData = activeSessions.get(id)!;

  if (sessionData.session.agentType === 'claude-code') {
    sessionData.adapter = new ClaudeCodeAdapter(
      id,
      sessionData.session.workingDir,
      (event) => handleEvent(id, event)
    );
  } else {
    throw new Error(`Agent type ${sessionData.session.agentType} not supported yet`);
  }

  await sessionData.adapter.start();
  sessionData.session.status = 'running';
  db.updateSession(id, { status: 'running' });
}

// Send prompt to agent
export async function sendPrompt(id: string, message: string): Promise<void> {
  const active = activeSessions.get(id);
  if (!active?.adapter) {
    throw new Error(`Session ${id} not started or no adapter`);
  }

  // Create user message event
  const userEvent: AgentEvent = {
    id: nanoid(),
    type: 'message',
    timestamp: Date.now(),
    sessionId: id,
    data: { role: 'user', content: message },
  };

  handleEvent(id, userEvent);
  await active.adapter.sendPrompt(message);
}

// Pause session
export function pauseSession(id: string): void {
  const active = activeSessions.get(id);
  if (active?.adapter) {
    active.adapter.pause();
    active.session.status = 'paused';
    db.updateSession(id, { status: 'paused' });
  }
}

// Resume session
export function resumeSession(id: string): void {
  const active = activeSessions.get(id);
  if (active?.adapter) {
    active.adapter.resume();
    active.session.status = 'running';
    db.updateSession(id, { status: 'running' });
  }
}

// Stop session
export async function stopSession(id: string): Promise<void> {
  const active = activeSessions.get(id);
  if (active?.adapter) {
    await active.adapter.stop();
    active.adapter = null;
    active.session.status = 'stopped';
    db.updateSession(id, { status: 'stopped' });
  }
}

// Delete session
export async function deleteSession(id: string): Promise<void> {
  await stopSession(id);
  activeSessions.delete(id);
  db.deleteSession(id);
}

// Subscribe to session events
export function subscribe(id: string, ws: ServerWebSocket<{ sessionId: string }>): void {
  let active = activeSessions.get(id);

  if (!active) {
    const session = db.getSession(id);
    if (!session) return;

    active = {
      session,
      adapter: null,
      subscribers: new Set(),
      recentEvents: new RingBuffer(100),
      contextState: createInitialContext(),
    };
    activeSessions.set(id, active);
  }

  active.subscribers.add(ws);

  // Send recent events to new subscriber
  const recentEvents = active.recentEvents.getAll();
  for (const event of recentEvents) {
    ws.send(JSON.stringify(event));
  }
}

// Unsubscribe from session
export function unsubscribe(id: string, ws: ServerWebSocket<{ sessionId: string }>): void {
  const active = activeSessions.get(id);
  if (active) {
    active.subscribers.delete(ws);
  }
}

// Handle event from adapter
function handleEvent(sessionId: string, event: AgentEvent): void {
  const active = activeSessions.get(sessionId);
  if (!active) return;

  // Store in ring buffer
  active.recentEvents.push(event);

  // Persist to database
  db.insertEvent(event);

  // Update context state based on event type
  updateContextState(active, event);

  // Broadcast to subscribers
  const message = JSON.stringify(event);
  for (const ws of active.subscribers) {
    ws.send(message);
  }
}

// Update context state based on event
function updateContextState(active: ActiveSession, event: AgentEvent): void {
  if (event.tokens) {
    active.contextState.tokens = {
      used: event.tokens.total,
      limit: event.tokens.limit,
      breakdown: event.tokens.breakdown,
    };
    active.session.tokensUsed = event.tokens.total;
  }

  switch (event.type) {
    case 'skill_activated':
      active.contextState.activeSkills.push({
        name: event.data.skillName,
        source: event.data.source,
        tokens: event.data.tokensAdded,
      });
      break;

    case 'mcp_call':
      const existing = active.contextState.activeMcp.find((m) => m.server === event.data.server);
      if (existing) {
        if (!existing.tools.includes(event.data.tool)) {
          existing.tools.push(event.data.tool);
        }
      } else {
        active.contextState.activeMcp.push({
          server: event.data.server,
          tools: [event.data.tool],
        });
      }
      break;

    case 'tool_call':
      active.contextState.recentTools.unshift({
        name: event.data.toolName,
        status: event.data.status,
        timestamp: event.timestamp,
      });
      // Keep only last 50 tools
      if (active.contextState.recentTools.length > 50) {
        active.contextState.recentTools.pop();
      }

      // Track file modifications
      if (['Write', 'Edit'].includes(event.data.toolName)) {
        const filePath = (event.data.input as { file_path?: string }).file_path;
        if (filePath && !active.contextState.filesModified.includes(filePath)) {
          active.contextState.filesModified.push(filePath);
        }
      }
      break;

    case 'tool_result':
      // Update tool status
      const tool = active.contextState.recentTools.find(
        (t) => t.timestamp === event.timestamp || t.name === event.data.toolName
      );
      if (tool) {
        tool.status = event.data.isError ? 'error' : 'done';
      }
      break;

    case 'context_update':
      active.contextState.tokens = {
        used: event.data.totalTokens,
        limit: event.data.limit,
        breakdown: event.data.breakdown,
      };
      break;
  }
}

// Get context summary for a session
export function getContextSummary(id: string): ContextSummary | null {
  const active = activeSessions.get(id);
  if (active) return active.contextState;

  // If not in memory, return basic summary from DB
  const session = db.getSession(id);
  if (!session) return null;

  return {
    tokens: {
      used: session.tokensUsed,
      limit: session.tokensLimit,
      breakdown: { system: 0, skills: 0, mcp: 0, messages: 0, buffer: 0 },
    },
    activeSkills: [],
    activeMcp: [],
    recentTools: [],
    filesModified: [],
  };
}

// Get events for a session (with pagination)
export function getEvents(
  sessionId: string,
  options: { offset?: number; limit?: number; type?: string } = {}
) {
  return db.getEvents(sessionId, options);
}
