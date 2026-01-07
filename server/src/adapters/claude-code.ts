import { nanoid } from 'nanoid';
import type { Subprocess } from 'bun';
import type { AgentAdapter, EventHandler } from './types';
import type { AgentEvent, ToolStatus, TokenBreakdown } from '../types';

// Claude Code JSON output types (based on --output-format stream-json)
interface ClaudeMessage {
  type: 'user' | 'assistant' | 'system';
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string; tool_use_id?: string; content?: string }>;
  };
  tool_use?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  tool_result?: {
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  };
  thinking?: string;
  result?: {
    duration_ms?: number;
    cost_usd?: number;
    num_turns?: number;
    session_id?: string;
  };
}

interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: ClaudeMessage;
  tool_use?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  tool_result?: {
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  };
  content_block?: {
    type: string;
    text?: string;
    thinking?: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export class ClaudeCodeAdapter implements AgentAdapter {
  private process: Subprocess<'pipe', 'pipe', 'pipe'> | null = null;
  private running = false;
  private paused = false;
  private pendingToolCalls = new Map<string, { name: string; startTime: number }>();
  private totalTokens = 0;
  private tokenBreakdown: TokenBreakdown = {
    system: 15000, // Estimate for system prompt
    skills: 0,
    mcp: 0,
    messages: 0,
    buffer: 0,
  };

  constructor(
    private sessionId: string,
    private workingDir: string,
    private onEvent: EventHandler
  ) {}

  async start(): Promise<void> {
    if (this.running) return;

    this.process = Bun.spawn(
      ['claude', '--output-format', 'stream-json', '--verbose'],
      {
        cwd: this.workingDir,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, FORCE_COLOR: '0' },
      }
    );

    this.running = true;
    this.readOutput();
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.running = false;
  }

  pause(): void {
    this.paused = true;
    // Claude Code doesn't have a built-in pause, so we just stop reading
  }

  resume(): void {
    this.paused = false;
  }

  async sendPrompt(message: string): Promise<void> {
    if (!this.process || !this.running) {
      throw new Error('Agent not running');
    }

    this.process.stdin.write(message + '\n');
    this.process.stdin.flush();

    // Update message tokens estimate
    this.tokenBreakdown.messages += Math.ceil(message.length / 4);
    this.updateTotalTokens();
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  private async readOutput(): Promise<void> {
    if (!this.process) return;

    const decoder = new TextDecoder();
    let buffer = '';

    const reader = this.process.stdout.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            this.parseLine(line.trim());
          }
        }
      }
    } catch (error) {
      console.error('Error reading Claude output:', error);
    } finally {
      this.running = false;
    }
  }

  private parseLine(line: string): void {
    // Try to parse as JSON
    try {
      const event = JSON.parse(line) as ClaudeStreamEvent;
      this.handleClaudeEvent(event);
    } catch {
      // Not JSON, might be plain text output
      if (line.startsWith('{') || line.startsWith('[')) {
        console.warn('Failed to parse JSON:', line.slice(0, 100));
      }
      // For non-JSON output, emit as assistant message
      if (line.length > 0 && !line.startsWith('╭') && !line.startsWith('│') && !line.startsWith('╰')) {
        this.emitEvent({
          id: nanoid(),
          type: 'message',
          timestamp: Date.now(),
          sessionId: this.sessionId,
          data: { role: 'assistant', content: line },
        });
      }
    }
  }

  private handleClaudeEvent(event: ClaudeStreamEvent): void {
    const timestamp = Date.now();

    // Handle different event types
    switch (event.type) {
      case 'assistant':
        if (event.message?.message?.content) {
          const content = event.message.message.content;
          let text = '';

          if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content)) {
            text = content
              .filter((c) => c.type === 'text' && c.text)
              .map((c) => c.text)
              .join('');
          }

          if (text) {
            this.emitEvent({
              id: nanoid(),
              type: 'message',
              timestamp,
              sessionId: this.sessionId,
              data: { role: 'assistant', content: text },
            });
          }
        }
        break;

      case 'tool_use':
        if (event.tool_use) {
          const { id, name, input } = event.tool_use;
          this.pendingToolCalls.set(id, { name, startTime: timestamp });

          // Check if it's an MCP tool
          if (name.startsWith('mcp__')) {
            const parts = name.split('__');
            const server = parts[1] || 'unknown';
            const toolName = parts.slice(2).join('__');

            this.emitEvent({
              id: nanoid(),
              type: 'mcp_call',
              timestamp,
              sessionId: this.sessionId,
              data: {
                server,
                tool: toolName,
                input,
                status: 'running' as ToolStatus,
              },
            });
          } else {
            this.emitEvent({
              id: nanoid(),
              type: 'tool_call',
              timestamp,
              sessionId: this.sessionId,
              data: {
                toolName: name,
                toolId: id,
                input,
                status: 'running' as ToolStatus,
              },
            });
          }

          // Check for skill activation
          if (name === 'Skill') {
            const skillName = (input as { skill?: string }).skill || 'unknown';
            this.emitEvent({
              id: nanoid(),
              type: 'skill_activated',
              timestamp,
              sessionId: this.sessionId,
              data: {
                skillName,
                source: 'plugin',
                tokensAdded: 2000, // Estimate
              },
            });
            this.tokenBreakdown.skills += 2000;
            this.updateTotalTokens();
          }
        }
        break;

      case 'tool_result':
        if (event.tool_result) {
          const { tool_use_id, content, is_error } = event.tool_result;
          const pending = this.pendingToolCalls.get(tool_use_id);
          const duration = pending ? timestamp - pending.startTime : undefined;

          this.emitEvent({
            id: nanoid(),
            type: 'tool_result',
            timestamp,
            sessionId: this.sessionId,
            data: {
              toolId: tool_use_id,
              toolName: pending?.name || 'unknown',
              result: content,
              isError: is_error || false,
              duration,
            },
          });

          this.pendingToolCalls.delete(tool_use_id);
        }
        break;

      case 'content_block':
        if (event.content_block?.thinking) {
          this.emitEvent({
            id: nanoid(),
            type: 'thinking',
            timestamp,
            sessionId: this.sessionId,
            data: { content: event.content_block.thinking },
          });
        }
        break;

      case 'usage':
        if (event.usage) {
          const { input_tokens, output_tokens } = event.usage;
          this.totalTokens = input_tokens + output_tokens;
          this.tokenBreakdown.messages = Math.max(
            0,
            this.totalTokens - this.tokenBreakdown.system - this.tokenBreakdown.skills - this.tokenBreakdown.mcp
          );

          this.emitEvent({
            id: nanoid(),
            type: 'context_update',
            timestamp,
            sessionId: this.sessionId,
            data: {
              breakdown: this.tokenBreakdown,
              totalTokens: this.totalTokens,
              limit: 200000,
            },
          });
        }
        break;

      case 'error':
        this.emitEvent({
          id: nanoid(),
          type: 'error',
          timestamp,
          sessionId: this.sessionId,
          data: {
            message: (event as { message?: string }).message || 'Unknown error',
          },
        });
        break;
    }
  }

  private updateTotalTokens(): void {
    this.totalTokens =
      this.tokenBreakdown.system +
      this.tokenBreakdown.skills +
      this.tokenBreakdown.mcp +
      this.tokenBreakdown.messages;
  }

  private emitEvent(event: AgentEvent): void {
    // Add token info to events
    if (!event.tokens) {
      event.tokens = {
        added: 0,
        total: this.totalTokens,
        limit: 200000,
        breakdown: { ...this.tokenBreakdown },
      };
    }

    this.onEvent(event);
  }
}
