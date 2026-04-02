---
title: "Credentials versehentlich committed? Eine Schritt-für-Schritt-Anleitung zur Behebung"
description: "Eine praktische Schritt-für-Schritt-Anleitung zur Behebung versehentlich eingebundener Secrets — Widerruf, Git-Verlauf bereinigen und Präventionsstrategien."
date: "2026-03-24"
tag: "security"
tagColor: "#e879f9"
readTime: "7 min Lesezeit"
lang: "de"
---

## Es passiert allen

Du pushst einen Commit. Dreißig Sekunden später fällt dir der Magen weg — die `.env`-Datei war dabei. Oder schlimmer: Du hast vor drei Commits "vorübergehend" einen API-Key hartcodiert und ihn gerade auf GitHub entdeckt.

Das ist kein seltener Fehler. GitHub berichtet, dass allein im Jahr 2024 über 10 Millionen Secrets in öffentlichen Repositories entdeckt wurden. Mit KI-Coding-Agenten, die zum festen Bestandteil täglicher Workflows werden, steigt das Risiko zusätzlich — Agenten generieren Code schnell, und sie wissen nicht immer, welche Strings sensibel sind.

Hier ist das Wiederherstellungs-Playbook. Jeden Schritt befolgen, in der angegebenen Reihenfolge.

## Schritt 1: Sofort widerrufen

**Das zuerst erledigen.** Nicht nach der Bereinigung des Git-Verlaufs. Nicht nach der Mittagspause. Jetzt sofort.

Ein committeter Secret sollte als kompromittiert gelten, sobald er auf einen Remote gepusht wurde — auch in einem privaten Repo. Automatisierte Scanner durchsuchen GitHub ständig, und einige können Credentials innerhalb von Sekunden nach einem Push extrahieren.

### Gängige Dienste — Wo widerrufen

**AWS:**
```bash
# Access Keys auflisten
aws iam list-access-keys --user-name your-username

# Den kompromittierten Key deaktivieren
aws iam update-access-key --access-key-id AKIAIOSFODNN7EXAMPLE --status Inactive

# Neuen Key erstellen, dann alten löschen
aws iam create-access-key --user-name your-username
aws iam delete-access-key --access-key-id AKIAIOSFODNN7EXAMPLE
```

**GitHub Personal Access Tokens:** Einstellungen → Entwicklereinstellungen → Personal Access Tokens → Token widerrufen.

**Stripe:** Dashboard → Developers → API Keys → Key rotieren (generiert einen neuen und invalidiert den alten).

**Datenbank-Credentials:** Passwort direkt auf dem Datenbankserver ändern, dann die Anwendungskonfiguration aktualisieren.

**OpenAI / Anthropic API Keys:** Zum Provider-Dashboard gehen, den kompromittierten Key löschen, einen neuen generieren.

Das Muster ist immer dasselbe: **Erst neue Credentials generieren**, die Anwendung auf diese umstellen, dann die alten löschen. Das minimiert die Ausfallzeit.

## Schritt 2: Aus aktuellen Dateien entfernen

Bevor du den Git-Verlauf anfasst, stelle sicher, dass der Secret nicht mehr in deinem aktuellen Working Tree vorhanden ist.

```bash
# Nach potenziellen Secrets in der Codebase suchen
grep -rn "AKIA\|sk-\|ghp_\|password\s*=" --include="*.{js,ts,py,yaml,yml,json,env}" .

# Secrets in Umgebungsvariablen verschieben
# Vorher (schlecht):
# const apiKey = "sk-proj-abc123...";

# Nachher (gut):
# const apiKey = process.env.OPENAI_API_KEY;
```

Die `.gitignore` aktualisieren, um erneutes Committen zu verhindern:

```gitignore
# Umgebungsdateien
.env
.env.*
!.env.example

# Gängige Credential-Dateien
credentials.json
service-account-key.json
*.pem
*.key
```

## Schritt 3: Git-Verlauf bereinigen

Die Datei aus dem aktuellen Commit zu entfernen reicht nicht. Der Secret existiert noch in früheren Commits, und jeder mit Zugriff auf das Repo kann ihn finden.

### Option A: Orphan-Branch-Reset (Einfach, destruktiv)

Wenn das Repo klein ist, das Team klein ist und der vollständige Verlauf nicht erhalten bleiben muss:

```bash
# Sauberen Orphan-Branch erstellen
git checkout --orphan clean-main

# Alle aktuellen (sauberen) Dateien hinzufügen
git add -A
git commit -m "Clean repository history — credential removal"

# main ersetzen
git branch -D main
git branch -m main

# Force Push (vorher mit dem Team abstimmen)
git push origin main --force
```

**Warnung:** Dadurch wird der gesamte Commit-Verlauf zerstört. Alle Teammitglieder müssen neu klonen.

### Option B: BFG Repo Cleaner (Chirurgisch)

BFG ist schneller und einfacher als `git filter-branch` zum Entfernen bestimmter Strings oder Dateien:

```bash
# BFG installieren
# macOS: brew install bfg
# Linux: von https://rtyley.github.io/bfg-repo-cleaner/ herunterladen

# Datei mit den zu entfernenden Secrets erstellen
echo "sk-proj-abc123xyz" >> secrets-to-remove.txt
echo "AKIAIOSFODNN7EXAMPLE" >> secrets-to-remove.txt

# BFG ausführen (arbeitet auf einem bare Clone)
git clone --mirror git@github.com:ai-ohara-systems/your-repo.git
cd your-repo.git

bfg --replace-text ../secrets-to-remove.txt

# Bereinigen und pushen
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

BFG erhält den Commit-Verlauf, ersetzt aber die Secret-Strings in allen früheren Commits durch `***REMOVED***`.

### Option C: git filter-repo (Moderne Alternative)

```bash
# Installation: pip install git-filter-repo

# Bestimmte Datei aus dem gesamten Verlauf entfernen
git filter-repo --path .env --invert-paths

# Oder bestimmte Strings ersetzen
git filter-repo --replace-text replacements.txt
```

Nach jeder Verlaufsumschreibung müssen alle Teammitglieder neu klonen oder ihre lokalen Branches sorgfältig rebasen.

## Schritt 4: Den Präventionsstack aufbauen

Behebung ist schmerzhaft. Prävention ist günstig. Diese Schutzmaßnahmen schichten:

### Ebene 1: .gitignore

Die erste Verteidigungslinie. Eine umfassende `.gitignore` pflegen, die alle Credential-Dateimuster für den eigenen Stack abdeckt. [gitignore.io](https://gitignore.io) als Ausgangspunkt nutzen.

### Ebene 2: Umgebungsvariablen

Niemals Secrets hardcoden. Umgebungsvariablen verwenden, die in der Entwicklung aus `.env`-Dateien (via dotenv) und in der Produktion aus der Secret-Verwaltung der Plattform geladen werden.

```bash
# .env.example (committed — zeigt Struktur ohne Werte)
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
```

### Ebene 3: Secret-Manager

Für die Produktion einen dedizierten Secret-Manager verwenden:

- **AWS Secrets Manager** oder **SSM Parameter Store**
- **HashiCorp Vault**
- **1Password CLI** (für kleinere Teams)
- **Doppler** oder **Infisical** (entwicklerfreundliche SaaS-Optionen)

### Ebene 4: Pre-Commit-Hooks

Secrets abfangen, bevor sie ins Repository gelangen:

```bash
# detect-secrets installieren
pip install detect-secrets

# Baseline initialisieren
detect-secrets scan > .secrets.baseline

# Pre-Commit-Hook hinzufügen (.pre-commit-config.yaml)
```

```yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

### Ebene 5: CI/CD-Scanning

Secret-Scanning als Sicherheitsnetz zur Pipeline hinzufügen:

```yaml
# GitHub Actions Beispiel
- name: Scan for secrets
  uses: trufflesecurity/trufflehog@main
  with:
    extra_args: --only-verified
```

## Ein Hinweis zu KI-Agenten und Secrets

KI-Coding-Agenten verdienen hier besondere Aufmerksamkeit. Wenn ein Agent Code generiert, könnte er:

- Einen API-Key aus deiner Umgebung in eine Quelldatei einbetten
- Eine Konfigurationsdatei erstellen, die Credentials aus deinem Shell-Verlauf enthält
- Dateien committen, die du normalerweise in `.gitignore` aufnehmen würdest

Wenn du Agenten in deinem Workflow einsetzt, füge deiner Agent-Konfiguration explizite Anweisungen hinzu, die das Hardcoding von Secrets verbieten. Einige Agent-Frameworks unterstützen Allow/Deny-Listen für Dateioperationen — diese nutzen. Und Agent-generierte Commits immer vor dem Pushen überprüfen.

## Die 5-Minuten-Checkliste

Wenn es passiert (und es wird passieren), diesen Ablauf durcharbeiten:

1. **Widerrufen** der kompromittierten Credentials (2 Minuten)
2. **Neue Credentials generieren** und die Anwendung aktualisieren (2 Minuten)
3. **Secret aus aktuellen Dateien entfernen** (1 Minute)
4. **Git-Verlauf bereinigen** mit BFG oder filter-repo (10 Minuten)
5. **Force Push** nach Abstimmung mit dem Team (1 Minute)
6. **Fehlende Präventionsebenen hinzufügen** (30 Minuten, einmalig)

Die Gesamtkosten eines gut behandelten Credential-Leaks betragen etwa 45 Minuten Arbeit. Die Kosten eines schlecht behandelten — bei dem der Secret wochenlang im Git-Verlauf aktiv bleibt — können katastrophal sein.

Schnell handeln. Dann den Präventionsstack aufbauen, damit schnelles Handeln nicht mehr nötig ist.
