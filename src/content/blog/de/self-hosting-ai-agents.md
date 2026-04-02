---
title: "KI-Agenten selbst hosten — vollständige Setup-Anleitung für einen VPS"
description: "Eine praxisnahe Anleitung zum Betrieb von KI-Agenten auf einem eigenen Server mit Node.js, nginx, SSL, Firewall-Konfiguration und Messenger-Integration."
date: "2026-02-24"
tag: "infrastructure"
tagColor: "#38bdf8"
readTime: "7 min Lesezeit"
lang: "de"
---

## Warum selbst hosten?

Cloud-Plattformen für KI-Agenten sind komfortabel, bringen aber Einschränkungen mit sich: Vendor Lock-in, begrenzte Anpassungsmöglichkeiten, nutzungsabhängige Preise mit schwer vorhersehbarer Skalierung und Daten, die deine Infrastruktur verlassen. Selbst-Hosting auf einem VPS gibt dir volle Kontrolle über Laufzeitumgebung, Datenhaltung und Kostenstruktur.

Ein einfacher VPS (10–20 €/Monat) kann problemlos mehrere KI-Agenten-Instanzen, einen Reverse Proxy und Monitoring betreiben — alles, was für ein produktionstaugliches Setup nötig ist.

## Voraussetzungen

- **Ein VPS** mit Ubuntu 22.04 oder 24.04 (Hetzner, DigitalOcean, Linode — jeder Anbieter funktioniert)
- **Eine Domain**, die auf deine VPS-IP zeigt (für SSL)
- **SSH-Zugang** mit schlüsselbasierter Authentifizierung (Passwort-Auth deaktivieren)
- **API-Keys** für deine LLM-Anbieter (OpenAI, Anthropic usw.)

## Schritt 1: Basissystem einrichten

Per SSH einloggen und alles aktualisieren:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### Node.js 22 über nvm installieren

Mit nvm lassen sich Node-Versionen einfach wechseln und du umgehst die veralteten Pakete in Ubuntus Standard-Repositories:

```bash
# nvm installieren
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Shell neu laden
source ~/.bashrc

# Node.js 22 installieren und aktivieren
nvm install 22
nvm alias default 22

# Prüfen
node --version  # v22.x.x
npm --version   # 10.x.x
```

## Schritt 2: Agenten installieren

Deine Agenten-Anwendung klonen und einrichten. Dieses Beispiel nutzt eine generische Struktur — passe die Pfade an deinen spezifischen Agenten an:

```bash
# Zielverzeichnis anlegen
sudo mkdir -p /opt/agents
sudo chown $USER:$USER /opt/agents

# Agenten-Repository klonen
git clone https://github.com/ai-ohara-systems/your-agent.git /opt/agents/main

cd /opt/agents/main
npm install

# Umgebungsdatei erstellen
cp .env.example .env
```

Die `.env`-Datei mit echten Zugangsdaten befüllen:

```bash
# /opt/agents/main/.env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AGENT_PORT=8080
NODE_ENV=production
LOG_LEVEL=info
```

## Schritt 3: systemd-Dienst anlegen

Als systemd-Dienst läuft der Agent beim Boot automatisch und startet bei Abstürzen neu:

```ini
# /etc/systemd/system/ai-agent.service
[Unit]
Description=AI Agent Service
After=network.target

[Service]
Type=simple
User=agent
Group=agent
WorkingDirectory=/opt/agents/main
ExecStart=/home/agent/.nvm/versions/node/v22.*/bin/node src/index.js
Restart=on-failure
RestartSec=10
EnvironmentFile=/opt/agents/main/.env

# Sicherheitshärtung
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/agents/main

[Install]
WantedBy=multi-user.target
```

```bash
# Dedizierten Systembenutzer anlegen
sudo useradd -r -s /usr/sbin/nologin agent
sudo chown -R agent:agent /opt/agents

# Dienst aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable ai-agent
sudo systemctl start ai-agent

# Status prüfen
sudo systemctl status ai-agent
```

## Schritt 4: Firewall mit ufw

Server auf notwendige Ports beschränken:

```bash
# ufw aktivieren
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH erlauben (unbedingt vor dem Aktivieren!)
sudo ufw allow 22/tcp

# HTTP und HTTPS erlauben
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Firewall aktivieren
sudo ufw enable

# Status prüfen
sudo ufw status verbose
```

**Port 8080** (oder dein Agent-Port) niemals direkt freigeben. Der gesamte Traffic läuft über nginx.

## Schritt 5: Nginx Reverse Proxy mit SSL

### nginx installieren

```bash
sudo apt install -y nginx
```

### Reverse Proxy konfigurieren

```nginx
# /etc/nginx/sites-available/agent
server {
    listen 80;
    server_name agent.deinedomain.de;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts für lang laufende Agenten-Anfragen
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
# Site aktivieren
sudo ln -s /etc/nginx/sites-available/agent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL mit Certbot einrichten

```bash
# Certbot installieren
sudo apt install -y certbot python3-certbot-nginx

# Zertifikat ausstellen und installieren
sudo certbot --nginx -d agent.deinedomain.de

# Auto-Erneuerung prüfen
sudo certbot renew --dry-run
```

Certbot passt die nginx-Konfiguration automatisch für HTTPS an und leitet HTTP-Traffic um.

## Schritt 6: Health Checks

Health-Check-Endpunkt im Agenten einbauen und überwachen:

```bash
# Einfaches Health-Check-Skript — /opt/agents/healthcheck.sh
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health)

if [ "$RESPONSE" != "200" ]; then
  echo "$(date): Health-Check fehlgeschlagen mit Status $RESPONSE" >> /var/log/agent-health.log
  systemctl restart ai-agent
fi
```

```bash
# In Crontab eintragen — alle 5 Minuten ausführen
chmod +x /opt/agents/healthcheck.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/agents/healthcheck.sh") | crontab -
```

Für robusteres Monitoring empfiehlt sich [Uptime Kuma](https://github.com/louislam/uptime-kuma) neben deinem Agenten.

## Schritt 7: Kanäle verbinden

### Telegram

```bash
# 1. Bot über @BotFather in Telegram erstellen
# 2. Bot-Token in .env eintragen
echo "TELEGRAM_BOT_TOKEN=123456:ABC-DEF..." >> /opt/agents/main/.env

# 3. Webhook auf deine Domain setzen
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://agent.deinedomain.de/webhook/telegram"
```

### Discord

```bash
# 1. Anwendung unter https://discord.com/developers/applications erstellen
# 2. Bot anlegen und Token kopieren
echo "DISCORD_BOT_TOKEN=MTIz..." >> /opt/agents/main/.env

# 3. Bot mit dem OAuth2-URL-Generator zum Server einladen
# Benötigte Rechte: Nachrichten senden, Nachrichtenverlauf lesen, Links einbetten
```

Nach neuen Umgebungsvariablen den Dienst neu starten:

```bash
sudo systemctl restart ai-agent
```

## Sicherheits-Best-Practices

**System aktuell halten.** Automatische Sicherheitsupdates aktivieren:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Nur SSH-Keys verwenden.** Passwort-Authentifizierung in `/etc/ssh/sshd_config` deaktivieren:

```
PasswordAuthentication no
PubkeyAuthentication yes
```

**Endpunkte rate-limitieren.** Rate Limiting in nginx gegen Missbrauch:

```nginx
# Im http-Block von /etc/nginx/nginx.conf
limit_req_zone $binary_remote_addr zone=agent:10m rate=10r/s;

# Im server-Block
location / {
    limit_req zone=agent burst=20 nodelay;
    proxy_pass http://127.0.0.1:8080;
    # ... restliche Proxy-Konfiguration
}
```

**API-Keys regelmäßig rotieren.** Kalendererinnerung setzen. Bei Rotation `.env` aktualisieren und Dienst neu starten.

**Konfiguration sichern.** Agent-Configs, `.env`-Dateien (verschlüsselt) und nginx-Configs regelmäßig sichern. Ein einfaches rsync an einen separaten Ort reicht.

## Fehlerbehebung

**Agent startet nicht:** Logs mit `journalctl -u ai-agent -f` prüfen. Häufige Ursachen: fehlende Umgebungsvariablen, Port belegt, Rechteproblem.

**502 Bad Gateway von nginx:** Agent läuft nicht oder lauscht nicht auf dem erwarteten Port. Prüfen mit `curl http://127.0.0.1:8080/health`.

**SSL-Zertifikat erneuert sich nicht:** Certbot-Timer prüfen: `systemctl status certbot.timer`. Mit `sudo certbot renew --dry-run` debuggen.

**Hoher Speicherverbrauch:** Node.js-Agenten können bei langen Sitzungen Speicher verlieren. Limit in systemd setzen: `MemoryMax=512M` im `[Service]`-Abschnitt. Der Dienst startet dann automatisch neu.

**Langsame Antworten:** LLM-API-Rate-Limits prüfen. Anfrage-Queuing im Agenten einbauen oder Model Prism nutzen, um Anfragen auf mehrere Provider-Keys zu verteilen.

Ein gut konfigurierter VPS ist eine zuverlässige, kostengünstige Grundlage für KI-Agenten. Nach dem initialen Setup hält sich der Wartungsaufwand in Grenzen — hauptsächlich System-Updates und Health-Check-Monitoring.
