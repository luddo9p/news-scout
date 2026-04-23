# Design: Synthèse JSON + Template Déterministe

**Date:** 2026-04-17
**Status:** Draft

## Problème

Actuellement, l'IA (GLM-5.1 via Ollama) génère directement le HTML de l'email, incluant styles inline et structure. Le design varie entre les exécutions car le modèle peut interpréter les instructions différemment. Les `systemPrompt` des agents sont lourds — ils décrivent à la fois le contenu ET le formatage HTML.

## Solution

Séparer données et présentation : l'IA retourne du JSON structuré, un template TypeScript le rend en HTML déterministe.

## Flux de données

```
AVANT:
  sources → buildPrompt() → Ollama("génère HTML") → htmlContent (string) → buildEmailHtml() → email

APRÈS:
  sources → buildPrompt() → Ollama("génère JSON") → Zod parse → renderSections(data) → buildEmailHtml() → email
                                              ↓ échec validation
                                         retry 1× → si toujours invalide → skip email (throw)
```

## Schéma JSON (Zod)

Deux types d'items via discriminated union sur `Section.type` :

### Item Standard

Pour les sections "À lire absolument", "Nouveaux Outils", "Activations Digitales", "Outils & Innovations".

```ts
const StandardItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  context: z.string(),
  author: z.string().optional(),
  source: z.string(),
  score: z.number().optional(),
  tags: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
});
```

### Item Tendance

Pour les sections "Tendances" — citations multiples au lieu d'une seule URL.

```ts
const TrendItemSchema = z.object({
  title: z.string(),
  context: z.string(),
  citations: z.array(z.object({
    text: z.string(),
    source: z.string(),
    url: z.string().url(),
  })),
});
```

### Section et Racine

```ts
const SectionSchema = z.object({
  title: z.string(),
  type: z.enum(["standard", "trend"]),
  items: z.array(z.union([StandardItemSchema, TrendItemSchema])),
});

const SynthesisSchema = z.object({
  sections: z.array(SectionSchema),
});
```

Les items d'une section `type: "trend"` doivent respecter `TrendItemSchema`, ceux d'une section `type: "standard"` doivent respecter `StandardItemSchema`. Cette contrainte est vérifiée par un `refine` sur `SectionSchema` :

```ts
const SectionSchema = z.object({
  title: z.string(),
  type: z.enum(["standard", "trend"]),
  items: z.array(z.union([StandardItemSchema, TrendItemSchema])),
}).refine((section) => {
  if (section.type === "standard") {
    return section.items.every((item) => StandardItemSchema.safeParse(item).success);
  }
  return section.items.every((item) => TrendItemSchema.safeParse(item).success);
}, { message: "Items must match section type" });
```

### Types TypeScript dérivés

```ts
type SynthesisData = z.infer<typeof SynthesisSchema>;
type Section = z.infer<typeof SectionSchema>;
type StandardItem = z.infer<typeof StandardItemSchema>;
type TrendItem = z.infer<typeof TrendItemSchema>;
```

## Template Rendering

Nouveau fichier `src/shared/render.ts` avec une fonction `renderSections(data: SynthesisData): string`.

### Rendu Standard

```html
<h2 style="...">{title}</h2>
<ul style="...">
  <li style="...">
    <a href="{url}" style="...">{title}</a>
    <span style="..."> — {context}</span>
    <em style="...">({author}, {source}, {score} points)</em>
    <!-- tags: texte simple après le contexte -->
    <span style="..."> · {tag1} · {tag2}</span>
    <!-- highlights: sous-liste -->
    <ul style="...">
      <li>{highlight1}</li>
      <li>{highlight2}</li>
    </ul>
  </li>
</ul>
```

### Rendu Trend

```html
<h2 style="...">{title}</h2>
<ul style="...">
  <li style="...">
    <strong>{title}</strong>
    <span style="..."> — {context}</span>
    <div style="...">
      <em style="...">({citation.source})</em> <a href="{citation.url}" style="...">{citation.text}</a>
    </div>
  </li>
</ul>
```

Tous les styles inline sont codés en dur dans `render.ts`. L'IA n'a aucun contrôle sur le design.

## Modifications de fichiers

| Fichier | Changement |
|---|---|
| `package.json` | Ajouter `zod` en dépendance |
| `src/shared/types.ts` | Ajouter interfaces `SynthesisData`, `Section`, `StandardItem`, `TrendItem` (ou ré-exporter depuis Zod) |
| `src/shared/synthesize.ts` | Retourne `SynthesisData` au lieu de `string`. Ajout Zod parse + retry 1×. Extraction du JSON depuis la réponse texte de l'IA (strip markdown fences si présentes). |
| `src/shared/render.ts` | **Nouveau fichier** — `renderSections(data: SynthesisData): string` |
| `src/shared/send-email.ts` | `buildEmailHtml()` prend `SynthesisData` au lieu de `string`, appelle `renderSections()` en interne |
| `src/agents/tech-ai.ts` | `systemPrompt` réécrit — décrit le schéma JSON, pas le HTML |
| `src/agents/luxe-digital.ts` | Idem |
| `src/shared/run-agent.ts` | Ajusté pour le nouveau type de retour de `synthesize()` |
| Tests existants | Mise à jour des mocks pour refléter le nouveau format |

## System Prompt (exemple tech-ai)

Le prompt demande du JSON structuré, pas du HTML. Il inclut le schéma et un exemple. Exemple simplifié :

```
Tu es Agent Scout. Tu synthétises les contenus en JSON structuré.

Règles :
- Rédige en français. Traduis les titres anglais.
- N'invente aucun lien. Utilise uniquement les URLs fournies.
- Fusionne les doublons.
- Utilise les scores pour prioriser.

Retourne UNIQUEMENT du JSON valide (pas de markdown, pas de texte avant/après).

Schéma :
{
  "sections": [
    {
      "title": "string",
      "type": "standard" | "trend",
      "items": [...]
    }
  ]
}

Section type "standard" — items: { title, url, context, author?, source, score?, tags?[], highlights?[] }
Section type "trend" — items: { title, context, citations: [{ text, source, url }] }

3 sections obligatoires :
1. "À lire absolument" (standard) — 3-5 items les plus importants
2. "Nouveaux Outils" (standard) — outils, projets, librairies
3. "Tendances" (trend) — tendances avec citations des sources

Si une section est vide, items: [].
```

## Extraction JSON depuis la réponse Ollama

Le modèle peut entourer le JSON de markdown fences (```json ... ```) ou ajouter du texte avant/après. `synthesize.ts` extrait le JSON :

```ts
function extractJson(raw: string): string {
  // Strip markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Sinon, tente de parser la réponse entière
  return raw.trim();
}
```

## Retry Logic

```ts
function parseSynthesis(raw: string): { data: SynthesisData } | { error: string } {
  const extracted = extractJson(raw);
  let json: unknown;
  try {
    json = JSON.parse(extracted);
  } catch (e) {
    return { error: `JSON parse error: ${(e as Error).message}` };
  }
  const parsed = SynthesisSchema.safeParse(json);
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.message };
}

async function synthesize(sources, vpsUrl, systemPrompt, apiKey?): Promise<SynthesisData> {
  // Premier appel
  const raw = await callOllama(buildPrompt(sources), systemPrompt, apiKey);
  const first = parseSynthesis(raw);
  if ("data" in first) return first.data;

  // Retry avec feedback sur l'erreur
  const retryUserPrompt = `Ton JSON précédent était invalide. Erreur : ${first.error}. Retourne UNIQUEMENT du JSON valide respectant le schéma.`;
  const retryRaw = await callOllama(retryUserPrompt, systemPrompt, apiKey);
  const retry = parseSynthesis(retryRaw);
  if ("data" in retry) return retry.data;

  throw new Error(`Synthesis JSON invalid after retry: ${retry.error}`);
}
```

La fonction `parseSynthesis` gère à la fois les erreurs de parsing JSON et les erreurs de validation Zod, évitant tout throw non catché dans la logique de retry.

## Tags dans l'email

Les tags sont affichés en texte simple séparés par des points médians (·), placés après le contexte de l'item. Pas de pills ni badges.

## Gestion des sections vides

Si `items: []`, le template affiche « Rien de notable cette fois-ci » dans un `<p>` stylé, cohérent avec le comportement actuel.

## Ce qui ne change pas

- Le pipeline `runAgent()` (fetch parallèle, Promise.allSettled, skip si 0 items)
- L'envoi via Resend
- Le template externe de `buildEmailHtml()` (header, footer, date)
- Les modules de fetch (sources)