# Comment fonctionne Agent Scout — Guide d'architecture

Ce document explique comment l'application est construite, de la maniere la plus simple possible. Pas de jargon inutile, on part de zero.

---

## L'idee de base

Agent Scout est un **robot qui lit des articles sur internet, les resume, et t'envoie le resume par email**. C'est tout.

Imagine : tous les matins a 9h30, quelqu'un parcourt Reddit, Bluesky, des flux RSS... il lit les derniers posts sur l'IA, prend des notes, et t'envoie un recap par email. C'est exactement ce que fait Agent Scout, sauf que "quelqu'un" c'est un programme.

---

## Les 4 etapes du robot

Chaque fois qu'Agent Scout tourne, il fait exactement ca, dans cet ordre :

```
1. CHERCHER    → Aller chercher des articles sur plusieurs sites
2. VERIFIER    → Si il a rien trouve, il s'arrete (pas la peine d'envoyer un email vide)
3. RESUMER     → Envoyer les articles a une IA qui ecrit un resume en HTML
4. ENVOYER     → Mettre le resume dans un joli email et l'envoyer
```

C'est le coeur de l'appli. Tout le reste existe pour rendre ces 4 etapes possibles.

---

## Comment les 4 etapes marchent en detail

### Etape 1 : Chercher (les "sources")

Agent Scout va chercher des articles sur differents sites. Chaque site = un "module source".

| Source | Ce qu'il fait | Comment |
|---|---|---|
| **Bluesky** | Cherche des posts par hashtags (#IA, #vibecoding) | API officielle d'AT Protocol |
| **Hacker News** | Cherche des stories populaires sur l'IA | API de recherche Algolia |
| **Reddit** | Cherche dans des subreddits (MachineLearning, etc.) | API publique de Reddit |
| **RSS** | Lit des flux RSS (Luxury Daily, etc.) | Telecharge le fichier XML et le parse |
| **Twitter** | Cherche des tweets par hashtags | Apify (service tiers payant) |

**Point important :** Toutes les sources sont lancees en meme temps (en parallele). Si l'une echoue, les autres continuent. C'est `Promise.allSettled` en JavaScript — "lance tout, on verra apres qui a reussi".

Chaque source retourne la meme chose : une liste d'articles avec un titre, un lien, un resume, et parfois un auteur ou un score.

### Etape 2 : Verifier

Simple : on compte le nombre total d'articles trouves. Si c'est zero, on arrete tout. Pas d'email vide.

### Etape 3 : Resumer (la synthese IA)

On prend tous les articles trouves et on les envoie a une IA (Ollama, modele GLM-5.1) qui tourne sur un serveur distant.

On lui donne deux choses :
- **Le prompt systeme** : "Tu es Agent Scout, tu fais des resumes en HTML, en francais, avec 3 sections..."
- **Les articles** : La liste brute des articles trouves

L'IA genere du HTML (pas du markdown, du vrai HTML avec des balises) qu'on pourra inserer directement dans l'email.

**Pourquoi un serveur distant ?** L'IA est trop lourde pour tourner sur un petit serveur. On utilise Ollama Cloud, qui heberge le modele. Notre serveur VPS fait juste le pont entre notre code et Ollama.

### Etape 4 : Envoyer (l'email)

On prend le HTML genere par l'IA, on l'enrobe dans un template d'email (avec un titre, la date, un footer), et on l'envoie via Resend (un service d'envoi d'emails par API).

L'email a un style "iOS" : fond blanc, texte noir, coins arrondis. Tout est en styles inline (pas de CSS classes) parce que les clients email (Gmail, Outlook) ne lisent pas bien le CSS externe.

---

## Le systeme multi-agent

### Le probleme

Au debut, Agent Scout ne faisait qu'une chose : surveiller l'IA et la tech. Mais on voulait aussi surveiller le marketing digital luxe. Deux sujets differents = deux prompts differents, deux listes de sources differentes, deux branding differents.

### La solution

Au lieu de dupliquer tout le code, on a separe **ce qui change** de **ce qui ne change pas**.

**Ce qui ne change pas** (dossier `src/shared/`) :
- La logique pour envoyer un email
- La logique pour appeler l'IA
- La logique pour executer le pipeline (chercher → verifier → resumer → envoyer)
- Les types de donnees

**Ce qui change** (dossier `src/agents/`) :
- Quelles sources consulter
- Quel prompt systeme donner a l'IA
- Quel titre/sujet mettre dans l'email

Chaque agent est juste un **fichier de configuration** qui dit "voici mes sources, mon prompt, mon branding". Le code d'execution est partage.

### L'analogie

Imagine une boulangerie qui fait different types de pains. Le four, le boulanger, la farine — c'est partage. Ce qui change c'est la recette :

- **Pain de campagne** : farine T110, levain, cuisson 40min
- **Baguette** : farine T55, levure, cuisson 25min

Nos agents, c'est pareil :

- **tech-ai** : Bluesky + Hacker News + Reddit + Twitter, prompt "veille IA/tech"
- **luxe-digital** : RSS + Reddit, prompt "marketing digital luxe"

---

## L'architecture en fichiers

```
agent-scout/
│
├── src/
│   ├── index.ts              ← Point d'entree. Choisis quel agent lancer.
│   │
│   ├── agents/               ← Les "recettes" (ce qui change par agent)
│   │   ├── tech-ai.ts        → Sources IA/tech + prompt IA/tech + branding "Agent Scout"
│   │   └── luxe-digital.ts   → Sources luxe + prompt luxe + branding "Luxe Digital Scout"
│   │
│   ├── shared/               ← Le "four" (code partage entre tous les agents)
│   │   ├── run-agent.ts      → Le pipeline : chercher → verifier → resumer → envoyer
│   │   ├── synthesize.ts     → Appeler l'IA avec les articles et le prompt
│   │   ├── send-email.ts     → Construire l'email HTML et l'envoyer via Resend
│   │   ├── date-filter.ts    → Calculer "il y a 24h" pour filtrer les articles
│   │   └── types.ts          → Les formes de donnees (TypeScript)
│   │
│   └── sources/              ← Les "fournisseurs" (un module par site web)
│       ├── fetch-bluesky.ts
│       ├── fetch-hackernews.ts
│       ├── fetch-reddit.ts
│       ├── fetch-rss.ts
│       └── fetch-twitter.ts
│
├── server/                   ← Le serveur VPS (Docker)
│   └── index.js              → Pont entre notre code et l'IA Ollama
│
└── tests/                    ← Les tests (meme structure que src/)
    ├── agents/
    ├── shared/
    └── sources/
```

---

## Le flux de donnees complet

Voici exactement ce qui se passe quand tu lances `npm run start:luxe` :

```
1. index.ts lit "--agent=luxe-digital"
   → Il charge la config de luxe-digital.ts

2. run-agent.ts prend cette config
   → Il execute les fonctions de sources en parallele

3. Chaque source va sur internet :
   fetch-rss  → telecharge les flux RSS de Luxury Daily et Luxury Roundtable
   fetch-reddit → cherche dans r/marketing, r/luxury, r/augmentedReality...
   → Chacune retourne une liste d'articles

4. run-agent.ts verifie : au moins 1 article ? Oui → on continue

5. synthesize.ts prend les articles + le prompt luxe-digital
   → Il envoie tout a l'IA Ollama (via le serveur VPS)
   → L'IA retourne du HTML

6. send-email.ts prend le HTML
   → Il l'enrobe dans le template "Luxe Digital Scout"
   → Il envoie l'email via Resend

7. Tu recois l'email dans ta boite
```

---

## Le serveur VPS et Docker

### Le probleme

L'IA (Ollama) ne peut pas tourner sur ton ordinateur portable — c'est trop lourd. Et on ne veut pas exposer Ollama directement sur internet (securite).

### La solution

Un petit serveur (VPS) sur Hetzner fait le pont :

```
Ton ordi ──── HTTP ────> VPS (Express API bridge) ──── HTTP ────> Ollama Cloud
                           port 3001, avec API key       glm-5.1:cloud
```

Le VPS a deux conteneurs Docker :
- **api-bridge** : serveur Express qui recoit les requetes, verifie la cle API, et les transmet a Ollama
- **ollama** : le modele d'IA (en pratique on utilise Ollama Cloud, pas le conteneur local)

### Securite

- Le VPS n'accepte les requetes que si elles ont la bonne cle API (`x-api-key`)
- L'API bridge tourne sur le port 3001
- Ollama est sur un reseau Docker interne (pas accessible depuis internet)

---

## Les types de donnees (TypeScript)

TypeScript permet de definir les "formes" des donnees. C'est comme un contrat : si une fonction dit "je retourne un SourceResult", TypeScript verifie que c'est vrai.

### ContentItem — Un article

```typescript
{
  title: "Dior lance un filtre AR",
  url: "https://luxurydaily.com/dior-ar",
  summary: "Dior collabore avec Snap pour un essayage virtuel",
  source: "Luxury Daily",        // d'ou vient l'article
  author: "Jane Doe",            // optionnel
  date: "2026-04-17T09:00:00Z", // optionnel
  score: 342                     // optionnel (points HN, likes Reddit...)
}
```

### SourceResult — Le resultat d'une source

```typescript
{
  source: "Reddit",              // nom de la source
  items: [ContentItem, ...],    // les articles trouves
  error: "Rate limited"         // optionnel, si la source a echoue
}
```

### AgentConfig — La config d'un agent

```typescript
{
  name: "luxe-digital",
  sources: [fonction, fonction],       // les sources a appeler
  systemPrompt: "Tu es Luxe Digital...", // le prompt pour l'IA
  emailBranding: {
    title: "Luxe Digital Scout",         // titre dans l'email
    subjectPrefix: "Luxe Digital",       // prefixe du sujet
    footerSources: "Luxury Daily · Reddit" // texte du footer
  }
}
```

---

## Comment ajouter un 3e agent

1. Creer `src/agents/mon-agent.ts` avec une `AgentConfig`
2. L'ajouter dans le dictionnaire `AGENTS` de `src/index.ts`
3. Ajouter un script dans `package.json` : `"start:mon-agent": "tsx --env-file=.env src/index.ts --agent=mon-agent"`

C'est tout. Pas besoin de toucher au code partage.

---

## Les tests

Les tests sont dans `tests/` et suivent la meme structure que `src/`.

**Comment on teste :** On "moque" (mock) les appels reseau. Au lieu de vraiment appeler l'API Reddit, on simule sa reponse avec `vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(...))`. Comme ca les tests sont rapides, deterministes, et ne dependent pas d'internet.

**62 tests** couvrent :
- Chaque source (parsing, erreurs, deduplication)
- La synthese (appel API, timeouts, reponses vides)
- L'email (branding, format HTML, envoi)
- Les agents (config correcte)
- Le pipeline complet (cas nominaux et d'erreur)