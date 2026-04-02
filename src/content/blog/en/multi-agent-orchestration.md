---
title: "Multi-Agent Orchestration — From Single Agent to Agent Pipelines"
description: "How to orchestrate multiple AI agents into reliable pipelines with proper routing, lifecycle management, and model assignment."
date: "2026-02-24"
tag: "agents"
tagColor: "#818cf8"
readTime: "7 min read"
lang: "en"
---

## Beyond the Single Agent

A single AI agent can do impressive things — write code, answer questions, refactor files. But real-world development workflows rarely fit into a single agent's scope. You need one agent to analyze a codebase, another to generate tests, a third to review those tests, and a fourth to update documentation. Running all of this in one session means a bloated context window, confused instructions, and degraded output quality.

Multi-agent orchestration solves this by breaking workflows into stages, each handled by a specialized agent with its own context, model, and instructions. The orchestrator manages the flow between them.

## What Sub-Agents Actually Are

A sub-agent is an isolated agent session — separate context window, separate system prompt, separate model assignment. It receives a specific input, produces a specific output, and terminates. It does not share memory with other agents in the pipeline unless you explicitly pass data between them.

This isolation is the key property. It means:

- **No context pollution.** The test-writing agent does not see the code review agent's internal reasoning.
- **Independent model selection.** Use an expensive model for complex analysis, a cheap one for formatting.
- **Predictable behavior.** Each agent's behavior depends only on its input and system prompt, not on what happened three steps ago in a different agent's session.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Analyzer    │────▶│  Generator  │────▶│  Reviewer    │
│  (Sonnet)    │     │  (Haiku)    │     │  (Sonnet)    │
│  128k ctx    │     │  32k ctx    │     │  64k ctx     │
└─────────────┘     └─────────────┘     └─────────────┘
     Input:              Input:              Input:
     Full codebase       Analysis +          Generated code +
                         instructions        quality criteria
```

## When to Use Multi-Agent Orchestration

Not every task needs multiple agents. Use orchestration when:

**The task has distinct phases.** Analysis → generation → validation is a natural three-agent pipeline. Each phase has different requirements and benefits from different models.

**Context window limits are a concern.** A 200k-token codebase will not fit in a single context window alongside detailed instructions and examples. Split the work across agents that each handle a subset.

**Different expertise is needed.** A security review requires different system prompts than a performance optimization. Cramming both into one agent dilutes both capabilities.

**You need auditability.** When each step produces a logged, inspectable output, debugging failures is straightforward. "The analyzer output was correct, the generator output was wrong" is actionable. "The agent produced bad output" is not.

**Do not use orchestration** for simple, single-turn tasks. If one agent can handle the entire job in under 30 seconds, adding orchestration overhead just slows things down.

## Routing Strategies

How do you decide which agent handles which part of the work? Three patterns:

### Sequential Pipeline

The simplest pattern. Agents run in a fixed order, each receiving the previous agent's output.

```yaml
pipeline:
  - agent: code-analyzer
  - agent: test-generator
  - agent: test-reviewer
  - agent: report-writer
```

Use this when the workflow is linear and every step is always needed.

### Conditional Routing

An initial classifier agent examines the input and routes to the appropriate specialist.

```yaml
router:
  agent: task-classifier
  routes:
    bug_fix:
      pipeline: [bug-locator, fix-generator, test-updater]
    feature:
      pipeline: [spec-writer, code-generator, test-generator, doc-updater]
    refactor:
      pipeline: [code-analyzer, refactor-planner, refactor-executor]
```

The classifier is typically a fast, cheap model call that categorizes the request. This avoids running unnecessary agents — a bug fix does not need the spec-writing agent.

### Fan-Out / Fan-In

Multiple agents run in parallel, and their outputs are aggregated by a final agent.

```yaml
fan_out:
  - agent: security-reviewer
  - agent: performance-reviewer
  - agent: style-reviewer

fan_in:
  agent: review-aggregator
  input: [security-reviewer.output, performance-reviewer.output, style-reviewer.output]
```

This is ideal for code review, where multiple independent perspectives can be gathered simultaneously and then synthesized.

## Lifecycle Management

Each agent session has a lifecycle: creation, execution, output collection, and termination. The orchestrator must handle edge cases at every stage.

**Timeouts.** If an agent has not responded in 120 seconds, kill the session and either retry or skip the step. Hanging agents block the entire pipeline.

**Retries with backoff.** LLM API calls fail. Rate limits hit. The orchestrator should retry transient failures (HTTP 429, 503) with exponential backoff, but not retry deterministic failures (malformed input).

**Graceful degradation.** If a non-critical agent fails (the documentation updater, for example), the pipeline should continue and flag the failure rather than aborting entirely.

```typescript
async function executeStep(agent: AgentConfig, input: unknown): Promise<StepResult> {
  const maxRetries = agent.critical ? 3 : 1;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runWithTimeout(
        agent.run(input),
        agent.timeoutMs ?? 120_000
      );
      return { status: "success", output: result };
    } catch (error) {
      if (attempt === maxRetries) {
        if (agent.critical) throw error;
        return { status: "skipped", error: error.message };
      }
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

## Model Assignment Per Task

One of the biggest advantages of multi-agent orchestration is per-step model selection. Different tasks have different cost-quality tradeoffs:

| Task | Recommended Model | Why |
|------|------------------|-----|
| Code analysis | Claude Sonnet | Needs strong reasoning |
| Boilerplate generation | GPT-4o-mini / Qwen | Simple, pattern-based |
| Security review | Claude Sonnet / GPT-4o | High stakes, needs depth |
| Documentation | Haiku / GPT-4o-mini | Straightforward writing |
| Test generation | Sonnet | Needs to understand edge cases |
| Formatting / linting | Qwen 2.5 | Mechanical transformation |

When paired with **Model Prism**, model assignment can be dynamic — the orchestrator sends requests with a task-type header, and Model Prism routes to the appropriate model based on your configuration. This means you can change model assignments without modifying your pipeline code.

## Best Practices

**1. Start with the data flow.** Before writing any agent configuration, map out what data each step needs and what it produces. Draw the pipeline on paper. If you cannot clearly define the handoff points, the pipeline is not ready to build.

**2. Use the cheapest model that works.** Run each agent with the least expensive model first. Only upgrade when you can demonstrate that the cheaper model produces measurably worse output for that specific task.

**3. Keep orchestration logic outside agents.** Agents should not decide which agent runs next. The orchestrator decides. This keeps agents simple and makes the pipeline flow visible in the configuration.

**4. Log token usage per step.** You cannot optimize what you do not measure. Track input tokens, output tokens, model used, and latency for every agent invocation. Aggregate this data to find cost hotspots.

**5. Version your pipelines.** A pipeline configuration is code. Store it in version control, review changes in pull requests, and tag releases. When a pipeline starts producing worse output, you need to diff against the last known-good version.

**6. Test agents in isolation first.** Before connecting agents into a pipeline, verify each one independently with representative inputs. Integration bugs are harder to diagnose than unit-level agent failures.

## The Ecosystem

**Agent Forge** provides the scaffolding for building individual sub-agents with proper contracts and validation. **Agent Atlas** serves as the catalog where you discover and share reusable agents. Together, they form the foundation for building multi-agent pipelines that are maintainable, cost-effective, and reliable.

The shift from single-agent to multi-agent is not about complexity for its own sake. It is about applying the same engineering principles — separation of concerns, composability, testability — that we already use in traditional software development. The agents are the functions. The pipeline is the program.
