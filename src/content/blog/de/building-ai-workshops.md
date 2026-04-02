---
title: "Interaktive KI-Workshops entwickeln — Erfahrungen aus dem Framework-freien Ansatz"
description: "Praktische Erkenntnisse zum Aufbau interaktiver KI-Schulungsmaterialien mit Vanilla JavaScript, Vite und ohne Framework-Overhead."
date: "2026-03-23"
tag: "education"
tagColor: "#818cf8"
readTime: "6 min Lesezeit"
lang: "de"
---

## Das Problem mit den meisten Workshop-Materialien

Die meisten KI-Workshops teilen dasselbe Format: eine Präsentation, ein GitHub-Repo voller Jupyter-Notebooks und die Hoffnung, dass die Teilnehmenden mithalten können. Für erfahrene Entwicklerinnen und Entwickler funktioniert das. Für alle anderen scheitert es.

Die Lücke zwischen "hier sind Folien über Prompt Engineering" und "baue jetzt etwas mit einem KI-Agenten" ist enorm. Interaktive Workshops — bei denen der Inhalt selbst eine lauffähige Anwendung ist, die die Teilnehmenden manipulieren können — schließen diese Lücke. Aber ihr Aufbau bringt eigene Entscheidungen mit sich, und die größte kommt zuerst: Greife ich zu einem Framework?

## Warum Vanilla JavaScript die richtige Wahl war

Als wir Workshop-Materialien für KI-Agenten-Training entwickelten, entschieden wir uns bewusst für Vanilla JavaScript mit Vite als Build-Tool. Kein React, kein Vue, kein Svelte. Hier ist, warum sich diese Entscheidung ausgezahlt hat.

### Vielfalt der Teilnehmenden

Workshop-Teilnehmende kommen aus den verschiedensten Hintergründen. Manche sind Frontend-Spezialistinnen, die in Komponenten denken. Andere sind Backend-Entwickler, die zuletzt 2018 JavaScript geschrieben haben. Einige sind Data Scientists, die hauptsächlich Python nutzen. React zu verwenden würde die Nicht-React-Leute ausgrenzen. Jedes Framework fügt eine konzeptionelle Schicht hinzu, die vom eigentlichen Inhalt ablenkt — der nämlich KI-Agenten sind, nicht UI-Architektur.

Vanilla JS mit Standard-DOM-APIs ist universell lesbar:

```javascript
// Jeder, der schon einmal JavaScript gesehen hat, kann das nachvollziehen
const responseEl = document.getElementById("agent-response");

async function runAgent(prompt) {
  responseEl.textContent = "Denke nach...";

  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json();
  responseEl.textContent = data.result;
}
```

Kein JSX zu erklären. Kein reaktives State-Modell einzuführen. Keine Verwirrung durch Build-Schritte. Die Teilnehmenden können sich auf die KI-Konzepte konzentrieren statt auf die UI-Infrastruktur.

### Vite als Build-Tool

Vite verdient besondere Erwähnung, weil es das einzige Problem löst, das Vanilla JS in einem Workshop-Setting hat: Modul-Loading und Hot Reload.

```javascript
// vite.config.js — das ist es, das ist die gesamte Konfiguration
export default {
  root: "src",
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
};
```

Vite bietet ES-Modul-Unterstützung, sofortiges Hot Module Replacement und einen Dev-Server — bei nahezu null Konfigurationsaufwand. Teilnehmende führen `npm run dev` aus und sind sofort startklar. Kein Webpack-Config zu debuggen, keine Babel-Presets zu installieren.

## Presenter-Modus vs. Selbstgesteuertes Lernen

Interaktive Workshops müssen zwei Modi unterstützen, und die Architektur sollte von Anfang an beide abdecken.

**Presenter-Modus:** Die Kursleitung steuert den Ablauf. Folien wechseln für alle gleichzeitig. Live-Coding-Demos werden projiziert. Teilnehmende sehen denselben Stand.

**Selbstgesteuerter Modus:** Jede teilnehmende Person arbeitet in ihrem eigenen Tempo. Sie können zu vorherigen Abschnitten zurückgehen, mit dem Code experimentieren und Dinge kaputt machen, ohne andere zu beeinflussen.

Die einfachste Implementierung nutzt URL-basiertes State-Management:

```javascript
// Jeder Abschnitt ist ein URL-Pfad
// /workshop/01-intro
// /workshop/02-first-agent
// /workshop/03-prompt-engineering

const sections = [
  { path: "01-intro", title: "Was sind KI-Agenten?" },
  { path: "02-first-agent", title: "Dein erster Agent" },
  { path: "03-prompt-engineering", title: "Prompt Engineering Grundlagen" },
  { path: "04-multi-agent", title: "Multi-Agent-Muster" },
];

// Navigation funktioniert mit Browser-Vor/Zurück
function navigateTo(section) {
  history.pushState({ section }, "", `/workshop/${section.path}`);
  loadSection(section);
}
```

Im Presenter-Modus synchronisiert eine WebSocket-Verbindung den aktuellen Abschnitt über alle verbundenen Browser hinweg. Im selbstgesteuerten Modus ist der WebSocket schlicht nicht verbunden — derselbe Code funktioniert in beiden Modi ohne jede Verzweigungslogik.

## Mehrsprachigkeit ohne i18n-Bibliotheken

Wenn deine Workshops ein internationales Publikum bedienen, brauchst du Lokalisierung. Aber vollständige i18n-Bibliotheken (i18next, FormatJS) sind schwere Abhängigkeiten für eine meist simple Anforderung: Inhalte in einer von zwei Sprachen anzuzeigen.

Ein schlanker Ansatz mit Data-Attributen:

```html
<h2 data-en="Building Your First Agent" data-de="Deinen ersten Agenten bauen"></h2>

<p data-en="An agent is a program that uses an LLM to make decisions."
   data-de="Ein Agent ist ein Programm, das ein LLM zur Entscheidungsfindung nutzt."></p>
```

```javascript
function setLanguage(lang) {
  document.querySelectorAll("[data-en]").forEach((el) => {
    el.textContent = el.dataset[lang] || el.dataset.en;
  });
  localStorage.setItem("workshop-lang", lang);
}

// Initialisieren aus gespeicherter Einstellung oder Browser-Sprache
const savedLang = localStorage.getItem("workshop-lang");
const browserLang = navigator.language.startsWith("de") ? "de" : "en";
setLanguage(savedLang || browserLang);
```

Das sind 15 Zeilen Code. Sie decken die gesamte Lokalisierungsanforderung eines Workshops ab. Kein Build-Schritt, keine JSON-Übersetzungsdateien, kein Key-Management.

## State Management ohne Framework

Der häufigste Einwand gegen Framework-freie Entwicklung ist das State Management. "Wie handhabst du komplexen State ohne Redux/Zustand/Pinia?"

Für Workshop-Anwendungen lautet die Antwort: Es gibt wahrscheinlich keinen komplexen State. Workshop-State besteht typischerweise aus:

- Auf welchem Abschnitt sich die nutzende Person befindet
- Ihre Antworten auf Aufgaben
- Konfigurationswerte (API-Keys, Modellauswahl)

Ein einfaches State-Objekt mit Event-Listenern deckt das ab:

```javascript
const state = {
  _data: {},
  _listeners: new Set(),

  set(key, value) {
    this._data[key] = value;
    this._listeners.forEach((fn) => fn(key, value));
  },

  get(key) {
    return this._data[key];
  },

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },
};

// Verwendung
state.onChange((key, value) => {
  if (key === "currentSection") loadSection(value);
  if (key === "agentResponse") updateResponsePanel(value);
});
```

Das sind rund 20 Zeilen. Debuggbar mit `console.log`. Ohne Abhängigkeiten. Und es skaliert auf alles, was ein Workshop benötigt.

## Erkenntnisse

**Mit Inhalten beginnen, nicht mit Tooling.** Der Workshop-Inhalt sollte als reines Markdown existieren, bevor auch nur eine Zeile UI-Code geschrieben wird. Wenn der Inhalt gut ist, reicht eine einfache Präsentationsschicht.

**Jede Aufgabe eigenständig machen.** Jeder Abschnitt sollte unabhängig funktionieren. Wenn Teilnehmende vorspringen oder zurückfallen, sollten sie nicht auf fehlerhafte Abhängigkeiten stoßen.

**Die Agent-Interaktion einbetten.** Die wirkungsvollsten Workshop-Aufgaben ermöglichen es Teilnehmenden, einen Prompt einzugeben und die Agent-Antwort direkt auf der Workshop-Seite zu sehen. Das erfordert ein Backend (auch ein minimales), aber der Lerneffekt rechtfertigt den Einrichtungsaufwand.

**Einen Reset-Button einbauen.** Teilnehmende werden Dinge kaputtmachen. Ein Klick, der die Aufgabe in ihren Ausgangszustand zurücksetzt, spart pro Person und Sitzung zehn Minuten Debugging.

**Auf langsamen Verbindungen testen.** Workshop-Veranstaltungsorte haben oft schlechtes WLAN. Ein Framework-freier Ansatz mit minimalen Abhängigkeiten lädt schneller und scheitert eleganter als ein 2-MB-JavaScript-Bundle.

Das beste Workshop-Tooling ist das, das das Publikum nicht bemerkt. Die Teilnehmenden sollen über KI-Agenten nachdenken — nicht darüber, warum die Seite nicht rendert.
