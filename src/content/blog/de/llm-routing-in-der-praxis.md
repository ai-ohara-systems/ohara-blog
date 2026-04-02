---
title: "LLM Routing in der Praxis — wie man Modelle automatisch wählt"
description: "Classifier-basiertes Routing, regelbasierte Fallbacks und hybride Ansätze: Wie du mit Model Prism das richtige Modell für jede Anfrage auswählst und dabei Kosten und Qualität im Gleichgewicht hältst."
date: "2026-04-01"
tag: "llmops"
tagColor: "#38bdf8"
readTime: "8 min Lesezeit"
lang: "de"
---

## Was ist LLM Routing — und warum brauche ich das?

Wer heute mit mehreren LLMs arbeitet, steht schnell vor der Frage: Welches Modell nehme ich für welche Anfrage? GPT-4o ist leistungsstark, aber teuer. GPT-4o-mini kostet fast nichts — kann aber komplexe Reasoning-Aufgaben nicht gleich gut lösen. Claude Sonnet liegt irgendwo dazwischen. Und lokale Modelle via Ollama kosten buchstäblich nichts, sind aber nicht für jede Aufgabe geeignet.

**LLM Routing** ist die Praxis, eingehende Anfragen automatisch an das jeweils optimale Modell weiterzuleiten — basierend auf Komplexität der Anfrage, gewünschter Antwortqualität und Kostenbudget. Das Ziel: die beste Balance aus Qualität und Kosten, ohne dass Entwickler manuell entscheiden müssen.

## Die drei wichtigsten Routing-Strategien

### 1. Regelbasiertes Routing

Die einfachste Form: Du definierst explizite Regeln, nach denen Anfragen zugewiesen werden. Beispiele:

- Alle Anfragen unter 500 Tokens → GPT-4o-mini
- Anfragen mit dem Tag `code_generation` → Claude Sonnet
- Anfragen von Tenant `premium-customer` → GPT-4o

Regelbasiertes Routing ist transparent, deterministisch und einfach zu debuggen. Es funktioniert gut, wenn du klare Kategorien hast — stößt aber an Grenzen, sobald die Regeln zu komplex werden.

### 2. Classifier-basiertes Routing

Hier wird ein kleines, schnelles Modell (der "Classifier") genutzt, um die Komplexität der Anfrage zu bewerten und daraus eine Routing-Entscheidung abzuleiten. Model Prism nutzt diesen Ansatz: Jede eingehende Anfrage wird zuerst durch einen Lightweight-Classifier analysiert, der eine Komplexitätsstufe (low / medium / high) zurückgibt. Diese wird dann auf einen Modell-Tier gemappt.

```yaml
# Beispiel-Konfiguration (routing-rules.yaml)
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

### 3. Hybrides Routing

In der Praxis kombiniert man beide Ansätze: Regelsets filtern zuerst nach klaren Kriterien (Tenant, Tag, Kontext-Länge), dann bewertet der Classifier die verbleibenden Anfragen dynamisch. Fallbacks sorgen dafür, dass bei Classifier-Ausfall oder API-Fehler automatisch auf ein Standard-Modell gewechselt wird.

## Routing mit Model Prism einrichten

Model Prism bringt Auto-Routing out-of-the-box mit. Hier ein minimales Beispiel:

```yaml
# docker-compose.yml Ausschnitt
services:
  model-prism:
    image: ghcr.io/ohara-systems/model-prism:latest
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      PRISM_ROUTING_MODE: auto
      PRISM_ROUTING_CONFIG: /config/routing-rules.yaml
```

Mit `"model": "auto"` in deiner API-Anfrage übernimmt Model Prism die Routing-Entscheidung automatisch:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TENANT_KEY" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Erkläre mir Quantenmechanik in 3 Sätzen"}]
  }'
```

## Fazit

LLM Routing ist keine Optimierung für später — es ist von Tag 1 an relevant, sobald du mit mehreren Modellen oder mehreren Teams arbeitest. Classifier-basiertes Auto-Routing mit Model Prism gibt dir sofort eine vernünftige Grundkonfiguration, die du schrittweise verfeinern kannst.

Im nächsten Artikel dieser Serie schauen wir uns an, wie du die Routing-Genauigkeit misst und deinen Classifier kontinuierlich verbesserst.
