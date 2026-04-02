---
title: "Building Custom Sub-Agents for AI-Assisted Workflows"
description: "Design patterns for specialized sub-agents with narrow scope, explicit contracts, and composable pipelines for AI-assisted development."
date: "2026-02-24"
tag: "agents"
tagColor: "#818cf8"
readTime: "6 min read"
lang: "en"
---

## The Narrow Scope Philosophy

A common mistake when building AI agents is making them too general. A single agent that handles code generation, testing, documentation, deployment, and code review will underperform at all of these tasks. It accumulates too much context, its system prompt becomes a wall of conflicting instructions, and its behavior becomes unpredictable.

The alternative: build narrow, focused sub-agents that each do one thing well. This is not a new idea — it is the Unix philosophy applied to AI. Small, composable tools that can be chained together.

A sub-agent should have:

- **One clear responsibility** ("generate unit tests for Python functions")
- **Defined inputs** (function source code, testing framework preference)
- **Defined outputs** (test file content, coverage estimate)
- **No side effects** outside its scope (it does not modify the source code it is testing)

## Explicit I/O Contracts

Every sub-agent needs a contract — a clear specification of what it accepts and what it returns. Without this, composition breaks down. You cannot pipe the output of one agent into another if you do not know the shape of that output.

### Defining Contracts

```yaml
# agents/test-generator.yaml
name: test-generator
description: "Generates unit tests for Python functions"
model: claude-sonnet-4-20250514

input:
  format: json
  schema:
    source_code:
      type: string
      required: true
      description: "The Python function(s) to test"
    framework:
      type: enum
      values: [pytest, unittest]
      default: pytest
    coverage_target:
      type: number
      default: 0.8
      description: "Target branch coverage (0.0-1.0)"

output:
  format: json
  schema:
    test_code:
      type: string
      description: "Generated test file content"
    test_count:
      type: number
      description: "Number of test cases generated"
    estimated_coverage:
      type: number
      description: "Estimated branch coverage"
```

This contract serves triple duty: it documents the agent for humans, it validates inputs at runtime, and it enables tooling to auto-generate pipeline configurations.

## Shell Scripting as Orchestration

You do not need a complex orchestration framework to chain sub-agents. Shell scripts work surprisingly well for linear pipelines, and they have the advantage of being universally understood.

```bash
#!/bin/bash
# pipeline: analyze → generate tests → review tests

set -euo pipefail

SOURCE_FILE="$1"
SOURCE_CODE=$(cat "$SOURCE_FILE")

# Step 1: Analyze the code structure
ANALYSIS=$(agent-run code-analyzer \
  --input "{\"source_code\": $(echo "$SOURCE_CODE" | jq -Rs .)}" \
  --output json)

echo "Analysis complete: $(echo "$ANALYSIS" | jq -r '.summary')"

# Step 2: Generate tests based on analysis
FUNCTIONS=$(echo "$ANALYSIS" | jq -r '.functions')
TESTS=$(agent-run test-generator \
  --input "{\"source_code\": $(echo "$SOURCE_CODE" | jq -Rs .), \"framework\": \"pytest\"}" \
  --output json)

echo "Generated $(echo "$TESTS" | jq -r '.test_count') test cases"

# Step 3: Review the generated tests for quality
REVIEW=$(agent-run code-reviewer \
  --input "{\"code\": $(echo "$TESTS" | jq -r '.test_code' | jq -Rs .), \"review_type\": \"test_quality\"}" \
  --output json)

# Step 4: Write output if review passes
SCORE=$(echo "$REVIEW" | jq -r '.quality_score')
if (( $(echo "$SCORE > 0.7" | bc -l) )); then
  echo "$TESTS" | jq -r '.test_code' > "tests/test_$(basename "$SOURCE_FILE")"
  echo "Tests written. Quality score: $SCORE"
else
  echo "Tests below quality threshold ($SCORE). Review: $(echo "$REVIEW" | jq -r '.issues')"
  exit 1
fi
```

This pipeline is readable, debuggable (add `set -x` for tracing), and easy to modify. Each step's output is captured in a variable and can be inspected if something goes wrong.

## Composable Pipelines

The real power of sub-agents appears when you start composing them into reusable pipelines. A pipeline is just a sequence of sub-agents with defined handoff points.

### Pipeline Definition

```yaml
# pipelines/pr-review.yaml
name: pr-review
description: "Full pull request review pipeline"

steps:
  - agent: diff-analyzer
    input:
      diff: "${pipeline.input.diff}"
    output_as: analysis

  - agent: security-scanner
    input:
      code_changes: "${analysis.changed_files}"
    output_as: security

  - agent: test-coverage-checker
    input:
      source_files: "${analysis.changed_files}"
      test_files: "${analysis.test_files}"
    output_as: coverage

  - agent: review-summarizer
    input:
      analysis: "${analysis}"
      security: "${security}"
      coverage: "${coverage}"
    output_as: summary

output:
  review: "${summary.review_text}"
  approve: "${summary.should_approve}"
  issues: "${summary.blocking_issues}"
```

Each step references outputs from previous steps using a simple variable syntax. The pipeline runner resolves these references, validates the data shapes against the agent contracts, and handles errors at each handoff.

## Validation Between Handoffs

The space between two agents is where things break. Agent A returns something unexpected, agent B receives garbage, and the pipeline produces nonsense. Validation at handoff points catches these failures early.

```typescript
interface HandoffValidator {
  validate(
    output: unknown,
    expectedSchema: Schema
  ): ValidationResult;
}

// Between each pipeline step:
const result = await agent.run(input);
const validation = validator.validate(result, nextAgent.inputSchema);

if (!validation.valid) {
  // Option 1: Retry with error context
  const retryResult = await agent.run(input, {
    additionalContext: `Previous output was invalid: ${validation.errors.join(", ")}. Please fix.`,
  });

  // Option 2: Fall back to a default
  // Option 3: Halt the pipeline with a clear error
}
```

Three validation strategies, in order of preference:

1. **Retry with feedback.** Give the agent its validation errors and ask it to fix them. Works well for formatting issues.
2. **Default values.** If a non-critical field is missing, use a sensible default and continue.
3. **Halt with diagnostics.** If the output is fundamentally wrong, stop the pipeline and report exactly which step failed and why.

## Building with Agent Forge

**Agent Forge** provides scaffolding for this pattern. It generates the agent configuration files, sets up the contract validation, and creates the pipeline runner — so you can focus on writing the system prompts and testing the agent behavior rather than building infrastructure.

```bash
# Scaffold a new sub-agent
agent-forge create test-generator --model claude-sonnet --category testing

# Define the contract interactively
agent-forge contract test-generator

# Add it to a pipeline
agent-forge pipeline add pr-review --step test-generator --after diff-analyzer

# Run the pipeline locally
agent-forge pipeline run pr-review --input '{"diff": "..."}'
```

## Design Guidelines

**Keep prompts under 500 words.** If your system prompt is longer, your agent's scope is probably too broad. Split it.

**Test with adversarial inputs.** Send your agent malformed JSON, empty strings, and absurdly long inputs. The contract validation should catch these, but verify.

**Version your agents.** When you update a system prompt, the agent's behavior changes. Tag versions so pipelines can pin to a known-good configuration.

**Log everything.** Every sub-agent invocation should log its input, output, model used, token count, and latency. This data is essential for debugging pipelines and optimizing costs.

**Start with two agents.** Do not design a twelve-agent pipeline on paper. Build two agents, connect them, verify the handoff works, then add the third. Incremental composition catches integration issues early.

The goal is not to build the most sophisticated multi-agent system. The goal is to build reliable, predictable automation from small, testable pieces.
