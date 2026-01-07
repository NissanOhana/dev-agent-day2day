import { useSessionStore } from '../../stores/session-store';
import { cn } from '../../lib/cn';
import type { AgentEvent } from '../../types';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getEventIcon(event: AgentEvent): string {
  switch (event.type) {
    case 'tool_call':
      return '▶';
    case 'tool_result':
      return '✓';
    case 'mcp_call':
      return '🔌';
    case 'skill_activated':
      return '⚡';
    case 'thinking':
      return '💭';
    case 'message':
      return event.data.role === 'user' ? '👤' : '🤖';
    case 'error':
      return '❌';
    case 'context_update':
      return '📊';
    case 'loop_event':
      return '🔄';
    default:
      return '•';
  }
}

function getEventLabel(event: AgentEvent): string {
  switch (event.type) {
    case 'tool_call':
      return `TOOL: ${event.data.toolName}`;
    case 'tool_result':
      return `RESULT: ${event.data.toolName}`;
    case 'mcp_call':
      return `MCP: ${event.data.server}/${event.data.tool}`;
    case 'skill_activated':
      return `SKILL: ${event.data.skillName}`;
    case 'thinking':
      return 'Thinking';
    case 'message':
      return event.data.role === 'user' ? 'User message' : 'Assistant message';
    case 'error':
      return `Error: ${event.data.message.slice(0, 50)}`;
    case 'context_update':
      return `Context: ${event.data.totalTokens.toLocaleString()} tokens`;
    case 'loop_event':
      return `Loop: ${event.data.loopType}`;
    default:
      return event.type;
  }
}

function getEventColor(event: AgentEvent): string {
  switch (event.type) {
    case 'tool_call':
    case 'tool_result':
      return 'text-amber-600 dark:text-amber-400';
    case 'mcp_call':
      return 'text-green-600 dark:text-green-400';
    case 'skill_activated':
      return 'text-purple-600 dark:text-purple-400';
    case 'thinking':
      return 'text-blue-600 dark:text-blue-400';
    case 'message':
      return 'text-gray-600 dark:text-gray-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'context_update':
      return 'text-cyan-600 dark:text-cyan-400';
    case 'loop_event':
      return 'text-indigo-600 dark:text-indigo-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

function getEventDetail(event: AgentEvent): string | null {
  switch (event.type) {
    case 'tool_call':
      const input = JSON.stringify(event.data.input).slice(0, 100);
      return input.length === 100 ? input + '...' : input;
    case 'tool_result':
      return event.data.duration ? `${event.data.duration}ms` : null;
    case 'skill_activated':
      return `+${event.data.tokensAdded.toLocaleString()} tokens`;
    default:
      return null;
  }
}

function TimelineEvent({ event }: { event: AgentEvent }) {
  const icon = getEventIcon(event);
  const label = getEventLabel(event);
  const color = getEventColor(event);
  const detail = getEventDetail(event);

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="text-xs text-gray-400 w-16 shrink-0">
        {formatTime(event.timestamp)}
      </div>
      <div className={cn('shrink-0', color)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium', color)}>{label}</div>
        {detail && (
          <div className="text-xs text-gray-500 truncate mt-0.5">{detail}</div>
        )}
      </div>
      {event.type === 'tool_call' && (
        <div
          className={cn(
            'text-xs px-1.5 py-0.5 rounded shrink-0',
            event.data.status === 'running' && 'bg-blue-100 text-blue-700',
            event.data.status === 'done' && 'bg-green-100 text-green-700',
            event.data.status === 'error' && 'bg-red-100 text-red-700'
          )}
        >
          {event.data.status}
        </div>
      )}
    </div>
  );
}

export function TimelineView() {
  const { events } = useSessionStore();

  // Show events in reverse chronological order (newest first)
  const sortedEvents = [...events].reverse();

  if (events.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No events yet</p>
        <p className="text-sm">Events will appear here as the agent works</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {sortedEvents.map((event) => (
        <TimelineEvent key={event.id} event={event} />
      ))}
    </div>
  );
}
