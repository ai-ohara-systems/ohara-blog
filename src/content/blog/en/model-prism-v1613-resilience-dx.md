---
title: "Model Prism v1.6.13 — Resilience & Developer Experience"
description: "Streaming retry, context-aware routing, thinking filter, editable context windows, bulk visibility, and more — making Model Prism production-hardened."
date: "2026-04-07"
tag: "release"
tagColor: "#22c55e"
readTime: "5 min read"
lang: "en"
---

## From "it works" to "it handles everything"

The v1.6.10–v1.6.13 releases focus on what happens when things go wrong — and on making the admin experience smoother. These aren't flashy features. They're the kind of fixes that prevent 3am pages.

## Streaming Retry with Automatic Fallback

Previously, if a streaming request hit a provider error, the client got an error event and that was it. No retry, no fallback. This is fixed.

**Streaming now has the same resilience as non-streaming:**

1. Provider fails → try next provider in fallback chain
2. `max_tokens` too high → extract limit from error, clamp, retry same provider
3. Context overflow → automatically upgrade to a model with a larger context window
4. Circuit breaker → skip providers that are already known to be unhealthy

All errors are logged to RequestLog with the new `errorType` field, so they show up in the Failed Requests dashboard.

## Context-Aware Routing

This was a subtle but critical bug: the auto-router would classify a 262k token input as "simple" and route it to a model with a 16k context window. The model would reject it with a 400 error.

**Now fixed at multiple levels:**

- **Pre-flight context check** estimates input tokens before sending to the provider. If the input doesn't fit, it finds a larger model automatically.
- The check uses the **model registry as fallback** when discovered models don't have context window data yet.
- `max_tokens` is clamped to **remaining headroom** (context window minus estimated input), not just the model limit. No more negative `max_tokens` values.
- A final safety floor ensures `max_tokens` is always ≥ 1.

## Strip Extended Thinking

Claude 4.x models on Bedrock send "extended thinking" — internal reasoning blocks that are useful for the model but noisy for end users. Model Prism now strips them by default.

**Per-tenant setting:** `stripThinking` (default: `true`)

Handles all known formats:
- `reasoning_content` field in delta chunks
- `role: "thinking"` streaming chunks
- `<thinking>...</thinking>` tag spans across multiple chunks
- `type: "thinking"` content blocks

Disable per tenant if your application needs reasoning traces (e.g., for debugging or chain-of-thought display).

## Editable Context Windows

The Models page now lets you edit `contextWindow` and `maxOutputTokens` directly — previously these were read-only fields.

When you set a value manually, it's protected from being overwritten on the next model refresh (`manualContext` flag). Same pattern as `manualPricing` for cost data.

**Updated registry defaults** for common Bedrock models:

| Model | Old | New |
|-------|-----|-----|
| Claude Opus 4.6/4.5 | 200k | **1M** |
| Claude Sonnet 4.6/4.5 | 200k | **1M** |
| Qwen3 235B | 131k | **262k** |
| Qwen3 Coder 30B | 128k | **262k** |

## Bulk Visibility Toggle

Select multiple models in the Models page → "Show selected" / "Hide selected". Hidden models are automatically excluded from all tenant routing selectors (classifier model, default model, baseline model, fallback models). The whitelist/blacklist configuration still shows all models with a "hidden" badge so you can manage the list.

## Multi-API-Key Management UI

The "Manage API Keys" drawer on each tenant now provides full key lifecycle management:

- Add auto-generated or custom keys (minimum 1 character — short keys like "test" work now)
- Enable/disable individual keys
- Edit labels for identification
- Track `lastUsedAt` per key
- Revoke keys with one click

## Provider Error Tracking

All provider errors — 400s, 502s, timeouts — now land in RequestLog with structured `errorType`:

- `context_length_exceeded` — input too large for model
- `max_tokens_exceeded` — output limit too high
- `provider_error` — generic upstream failure

The streaming adapter also now detects error events embedded in SSE streams (some Bedrock proxies send errors as `data: {"error": ...}` with HTTP 200) and surfaces them properly.

## Upgrading

```bash
docker pull ghcr.io/ai-ohara-systems/model-prism:1.6.13
```

After upgrading, click **Discover** on each provider to populate context window data. This enables the pre-flight context check and context-aware fallback routing.

---

*[Full changelog on GitHub](https://github.com/ai-ohara-systems/model-prism/releases) · [Documentation](https://docs.ohara.systems/model-prism)*
