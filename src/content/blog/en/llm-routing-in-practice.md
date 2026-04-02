---
title: "LLM Routing in Practice — How to Select Models Automatically"
description: "Classifier-based routing, rule-based fallbacks and hybrid approaches: How to use Model Prism to select the right model for every request while balancing cost and quality."
date: "2026-04-01"
tag: "llmops"
tagColor: "#38bdf8"
readTime: "8 min read"
lang: "en"
---

## What is LLM Routing — and why do I need it?

Anyone working with multiple LLMs quickly faces the question: which model do I use for which request? GPT-4o is powerful, but expensive. GPT-4o-mini costs almost nothing — but can't handle complex reasoning tasks as well. Claude Sonnet sits somewhere in between. And local models via Ollama cost literally nothing, but aren't suitable for every task.

**LLM Routing** is the practice of automatically directing incoming requests to the optimal model — based on request complexity, desired response quality, and cost budget. The goal: the best balance of quality and cost, without developers having to decide manually.

## The three most important routing strategies

### 1. Rule-based Routing

The simplest form: you define explicit rules by which requests are assigned. Examples:

- All requests under 500 tokens → GPT-4o-mini
- Requests with the tag `code_generation` → Claude Sonnet
- Requests from tenant `premium-customer` → GPT-4o

Rule-based routing is transparent, deterministic, and easy to debug. It works well when you have clear categories — but hits limits once the rules become too complex.

### 2. Classifier-based Routing

Here, a small, fast model (the "classifier") is used to evaluate the complexity of the request and derive a routing decision. Model Prism uses this approach: every incoming request is first analyzed by a lightweight classifier that returns a complexity level (low / medium / high). This is then mapped to a model tier.

```yaml
# Example configuration (routing-rules.yaml)
tiers:
  low:
    model: gpt-4o-mini
    max_tokens: 2048
  medium:
    model: claude-3-5-haiku
    max_tokens: 4096
  high:
    model: gpt-4o
    max_tokens: 8192

classifier:
  model: text-classification-small
  fallback_tier: medium
```

### 3. Hybrid Routing

In practice, both approaches are combined: rule sets filter first by clear criteria (tenant, tag, context length), then the classifier dynamically evaluates remaining requests. Fallbacks ensure that if the classifier fails or an API error occurs, a default model is automatically used.

## Setting up routing with Model Prism

Model Prism ships with auto-routing out of the box. Here's a minimal example:

```yaml
# docker-compose.yml excerpt
services:
  model-prism:
    image: ghcr.io/ai-ohara-systems/model-prism:latest
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      PRISM_ROUTING_MODE: auto
      PRISM_ROUTING_CONFIG: /config/routing-rules.yaml
```

With `"model": "auto"` in your API request, Model Prism handles the routing decision automatically:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TENANT_KEY" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Explain quantum mechanics in 3 sentences"}]
  }'
```

## Conclusion

LLM routing isn't an optimization for later — it's relevant from day 1 as soon as you're working with multiple models or multiple teams. Classifier-based auto-routing with Model Prism gives you a sensible baseline configuration immediately, which you can refine step by step.

In the next article in this series, we'll look at how to measure routing accuracy and continuously improve your classifier.
