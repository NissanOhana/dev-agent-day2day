import { useSessionStore } from '../../stores/session-store';
import { cn } from '../../lib/cn';

function TokenBar() {
  const { contextSummary } = useSessionStore();

  if (!contextSummary) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-sm text-gray-500">No context data yet</div>
      </div>
    );
  }

  const { used, limit, breakdown } = contextSummary.tokens;
  const percentage = (used / limit) * 100;

  const segments = [
    { key: 'system', color: 'bg-blue-500', value: breakdown.system, label: 'System' },
    { key: 'skills', color: 'bg-purple-500', value: breakdown.skills, label: 'Skills' },
    { key: 'mcp', color: 'bg-green-500', value: breakdown.mcp, label: 'MCP' },
    { key: 'messages', color: 'bg-amber-500', value: breakdown.messages, label: 'Messages' },
  ];

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Context Usage</span>
        <span className="text-sm text-gray-500">
          {formatTokens(used)} / {formatTokens(limit)} ({percentage.toFixed(1)}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
        {segments.map((seg) => {
          const width = (seg.value / limit) * 100;
          return (
            <div
              key={seg.key}
              className={cn(seg.color, 'h-full transition-all')}
              style={{ width: `${width}%` }}
              title={`${seg.label}: ${formatTokens(seg.value)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
            <div className={cn('w-3 h-3 rounded', seg.color)} />
            <span className="text-gray-600 dark:text-gray-400">
              {seg.label}: {formatTokens(seg.value)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-300 dark:bg-gray-600" />
          <span className="text-gray-600 dark:text-gray-400">
            Buffer: {formatTokens(limit - used)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatsCards() {
  const { contextSummary, events } = useSessionStore();

  const toolCalls = events.filter((e) => e.type === 'tool_call').length;
  const mcpCalls = events.filter((e) => e.type === 'mcp_call').length;
  const skills = contextSummary?.activeSkills.length || 0;

  const cards = [
    { label: 'Tool Calls', value: toolCalls, color: 'text-amber-600' },
    { label: 'MCP Calls', value: mcpCalls, color: 'text-green-600' },
    { label: 'Active Skills', value: skills, color: 'text-purple-600' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center"
        >
          <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
          <div className="text-xs text-gray-500 mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}

function ActiveSkillsList() {
  const { contextSummary } = useSessionStore();
  const skills = contextSummary?.activeSkills || [];

  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="text-sm font-medium mb-2">Active Skills</div>
      <div className="space-y-1">
        {skills.map((skill, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-purple-600 dark:text-purple-400">• {skill.name}</span>
            <span className="text-xs text-gray-500">{skill.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentToolsList() {
  const { contextSummary } = useSessionStore();
  const tools = contextSummary?.recentTools.slice(0, 10) || [];

  if (tools.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="text-sm font-medium mb-2">Recent Tools</div>
      <div className="space-y-1">
        {tools.map((tool, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="font-mono text-amber-600 dark:text-amber-400">{tool.name}</span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                tool.status === 'done' && 'bg-green-100 text-green-700',
                tool.status === 'running' && 'bg-blue-100 text-blue-700',
                tool.status === 'error' && 'bg-red-100 text-red-700'
              )}
            >
              {tool.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardView() {
  return (
    <div className="space-y-4">
      <TokenBar />
      <StatsCards />
      <ActiveSkillsList />
      <RecentToolsList />
    </div>
  );
}
