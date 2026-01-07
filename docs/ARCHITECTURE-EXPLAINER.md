# Architecture Explainer: Dev Agent Day2Day

A mini guide explaining the key technologies and patterns used in this project.

## The Stack

### Frontend: React + Vite

**React** is a JavaScript library for building user interfaces using components.
**Vite** is a fast build tool that serves your code during development with hot reload.

```bash
# Create a new Vite + React + TypeScript project
bun create vite frontend --template react-ts
```

Why Vite over Create React App?
- 10-100x faster startup
- Instant hot module replacement (HMR)
- Built-in TypeScript support
- Smaller production bundles

### Backend: Bun

**Bun** is a fast JavaScript runtime (like Node.js but faster) with built-in:
- Package manager (like npm/yarn but faster)
- Bundler
- Test runner
- SQLite database
- WebSocket server

```typescript
// Starting a Bun server is simple
Bun.serve({
  port: 3001,
  fetch(req) {
    return new Response("Hello!");
  },
  websocket: {
    message(ws, message) {
      // Handle WebSocket messages
    }
  }
});
```

### What is `spawn`?

`spawn` creates a child process - running another program from your code.

```typescript
// Spawn Claude Code CLI as a subprocess
const agent = Bun.spawn(["claude", "--json"], {
  stdin: "pipe",   // We can write to its input
  stdout: "pipe",  // We can read its output
});

// Send a prompt to Claude
agent.stdin.write("Help me write a function\n");

// Read Claude's response (streaming)
for await (const chunk of agent.stdout) {
  console.log(new TextDecoder().decode(chunk));
}
```

This is how the backend controls Claude Code - it spawns the CLI process and communicates via stdin/stdout.

### WebSocket: Real-time Communication

HTTP is request-response: client asks, server answers, connection closes.
WebSocket is persistent: connection stays open, both sides can send messages anytime.

```
HTTP:
Client ──request──► Server
Client ◄──response── Server
(connection closed)

WebSocket:
Client ◄───────────► Server
       (stays open)
       ◄── message ──
       ── message ──►
       ◄── message ──
```

Perfect for streaming agent responses in real-time.

### SQLite: Embedded Database

SQLite is a database in a single file. No server needed.

```typescript
import { Database } from "bun:sqlite";

// Create/open database file
const db = new Database("sessions.db");

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    type TEXT,
    data TEXT,
    timestamp INTEGER
  )
`);

// Insert data
db.run("INSERT INTO events (session_id, type, data) VALUES (?, ?, ?)",
  ["session-1", "tool_call", JSON.stringify({tool: "Read"})]);

// Query data
const events = db.query("SELECT * FROM events WHERE session_id = ?")
  .all("session-1");
```

File survives restarts. No external database to manage.

## Key Patterns

### Adapter Pattern

Different CLI agents (Claude Code, Cursor) have different output formats.
An adapter normalizes them to a common format.

```typescript
// Common interface
interface AgentAdapter {
  spawn(sessionId: string): Process;
  parseOutput(line: string): NormalizedEvent;
}

// Claude Code implementation
class ClaudeCodeAdapter implements AgentAdapter {
  spawn(sessionId: string) {
    return Bun.spawn(["claude", "--json", "--session", sessionId]);
  }

  parseOutput(line: string): NormalizedEvent {
    const raw = JSON.parse(line);
    // Transform Claude Code's format to our format
    return { type: raw.type, data: raw.content, ... };
  }
}

// Cursor implementation (future)
class CursorAdapter implements AgentAdapter {
  spawn(sessionId: string) {
    return Bun.spawn(["cursor", "--agent", sessionId]);
  }

  parseOutput(line: string): NormalizedEvent {
    // Transform Cursor's format to our format
    ...
  }
}
```

Frontend doesn't care which agent - it just receives `NormalizedEvent`.

### Ring Buffer for Hot Data

Keep last N items in memory without growing forever.

```typescript
class RingBuffer<T> {
  private buffer: T[];
  private index = 0;

  constructor(private size: number) {
    this.buffer = new Array(size);
  }

  push(item: T) {
    this.buffer[this.index % this.size] = item;
    this.index++;
  }

  getRecent(): T[] {
    // Return items in order, newest last
    ...
  }
}

// Usage: keep last 100 events in memory
const recentEvents = new RingBuffer<Event>(100);
```

### Virtualized Lists

Don't render 10,000 DOM elements. Only render what's visible.

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function EventList({ events }) {
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 50, // estimated row height
  });

  return (
    <div ref={scrollRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size,
            }}
          >
            <EventRow event={events[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Only ~20 DOM elements exist, no matter how many events.

## Data Flow

```
User types message
        │
        ▼
┌─────────────────┐
│  React Frontend │ ── WebSocket ──┐
└─────────────────┘                │
                                   ▼
                          ┌─────────────────┐
                          │   Bun Server    │
                          │                 │
                          │  SessionManager │
                          │       │         │
                          │       ▼         │
                          │  AgentAdapter   │
                          │       │         │
                          │   Bun.spawn()   │
                          └───────┼─────────┘
                                  │
                                  ▼
                          ┌─────────────────┐
                          │  Claude Code    │
                          │     CLI         │
                          └───────┼─────────┘
                                  │
                            JSON output
                                  │
                                  ▼
                          ┌─────────────────┐
                          │  Bun Server     │
                          │                 │
                          │  Parse + Store  │──► SQLite
                          │       │         │
                          │  Normalize      │
                          │       │         │
                          │  Broadcast      │
                          └───────┼─────────┘
                                  │
                             WebSocket
                                  │
                                  ▼
                          ┌─────────────────┐
                          │  React Frontend │
                          │                 │
                          │  Update State   │
                          │  Render UI      │
                          └─────────────────┘
```

## Why These Choices?

| Choice | Why |
|--------|-----|
| Bun over Node | Native SQLite, faster, better subprocess handling |
| SQLite over Postgres | No server, single file, perfect for local app |
| WebSocket over polling | Real-time streaming, lower latency |
| Zustand over Redux | Simpler, less boilerplate, good for this scale |
| shadcn/ui over MUI | Lighter, copy-paste components, full control |
| Adapter pattern | Easy to add Cursor later without changing frontend |
| Ring buffer | Bounded memory for hot data |
| Virtualization | Handle long conversations without lag |
