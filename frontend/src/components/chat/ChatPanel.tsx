import { useState, useRef, useEffect } from 'react';
import { Send, Pause, Play } from 'lucide-react';
import { useSessionStore } from '../../stores/session-store';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { AgentEvent } from '../../types';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function EventRenderer({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case 'message':
      return (
        <div
          className={cn(
            'p-3 rounded-lg',
            event.data.role === 'user'
              ? 'bg-blue-100 dark:bg-blue-900 ml-8'
              : 'bg-gray-100 dark:bg-gray-800 mr-8'
          )}
        >
          <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
            <span>{event.data.role === 'user' ? '👤 User' : '🤖 Agent'}</span>
            <span>{formatTime(event.timestamp)}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap">{event.data.content}</div>
        </div>
      );

    case 'tool_call':
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-800 text-sm">
          <span className="text-amber-600 dark:text-amber-400">▶</span>
          <span className="font-mono">{event.data.toolName}</span>
          <span
            className={cn(
              'ml-auto text-xs px-2 py-0.5 rounded',
              event.data.status === 'running' && 'bg-blue-100 text-blue-700',
              event.data.status === 'done' && 'bg-green-100 text-green-700',
              event.data.status === 'error' && 'bg-red-100 text-red-700'
            )}
          >
            {event.data.status}
          </span>
        </div>
      );

    case 'thinking':
      return (
        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800 text-sm text-purple-700 dark:text-purple-300 italic">
          💭 Thinking...
        </div>
      );

    case 'error':
      return (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          ❌ {event.data.message}
        </div>
      );

    default:
      return null;
  }
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { activeSessionId, events, sessions } = useSessionStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isRunning = activeSession?.status === 'running';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId || sending) return;

    try {
      setSending(true);
      await api.sendPrompt(activeSessionId, input);
      setInput('');
    } catch (err) {
      console.error('Failed to send prompt:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePauseResume = async () => {
    if (!activeSessionId) return;
    try {
      if (isRunning) {
        await api.pauseSession(activeSessionId);
      } else {
        await api.resumeSession(activeSessionId);
      }
    } catch (err) {
      console.error('Failed to pause/resume:', err);
    }
  };

  if (!activeSessionId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-500">
        <p>No session selected</p>
        <p className="text-sm">Create or select a session to start</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="font-medium">{activeSession?.name || 'Session'}</span>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isRunning ? 'bg-green-500' : 'bg-gray-400'
            )}
          />
          {activeSession?.status}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {events.map((event) => (
          <EventRenderer key={event.id} event={event} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            /skill
          </button>
          <button className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            /context
          </button>
          <button className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            /plan
          </button>
          <div className="flex-1" />
          <button
            onClick={handlePauseResume}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {isRunning ? <Pause size={12} /> : <Play size={12} />}
            {isRunning ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
    </div>
  );
}
