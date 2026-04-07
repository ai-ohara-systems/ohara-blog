---
title: "Model Prism v1.6.13 — Resilience & Developer Experience"
description: "Streaming Retry, kontextbewusstes Routing, Thinking-Filter, editierbare Context Windows, Bulk Visibility und mehr — Model Prism wird produktionsgehärtet."
date: "2026-04-07"
tag: "release"
tagColor: "#22c55e"
readTime: "5 min Lesezeit"
lang: "de"
---

## Von „es funktioniert" zu „es fängt alles ab"

Die Releases v1.6.10–v1.6.13 fokussieren sich auf das, was passiert wenn etwas schiefgeht — und auf eine reibungslosere Admin-Erfahrung. Das sind keine Flashy-Features. Es sind die Fixes, die 3-Uhr-morgens-Alerts verhindern.

## Streaming Retry mit automatischem Fallback

Bisher: Wenn ein Streaming-Request auf einen Provider-Fehler traf, bekam der Client ein Error-Event und das war's. Kein Retry, kein Fallback. Das ist jetzt behoben.

**Streaming hat jetzt die gleiche Resilienz wie Non-Streaming:**

1. Provider fällt aus → nächsten Provider in der Fallback-Chain versuchen
2. `max_tokens` zu hoch → Limit aus dem Fehler extrahieren, clampen, gleichen Provider erneut versuchen
3. Context Overflow → automatisch auf ein Modell mit größerem Context-Window upgraden
4. Circuit Breaker → Provider überspringen, die bereits als unhealthy bekannt sind

## Kontextbewusstes Routing

Ein subtiler aber kritischer Bug: Der Auto-Router stufte einen 262k-Token-Input als „einfach" ein und routete ihn zu einem Modell mit 16k Context-Window. Das Modell lehnte mit 400-Error ab.

**Jetzt auf mehreren Ebenen behoben:**

- **Pre-flight Context Check** schätzt die Input-Tokens vor dem Senden ab. Wenn der Input nicht passt, wird automatisch ein größeres Modell gefunden.
- `max_tokens` wird auf das **verbleibende Headroom** geclampt (Context-Window minus geschätzter Input), nicht nur auf das Modell-Limit.
- Ein finaler Safety-Floor stellt sicher, dass `max_tokens` immer ≥ 1 ist.

## Strip Extended Thinking

Claude 4.x Modelle auf Bedrock senden „Extended Thinking" — interne Reasoning-Blöcke, die für das Modell nützlich, aber für Endbenutzer störend sind. Model Prism filtert sie jetzt standardmäßig heraus.

**Per-Tenant-Setting:** `stripThinking` (Default: `true`)

Handhabt alle bekannten Formate: `reasoning_content`-Felder, `role: "thinking"` Chunks, `<thinking>...</thinking>` Tag-Spans und `type: "thinking"` Content-Blöcke.

## Editierbare Context Windows

Die Models-Seite erlaubt jetzt das Editieren von `contextWindow` und `maxOutputTokens` — vorher waren das Nur-Lese-Felder.

Manuell gesetzte Werte werden durch den `manualContext`-Flag vor Überschreibung beim nächsten Refresh geschützt.

**Aktualisierte Registry-Defaults:**

| Modell | Alt | Neu |
|--------|-----|-----|
| Claude Opus 4.6/4.5 | 200k | **1M** |
| Claude Sonnet 4.6/4.5 | 200k | **1M** |
| Qwen3 235B | 131k | **262k** |
| Qwen3 Coder 30B | 128k | **262k** |

## Bulk Visibility Toggle

Mehrere Modelle auf der Models-Seite auswählen → „Show selected" / „Hide selected". Ausgeblendete Modelle werden automatisch aus allen Tenant-Routing-Selektoren ausgeschlossen.

## Multi-API-Key Management UI

Der „Manage API Keys"-Drawer pro Tenant bietet jetzt vollständiges Key-Lifecycle-Management: Auto-generierte oder Custom-Keys anlegen (Minimum 1 Zeichen), einzelne Keys aktivieren/deaktivieren, Labels bearbeiten, `lastUsedAt` tracken, Keys mit einem Klick widerrufen.

## Provider Error Tracking

Alle Provider-Fehler — 400er, 502er, Timeouts — landen jetzt im RequestLog mit strukturiertem `errorType`. Der Streaming-Adapter erkennt auch Error-Events die in SSE-Streams eingebettet sind.

## Upgrade

```bash
docker pull ghcr.io/ai-ohara-systems/model-prism:1.6.13
```

Nach dem Upgrade **Discover** auf jedem Provider klicken, um Context-Window-Daten zu befüllen.

---

*[Vollständiger Changelog auf GitHub](https://github.com/ai-ohara-systems/model-prism/releases) · [Dokumentation](https://docs.ohara.systems/model-prism)*
