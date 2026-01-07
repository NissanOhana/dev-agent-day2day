import type { Session, ContextSummary, AgentEvent } from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Sessions
  getSessions: () => fetchJson<Session[]>('/sessions'),

  createSession: (workingDir: string, name?: string) =>
    fetchJson<Session>('/session', {
      method: 'POST',
      body: JSON.stringify({ workingDir, name }),
    }),

  getSession: (id: string) => fetchJson<Session>(`/session/${id}`),

  startSession: (id: string) =>
    fetchJson<{ success: boolean }>(`/session/${id}/start`, { method: 'POST' }),

  sendPrompt: (id: string, message: string) =>
    fetchJson<{ success: boolean }>(`/session/${id}/prompt`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  pauseSession: (id: string) =>
    fetchJson<{ success: boolean }>(`/session/${id}/pause`, { method: 'POST' }),

  resumeSession: (id: string) =>
    fetchJson<{ success: boolean }>(`/session/${id}/resume`, { method: 'POST' }),

  deleteSession: (id: string) =>
    fetchJson<{ success: boolean }>(`/session/${id}`, { method: 'DELETE' }),

  // Events
  getEvents: (id: string, options?: { offset?: number; limit?: number; type?: string }) => {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.type) params.set('type', options.type);
    return fetchJson<AgentEvent[]>(`/session/${id}/events?${params}`);
  },

  // Context
  getContextSummary: (id: string) => fetchJson<ContextSummary>(`/session/${id}/context-summary`),
};
