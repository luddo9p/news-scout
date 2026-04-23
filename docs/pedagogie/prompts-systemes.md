# Prompts systemes — Comment on guide l'IA

Ce document explique comment les prompts systemes fonctionnent dans Agent Scout, et pourquoi chaque agent a le sien.

---

## C'est quoi un prompt systeme ?

Quand tu parles a une IA, tu peux lui donner deux types de messages :

1. **Le prompt systeme** : "Tu es un analyste de veille. Tu ecris en HTML. Tu fais 3 sections." — c'est le **role et les regles**. L'IA s'y tient pendant toute la conversation.

2. **Le prompt utilisateur** : "Voici les articles du jour : [liste]" — c'est le **contenu** a traiter.

C'est comme donner un brief a un journaliste : "Tu ecris pour Vogue, tu fais 3 sections, en francais" (systeme) + "Voici les infos" (utilisateur).

---

## Les regles communes aux deux agents

Les deux agents partagent ces regles dans leur prompt systeme :

| Regle | Pourquoi |
|---|---|
| HTML pur, pas de markdown | L'email ne lit pas le markdown, il faut du HTML |
| Pas de `<html>`, `<body>` | Le HTML est insere dans un template d'email deja existant |
| Ecrire en francais | L'email est pour un public francophone |
| Ne jamais inventer de liens | Si l'IA invente une URL, le lien sera mort dans l'email |
| Fusionner les doublons | Si Reddit et Bluesky parlent du meme sujet, un seul item |
| Styles inline uniquement | Gmail/Outlook ignorent les classes CSS |

---

## Les differences entre les deux agents

### tech-ai — Sections

1. **A lire absolument** — Les 3-5 articles les plus importants. Utilise les scores (points HN, likes) pour prioriser.
2. **Nouveaux Outils** — Outils, librairies, frameworks mentionnes.
3. **Tendances** — Patterns recurrences, avec sources citees.

### luxe-digital — Sections

1. **Activations Digitales** — Campagnes, experiences immersives (AR, VR, pop-ups digitaux) des marques luxe.
2. **Outils & Innovations** — Filtres AR, agents IA, plateformes marketing digital.
3. **Tendances** — Tendances du marketing digital luxe, retours sur campagnes.

---

## Comment le prompt est construit

### Dans le code

```
src/agents/tech-ai.ts
  → export const TECH_AI_CONFIG = {
      systemPrompt: "Tu es Agent Scout, un analyste...",
      ...
    }

src/shared/synthesize.ts
  → synthesize(sources, vpsUrl, config.systemPrompt, apiKey)
  → Le systemPrompt est envoye a l'API Ollama
```

### Ce que recoit l'IA

L'API Ollama recoit deux messages :

```json
{
  "messages": [
    { "role": "system", "content": "Tu es Agent Scout, un analyste..." },
    { "role": "user", "content": "Voici les contenus collectes aujourd'hui...\n\n## Source : Bluesky\n- **Post 1** (par auteur)\n  Lien : https://...\n  Resume : ..." }
  ]
}
```

Le message "system" donne les regles. Le message "user" donne les donnees.

---

## Pourquoi le systemPrompt est un parametre

Au debut, le prompt systeme etait ecrit en dur dans `synthesize.ts`. Ca marchait pour un agent. Mais avec deux agents, chaque IA doit avoir son propre role :

- L'IA du tech-ai : "Tu es Agent Scout, analyste techno"
- L'IA du luxe-digital : "Tu es Luxe Digital Scout, analyste luxe"

On a donc fait du `systemPrompt` un parametre de la fonction `synthesize()`. C'est l'agent qui choisit son prompt, pas le module de synthese.

---

## L'equilibre du prompt

Un bon prompt systeme doit etre :

- **Assez precis** pour que l'IA respecte le format (HTML, 3 sections, liens reels)
- **Assez ouvert** pour que l'IA puisse synthetiser intelligemment (choisir les tendances, fusionner les sujets)

Si le prompt est trop rigide, l'IA produit du copier-coller sans valeur ajoutee. Si il est trop vague, l'IA peut inventer des liens ou ignorer le format email.