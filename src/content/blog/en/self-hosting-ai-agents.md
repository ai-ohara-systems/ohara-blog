---
title: "Self-Hosting AI Agents on a VPS — Complete Setup Guide"
description: "A practical guide to deploying AI agents on a VPS with Node.js, nginx, SSL, firewall configuration, and channel integrations."
date: "2026-02-24"
tag: "infrastructure"
tagColor: "#38bdf8"
readTime: "7 min read"
lang: "en"
---

## Why Self-Host?

Cloud-hosted agent platforms are convenient, but they come with constraints: vendor lock-in, limited customization, usage-based pricing that scales unpredictably, and data leaving your infrastructure. Self-hosting on a VPS gives you full control over your agent runtime, data residency, and cost structure.

A basic VPS ($10-20/month) can comfortably run multiple AI agent instances, a reverse proxy, and monitoring — all you need for a production-grade setup.

## Prerequisites

- **A VPS** running Ubuntu 22.04 or 24.04 (Hetzner, DigitalOcean, Linode — any provider works)
- **A domain name** pointed at your VPS IP (for SSL)
- **SSH access** with key-based authentication (disable password auth)
- **API keys** for your LLM providers (OpenAI, Anthropic, etc.)

## Step 1: Base System Setup

SSH into your server and update everything:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### Install Node.js 22 via nvm

Using nvm (Node Version Manager) makes it easy to switch Node versions and avoids the outdated versions in Ubuntu's default repositories:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Reload shell
source ~/.bashrc

# Install and use Node.js 22
nvm install 22
nvm alias default 22

# Verify
node --version  # v22.x.x
npm --version   # 10.x.x
```

## Step 2: Install Your Agent

Clone and set up your agent application. This example uses a generic structure — adapt the paths to your specific agent:

```bash
# Create a dedicated directory
sudo mkdir -p /opt/agents
sudo chown $USER:$USER /opt/agents

# Clone your agent repository
git clone https://github.com/ai-ohara-systems/your-agent.git /opt/agents/main

cd /opt/agents/main
npm install

# Create the environment file
cp .env.example .env
```

Edit the `.env` file with your actual credentials:

```bash
# /opt/agents/main/.env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AGENT_PORT=8080
NODE_ENV=production
LOG_LEVEL=info
```

## Step 3: Create a systemd Service

Running the agent as a systemd service ensures it starts on boot and restarts on crashes:

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

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/agents/main

[Install]
WantedBy=multi-user.target
```

```bash
# Create a dedicated system user
sudo useradd -r -s /usr/sbin/nologin agent
sudo chown -R agent:agent /opt/agents

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable ai-agent
sudo systemctl start ai-agent

# Check status
sudo systemctl status ai-agent
```

## Step 4: Firewall with ufw

Lock down your server to only the ports you need:

```bash
# Enable ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (critical — do this before enabling)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable the firewall
sudo ufw enable

# Verify
sudo ufw status verbose
```

**Do not expose port 8080** (or whatever port your agent runs on) directly. All traffic goes through nginx.

## Step 5: Nginx Reverse Proxy with SSL

### Install nginx

```bash
sudo apt install -y nginx
```

### Configure the reverse proxy

```nginx
# /etc/nginx/sites-available/agent
server {
    listen 80;
    server_name agent.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-running agent requests
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/agent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Add SSL with Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install certificate
sudo certbot --nginx -d agent.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

Certbot modifies your nginx config automatically to handle HTTPS and redirect HTTP traffic.

## Step 6: Health Checks

Add a health check endpoint to your agent application and monitor it:

```bash
# Simple health check script — /opt/agents/healthcheck.sh
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health)

if [ "$RESPONSE" != "200" ]; then
  echo "$(date): Health check failed with status $RESPONSE" >> /var/log/agent-health.log
  systemctl restart ai-agent
fi
```

```bash
# Add to crontab — run every 5 minutes
chmod +x /opt/agents/healthcheck.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/agents/healthcheck.sh") | crontab -
```

For more robust monitoring, consider setting up a lightweight solution like [Uptime Kuma](https://github.com/louislam/uptime-kuma) alongside your agent.

## Step 7: Connecting Channels

### Telegram

```bash
# 1. Create a bot via @BotFather on Telegram
# 2. Add the bot token to your .env
echo "TELEGRAM_BOT_TOKEN=123456:ABC-DEF..." >> /opt/agents/main/.env

# 3. Set the webhook to your domain
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://agent.yourdomain.com/webhook/telegram"
```

### Discord

```bash
# 1. Create an application at https://discord.com/developers/applications
# 2. Add a bot and copy the token
echo "DISCORD_BOT_TOKEN=MTIz..." >> /opt/agents/main/.env

# 3. Invite the bot to your server using the OAuth2 URL generator
# Required permissions: Send Messages, Read Message History, Embed Links
```

After adding new environment variables, restart the service:

```bash
sudo systemctl restart ai-agent
```

## Security Best Practices

**Keep the system updated.** Enable unattended security updates:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Use SSH keys only.** Disable password authentication in `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PubkeyAuthentication yes
```

**Rate limit your endpoints.** Add rate limiting in nginx to prevent abuse:

```nginx
# In the http block of /etc/nginx/nginx.conf
limit_req_zone $binary_remote_addr zone=agent:10m rate=10r/s;

# In your server block
location / {
    limit_req zone=agent burst=20 nodelay;
    proxy_pass http://127.0.0.1:8080;
    # ... rest of proxy config
}
```

**Rotate API keys regularly.** Set a calendar reminder. When you rotate, update `.env` and restart the service.

**Back up your configuration.** Your agent configs, `.env` files (encrypted), and nginx configs should be backed up. A simple rsync to a separate location works.

## Troubleshooting

**Agent won't start:** Check logs with `journalctl -u ai-agent -f`. Common issues: missing environment variables, port already in use, permission errors.

**502 Bad Gateway from nginx:** The agent is not running or not listening on the expected port. Verify with `curl http://127.0.0.1:8080/health`.

**SSL certificate not renewing:** Check that Certbot's timer is active: `systemctl status certbot.timer`. Run `sudo certbot renew --dry-run` to diagnose.

**High memory usage:** Node.js agents can leak memory on long-running sessions. Set a memory limit in systemd: `MemoryMax=512M` in the `[Service]` section. The service will restart automatically when the limit is hit.

**Slow responses:** Check if you are hitting LLM API rate limits. Add request queuing in your agent or use Model Prism to distribute requests across multiple provider keys.

A well-configured VPS is a reliable, cost-effective foundation for running AI agents. Once the initial setup is done, maintenance is minimal — mostly keeping the system updated and monitoring health checks.
