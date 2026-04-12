# Agent Scout

Agent de veille tech automatisé qui surveille l'IA et le vibe coding. Exécution deux fois par jour via Netlify Scheduled Functions — récupère les contenus, les synthétise via Gemini, et envoie un résumé HTML par email.

## Architecture

```
Cron Netlify (9h/17h Paris)
  → fetch parallèle (Bluesky, Hacker News, X/Twitter)
  → synthèse Gemini (HTML structuré)
  → envoi email via Resend
```

## Sources

| Source      | API                                     | Auth                                                  |
| ----------- | --------------------------------------- | ----------------------------------------------------- |
| Bluesky     | AT Protocol `app.bsky.feed.searchPosts` | Optionnel (`BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD`) |
| Hacker News | Algolia                                 | Aucune                                                |
| X/Twitter   | Placeholder (Apify)                     | À configurer                                          |

## Installation

```bash
npm install
cp .env.example .env   # puis remplir les clés API
```

## Développement

```bash
npm run dev          # Netlify dev server
npm run build        # Compilation TypeScript
npm test             # Vitest
npm run test:watch   # Vitest en watch mode
```

## Variables d'environnement

| Variable               | Requise | Description                                   |
| ---------------------- | ------- | --------------------------------------------- |
| `GEMINI_API_KEY`       | ✅      | Clé API Google Gemini                         |
| `RESEND_API_KEY`       | ✅      | Clé API Resend                                |
| `RESEND_TO`            | ✅      | Email destinataire                            |
| `RESEND_FROM`          | ❌      | Expéditeur (défaut : `onboarding@resend.dev`) |
| `BLUESKY_HANDLE`       | ❌      | Handle Bluesky pour rate limiting             |
| `BLUESKY_APP_PASSWORD` | ❌      | Mot de passe app Bluesky                      |
| `APIFY_API_KEY`        | ❌      | Pour X/Twitter (futur)                        |

## Licence

MIT
