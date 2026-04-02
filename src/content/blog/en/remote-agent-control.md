---
title: "Remote AI Agent Control — Managing Coding Agents from Your Phone"
description: "How to control AI coding agents remotely via messaging platforms like Telegram, with on-demand session spawning and secure access."
date: "2026-03-25"
tag: "devtools"
tagColor: "#38bdf8"
readTime: "6 min read"
lang: "en"
---

## Why Control Agents Remotely?

You are on a train, reviewing a pull request on your phone. You spot an issue — a missing null check that will cause a crash in production. Normally, you would bookmark it and fix it later at your desk. But what if you could message your AI coding agent right now, from Telegram, and have it push a fix?

Remote agent control bridges the gap between mobile convenience and desktop-grade development workflows. It does not replace your IDE — it extends your reach to moments where opening a laptop is not practical.

## Architecture: On-Demand Session Spawning

The core pattern is straightforward. A lightweight bridge service connects a messaging platform (Telegram, Discord, Slack) to your AI coding agent running on a server.

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  Phone   │────▶│   Bridge    │────▶│  AI Agent    │
│ Telegram │◀────│   Service   │◀────│  (on VPS)    │
└──────────┘     └─────────────┘     └──────────────┘
                   SSE stream           Spawned on
                   per session          demand
```

When you send a message, the bridge:

1. **Authenticates** the request against your user ID
2. **Spawns a new agent session** (or reconnects to an existing one)
3. **Forwards your message** as a prompt
4. **Streams the response** back via Server-Sent Events (SSE)

Each session is isolated. You can have multiple conversations running — one debugging a production issue, another generating test cases for a different repo.

### Session Spawning in Practice

```typescript
// Simplified session manager
class AgentSessionManager {
  private sessions: Map<string, AgentSession> = new Map();

  async getOrCreate(userId: string, repo?: string): Promise<AgentSession> {
    const key = `${userId}:${repo ?? "default"}`;

    if (this.sessions.has(key)) {
      const session = this.sessions.get(key)!;
      session.resetIdleTimer();
      return session;
    }

    const session = await AgentSession.spawn({
      workdir: repo ? `/repos/${repo}` : "/tmp/scratch",
      model: "claude-sonnet-4-20250514",
      timeout: 30 * 60 * 1000, // 30 min idle timeout
    });

    this.sessions.set(key, session);
    return session;
  }
}
```

## SSE for Real-Time Responses

AI agents generate responses token by token. Waiting for the full response before sending it to your phone creates an awkward delay — sometimes 30 seconds or more for complex tasks. Server-Sent Events solve this by streaming partial responses as they arrive.

On Telegram, this looks like a message that progressively updates every few hundred milliseconds, giving you real-time visibility into what the agent is doing. For longer outputs (code generation, file diffs), the bridge batches updates to avoid hitting API rate limits.

```typescript
// Stream agent output to Telegram
agentSession.on("token", async (token: string) => {
  buffer += token;

  if (shouldFlush(buffer, lastFlushTime)) {
    await telegram.editMessage(chatId, messageId, buffer);
    lastFlushTime = Date.now();
  }
});
```

## Security: Per-Instance Authentication

Remote agent control introduces a real attack surface. Your agent has access to your codebase, can run shell commands, and might have access to deployment credentials. Security is not optional here.

**Essential measures:**

- **Allowlisted user IDs.** Only pre-approved Telegram/Discord user IDs can interact with the bridge. No open registration.
- **Per-instance tokens.** Each bridge instance generates a unique auth token on startup. Even if someone knows your bot's username, they cannot interact without the token.
- **Command restrictions.** Define which agent capabilities are available remotely. You might allow code review and generation but block direct shell execution or git push.
- **Audit logging.** Every remote interaction is logged with timestamp, user ID, and the full prompt/response pair.

```yaml
# bridge-config.yaml
security:
  allowed_users:
    - telegram:123456789
  restricted_commands:
    - shell_exec
    - git_push
    - env_read
  audit_log: /var/log/agent-bridge/audit.jsonl
```

## Idle Timeouts and Resource Management

Agent sessions consume memory and compute. Without timeouts, a forgotten session could run indefinitely. The bridge should implement automatic cleanup:

- **Idle timeout:** Sessions with no interaction for 30 minutes are terminated automatically
- **Max session duration:** Hard cap of 4 hours regardless of activity
- **Graceful shutdown:** Before termination, the session state is serialized so it can be restored if the user returns

This keeps VPS costs predictable even if you forget to close a session.

## Practical Use Cases

**Code review on the go.** Send a PR link, get a summary of changes with flagged issues. Ask follow-up questions about specific files.

**Quick fixes.** Describe a bug, have the agent locate and patch it, then review the diff before approving the commit.

**Deployment monitoring.** Ask the agent to check deployment status, tail logs, or run health checks — all from your phone.

**Pair programming with context.** Start a conversation about an architecture decision during your commute. The agent remembers context within the session, so you can iterate on ideas without repeating yourself.

**Triggering CI/CD.** Have the agent create a branch, push a fix, and open a pull request. You review and merge from your phone's GitHub app.

## Getting Started

The setup requires three components: a VPS running your AI agent, the bridge service, and a bot on your messaging platform. If you are already self-hosting agents (see our [VPS setup guide](/blog/en/self-hosting-ai-agents)), adding the bridge is a single service in your Docker Compose stack.

The bridge pattern works with any agent that supports stdio or HTTP-based interaction. It is not tied to a specific AI coding tool — the same architecture works whether you are running Claude Code, Aider, or a custom agent built with Agent Forge.

Remote control does not replace sitting down and writing code. But it turns dead time into productive time, and that adds up.
