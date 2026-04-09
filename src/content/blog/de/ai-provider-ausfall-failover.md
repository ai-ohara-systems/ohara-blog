---
title: "Was passiert, wenn dein KI-Provider ausfällt? Zero-Downtime-Failover für LLM-Anwendungen"
description: "AWS Bedrock Ausfall, Azure Throttling, Claude Rate-Limits — so baust du resiliente KI-Anwendungen mit automatischem Provider-Failover, Circuit Breaker und Context-Overflow-Handling."
date: "2026-04-09"
tag: "engineering"
tagColor: "#14b8a6"
readTime: "6 Min. Lesezeit"
lang: "de"
---

## Die Frage, die niemand stellt — bis es zu spät ist

Du hast einen produktiven Chatbot gebaut. Tausende Kunden nutzen ihn täglich. Dein Team hat sich für Claude Sonnet auf AWS Bedrock entschieden — schnell, intelligent, zuverlässig. Bis es das nicht mehr ist.

AWS Bedrock [hat Ausfälle](https://health.aws.amazon.com/health/status). Anthropic [hat Rate-Limits](https://docs.anthropic.com/en/docs/about-claude/models). Azure [hat Throttling](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/quota). Jeder einzelne KI-Provider wird irgendwann ausfallen. Die Frage ist nicht *ob* — sondern *was dann passiert*.

Für die meisten Teams lautet die Antwort: Der Chatbot steht still, Kunden beschweren sich, und Entwickler geraten in Panik.

## Die wahren Kosten eines Provider-Ausfalls

Ein 30-minütiger Ausfall während der Geschäftszeiten bedeutet:
- **Umsatzverlust** durch Kunden, die keine Antworten bekommen
- **Support-Tickets**, die den Helpdesk überfluten
- **SLA-Verletzungen**, wenn Verfügbarkeitsgarantien existieren
- **Vertrauensverlust**, der Monate braucht, um sich zu erholen

Und das Schlimmste? Du bezahlst für ein KI-Modell, das bereit wäre zu antworten — bei einem *anderen* Provider.

## Automatisches Provider-Failover

Die Lösung sind **Provider-Fallback-Ketten**. Statt einen einzigen Provider fest zu verdrahten, definierst du eine Prioritätsliste:

```
Primär:     AWS Bedrock (Claude Sonnet 4.6)
Fallback 1: Azure OpenAI (GPT-5.3)
Fallback 2: On-Premise Ollama (Qwen3-235B)
```

Wenn der primäre Provider ausfällt, übernimmt der nächste in der Kette. Der Kunde merkt nichts. Kein manueller Eingriff. Kein Alarm um 3 Uhr nachts.

## Circuit Breaker: Nicht weiter auf einen toten Server einschlagen

Naive Retry-Logik hämmert auf einen fehlerhaften Provider mit wiederholten Anfragen ein — und macht alles schlimmer. Ein **Circuit Breaker** löst das:

1. **CLOSED** — Normalbetrieb, alle Anfragen gehen durch
2. **OPEN** — Provider ist 5+ Mal fehlgeschlagen, alle Anfragen überspringen ihn für 60 Sekunden
3. **HALF-OPEN** — Nach 60 Sekunden werden 2 Testanfragen erlaubt, um die Wiederherstellung zu prüfen

Dieses Pattern (aus dem Distributed-Systems-Engineering entlehnt) verhindert kaskadierende Ausfälle und begrenzt den Schadensradius.

## Context Overflow: Der versteckte Fehlerfall

Selbst wenn Provider gesund sind, können lange Konversationen das Kontextfenster eines Modells sprengen. Eine 200K-Token-Konversation an ein 128K-Modell gesendet — in den meisten Setups schlägt das still fehl.

Intelligentes Handling:
1. **Auto-Upgrade** auf ein Modell mit größerem Kontextfenster
2. **Kürzung** — die ältesten Nachrichten entfernen, System-Prompt und letzte User-Nachricht behalten
3. **Pre-Flight-Check** — Token-Anzahl schätzen und direkt zum richtigen Modell routen

## So implementiert Model Prism das

[Model Prism](https://ohara.systems/products/model-prism) bietet all das out of the box:

- **Fallback-Ketten** pro Tenant konfigurierbar — Default-Chain für alle Modelle plus modellspezifische Overrides
- **Integrierter Circuit Breaker** mit Echtzeit-Gesundheitsmonitoring
- **Context-Overflow-Handling** mit Auto-Upgrade und Kürzung
- **Cross-Provider-Fallback** — wenn ein Provider-Slug nicht zum Tenant gehört, sucht das Gateway automatisch bei allen Providern nach dem Modell

Konfiguriere es in der Admin-UI unter **Tenants → Resilience**, oder per API. Keine Code-Änderungen nötig.

## Das Fazit

Wenn du KI in Produktion betreibst, brauchst du eine Resilienz-Strategie. Provider-Ausfälle sind keine Randerscheinungen — sie passieren regelmäßig. Der Unterschied zwischen einer guten und einer großartigen KI-Plattform ist, was passiert, wenn etwas schiefgeht.

**Warte nicht auf den Ausfall, um es herauszufinden.**

---

*Model Prism ist ein Open-Source, Multi-Tenant LLM-Gateway mit intelligentem Routing und Enterprise-Resilienz. [Mehr erfahren →](https://ohara.systems/products/model-prism)*
