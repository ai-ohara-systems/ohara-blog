---
title: "Model Prism v1.8 — AI-Powered Routing Intelligence"
description: "Test Route dry-run, Routing Debug Panel, AI-powered Synthetic Tests, configurable tier boost, and enhanced override rules — making LLM routing fully transparent and self-improving."
date: "2026-04-08"
tag: "release"
tagColor: "#22c55e"
readTime: "5 min read"
lang: "en"
---

## What's new in v1.8

Model Prism v1.8 makes routing decisions **fully transparent** and introduces **AI-powered testing** to continuously improve routing quality. Here's what's new.

---

## Test Route — See exactly what happens

Ever wondered *why* a request ended up on a particular model? The new **Test Route** tab in Routing Config lets you dry-run any prompt through the full routing pipeline and see a step-by-step trace:

1. **Signal Extraction** — tokens, images, tool calls, detected domains and languages
2. **Fast-Path Detection** — FIM autocomplete or tool-agent system prompt
3. **Rule-Set Pre-Routing** — which keyword rules and system prompt roles matched
4. **Classifier Decision** — use the LLM classifier or skip (and why)
5. **Classifier Output** — category, tier, confidence, recommended model, reasoning
6. **Tier Enforcement** — rule-set floor applied over classifier choice
7. **Override Rules** — vision upgrade, tool call upgrade, frustration detection
8. **Cost Mode & Tier Boost** — final tier adjustments
9. **Model Selection** — the actual model picked and why

Each step shows whether it changed the result (green border) or was a no-op (gray), with full JSON detail. Optionally enable "Call real classifier" for production-identical results.

---

## Routing Debug Panel — In every request log entry

Every auto-routed request in the **Request Log** now has an expandable routing debug panel showing:

- **Signals** as colored badges (tokens, images, tool calls, FIM, domains, languages)
- **Pre-Routing** status with signal source
- **Classifier confidence** as a visual bar (green/yellow/red)
- **Applied overrides** as individual badges
- **Final result** with model, tier, routing time, and classifier cost

No additional API calls — the data is already stored with every request.

---

## Synthetic Tests — AI-powered routing evaluation

The most significant addition: **Synthetic Tests** let you systematically evaluate and improve your routing configuration using AI.

**How it works:**

1. **Create a test suite** — name it, optionally scope to a category (e.g., "coding" or "security")
2. **Generate test prompts** — pick any available model to generate realistic prompts with expected categories and tier ranges
3. **Run the suite** — all prompts go through the routing pipeline (pre-routing only, zero cost)
4. **AI Evaluate** — choose any model to analyze results and get:
   - A **routing quality score** (0–100)
   - **Quality suggestions** ("to improve accuracy, consider...")
   - **Cost suggestions** ("to reduce spending, consider...")

Test runs are persisted, so you can track improvements over time. The generation and evaluation models are independently selectable — use a cheap model for generation and a frontier model for evaluation, or vice versa.

---

## Tier Boost — Explicit quality control

The new **Tier Boost** setting (−2 to +2) provides explicit tier shifting that stacks with Cost Mode. For example:

- Cost Mode **Quality** (+1) + Tier Boost **+1** = total **+2 tiers**
- A `medium` request becomes `high`

This gives you fine-grained control beyond the three cost mode options.

---

## Configurable Tool Call Minimum Tier

The Tool Call Upgrade override now has a **configurable minimum tier** instead of the previous hardcoded `medium`. Set it to `advanced` or `high` for coding agents that need powerful models for function calling.

---

## Enhanced Guided Tour

The welcome tour expanded from 6 to 10 steps, now covering Test Route, Synthetic Tests, Routing Debug Panel, and Override Rules. New features are marked with **New** and **AI** badges. The tour supports element highlighting with a pulsing overlay.

---

## Category Rebalancing

Several coding-related categories were raised from `low` to `medium` tier:

| Category | Before | After |
|----------|--------|-------|
| `coding_medium` | low | **medium** |
| `error_debugging` | low | **medium** |
| `qa_testing` | low | **medium** |
| `devops_infrastructure` | low | **medium** |

With Quality mode (+1), these now reach `advanced` — a much better fit for real coding workloads.

---

## Bug Fixes

- **Analytics logging silently broken** — `qualityBreakdown` was storing string descriptions instead of numeric scores, causing a Mongoose CastError on every log write. All requests since the last restart were lost. Fixed.
- **`tierMax` not persisted** — keyword rules with `tierMax` (e.g., Chat Title Generation capped at `micro`) were silently stripped. Schema and UI updated.
- **License badge showing "free"** — on page reload with an existing session, the license info wasn't loaded. Fixed.

---

## Upgrade

```bash
# Docker
docker pull ghcr.io/ai-ohara-systems/model-prism:1.8.0

# Helm
helm upgrade model-prism oci://ghcr.io/ai-ohara-systems/charts/model-prism --version 1.8.0
```

Category tiers are automatically synced on startup. No migration needed.
