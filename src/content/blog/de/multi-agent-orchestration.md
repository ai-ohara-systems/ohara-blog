---
title: "Multi-Agenten-Orchestrierung — vom Einzelagenten zur Pipeline"
description: "Wie man mehrere KI-Agenten zu zuverlässigen Pipelines orchestriert — mit Routing-Strategien, Lifecycle-Management und modellspezifischer Zuweisung."
date: "2026-02-24"
tag: "agents"
tagColor: "#818cf8"
readTime: "7 min Lesezeit"
lang: "de"
---

## Über den Einzelagenten hinaus

Ein einzelner KI-Agent kann beeindruckende Dinge leisten — Code schreiben, Fragen beantworten, Dateien refaktorieren. Aber echte Entwicklungsworkflows passen selten in den Scope eines einzelnen Agenten. Du brauchst einen Agenten zur Codeanalyse, einen anderen zum Erzeugen von Tests, einen dritten zum Review dieser Tests, und einen vierten zum Aktualisieren der Dokumentation. Das alles in einer einzigen Session zu erledigen bedeutet: überfülltes Kontextfenster, widersprüchliche Anweisungen und schlechtere Ausgabequalität.

Multi-Agenten-Orchestrierung löst dieses Problem, indem sie Workflows in Phasen aufteilt — jede mit einem spezialisierten Agenten mit eigenem Kontext, eigenem Modell und eigenen Anweisungen. Der Orchestrator steuert den Ablauf zwischen ihnen.

## Was Sub-Agenten eigentlich sind

Ein Sub-Agent ist eine isolierte Agenten-Session — eigenes Kontextfenster, eigener System-Prompt, eigene Modell-Zuweisung. Er empfängt eine spezifische Eingabe, produziert eine spezifische Ausgabe und beendet sich. Er teilt keinen Speicher mit anderen Agenten der Pipeline, es sei denn, du gibst Daten explizit weiter.

Diese Isolation ist die Schlüsseleigenschaft:

- **Keine Kontext-Verschmutzung.** Der Test-Schreiber sieht nicht das interne Reasoning des Code-Reviewers.
- **Unabhängige Modellwahl.** Teures Modell für komplexe Analyse, günstiges für Formatierung.
- **Vorhersehbares Verhalten.** Das Verhalten jedes Agenten hängt nur von seinem Input und System-Prompt ab — nicht davon, was drei Schritte zuvor in einer anderen Session passiert ist.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Analyzer    │────▶│  Generator  │────▶│  Reviewer    │
│  (Sonnet)    │     │  (Haiku)    │     │  (Sonnet)    │
│  128k ctx    │     │  32k ctx    │     │  64k ctx     │
└─────────────┘     └─────────────┘     └─────────────┘
     Input:              Input:              Input:
     Gesamte Codebase    Analyse +           Generierter Code +
                         Anweisungen         Qualitätskriterien
```

## Wann Multi-Agenten-Orchestrierung sinnvoll ist

Nicht jede Aufgabe braucht mehrere Agenten. Orchestrierung ist sinnvoll wenn:

**Die Aufgabe klare Phasen hat.** Analyse → Generierung → Validierung ist eine natürliche Drei-Agenten-Pipeline. Jede Phase hat unterschiedliche Anforderungen und profitiert von verschiedenen Modellen.

**Kontextfenster-Limits relevant sind.** Eine 200k-Token-Codebase passt nicht in ein einzelnes Kontextfenster zusammen mit detaillierten Anweisungen und Beispielen. Arbeit auf Agenten verteilen, die jeweils einen Teilbereich behandeln.

**Unterschiedliches Fachwissen gefragt ist.** Ein Sicherheits-Review braucht andere System-Prompts als eine Performance-Optimierung. Beides in einen Agenten zu packen verwässert beide Fähigkeiten.

**Nachvollziehbarkeit nötig ist.** Wenn jeder Schritt einen protokollierten, prüfbaren Output produziert, ist das Debuggen von Fehlern einfach. „Die Analyse war korrekt, der Generator-Output war falsch" ist handlungsfähig. „Der Agent hat schlechten Output produziert" nicht.

**Keine Orchestrierung** bei einfachen, einmaligen Aufgaben. Wenn ein Agent die gesamte Arbeit in unter 30 Sekunden erledigen kann, kostet Orchestrierung nur Zeit.

## Routing-Strategien

Wie entscheidest du, welcher Agent welchen Teil der Arbeit übernimmt? Drei Muster:

### Sequenzielle Pipeline

Das einfachste Muster. Agenten laufen in fester Reihenfolge, jeder empfängt den Output des vorherigen.

```yaml
pipeline:
  - agent: code-analyzer
  - agent: test-generator
  - agent: test-reviewer
  - agent: report-writer
```

Geeignet, wenn der Workflow linear ist und jeder Schritt immer gebraucht wird.

### Bedingtes Routing

Ein initialer Klassifikations-Agent prüft den Input und leitet an den passenden Spezialisten weiter.

```yaml
router:
  agent: task-classifier
  routes:
    bug_fix:
      pipeline: [bug-locator, fix-generator, test-updater]
    feature:
      pipeline: [spec-writer, code-generator, test-generator, doc-updater]
    refactor:
      pipeline: [code-analyzer, refactor-planner, refactor-executor]
```

Der Klassifikator ist typischerweise ein schneller, günstiger Modell-Aufruf, der die Anfrage kategorisiert. So werden unnötige Agenten übersprungen — ein Bug-Fix braucht keinen Spec-Writer.

### Fan-Out / Fan-In

Mehrere Agenten laufen parallel, ihre Outputs werden von einem abschließenden Agenten zusammengeführt.

```yaml
fan_out:
  - agent: security-reviewer
  - agent: performance-reviewer
  - agent: style-reviewer

fan_in:
  agent: review-aggregator
  input: [security-reviewer.output, performance-reviewer.output, style-reviewer.output]
```

Ideal für Code-Reviews, bei denen mehrere unabhängige Perspektiven gleichzeitig eingeholt und dann zusammengefasst werden.

## Lifecycle-Management

Jede Agenten-Session hat einen Lifecycle: Erstellung, Ausführung, Output-Sammlung und Beendigung. Der Orchestrator muss Randfälle in jeder Phase behandeln.

**Timeouts.** Wenn ein Agent nach 120 Sekunden nicht geantwortet hat, Session beenden und entweder wiederholen oder Schritt überspringen. Hängende Agenten blockieren die gesamte Pipeline.

**Wiederholungen mit Backoff.** LLM-API-Aufrufe schlagen fehl. Rate Limits werden erreicht. Der Orchestrator sollte transiente Fehler (HTTP 429, 503) mit exponentiellem Backoff wiederholen, aber keine deterministischen Fehler (fehlerhafte Eingabe).

**Graceful Degradation.** Wenn ein nicht-kritischer Agent scheitert (z. B. der Dokumentations-Updater), sollte die Pipeline fortlaufen und den Fehler markieren statt abzubrechen.

```typescript
async function executeStep(agent: AgentConfig, input: unknown): Promise<StepResult> {
  const maxRetries = agent.critical ? 3 : 1;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runWithTimeout(
        agent.run(input),
        agent.timeoutMs ?? 120_000
      );
      return { status: "success", output: result };
    } catch (error) {
      if (attempt === maxRetries) {
        if (agent.critical) throw error;
        return { status: "skipped", error: error.message };
      }
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

## Modell-Zuweisung pro Aufgabe

Einer der größten Vorteile der Multi-Agenten-Orchestrierung ist die modellspezifische Zuweisung pro Schritt:

| Aufgabe | Empfohlenes Modell | Grund |
|---------|-------------------|-------|
| Code-Analyse | Claude Sonnet | Starkes Reasoning nötig |
| Boilerplate-Generierung | GPT-4o-mini / Qwen | Einfach, musterbasiert |
| Sicherheits-Review | Claude Sonnet / GPT-4o | Hohes Risiko, braucht Tiefe |
| Dokumentation | Haiku / GPT-4o-mini | Unkompliziertes Schreiben |
| Test-Generierung | Sonnet | Muss Randfälle verstehen |
| Formatierung / Linting | Qwen 2.5 | Mechanische Transformation |

In Verbindung mit **Model Prism** kann die Modell-Zuweisung dynamisch erfolgen — der Orchestrator sendet Anfragen mit einem Aufgabentyp-Header, und Model Prism leitet basierend auf deiner Konfiguration ans passende Modell weiter. Modell-Zuweisungen lassen sich so ändern, ohne den Pipeline-Code anzufassen.

## Best Practices

**1. Mit dem Datenfluss beginnen.** Bevor eine Agenten-Konfiguration geschrieben wird, den Datenfluss zwischen den Schritten skizzieren. Die Pipeline auf Papier zeichnen. Wenn die Übergabepunkte nicht klar definiert werden können, ist die Pipeline noch nicht bereit zum Bauen.

**2. Das günstigste Modell nutzen, das funktioniert.** Jeden Agenten zuerst mit dem günstigsten Modell ausführen. Nur upgraden, wenn messbar schlechtere Outputs für diese spezifische Aufgabe nachgewiesen werden.

**3. Orchestrierungslogik außerhalb der Agenten halten.** Agenten sollen nicht entscheiden, welcher Agent als nächstes läuft. Der Orchestrator entscheidet. Das hält Agenten einfach und macht den Pipeline-Ablauf in der Konfiguration sichtbar.

**4. Token-Nutzung pro Schritt protokollieren.** Was nicht gemessen wird, kann nicht optimiert werden. Eingabe-Tokens, Ausgabe-Tokens, verwendetes Modell und Latenz für jeden Agenten-Aufruf tracken. Aggregierte Daten helfen dabei, Kosten-Hotspots zu finden.

**5. Pipelines versionieren.** Eine Pipeline-Konfiguration ist Code. In Versionskontrolle speichern, Änderungen in Pull Requests reviewen, Releases taggen. Wenn eine Pipeline schlechtere Outputs produziert, muss gegen die letzte bekannte funktionierende Version gedifft werden können.

**6. Agenten zuerst isoliert testen.** Vor dem Verbinden zu einer Pipeline jeden Agenten unabhängig mit repräsentativen Inputs verifizieren. Integrations-Bugs sind schwerer zu diagnostizieren als Einzelagenten-Fehler.

## Das Ökosystem

**Agent Forge** bietet das Gerüst zum Bauen einzelner Sub-Agenten mit richtigen Kontrakten und Validierung. **Agent Atlas** dient als Katalog, in dem wiederverwendbare Agenten entdeckt und geteilt werden. Zusammen bilden sie die Grundlage für Multi-Agenten-Pipelines, die wartbar, kostengünstig und zuverlässig sind.

Der Wechsel vom Einzel- zum Multi-Agenten-Ansatz ist kein Selbstzweck. Es geht darum, dieselben Engineering-Prinzipien — Separation of Concerns, Komposierbarkeit, Testbarkeit — anzuwenden, die wir bereits in der traditionellen Softwareentwicklung nutzen. Die Agenten sind die Funktionen. Die Pipeline ist das Programm.
