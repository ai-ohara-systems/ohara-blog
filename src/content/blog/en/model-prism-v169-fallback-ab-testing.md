---
title: "Model Prism v1.6.9 — Provider Fallback, A/B Testing & Quality Scoring"
description: "Circuit breaker health monitoring, automatic failover, A/B experiments for routing, automated quality scoring, webhooks, and usage quotas — all in a single release."
date: "2026-04-07"
tag: "release"
tagColor: "#22c55e"
readTime: "7 min read"
lang: "en"
---

## The biggest Model Prism release yet

v1.6.9 ships five major features that transform Model Prism from a routing gateway into a full observability and experimentation platform. Every feature is designed to run without manual intervention — set it up once, and it takes care of itself.

## Provider Fallback Chains with Circuit Breaker

LLM providers go down. API rate limits hit. Regions have outages. Previously, a provider failure meant a failed request. Now Model Prism handles it automatically.

**How it works:** Each tenant can configure ordered fallback chains — either per model (e.g., "for Claude Opus, try eu-bedrock first, then global-bedrock, then Azure") or as a wildcard default. When a provider fails, the next one in the chain takes over.

The circuit breaker pattern monitors provider health with three states:

- **CLOSED** (normal) — requests flow through. Failures are counted in a rolling window.
- **OPEN** (tripped) — after 5 failures, the circuit opens. All requests skip this provider immediately — no wasted round-trips.
- **HALF_OPEN** (testing) — after a cooldown period, a limited number of test requests are allowed through. If they succeed, the circuit closes. If they fail, it stays open.

```
Provider A (healthy) ──→ Provider B (circuit open, skip) ──→ Provider C (healthy, used)
```

The gateway also emits `provider_down` webhook events, so your ops team gets notified in real time.

**Context-aware fallback:** If a request overflows a model's context window, Model Prism doesn't just fail — it automatically finds the next model with a larger context window and retries. A 262k token input that doesn't fit in Qwen3 (32k) gets seamlessly upgraded to Claude Sonnet (1M context).

## A/B Testing for Routing Decisions

Is Claude Sonnet really better than GPT-4.1 for your coding tasks? Does the cheaper model actually produce worse results? Now you can measure it.

**Experiments** let you split traffic between model variants with configurable weights. Each variant tracks:

- Request count, token usage, cost
- Error rate
- Quality score (see below)
- Latency

The assignment is **session-consistent** — a user in variant A stays in variant A for their entire session, using SHA-256 hashing of experimentId + sessionId. No randomness, no flip-flopping.

When you have enough data, the built-in **z-test statistical analysis** tells you whether the difference is significant or just noise. The full experiment lifecycle (draft → running → completed → archived) is managed through the admin API.

## Automated Quality Scoring

Every response now gets a 0–100 quality score computed from six signals:

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Completeness | 25 pts | Did the response address the request fully? |
| Length adequacy | 20 pts | Is the response length appropriate for the task? |
| Refusal detection | 20 pts | Did the model refuse to answer? |
| Error indicators | 15 pts | Does the response contain error phrases? |
| Language consistency | 10 pts | Does the response match the input language? |
| Format compliance | 10 pts | Is the format correct (JSON, code, etc.)? |

Quality scores feed directly into A/B experiment metrics, so you can compare model quality objectively — not just cost and latency.

## Webhooks & Event Notifications

Model Prism can now push events to any HTTP endpoint with HMAC-SHA256 signed payloads. Configure webhooks per tenant or globally.

**Supported events:**

- `quota_warning` / `quota_exhausted` — usage thresholds
- `budget_threshold` / `budget_exceeded` — cost limits
- `provider_down` — circuit breaker tripped
- `error_spike` — unusual error rate
- `experiment_completed` — A/B test finished

Failed deliveries are retried with exponential backoff. Every delivery attempt is logged with a 30-day TTL for audit trails. HMAC secrets can be rotated without downtime.

## Usage Quotas

Budget limits cap total spend. Quotas are more granular — they limit specific dimensions:

- **tokens_monthly** — total tokens per month
- **requests_daily** / **requests_monthly** — request count limits
- **cost_monthly** — cost cap per month

Each quota has an enforcement mode:

| Mode | Behavior |
|------|----------|
| `hard_block` | Reject requests when quota is exceeded |
| `soft_warning` | Allow requests but emit webhook warning |
| `auto_economy` | Switch routing to cheapest models when quota is near limit |

Quotas reset automatically on calendar boundaries (daily at midnight, monthly on the 1st). Manual reset is available via the admin API.

## Multi-API-Key Support

Tenants are no longer limited to a single API key. Each tenant can have multiple keys with individual labels, enable/disable toggles, expiry dates, and `lastUsedAt` tracking.

Use cases:
- Different keys for dev/staging/production
- Per-team keys within the same tenant
- Temporary keys for contractors or demos
- Key rotation without downtime (add new key, migrate, revoke old key)

The admin UI includes a "Manage API Keys" drawer with full CRUD operations.

## Upgrading

```bash
# Docker
docker pull ghcr.io/ai-ohara-systems/model-prism:1.6.13

# Helm
helm repo update ohara
helm upgrade model-prism ohara/model-prism
```

No migration required. New features are opt-in — existing tenants continue to work exactly as before. After upgrading, click **Discover** on your providers to enrich models with context window data from the updated registry.

---

*Model Prism is source-available under the Elastic License v2. [View on GitHub](https://github.com/ai-ohara-systems/model-prism) · [Documentation](https://docs.ohara.systems/model-prism)*
