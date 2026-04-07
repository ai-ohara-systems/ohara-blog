---
title: "Model Prism v1.6.9 — Provider Fallback, A/B Testing & Quality Scoring"
description: "Circuit-Breaker-Gesundheitsüberwachung, automatisches Failover, A/B-Experimente für Routing, automatisierte Qualitätsbewertung, Webhooks und Usage Quotas — alles in einem Release."
date: "2026-04-07"
tag: "release"
tagColor: "#22c55e"
readTime: "7 min Lesezeit"
lang: "de"
---

## Das bisher größte Model Prism Release

v1.6.9 liefert fünf große Features, die Model Prism von einem Routing-Gateway zu einer vollständigen Observability- und Experimentierplattform machen. Jedes Feature ist darauf ausgelegt, ohne manuellen Eingriff zu laufen — einmal einrichten, den Rest erledigt es selbst.

## Provider Fallback Chains mit Circuit Breaker

LLM-Provider fallen aus. API-Rate-Limits greifen. Regionen haben Ausfälle. Bisher bedeutete ein Provider-Ausfall einen fehlgeschlagenen Request. Jetzt handhabt Model Prism das automatisch.

**So funktioniert es:** Jeder Tenant kann geordnete Fallback-Chains konfigurieren — entweder pro Model (z.B. „für Claude Opus erst eu-bedrock, dann global-bedrock, dann Azure") oder als Wildcard-Default. Wenn ein Provider ausfällt, übernimmt der nächste in der Chain.

Das Circuit-Breaker-Pattern überwacht die Provider-Gesundheit mit drei Zuständen:

- **CLOSED** (normal) — Requests fließen durch. Fehler werden in einem Rolling Window gezählt.
- **OPEN** (ausgelöst) — nach 5 Fehlern öffnet sich der Circuit. Alle Requests überspringen diesen Provider sofort — keine verschwendeten Round-Trips.
- **HALF_OPEN** (Test) — nach einer Abkühlphase werden begrenzt Test-Requests durchgelassen. Bei Erfolg schließt der Circuit. Bei Fehler bleibt er offen.

Das Gateway sendet außerdem `provider_down` Webhook-Events, damit euer Ops-Team in Echtzeit informiert wird.

**Kontextbewusstes Fallback:** Wenn ein Request das Context-Window eines Modells überläuft, scheitert Model Prism nicht einfach — es findet automatisch das nächste Modell mit einem größeren Context-Window und versucht es erneut.

## A/B Testing für Routing-Entscheidungen

Ist Claude Sonnet wirklich besser als GPT-4.1 für eure Coding-Tasks? Produziert das günstigere Modell tatsächlich schlechtere Ergebnisse? Jetzt könnt ihr es messen.

**Experimente** teilen den Traffic zwischen Modell-Varianten mit konfigurierbaren Gewichtungen auf. Jede Variante trackt:

- Request-Anzahl, Token-Verbrauch, Kosten
- Fehlerrate
- Qualitätsscore (siehe unten)
- Latenz

Die Zuweisung ist **session-konsistent** — ein User in Variante A bleibt für seine gesamte Session in Variante A, mittels SHA-256-Hashing von experimentId + sessionId.

Wenn genug Daten vorhanden sind, sagt die integrierte **z-Test Statistik-Analyse**, ob der Unterschied signifikant ist oder nur Rauschen.

## Automatisierte Qualitätsbewertung

Jede Antwort bekommt jetzt einen 0–100 Qualitätsscore, berechnet aus sechs Signalen:

| Signal | Gewicht | Was es misst |
|--------|---------|-------------|
| Vollständigkeit | 25 Pkt | Hat die Antwort die Anfrage vollständig adressiert? |
| Längenangemessenheit | 20 Pkt | Ist die Antwortlänge passend für die Aufgabe? |
| Verweigerungserkennung | 20 Pkt | Hat das Modell die Antwort verweigert? |
| Fehlerindikatoren | 15 Pkt | Enthält die Antwort Fehlerphrasen? |
| Sprachkonsistenz | 10 Pkt | Passt die Antwortsprache zur Eingabesprache? |
| Formatkonformität | 10 Pkt | Ist das Format korrekt (JSON, Code, etc.)? |

Qualitätsscores fließen direkt in die A/B-Experiment-Metriken ein.

## Webhooks & Event-Benachrichtigungen

Model Prism kann jetzt Events an beliebige HTTP-Endpoints pushen — mit HMAC-SHA256-signierten Payloads. Webhooks lassen sich pro Tenant oder global konfigurieren.

**Unterstützte Events:** `quota_warning`, `quota_exhausted`, `budget_threshold`, `budget_exceeded`, `provider_down`, `error_spike`, `experiment_completed`

Fehlgeschlagene Zustellungen werden mit exponentiellem Backoff wiederholt. Jeder Zustellversuch wird mit 30-Tage-TTL für Audit-Trails protokolliert.

## Usage Quotas

Budget-Limits begrenzen die Gesamtausgaben. Quotas sind granularer — sie limitieren spezifische Dimensionen: Tokens pro Monat, Requests pro Tag/Monat, Kosten pro Monat.

Drei Enforcement-Modi:

| Modus | Verhalten |
|-------|-----------|
| `hard_block` | Requests ablehnen bei Quota-Überschreitung |
| `soft_warning` | Requests erlauben, aber Webhook-Warnung senden |
| `auto_economy` | Routing auf günstigste Modelle umschalten wenn Quota-Grenze naht |

## Multi-API-Key Support

Tenants können jetzt mehrere API-Keys haben — mit individuellen Labels, Enable/Disable-Toggles, Ablaufdaten und `lastUsedAt`-Tracking. Perfekt für separate Keys pro Umgebung, Team oder Contractor.

## Upgrade

```bash
docker pull ghcr.io/ai-ohara-systems/model-prism:1.6.13
helm repo update ohara && helm upgrade model-prism ohara/model-prism
```

Keine Migration nötig. Neue Features sind opt-in.

---

*Model Prism ist source-available unter der Elastic License v2. [Auf GitHub ansehen](https://github.com/ai-ohara-systems/model-prism) · [Dokumentation](https://docs.ohara.systems/model-prism)*
