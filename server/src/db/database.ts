import { Database } from 'bun:sqlite';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import type { AgentEvent, Session, SessionSummary } from '../types';

const DATA_DIR = join(homedir(), '.dev-agent-day2day');
const DB_PATH = join(DATA_DIR, 'sessions.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Initialize tables
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'stopped',
    working_dir TEXT NOT NULL,
    agent_type TEXT NOT NULL DEFAULT 'claude-code',
    tokens_used INTEGER NOT NULL DEFAULT 0,
    tokens_limit INTEGER NOT NULL DEFAULT 200000,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    tokens TEXT,
    timestamp INTEGER NOT NULL,
    blob_refs TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  )
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`);

// Session operations
export function createSession(session: Session): void {
  db.run(
    `INSERT INTO sessions (id, name, status, working_dir, agent_type, tokens_used, tokens_limit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.name,
      session.status,
      session.workingDir,
      session.agentType,
      session.tokensUsed,
      session.tokensLimit,
      session.createdAt,
      session.updatedAt,
    ]
  );
}

export function getSession(id: string): Session | null {
  const row = db.query(
    `SELECT id, name, status, working_dir as workingDir, agent_type as agentType,
            tokens_used as tokensUsed, tokens_limit as tokensLimit,
            created_at as createdAt, updated_at as updatedAt
     FROM sessions WHERE id = ?`
  ).get(id) as Session | null;
  return row;
}

export function getAllSessions(): SessionSummary[] {
  const rows = db.query(`
    SELECT s.id, s.name, s.status, s.agent_type as agentType,
           s.tokens_used as tokensUsed, s.tokens_limit as tokensLimit,
           s.created_at as createdAt, s.updated_at as updatedAt,
           COUNT(e.id) as eventCount
    FROM sessions s
    LEFT JOIN events e ON e.session_id = s.id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `).all() as SessionSummary[];
  return rows;
}

export function updateSession(id: string, updates: Partial<Session>): void {
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    values.push(updates.status);
  }
  if (updates.tokensUsed !== undefined) {
    sets.push('tokens_used = ?');
    values.push(updates.tokensUsed);
  }

  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  const stmt = db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

export function deleteSession(id: string): void {
  db.run('DELETE FROM events WHERE session_id = ?', [id]);
  db.run('DELETE FROM sessions WHERE id = ?', [id]);
}

// Event operations
export function insertEvent(event: AgentEvent): void {
  db.run(
    `INSERT INTO events (id, session_id, type, data, tokens, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.sessionId,
      event.type,
      JSON.stringify(event.data),
      event.tokens ? JSON.stringify(event.tokens) : null,
      event.timestamp,
    ]
  );
}

type EventRow = {
  id: string;
  session_id: string;
  type: string;
  data: string;
  tokens: string | null;
  timestamp: number;
};

export function getEvents(
  sessionId: string,
  options: { offset?: number; limit?: number; type?: string } = {}
): AgentEvent[] {
  const { offset = 0, limit = 50, type } = options;

  let rows: EventRow[];

  if (type) {
    const stmt = db.prepare(
      'SELECT * FROM events WHERE session_id = ? AND type = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    );
    rows = stmt.all(sessionId, type, limit, offset) as EventRow[];
  } else {
    const stmt = db.prepare(
      'SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    );
    rows = stmt.all(sessionId, limit, offset) as EventRow[];
  }

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    type: row.type as AgentEvent['type'],
    data: JSON.parse(row.data),
    tokens: row.tokens ? JSON.parse(row.tokens) : undefined,
    timestamp: row.timestamp,
  })) as AgentEvent[];
}

export function getEventCount(sessionId: string): number {
  const result = db.query('SELECT COUNT(*) as count FROM events WHERE session_id = ?').get(sessionId) as { count: number };
  return result.count;
}

export function getRecentEvents(sessionId: string, limit: number = 100): AgentEvent[] {
  return getEvents(sessionId, { limit, offset: 0 });
}
