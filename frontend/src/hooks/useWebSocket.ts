import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/session-store';
import type { AgentEvent } from '../types';

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { addEvent, setConnected, setContextSummary } = useSessionStore();

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected:', sessionId);
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected:', sessionId);
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AgentEvent;
        addEvent(data);

        // Update context summary from context_update events
        if (data.type === 'context_update') {
          setContextSummary({
            tokens: {
              used: data.data.totalTokens,
              limit: data.data.limit,
              breakdown: data.data.breakdown,
            },
            activeSkills: [],
            activeMcp: [],
            recentTools: [],
            filesModified: [],
          });
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    return ws;
  }, [sessionId, addEvent, setConnected, setContextSummary]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => {
      if (ws) ws.close();
    };
  }, [connect]);

  return { disconnect };
}
