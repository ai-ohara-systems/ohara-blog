---
title: "Model Prism v1.8 — KI-gesteuerte Routing-Intelligenz"
description: "Test Route Dry-Run, Routing Debug Panel, KI-gesteuerte Synthetische Tests, konfigurierbarer Tier Boost und erweiterte Override-Regeln — LLM-Routing wird vollständig transparent und selbstoptimierend."
date: "2026-04-08"
tag: "release"
tagColor: "#22c55e"
readTime: "5 min read"
lang: "de"
---

## Was ist neu in v1.8

Model Prism v1.8 macht Routing-Entscheidungen **vollständig transparent** und führt **KI-gesteuerte Tests** ein, um die Routing-Qualität kontinuierlich zu verbessern.

---

## Test Route — Schritt für Schritt nachvollziehen

Warum landete ein Request auf einem bestimmten Modell? Der neue **Test Route**-Tab in der Routing-Konfiguration zeigt eine schrittweise Nachverfolgung durch die gesamte Routing-Pipeline:

1. **Signal-Extraktion** — Tokens, Bilder, Tool-Calls, erkannte Domains und Sprachen
2. **Fast-Path-Erkennung** — FIM-Autocomplete oder Tool-Agent-Systemprompt
3. **Rule-Set Pre-Routing** — welche Keyword-Regeln und Prompt-Rollen gematcht haben
4. **Classifier-Entscheidung** — LLM-Classifier nutzen oder überspringen (und warum)
5. **Classifier-Output** — Kategorie, Tier, Confidence, empfohlenes Modell, Begründung
6. **Tier-Enforcement** — Rule-Set-Floor über Classifier-Ergebnis angewendet
7. **Override-Regeln** — Vision Upgrade, Tool-Call Upgrade, Frustrations-Erkennung
8. **Cost Mode & Tier Boost** — finale Tier-Anpassungen
9. **Modell-Auswahl** — welches Modell gewählt wurde und warum

Optional: "Echten Classifier aufrufen" für produktionsidentische Ergebnisse (kostet Tokens).

---

## Routing Debug Panel — In jedem Request-Log-Eintrag

Jeder auto-geroutete Request im **Request Log** zeigt ein expandierbares Routing-Debug-Panel:

- **Signale** als farbige Badges (Tokens, Bilder, Tool-Calls, FIM, Domains, Sprachen)
- **Pre-Routing**-Status mit Signal-Quelle
- **Classifier-Confidence** als visuelle Leiste
- **Angewandte Overrides** als einzelne Badges
- **Endergebnis** mit Modell, Tier, Routing-Zeit und Classifier-Kosten

---

## Synthetische Tests — KI-gesteuerte Routing-Evaluation

Das wichtigste neue Feature: **Synthetische Tests** ermöglichen systematische Evaluation und Verbesserung der Routing-Konfiguration mit KI.

1. **Test-Suite erstellen** — benennen und optional auf eine Kategorie beschränken
2. **Test-Prompts generieren** — beliebiges verfügbares Modell wählen
3. **Suite ausführen** — alle Prompts durchlaufen die Routing-Pipeline (ohne LLM-Calls, kostenlos)
4. **KI-Evaluation** — beliebiges Modell analysiert die Ergebnisse:
   - **Routing-Qualitätsscore** (0–100)
   - **Qualitätsvorschläge** und **Kostenvorschläge**

Test-Runs werden gespeichert — Verbesserungen über die Zeit nachverfolgbar.

---

## Tier Boost — Explizite Qualitätskontrolle

Das neue **Tier Boost**-Setting (−2 bis +2) bietet explizite Tier-Verschiebung zusätzlich zum Cost Mode. Beispiel: Quality (+1) + Tier Boost (+1) = insgesamt **+2 Tiers**.

---

## Weitere Neuerungen

- **Konfigurierbarer Tool-Call-Minimum-Tier** — statt fest `medium` jetzt frei wählbar (z.B. `advanced` für Coding-Agents)
- **Override-Tooltips** — alle Override-Toggles haben jetzt Beschreibungstexte
- **Erweiterte Tour** — 10 Schritte (vorher 6), mit Element-Highlighting und "New"/"AI"-Badges
- **Kategorie-Rebalancing** — `coding_medium`, `error_debugging`, `qa_testing`, `devops_infrastructure` von `low` auf `medium` angehoben

---

## Bugfixes

- **Analytics-Logging still kaputt** — `qualityBreakdown` speicherte Strings statt Zahlen, jeder Log-Write schlug fehl
- **`tierMax` nicht persistiert** — Keyword-Regeln mit `tierMax` wurden beim Speichern entfernt
- **Lizenz-Badge zeigt "free"** — nach Page-Reload mit bestehendem Token wurde die Lizenz nicht geladen

---

## Upgrade

```bash
docker pull ghcr.io/ai-ohara-systems/model-prism:1.8.0
```

Kategorie-Tiers werden beim Start automatisch synchronisiert. Keine Migration nötig.
