# Agent Scout — Design Spec

## Vue d'ensemble

Agent de veille tech automatisé qui surveille l'IA et le "vibe coding". Exécution deux fois par jour (9h et 17h, heure de Paris) via Netlify Scheduled Functions. Récupère les contenus de 3 sources, les synthétise via Groq (Llama 3), et envoie un résumé HTML par email via Resend.

## Architecture

**Approche monolithe** : une seule fonction Netlify `scout` contient toute la logique.

```
agent-scout/
├── netlify/
│   └── functions/
│       └── scout.ts          ← point d'entrée, orchestration complète
├── netlify.toml               ← config cron 9h/17h Paris
├── package.json
├── tsconfig.json
└── .env                       ← clés API (non versionné)
```

Flux d'exécution :

1. Le cron Netlify déclenche `scout`
2. Fetch des 3 sources en parallèle (`Promise.allSettled`)
3. Compilation des résultats en un prompt structuré
4. Appel Groq (Llama 3) pour synthèse HTML
5. Envoi email via Resend
6. Retour d'un résumé d'exécution (succès/échecs par source)

## Sources de données

### Bluesky

- **API** : AT Protocol public (`app.bsky.feed.searchPosts`)
- **Recherche** : hashtags `#vibecoding` et `#IA`
- **Limite** : 20 posts récents par hashtag
- **Auth** : Pas de clé obligatoire. `BLUESKY_HANDLE` optionnel pour rate limiting

### Hacker News

- **API** : Algolia (`hn.algolia.com/api/v1/search`)
- **Recherche** : queries `AI` et `LLM`
- **Limite** : 10 stories par query
- **Auth** : Aucune clé nécessaire

### X/Twitter (placeholder)

- **API** : Apify (à configurer)
- **Comportement** : Retourne un stub "Pas encore configuré" avec instruction de config
- **Structure** : Interface identique aux autres sources, facilement remplaçable

## Format email

Le LLM génère du **HTML stylisé** avec :

1. **À lire absolument** — Les 3-5 contenus les plus importants
2. **Nouveaux Outils** — Outils, projets, librairies mentionnés
3. **Tendances** — Tendances émergentes observées

Caractéristiques :

- Styles inline (compatible clients email)
- Liens cliquables vers les sources
- Header/badge "Agent Scout"
- Date et heure de génération

## Gestion des erreurs

- `Promise.allSettled` : si une source échoue, les autres continuent
- Timeout de 5s par source (4 sources × 5s + LLM + email < 26s)
- Si Groq échoue → log erreur, pas d'email envoyé (évite un email vide)
- Si Resend échoue → log erreur, retour 500
- Les sources en échec sont mentionnées dans l'email si au moins une source a réussi

## Variables d'environnement

```
GROQ_API_KEY=          ← clé API Groq
RESEND_API_KEY=        ← clé API Resend
RESEND_FROM=onboarding@resend.dev  ← expéditeur
RESEND_TO=             ← email destinataire unique
BLUESKY_HANDLE=        ← optionnel, pour rate limiting Bluesky
APIFY_API_KEY=         ← pour le futur X/Twitter
```

## Dépendances

- `@netlify/functions` — types Netlify Functions
- `groq-sdk` — client API Groq
- `resend` — client API Resend
- `typescript` — compilation TS

## Cron Netlify

Configuration dans `netlify.toml` :

```toml
[functions]
  directory = "netlify/functions"

[[cron]]
  schedule = "0 7 * * *"    # 9h Paris (UTC+2) = 7h UTC (heure d'été)
  function = "scout"

[[cron]]
  schedule = "0 15 * * *"   # 17h Paris (UTC+2) = 15h UTC (heure d'été)
  function = "scout"
```

Note : Netlify Scheduled Functions utilise UTC. Heure d'été Paris = UTC+2, heure d'hiver = UTC+1. Le cron ci-dessus est pour l'heure d'été. Pour un support complet toute l'année, il faudrait ajuster manuellement ou utiliser une solution plus flexible.
