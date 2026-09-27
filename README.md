# Agent Scout

Plateforme multi-agents de veille automatisée. Récupère les contenus de multiples sources, les synthétise via Ollama Cloud (DeepSeek V4.1 Flash), et envoie des résumés HTML par email via Resend.

## Agents

| Agent | Description | Fréquence |
|---|---|---|
| `tech-ai` | Veille IA, vibe coding, LLM | 2×/jour (9h, 17h) |
| `luxe-digital` | Luxe digital, AR, IA premium | 1×/semaine (lundi 10h) |
| `bourse-scout` | Portefeuille Pierre Schchang | 1×/jour (18h) |
| `higgons-scout` | Portefeuille William Higgons | 1×/jour (18h05) |
| `maugey-scout` | Portefeuille Stéphanie Maugey | 1×/jour (18h10) |
| `dunand-scout` | Portefeuille Léa Dunand-Chatellet | 1×/jour (18h15) |

## Architecture

```
Cron → cron-run.sh --agent <name>
  → Standard agents : fetch parallèle → synthèse Ollama Cloud → email
  → Bourse agents : scrape WordPress → diff vs état précédent → email si changements
```

## Installation

```bash
npm install
cp .env.example .env   # puis remplir les clés API
```

### Docker (Express bridge + Ollama Cloud)

```bash
docker compose up -d
```

Le bridge Express expose `POST /generate` sur le port 3001, proxy vers l'API Ollama Cloud.

## Développement

```bash
npm start                          # Lancer tech-ai (défaut)
npm start -- --agent luxe-digital # Lancer luxe-digital
npm start -- --agent bourse-scout # Lancer bourse-scout
npm run build                      # Compilation TypeScript
npm test                           # Vitest
npm run test:watch                 # Vitest en watch mode
```

## Variables d'environnement

| Variable | Requise | Description |
|---|---|---|
| `VPS_URL` | ✅ | URL du bridge Express |
| `API_KEY` | ✅ | Clé d'authentification du bridge |
| `RESEND_API_KEY` | ✅ | Clé API Resend |
| `RESEND_TO` | ✅ | Email destinataire |
| `RESEND_FROM` | ❌ | Expéditeur (défaut : `onboarding@resend.dev`) |
| `BLUESKY_HANDLE` | ❌ | Handle Bluesky pour rate limiting |
| `BLUESKY_APP_PASSWORD` | ❌ | Mot de passe app Bluesky |
| `APIFY_API_KEY` | ❌ | Pour X/Twitter via Apify |

La source Reddit est débranchée des agents : `oauth.reddit.com` renvoie 403 avec une page de challenge HTML depuis une IP de datacenter, même avec un jeton OAuth valide. Le module `fetch-reddit.ts` (OAuth2 `client_credentials`, variables `REDDIT_CLIENT_ID` et `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` optionnel) reste présent et testé : le rebrancher se fait en une ligne dans les configs d'agents.

## Cron (VPS)

Horaires en heure de Paris :

```crontab
0  9,17 * * * /opt/agent-scout/cron-run.sh --agent tech-ai
0  10    * * 1 /opt/agent-scout/cron-run.sh --agent luxe-digital
0  18    * * * /opt/agent-scout/cron-run.sh --agent bourse-scout
5  18    * * * /opt/agent-scout/cron-run.sh --agent higgons-scout
10 18    * * * /opt/agent-scout/cron-run.sh --agent maugey-scout
15 18    * * * /opt/agent-scout/cron-run.sh --agent dunand-scout
```

## Licence

MIT