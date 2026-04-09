---
title: "What Happens When Your AI Provider Goes Down? Zero-Downtime Failover for LLM Applications"
description: "AWS Bedrock outage, Azure throttling, Claude rate limits — learn how to build resilient AI applications with automatic provider failover, circuit breakers, and context overflow handling."
date: "2026-04-09"
tag: "engineering"
tagColor: "#14b8a6"
readTime: "6 min read"
lang: "en"
---

## The $50,000 Question Nobody Asks

You've built a production chatbot. Thousands of customers use it daily. Your team chose Claude Sonnet on AWS Bedrock — fast, smart, reliable. Until it isn't.

AWS Bedrock [has outages](https://health.aws.amazon.com/health/status). Anthropic [has rate limits](https://docs.anthropic.com/en/docs/about-claude/models). Azure [has throttling](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/quota). Every single AI provider will fail at some point. The question isn't *if* — it's *what happens when it does*.

For most teams, the answer is: the chatbot stops working, customers complain, and engineers scramble.

## The Real Cost of Provider Downtime

A 30-minute outage during business hours means:
- **Lost revenue** from customers who can't get answers
- **Support tickets** flooding your helpdesk
- **SLA violations** if you've promised uptime guarantees
- **Trust erosion** that takes months to rebuild

And the worst part? You're paying for an AI model that's sitting there, ready to serve — on a *different* provider.

## Automatic Provider Failover

The solution is **provider fallback chains**. Instead of hardcoding a single provider, you define a priority list:

```
Primary:   AWS Bedrock (Claude Sonnet 4.6)
Fallback 1: Azure OpenAI (GPT-5.3)
Fallback 2: On-Premise Ollama (Qwen3-235B)
```

When the primary provider fails, the next one in the chain handles the request. The customer never notices. No manual intervention. No 3am pages.

## Circuit Breaker: Don't Keep Hitting a Dead Server

Naive retry logic hammers a failing provider with repeated requests — making things worse. A **circuit breaker** solves this:

1. **CLOSED** — normal operation, all requests pass through
2. **OPEN** — provider has failed 5+ times, all requests skip it for 60 seconds
3. **HALF-OPEN** — after 60 seconds, allow 2 test requests to check recovery

This pattern (borrowed from distributed systems engineering) prevents cascading failures and reduces the blast radius of an outage.

## Context Overflow: The Hidden Failure Mode

Even when providers are healthy, long conversations can exceed a model's context window. A 200K-token conversation sent to a 128K model fails silently in most setups.

Smart handling:
1. **Auto-upgrade** to a model with a larger context window
2. **Truncation** — drop the oldest messages, keeping the system prompt and latest user message
3. **Pre-flight check** — estimate token count before sending and route to the right model upfront

## How Model Prism Implements This

[Model Prism](https://ohara.systems/products/model-prism) provides all of this out of the box:

- **Fallback chains** configurable per tenant — default chain for all models, plus model-specific overrides
- **Built-in circuit breaker** with real-time health monitoring
- **Context overflow handling** with auto-upgrade and truncation
- **Cross-provider fallback** — if a provider slug isn't assigned to a tenant, the gateway searches all providers for the model

Configure it in the admin UI under **Tenants → Resilience**, or via the API. No code changes needed.

## The Bottom Line

If you're running AI in production, you need a resilience strategy. Provider outages are not edge cases — they're regular occurrences. The difference between a good AI platform and a great one is what happens when things go wrong.

**Don't wait for the outage to find out.**

---

*Model Prism is an open-source, multi-tenant LLM gateway with intelligent routing and enterprise-grade resilience. [Learn more →](https://ohara.systems/products/model-prism)*
