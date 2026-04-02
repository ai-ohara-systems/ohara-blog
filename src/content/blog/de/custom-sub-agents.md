---
title: "Eigene Sub-Agenten bauen — Designmuster für KI-gestützte Workflows"
description: "Designmuster für spezialisierte Sub-Agenten mit engem Scope, expliziten Kontrakten und komposierbare Pipelines für KI-gestützte Entwicklung."
date: "2026-02-24"
tag: "agents"
tagColor: "#818cf8"
readTime: "6 min Lesezeit"
lang: "de"
---

## Die Philosophie des engen Scopes

Ein häufiger Fehler beim Bauen von KI-Agenten ist es, sie zu allgemein zu machen. Ein einzelner Agent, der Code-Generierung, Testing, Dokumentation, Deployment und Code-Review übernimmt, wird bei all diesen Aufgaben schlechter abschneiden. Er sammelt zu viel Kontext an, sein System-Prompt wird zu einem Widerspruchs-Wall, und sein Verhalten wird unvorhersehbar.

Die Alternative: enge, fokussierte Sub-Agenten bauen, die je eines gut können. Das ist keine neue Idee — es ist die Unix-Philosophie angewandt auf KI. Kleine, komposierbare Werkzeuge, die sich verketten lassen.

Ein Sub-Agent sollte haben:

- **Eine klare Verantwortung** ("Unit Tests für Python-Funktionen generieren")
- **Definierte Eingaben** (Quellcode der Funktion, bevorzugtes Test-Framework)
- **Definierte Ausgaben** (Testdatei-Inhalt, Coverage-Schätzung)
- **Keine Seiteneffekte** außerhalb seines Scopes (er verändert nicht den Quellcode, den er testet)

## Explizite I/O-Kontrakte

Jeder Sub-Agent braucht einen Kontrakt — eine klare Spezifikation, was er akzeptiert und was er zurückgibt. Ohne das bricht die Komposition zusammen. Du kannst den Output eines Agenten nicht in einen anderen pipen, wenn du die Form des Outputs nicht kennst.

### Kontrakte definieren

```yaml
# agents/test-generator.yaml
name: test-generator
description: "Generiert Unit Tests für Python-Funktionen"
model: claude-sonnet-4-20250514

input:
  format: json
  schema:
    source_code:
      type: string
      required: true
      description: "Die zu testende(n) Python-Funktion(en)"
    framework:
      type: enum
      values: [pytest, unittest]
      default: pytest
    coverage_target:
      type: number
      default: 0.8
      description: "Ziel-Branch-Coverage (0.0–1.0)"

output:
  format: json
  schema:
    test_code:
      type: string
      description: "Inhalt der generierten Testdatei"
    test_count:
      type: number
      description: "Anzahl generierter Test-Cases"
    estimated_coverage:
      type: number
      description: "Geschätzte Branch-Coverage"
```

Dieser Kontrakt erfüllt drei Aufgaben gleichzeitig: Er dokumentiert den Agenten für Menschen, validiert Eingaben zur Laufzeit und ermöglicht es Tooling, Pipeline-Konfigurationen automatisch zu generieren.

## Shell-Scripting als Orchestrierung

Für das Verketten von Sub-Agenten braucht es kein komplexes Orchestrierungs-Framework. Shell-Skripte funktionieren überraschend gut für lineare Pipelines und haben den Vorteil, allgemein verständlich zu sein.

```bash
#!/bin/bash
# pipeline: analyse → tests generieren → tests reviewen

set -euo pipefail

SOURCE_FILE="$1"
SOURCE_CODE=$(cat "$SOURCE_FILE")

# Schritt 1: Code-Struktur analysieren
ANALYSIS=$(agent-run code-analyzer \
  --input "{\"source_code\": $(echo "$SOURCE_CODE" | jq -Rs .)}" \
  --output json)

echo "Analyse abgeschlossen: $(echo "$ANALYSIS" | jq -r '.summary')"

# Schritt 2: Tests basierend auf Analyse generieren
FUNCTIONS=$(echo "$ANALYSIS" | jq -r '.functions')
TESTS=$(agent-run test-generator \
  --input "{\"source_code\": $(echo "$SOURCE_CODE" | jq -Rs .), \"framework\": \"pytest\"}" \
  --output json)

echo "$(echo "$TESTS" | jq -r '.test_count') Test-Cases generiert"

# Schritt 3: Generierte Tests auf Qualität reviewen
REVIEW=$(agent-run code-reviewer \
  --input "{\"code\": $(echo "$TESTS" | jq -r '.test_code' | jq -Rs .), \"review_type\": \"test_quality\"}" \
  --output json)

# Schritt 4: Output schreiben, wenn Review bestanden
SCORE=$(echo "$REVIEW" | jq -r '.quality_score')
if (( $(echo "$SCORE > 0.7" | bc -l) )); then
  echo "$TESTS" | jq -r '.test_code' > "tests/test_$(basename "$SOURCE_FILE")"
  echo "Tests geschrieben. Qualitäts-Score: $SCORE"
else
  echo "Tests unter Qualitätsschwelle ($SCORE). Review: $(echo "$REVIEW" | jq -r '.issues')"
  exit 1
fi
```

Diese Pipeline ist lesbar, debugbar (mit `set -x` für Tracing) und einfach zu modifizieren. Der Output jedes Schritts wird in einer Variable gespeichert und kann bei Problemen geprüft werden.

## Komposierbare Pipelines

Die eigentliche Stärke von Sub-Agenten zeigt sich, wenn du sie zu wiederverwendbaren Pipelines zusammensetzt. Eine Pipeline ist eine Abfolge von Sub-Agenten mit definierten Übergabepunkten.

### Pipeline-Definition

```yaml
# pipelines/pr-review.yaml
name: pr-review
description: "Vollständige Pull-Request-Review-Pipeline"

steps:
  - agent: diff-analyzer
    input:
      diff: "${pipeline.input.diff}"
    output_as: analysis

  - agent: security-scanner
    input:
      code_changes: "${analysis.changed_files}"
    output_as: security

  - agent: test-coverage-checker
    input:
      source_files: "${analysis.changed_files}"
      test_files: "${analysis.test_files}"
    output_as: coverage

  - agent: review-summarizer
    input:
      analysis: "${analysis}"
      security: "${security}"
      coverage: "${coverage}"
    output_as: summary

output:
  review: "${summary.review_text}"
  approve: "${summary.should_approve}"
  issues: "${summary.blocking_issues}"
```

Jeder Schritt referenziert Outputs vorheriger Schritte über eine einfache Variablen-Syntax. Der Pipeline-Runner löst diese Referenzen auf, validiert die Datenstrukturen gegen die Agenten-Kontrakte und behandelt Fehler an jedem Übergabepunkt.

## Validierung zwischen Übergaben

Der Raum zwischen zwei Agenten ist der, wo Dinge kaputtgehen. Agent A gibt etwas Unerwartetes zurück, Agent B empfängt Müll, die Pipeline produziert Unsinn. Validierung an den Übergabepunkten fängt diese Fehler frühzeitig ab.

```typescript
interface HandoffValidator {
  validate(
    output: unknown,
    expectedSchema: Schema
  ): ValidationResult;
}

// Zwischen jedem Pipeline-Schritt:
const result = await agent.run(input);
const validation = validator.validate(result, nextAgent.inputSchema);

if (!validation.valid) {
  // Option 1: Mit Fehlerkontext wiederholen
  const retryResult = await agent.run(input, {
    additionalContext: `Vorheriger Output war ungültig: ${validation.errors.join(", ")}. Bitte korrigieren.`,
  });

  // Option 2: Standardwert verwenden
  // Option 3: Pipeline mit klarem Fehler stoppen
}
```

Drei Validierungsstrategien in der Reihenfolge ihrer Bevorzugung:

1. **Mit Feedback wiederholen.** Dem Agenten seine Validierungsfehler mitgeben und ihn bitten, sie zu beheben. Funktioniert gut bei Formatierungsproblemen.
2. **Standardwerte.** Wenn ein nicht-kritisches Feld fehlt, sinnvollen Standardwert verwenden und weitermachen.
3. **Mit Diagnose stoppen.** Wenn der Output grundlegend falsch ist, Pipeline stoppen und exakt angeben, welcher Schritt warum scheiterte.

## Mit Agent Forge bauen

**Agent Forge** liefert das Gerüst für dieses Muster. Es generiert die Agenten-Konfigurationsdateien, richtet die Kontrakt-Validierung ein und erstellt den Pipeline-Runner — damit du dich auf das Schreiben der System-Prompts und das Testen des Agentenverhaltens konzentrieren kannst statt auf die Infrastruktur.

```bash
# Neuen Sub-Agenten scaffolden
agent-forge create test-generator --model claude-sonnet --category testing

# Kontrakt interaktiv definieren
agent-forge contract test-generator

# Zur Pipeline hinzufügen
agent-forge pipeline add pr-review --step test-generator --after diff-analyzer

# Pipeline lokal ausführen
agent-forge pipeline run pr-review --input '{"diff": "..."}'
```

## Design-Richtlinien

**Prompts unter 500 Wörter halten.** Wenn dein System-Prompt länger ist, ist der Scope des Agenten wahrscheinlich zu breit. Aufteilen.

**Mit adversarialen Inputs testen.** Den Agenten mit fehlerhaftem JSON, leeren Strings und absurd langen Inputs konfrontieren. Die Kontrakt-Validierung sollte das abfangen — aber verifizieren.

**Agenten versionieren.** Wenn ein System-Prompt aktualisiert wird, ändert sich das Verhalten des Agenten. Versionen taggen, damit Pipelines auf bekannte funktionierende Konfigurationen pinnen können.

**Alles protokollieren.** Jeder Sub-Agenten-Aufruf sollte Input, Output, verwendetes Modell, Token-Anzahl und Latenz loggen. Diese Daten sind unverzichtbar zum Debuggen von Pipelines und zur Kostenoptimierung.

**Mit zwei Agenten beginnen.** Keine Zwölf-Agenten-Pipeline auf dem Papier entwerfen. Zwei Agenten bauen, verbinden, die Übergabe verifizieren, dann den dritten hinzufügen. Schrittweise Komposition findet Integrationsprobleme früh.

Das Ziel ist nicht das ausgefeilteste Multi-Agenten-System zu bauen. Das Ziel ist zuverlässige, vorhersehbare Automatisierung aus kleinen, testbaren Teilen.
