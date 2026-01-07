import { create } from 'zustand';
import type { Session, AgentEvent, ContextSummary, ContextView } from '../types';

interface SessionState {
  // Sessions
  sessions: Session[];
  activeSessionId: string | null;

  // Events for active session
  events: AgentEvent[];

  // Context summary
  contextSummary: ContextSummary | null;

  // UI state
  contextView: ContextView;
  isConnected: boolean;

  // Actions
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;

  addEvent: (event: AgentEvent) => void;
  setEvents: (events: AgentEvent[]) => void;
  clearEvents: () => void;

  setContextSummary: (summary: ContextSummary | null) => void;
  setContextView: (view: ContextView) => void;
  setConnected: (connected: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,
  events: [],
  contextSummary: null,
  contextView: 'dashboard',
  isConnected: false,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => set((state) => ({
    sessions: [...state.sessions, session],
  })),

  updateSession: (id, updates) => set((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    ),
  })),

  removeSession: (id) => set((state) => ({
    sessions: state.sessions.filter((s) => s.id !== id),
    activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
  })),

  setActiveSession: (id) => set({
    activeSessionId: id,
    events: [],
    contextSummary: null,
  }),

  addEvent: (event) => set((state) => ({
    events: [...state.events, event],
  })),

  setEvents: (events) => set({ events }),

  clearEvents: () => set({ events: [] }),

  setContextSummary: (summary) => set({ contextSummary: summary }),

  setContextView: (view) => set({ contextView: view }),

  setConnected: (connected) => set({ isConnected: connected }),
}));
