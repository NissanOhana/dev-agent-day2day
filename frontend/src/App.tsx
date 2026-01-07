import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { ChatPanel } from './components/chat/ChatPanel';
import { ContextPanel } from './components/context/ContextPanel';
import { FilesPanel } from './components/files/FilesPanel';
import { useSessionStore } from './stores/session-store';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './lib/api';
import './index.css';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const { activeSessionId, setSessions, setContextSummary } = useSessionStore();

  // Connect WebSocket to active session
  useWebSocket(activeSessionId);

  // Load sessions on mount
  useEffect(() => {
    api.getSessions().then(setSessions).catch(console.error);
  }, [setSessions]);

  // Load context summary when session changes
  useEffect(() => {
    if (activeSessionId) {
      api.getContextSummary(activeSessionId).then(setContextSummary).catch(console.error);
    }
  }, [activeSessionId, setContextSummary]);

  // Toggle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel - 30% */}
        <div className="w-[30%] border-r overflow-hidden">
          <ChatPanel />
        </div>

        {/* Context Panel - 40% (The Star) */}
        <div className="w-[40%] border-r overflow-hidden">
          <ContextPanel />
        </div>

        {/* Files Panel - 30% */}
        <div className="w-[30%] overflow-hidden">
          <FilesPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
