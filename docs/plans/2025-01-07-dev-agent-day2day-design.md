# Dev Agent Day2Day - Design Document

## Overview

A demonstration app for visualizing how developers work with AI coding agents (Claude Code, Cursor) in their day-to-day workflows. Built for a company AI Day presentation.

## Purpose

Show the 4 main developer tasks with agent assistance:
1. Planning, design, and understanding flows
2. Coding (TDD, PR, rollout, feature flags, risks)
3. Reviewing other people's work
4. Problem solving, debugging, investigation, production issues

Key concepts demonstrated: Context management, Skills, MCP tools, Ralph Wiggum autonomous loop.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                  │
├──────────────────┬──────────────────────┬───────────────────────┤
│   Chat Panel     │  Context Panel       │    Files Panel        │
│   (30%)          │  (40% - star)        │    (30%)              │
├──────────────────┴──────────────────────┴───────────────────────┤
│                        Session Tabs Bar                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                            WebSocket
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND (Bun)                            │
├─────────────────────────────────────────────────────────────────┤
│  Session Manager  │  Agent Facade  │  Event Normalizer          │
├───────────────────┴────────────────┴────────────────────────────┤
│                        Agent Adapters                            │
│            ┌─────────────────┐    ┌─────────────────┐           │
│            │ ClaudeCodeAdapter│   │ CursorAdapter   │           │
│            │ (spawn CLI)      │   │ (future)        │           │
│            └─────────────────┘    └─────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Zustand
- **Backend:** Bun (native WebSocket, SQLite, subprocess handling)
- **Storage:** SQLite (persistent) + file-based blob storage
- **Communication:** WebSocket for real-time, REST for session management

## Core Features

### 1. Three-Panel Layout

#### Chat Panel (Left - 30%)
- Conversation history with markdown rendering
- Collapsible tool calls inline
- Collapsible thinking blocks
- Streaming responses with cursor
- Slash command buttons
- Pause/resume agent control

#### Context Panel (Center - 40% - THE STAR)
Three toggleable views:

**Dashboard View:**
- Token usage bar with breakdown (system, skills, MCP, messages, buffer)
- Stats cards (total tokens, tool calls, active MCP)
- Active skills list
- Git worktree status

**Timeline View:**
- Live activity feed of events
- Tool calls with status (running/done/error)
- MCP activations
- Skill activations with token impact

**CDD Octopus View:**
- Visual of context sources feeding the agent
- Arms: CDD repo, Skills, MCP, Project files, GitHub CLI, Conversation
- Shows what's actively feeding context
- Size proportional to token usage

#### Files Panel (Right - 30%)
- File tree with change indicators (new, modified, deleted)
- Three view modes: Tree, List, Diff
- Syntax-highlighted file content
- Live updates as agent writes
- CDD docs referenced section

### 2. Session Management

**Multiple Sessions:**
- Tab bar for parallel sessions
- Each session = separate agent process
- States: running, paused, saved, replay

**Persistence:**
- SQLite stores all events
- Survives server restart
- Can restore any session

**Replay Mode:**
- Record sessions as event logs
- Playback with speed control
- Pause points for presentation
- "Live takeover" - jump from replay to real agent

### 3. Ralph Wiggum Loop (Autonomous Mode)

Visual task queue showing:
- Plan with numbered tasks
- Current task progress
- Validation checks (build, tests, browser)
- Loop status and timing

### 4. Data Management

**Tiered Storage:**
- Hot (Memory): Last 100 events, current context state
- Warm (SQLite): Full event log, indexed and searchable
- Cold (Files): Large blobs (>10kb) like file diffs

**Frontend Efficiency:**
- Virtualized lists for long conversations
- Pagination API for events
- Summary endpoints for dashboards
- On-demand blob fetching

## API Design

### REST Endpoints
```
POST   /session              # Create new session
GET    /sessions             # List all sessions
GET    /session/:id          # Get session details
POST   /session/:id/prompt   # Send message to agent
POST   /session/:id/pause    # Pause agent
POST   /session/:id/resume   # Resume agent
DELETE /session/:id          # Kill session

GET    /session/:id/events?offset=0&limit=50
GET    /session/:id/events?type=tool_call
GET    /session/:id/context-summary
GET    /session/:id/blob/:blobId
```

### WebSocket Events
```
→ /ws/:sessionId

← { type: 'message', data: {...}, tokens: {...} }
← { type: 'tool_call', data: {...}, tokens: {...} }
← { type: 'tool_result', data: {...} }
← { type: 'thinking', data: {...} }
← { type: 'skill_activated', data: {...} }
← { type: 'mcp_call', data: {...} }
← { type: 'context_update', data: {...} }
← { type: 'loop_event', data: {...} }
```

## Storage Structure

```
~/.dev-agent-day2day/
├── sessions.db              # SQLite database
├── sessions/
│   ├── {session-id}/
│   │   ├── blobs/           # Large payloads
│   │   └── replay-config.json
└── config.json              # Global settings
```

## Implementation Phases

### Phase 1: Foundation
- Bun server with WebSocket
- SQLite setup
- Claude Code adapter
- Basic React 3-panel skeleton
- Single session end-to-end

### Phase 2: Context Panel
- Dashboard view
- Timeline view
- CDD Octopus view
- View toggle

### Phase 3: Chat & Files
- Chat UI with markdown
- Streaming responses
- File tree with changes
- Diff viewer
- Syntax highlighting

### Phase 4: Sessions & Persistence
- Multi-session tabs
- SQLite persistence
- Session restore
- Replay mode

### Phase 5: Polish
- Ralph Wiggum loop UI
- Git worktree indicator
- Dark mode
- Keyboard shortcuts
- Demo session recording

## Code to Extract from vibe-kanban

- `useJsonPatchWsStream.ts` - WebSocket streaming pattern
- `DisplayConversationEntry.tsx` - Event rendering patterns
- `FileContentView.tsx` - Syntax highlighting
- `EditDiffRenderer.tsx` - Diff visualization
- `shared/types.ts` - Event type inspiration

## Key Design Decisions

1. **Bun over Node/Rust** - Fast to build, native SQLite/WebSocket, great subprocess handling
2. **SQLite for persistence** - Single file, survives restarts, no external DB needed
3. **Adapter pattern** - Start with Claude Code, easy to add Cursor later
4. **Replay mode** - Predictable demos for presentation, no live agent risk
5. **Tiered storage** - Handle long sessions without memory issues
6. **Context panel as star** - Main "wow factor" showing agent's brain
