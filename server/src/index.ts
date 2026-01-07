import type { ServerWebSocket } from 'bun';
import * as sessionManager from './session-manager';
import type { CreateSessionRequest, SendPromptRequest } from './types';

const PORT = 3001;

interface WsData {
  sessionId: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Parse JSON body
async function parseBody<T>(req: Request): Promise<T> {
  const text = await req.text();
  return JSON.parse(text) as T;
}

// JSON response helper
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Error response helper
function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

const server = Bun.serve<WsData>({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // WebSocket upgrade
    if (path.startsWith('/ws/')) {
      const sessionId = path.split('/')[2];
      if (!sessionId) {
        return error('Session ID required', 400);
      }

      const upgraded = server.upgrade(req, { data: { sessionId } });
      if (!upgraded) {
        return error('WebSocket upgrade failed', 500);
      }
      return undefined;
    }

    // REST API routes
    try {
      // GET /sessions - List all sessions
      if (path === '/sessions' && method === 'GET') {
        const sessions = sessionManager.getAllSessions();
        return json(sessions);
      }

      // POST /session - Create new session
      if (path === '/session' && method === 'POST') {
        const body = await parseBody<CreateSessionRequest>(req);
        if (!body.workingDir) {
          return error('workingDir is required');
        }
        const session = sessionManager.createSession(
          body.workingDir,
          body.name,
          body.agentType
        );
        return json(session, 201);
      }

      // GET /session/:id - Get session details
      const sessionMatch = path.match(/^\/session\/([^/]+)$/);
      if (sessionMatch && method === 'GET') {
        const session = sessionManager.getSession(sessionMatch[1]);
        if (!session) {
          return error('Session not found', 404);
        }
        return json(session);
      }

      // POST /session/:id/start - Start session
      const startMatch = path.match(/^\/session\/([^/]+)\/start$/);
      if (startMatch && method === 'POST') {
        await sessionManager.startSession(startMatch[1]);
        return json({ success: true });
      }

      // POST /session/:id/prompt - Send prompt
      const promptMatch = path.match(/^\/session\/([^/]+)\/prompt$/);
      if (promptMatch && method === 'POST') {
        const body = await parseBody<SendPromptRequest>(req);
        if (!body.message) {
          return error('message is required');
        }
        await sessionManager.sendPrompt(promptMatch[1], body.message);
        return json({ success: true });
      }

      // POST /session/:id/pause - Pause session
      const pauseMatch = path.match(/^\/session\/([^/]+)\/pause$/);
      if (pauseMatch && method === 'POST') {
        sessionManager.pauseSession(pauseMatch[1]);
        return json({ success: true });
      }

      // POST /session/:id/resume - Resume session
      const resumeMatch = path.match(/^\/session\/([^/]+)\/resume$/);
      if (resumeMatch && method === 'POST') {
        sessionManager.resumeSession(resumeMatch[1]);
        return json({ success: true });
      }

      // DELETE /session/:id - Delete session
      const deleteMatch = path.match(/^\/session\/([^/]+)$/);
      if (deleteMatch && method === 'DELETE') {
        await sessionManager.deleteSession(deleteMatch[1]);
        return json({ success: true });
      }

      // GET /session/:id/events - Get events with pagination
      const eventsMatch = path.match(/^\/session\/([^/]+)\/events$/);
      if (eventsMatch && method === 'GET') {
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const type = url.searchParams.get('type') || undefined;

        const events = sessionManager.getEvents(eventsMatch[1], { offset, limit, type });
        return json(events);
      }

      // GET /session/:id/context-summary - Get context summary
      const contextMatch = path.match(/^\/session\/([^/]+)\/context-summary$/);
      if (contextMatch && method === 'GET') {
        const summary = sessionManager.getContextSummary(contextMatch[1]);
        if (!summary) {
          return error('Session not found', 404);
        }
        return json(summary);
      }

      // Health check
      if (path === '/health') {
        return json({ status: 'ok', timestamp: Date.now() });
      }

      return error('Not found', 404);
    } catch (err) {
      console.error('API error:', err);
      return error(err instanceof Error ? err.message : 'Internal server error', 500);
    }
  },

  websocket: {
    open(ws: ServerWebSocket<WsData>) {
      console.log(`WebSocket connected: ${ws.data.sessionId}`);
      sessionManager.subscribe(ws.data.sessionId, ws);
    },

    close(ws: ServerWebSocket<WsData>) {
      console.log(`WebSocket disconnected: ${ws.data.sessionId}`);
      sessionManager.unsubscribe(ws.data.sessionId, ws);
    },

    message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
      // Handle incoming messages from client if needed
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Ignore invalid JSON
      }
    },
  },
});

console.log(`🚀 Dev Agent Server running at http://localhost:${PORT}`);
console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws/:sessionId`);
