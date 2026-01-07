import { useSessionStore } from '../../stores/session-store';
import { cn } from '../../lib/cn';

interface ContextArm {
  id: string;
  name: string;
  icon: string;
  color: string;
  tokens: number;
  items: string[];
  isActive: boolean;
}

export function CddOctopusView() {
  const { contextSummary, events } = useSessionStore();

  // Build arms from context data
  const arms: ContextArm[] = [
    {
      id: 'system',
      name: 'System Prompt',
      icon: '⚙️',
      color: 'bg-blue-500',
      tokens: contextSummary?.tokens.breakdown.system || 15000,
      items: ['Base instructions', 'Tool definitions'],
      isActive: true,
    },
    {
      id: 'skills',
      name: 'Skills',
      icon: '⚡',
      color: 'bg-purple-500',
      tokens: contextSummary?.tokens.breakdown.skills || 0,
      items: contextSummary?.activeSkills.map((s) => s.name) || [],
      isActive: (contextSummary?.activeSkills.length || 0) > 0,
    },
    {
      id: 'mcp',
      name: 'MCP Tools',
      icon: '🔌',
      color: 'bg-green-500',
      tokens: contextSummary?.tokens.breakdown.mcp || 0,
      items: contextSummary?.activeMcp.flatMap((m) => m.tools.map((t) => `${m.server}/${t}`)) || [],
      isActive: (contextSummary?.activeMcp.length || 0) > 0,
    },
    {
      id: 'files',
      name: 'Project Files',
      icon: '📁',
      color: 'bg-amber-500',
      tokens: 0,
      items: contextSummary?.filesModified || [],
      isActive: (contextSummary?.filesModified.length || 0) > 0,
    },
    {
      id: 'github',
      name: 'GitHub CLI',
      icon: '🐙',
      color: 'bg-gray-500',
      tokens: 0,
      items: [],
      isActive: events.some((e) => e.type === 'mcp_call' && e.data.server.includes('github')),
    },
    {
      id: 'messages',
      name: 'Conversation',
      icon: '💬',
      color: 'bg-cyan-500',
      tokens: contextSummary?.tokens.breakdown.messages || 0,
      items: [`${events.filter((e) => e.type === 'message').length} messages`],
      isActive: true,
    },
  ];

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  // Recent feeding activity
  const recentActivity = events
    .slice(-5)
    .reverse()
    .filter((e) => ['tool_call', 'mcp_call', 'skill_activated'].includes(e.type));

  return (
    <div className="space-y-6">
      {/* Octopus Visualization */}
      <div className="relative p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {/* Center - Agent Brain */}
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
          🧠
        </div>
        <div className="text-center mt-2 text-sm font-medium">Agent Brain</div>

        {/* Arms Grid */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {arms.map((arm) => (
            <div
              key={arm.id}
              className={cn(
                'p-3 rounded-lg border-2 transition-all',
                arm.isActive
                  ? 'border-current opacity-100'
                  : 'border-gray-200 dark:border-gray-700 opacity-50'
              )}
              style={{ borderColor: arm.isActive ? undefined : undefined }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{arm.icon}</span>
                <span className="font-medium text-sm">{arm.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('h-2 rounded-full flex-1', arm.color)}
                     style={{ opacity: arm.tokens > 0 ? 1 : 0.3 }} />
                <span className="text-xs text-gray-500">
                  {formatTokens(arm.tokens)}
                </span>
              </div>
              {arm.items.length > 0 && (
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  {arm.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="truncate">• {item}</div>
                  ))}
                  {arm.items.length > 3 && (
                    <div className="text-gray-400">+{arm.items.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Feeding Activity */}
      {recentActivity.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-sm font-medium mb-2">Feeding Now</div>
          <div className="space-y-2">
            {recentActivity.map((event) => (
              <div key={event.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-gray-600 dark:text-gray-400">
                  {event.type === 'tool_call' && `Reading: ${event.data.toolName}`}
                  {event.type === 'mcp_call' && `MCP: ${event.data.tool}`}
                  {event.type === 'skill_activated' && `Skill: ${event.data.skillName}`}
                </span>
                {event.tokens && (
                  <span className="text-xs text-gray-400 ml-auto">
                    +{formatTokens(event.tokens.added)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
