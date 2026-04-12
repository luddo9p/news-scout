# Agent Scout

Agent de veille tech automatisé qui surveille l'IA et le vibe coding. Récupère les contenus de 4 sources, les synthétise via Ollama Cloud (GLM-5.1), et envoie un résumé HTML par email. Programmé via cron (9h et 17h heure de Paris).

## Architecture

```
Cron (9h/17h Paris)
  → fetch parallèle (Bluesky, Hacker News, Reddit, X/Twitter)
  → synthèse Ollama Cloud via Express bridge (GLM-5.1, HTML structuré)
  → envoi email via Resend
```

## Sources

| Source      | API                                     | Auth                                                  |
| ----------- | --------------------------------------- | ----------------------------------------------------- |
| Bluesky     | AT Protocol `app.bsky.feed.searchPosts` | Optionnel (`BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD`) |
| Hacker News | Algolia                                 | Aucune                                                |
| Reddit      | Reddit search API                       | Aucune                                                |
| X/Twitter   | Apify `apidojo~tweet-scraper`           | `APIFY_API_KEY`                                       |

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
npm start             # Lancer le pipeline complet
npm run build         # Compilation TypeScript
npm test              # Vitest
npm run test:watch    # Vitest en watch mode
```

## Variables d'environnement

| Variable               | Requise | Description                                         |
| ---------------------- | ------- | --------------------------------------------------- |
| `VPS_URL`              | ✅      | URL du bridge Express (ex: `http://localhost:3001`) |
| `API_KEY`              | ✅      | Clé d'authentification du bridge                    |
| `OLLAMA_API_KEY`       | ✅      | Clé Ollama Cloud                                    |
| `RESEND_API_KEY`       | ✅      | Clé API Resend                                      |
| `RESEND_TO`            | ✅      | Email destinataire                                  |
| `RESEND_FROM`          | ❌      | Expéditeur (défaut : `onboarding@resend.dev`)       |
| `BLUESKY_HANDLE`       | ❌      | Handle Bluesky pour rate limiting                   |
| `BLUESKY_APP_PASSWORD` | ❌      | Mot de passe app Bluesky                            |
| `APIFY_API_KEY`        | ❌      | Pour X/Twitter via Apify                            |

## Cron

Ajouter au crontab du serveur pour une exécution à 9h et 17h Paris :

```
0 7,15 * * * cd /opt/agent-scout && npm start >> /var/log/agent-scout.log 2>&1
```

## Licence

MIT
