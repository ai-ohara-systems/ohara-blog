---
title: "Accidentally Committed Credentials? A Step-by-Step Recovery Guide"
description: "A practical, step-by-step guide to recovering from accidentally committed secrets — revocation, git history cleanup, and prevention strategies."
date: "2026-03-24"
tag: "security"
tagColor: "#e879f9"
readTime: "7 min read"
lang: "en"
---

## It Happens to Everyone

You push a commit. Thirty seconds later, your stomach drops — the `.env` file went with it. Or worse, you hardcoded an API key "temporarily" three commits ago and just noticed it on GitHub.

This is not a rare mistake. GitHub reports that over 10 million secrets were detected in public repositories in 2024 alone. And with AI coding agents becoming part of daily workflows, the risk increases — agents generate code fast, and they do not always know which strings are sensitive.

Here is the recovery playbook. Follow every step, in order.

## Step 1: Revoke Immediately

**Do this first.** Not after you clean the git history. Not after lunch. Right now.

A committed secret should be considered compromised the moment it was pushed to any remote — even a private repo. Automated scanners crawl GitHub constantly, and some can extract credentials within seconds of a push.

### Common Services — Where to Revoke

**AWS:**
```bash
# List your access keys
aws iam list-access-keys --user-name your-username

# Deactivate the compromised key
aws iam update-access-key --access-key-id AKIAIOSFODNN7EXAMPLE --status Inactive

# Create a new key, then delete the old one
aws iam create-access-key --user-name your-username
aws iam delete-access-key --access-key-id AKIAIOSFODNN7EXAMPLE
```

**GitHub Personal Access Tokens:** Settings → Developer Settings → Personal Access Tokens → Revoke the token.

**Stripe:** Dashboard → Developers → API Keys → Roll the key (this generates a new one and invalidates the old one).

**Database credentials:** Change the password directly on the database server, then update your application configuration.

**OpenAI / Anthropic API keys:** Go to the provider dashboard, delete the compromised key, generate a new one.

The pattern is always the same: **generate new credentials first**, update your application to use them, then delete the old ones. This minimizes downtime.

## Step 2: Remove from Current Files

Before touching git history, make sure the secret is not in your current working tree.

```bash
# Search for potential secrets in your codebase
grep -rn "AKIA\|sk-\|ghp_\|password\s*=" --include="*.{js,ts,py,yaml,yml,json,env}" .

# Move secrets to environment variables
# Before (bad):
# const apiKey = "sk-proj-abc123...";

# After (good):
# const apiKey = process.env.OPENAI_API_KEY;
```

Update your `.gitignore` to prevent re-committing:

```gitignore
# Environment files
.env
.env.*
!.env.example

# Common credential files
credentials.json
service-account-key.json
*.pem
*.key
```

## Step 3: Clean Git History

Removing the file from the current commit is not enough. The secret still exists in previous commits, and anyone with access to the repo can find it.

### Option A: Orphan Branch Reset (Simple, Destructive)

If the repo is small, the team is small, and you do not care about preserving full history:

```bash
# Create a clean orphan branch
git checkout --orphan clean-main

# Add all current (clean) files
git add -A
git commit -m "Clean repository history — credential removal"

# Replace main
git branch -D main
git branch -m main

# Force push (coordinate with your team first)
git push origin main --force
```

**Warning:** This destroys all commit history. Every team member must re-clone.

### Option B: BFG Repo Cleaner (Surgical)

BFG is faster and simpler than `git filter-branch` for removing specific strings or files:

```bash
# Install BFG
# macOS: brew install bfg
# Linux: download from https://rtyley.github.io/bfg-repo-cleaner/

# Create a file listing the secrets to remove
echo "sk-proj-abc123xyz" >> secrets-to-remove.txt
echo "AKIAIOSFODNN7EXAMPLE" >> secrets-to-remove.txt

# Run BFG (operates on a bare clone)
git clone --mirror git@github.com:ohara-systems/your-repo.git
cd your-repo.git

bfg --replace-text ../secrets-to-remove.txt

# Clean up and push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

BFG preserves your commit history but replaces the secret strings with `***REMOVED***` in all previous commits.

### Option C: git filter-repo (Modern Alternative)

```bash
# Install: pip install git-filter-repo

# Remove a specific file from all history
git filter-repo --path .env --invert-paths

# Or replace specific strings
git filter-repo --replace-text replacements.txt
```

After any history rewrite, all team members need to re-clone or carefully rebase their local branches.

## Step 4: Build Your Prevention Stack

Recovery is painful. Prevention is cheap. Layer these defenses:

### Layer 1: .gitignore

The first line of defense. Maintain a comprehensive `.gitignore` that covers all credential file patterns for your stack. Use [gitignore.io](https://gitignore.io) as a starting point.

### Layer 2: Environment Variables

Never hardcode secrets. Use environment variables loaded from `.env` files (via dotenv) in development and from your platform's secret management in production.

```bash
# .env.example (committed — shows structure without values)
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
```

### Layer 3: Secret Managers

For production, use a dedicated secret manager:

- **AWS Secrets Manager** or **SSM Parameter Store**
- **HashiCorp Vault**
- **1Password CLI** (for smaller teams)
- **Doppler** or **Infisical** (developer-friendly SaaS options)

### Layer 4: Pre-Commit Hooks

Catch secrets before they enter the repository:

```bash
# Install detect-secrets
pip install detect-secrets

# Initialize baseline
detect-secrets scan > .secrets.baseline

# Add pre-commit hook (.pre-commit-config.yaml)
```

```yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

### Layer 5: CI/CD Scanning

Add secret scanning to your pipeline as a safety net:

```yaml
# GitHub Actions example
- name: Scan for secrets
  uses: trufflesecurity/trufflehog@main
  with:
    extra_args: --only-verified
```

## A Note on AI Agents and Secrets

AI coding agents deserve special attention here. When an agent generates code, it might:

- Inline an API key from your environment into a source file
- Create a configuration file that includes credentials from your shell history
- Commit files that you would normally `.gitignore`

If you are using agents in your workflow, add explicit instructions to your agent configuration that prohibit hardcoding secrets. Some agent frameworks support allow/deny lists for file operations — use them. And always review agent-generated commits before pushing.

## The 5-Minute Checklist

When it happens (and it will), work through this:

1. **Revoke** the compromised credential (2 minutes)
2. **Generate** a new credential and update your app (2 minutes)
3. **Remove** the secret from current files (1 minute)
4. **Clean** git history with BFG or filter-repo (10 minutes)
5. **Force push** after coordinating with your team (1 minute)
6. **Add** prevention layers you were missing (30 minutes, one-time)

The total cost of a well-handled credential leak is about 45 minutes of work. The cost of a poorly handled one — where the secret stays live in git history for weeks — can be catastrophic.

Act fast. Then build the prevention stack so you do not have to act fast again.
