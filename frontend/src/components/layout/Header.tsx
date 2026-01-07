import { Plus, Sun, Moon, Settings } from 'lucide-react';
import { useSessionStore } from '../../stores/session-store';
import { cn } from '../../lib/cn';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({ darkMode, onToggleDarkMode }: HeaderProps) {
  const { sessions, activeSessionId, setActiveSession } = useSessionStore();

  return (
    <header className="flex items-center justify-between border-b px-4 py-2 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          Dev Agent Day2Day
        </h1>
      </div>

      {/* Session Tabs */}
      <div className="flex items-center gap-1 flex-1 mx-4 overflow-x-auto">
        <button
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          onClick={() => {/* TODO: Create new session modal */}}
        >
          <Plus size={14} />
          New
        </button>

        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
              activeSessionId === session.id
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                session.status === 'running' && 'bg-green-500',
                session.status === 'paused' && 'bg-yellow-500',
                session.status === 'stopped' && 'bg-gray-400',
                session.status === 'replay' && 'bg-purple-500'
              )}
            />
            {session.name}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
