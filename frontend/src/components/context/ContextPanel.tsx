import { useSessionStore } from '../../stores/session-store';
import { cn } from '../../lib/cn';
import type { ContextView } from '../../types';
import { DashboardView } from './DashboardView';
import { TimelineView } from './TimelineView';
import { CddOctopusView } from './CddOctopusView';

const views: { id: ContextView; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'cdd', label: 'CDD Octopus' },
];

export function ContextPanel() {
  const { contextView, setContextView, activeSessionId } = useSessionStore();

  if (!activeSessionId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-500">
        <p>No session selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* View Toggle */}
      <div className="flex items-center gap-1 p-2 border-b">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setContextView(view.id)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              contextView === view.id
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            )}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {contextView === 'dashboard' && <DashboardView />}
        {contextView === 'timeline' && <TimelineView />}
        {contextView === 'cdd' && <CddOctopusView />}
      </div>
    </div>
  );
}
