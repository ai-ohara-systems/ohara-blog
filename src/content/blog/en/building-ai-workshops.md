---
title: "Building Interactive AI Workshops — Lessons from Going Framework-Free"
description: "Practical lessons on building interactive AI training materials with vanilla JavaScript, Vite, and no framework overhead."
date: "2026-03-23"
tag: "education"
tagColor: "#818cf8"
readTime: "6 min read"
lang: "en"
---

## The Problem with Most Workshop Materials

Most AI workshops share the same format: a slide deck, a GitHub repo full of Jupyter notebooks, and a hope that attendees can follow along. It works for experienced developers. It fails for everyone else.

The gap between "here are slides about prompt engineering" and "now build something with an AI agent" is enormous. Interactive workshops — where the content itself is a working application that attendees can manipulate — close that gap. But building them introduces its own set of decisions, and the biggest one comes first: do you reach for a framework?

## Why Vanilla JavaScript Was the Right Call

When we built workshop materials for AI agent training, we deliberately chose vanilla JavaScript with Vite as the build tool. No React, no Vue, no Svelte. Here is why that decision paid off.

### Audience Diversity

Workshop attendees come from every background. Some are frontend specialists who think in components. Others are backend developers who last wrote JavaScript in 2018. A few are data scientists who primarily use Python. Using React would alienate the non-React people. Using any framework adds a conceptual layer that distracts from the actual content — which is AI agents, not UI architecture.

Vanilla JS with standard DOM APIs is universally readable:

```javascript
// Anyone who has ever seen JavaScript can follow this
const responseEl = document.getElementById("agent-response");

async function runAgent(prompt) {
  responseEl.textContent = "Thinking...";

  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json();
  responseEl.textContent = data.result;
}
```

No JSX to explain. No reactive state model to introduce. No build step confusion. Attendees can focus on the AI concepts instead of the UI plumbing.

### Vite as the Build Tool

Vite deserves specific mention because it solves the one problem vanilla JS has in a workshop setting: module loading and hot reload.

```javascript
// vite.config.js — that's it, that's the config
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

Vite gives you ES module support, instant hot module replacement, and a dev server — with nearly zero configuration. Attendees run `npm run dev` and they are up. No webpack config to debug, no babel presets to install.

## Presenter Mode vs. Self-Paced

Interactive workshops need to support two modes, and the architecture should handle both from the start.

**Presenter mode:** The instructor controls the flow. Slides advance for everyone. Live coding demos are projected. Attendees see the same state.

**Self-paced mode:** Each attendee works at their own speed. They can go back to previous sections, experiment with the code, and break things without affecting anyone else.

The simplest implementation uses URL-based state:

```javascript
// Each section is a URL path
// /workshop/01-intro
// /workshop/02-first-agent
// /workshop/03-prompt-engineering

const sections = [
  { path: "01-intro", title: "What Are AI Agents?" },
  { path: "02-first-agent", title: "Your First Agent" },
  { path: "03-prompt-engineering", title: "Prompt Engineering Basics" },
  { path: "04-multi-agent", title: "Multi-Agent Patterns" },
];

// Navigation works with browser back/forward
function navigateTo(section) {
  history.pushState({ section }, "", `/workshop/${section.path}`);
  loadSection(section);
}
```

In presenter mode, a WebSocket connection syncs the current section across all connected browsers. In self-paced mode, the WebSocket is simply not connected — the same code works in both modes without any branching logic.

## Bilingual Support Without i18n Libraries

If your workshops serve an international audience, you need localization. But full i18n libraries (i18next, FormatJS) are heavy dependencies for what is usually a simple requirement: showing content in one of two languages.

A lightweight approach using data attributes:

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

// Initialize from preference or browser language
const savedLang = localStorage.getItem("workshop-lang");
const browserLang = navigator.language.startsWith("de") ? "de" : "en";
setLanguage(savedLang || browserLang);
```

This is 15 lines of code. It handles the entire localization requirement for a workshop. No build step, no JSON translation files, no key management.

## State Management Without a Framework

The most common objection to framework-free development is state management. "How do you handle complex state without Redux/Zustand/Pinia?"

For workshop applications, the answer is: you probably do not have complex state. Workshop state is typically:

- Which section the user is on
- Their responses to exercises
- Configuration values (API keys, model selection)

A simple state object with event listeners covers it:

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

// Usage
state.onChange((key, value) => {
  if (key === "currentSection") loadSection(value);
  if (key === "agentResponse") updateResponsePanel(value);
});
```

This is roughly 20 lines. It is debuggable with `console.log`. It has no dependencies. And it scales to everything a workshop needs.

## Lessons Learned

**Start with content, not tooling.** The workshop content should exist as plain Markdown before you write any UI code. If the content is good, a simple presentation layer is sufficient.

**Make every exercise self-contained.** Each section should work independently. If attendees skip ahead or fall behind, they should not hit broken dependencies.

**Embed the agent interaction.** The most effective workshop exercises let attendees type a prompt and see the agent respond — right in the workshop page. This requires a backend (even a minimal one), but the learning impact is worth the setup cost.

**Ship a reset button.** Attendees will break things. A one-click reset that restores the exercise to its initial state saves ten minutes of debugging per person per session.

**Test on slow connections.** Workshop venues often have terrible WiFi. A framework-free approach with minimal dependencies loads faster and fails more gracefully than a 2MB JavaScript bundle.

The best workshop tooling is the tooling your audience does not notice. They should be thinking about AI agents, not about why the page is not rendering.
