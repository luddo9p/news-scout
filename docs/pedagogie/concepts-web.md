# Concepts web et API pour debutants

Ce document explique les concepts techniques utilises dans Agent Scout, pour quelqu'un qui debute en programmation web.

---

## API — Application Programming Interface

Une API est un **menu de restaurant** pour les programmes.

Quand tu vas au resto, tu ne vas pas en cuisine — tu regardes le menu et tu commandes. Une API, c'est pareil : ton programme demande une information a un autre programme, sans savoir comment il fonctionne a l'interieur.

**Exemples dans Agent Scout :**

| API | Ce qu'on demande | Ce qu'on reçoit |
|---|---|---|
| Reddit API | "Cherche 'AI' dans r/MachineLearning" | Une liste de posts (titre, URL, score) |
| Algolia HN API | "Cherche 'LLM' sur Hacker News" | Une liste de stories (titre, URL, points) |
| Resend API | "Envoie cet email a ludosaffroy@gmail.com" | Confirmation "email envoye" |
| Ollama API | "Resume ces articles en HTML" | Du HTML formatte |

### Comment on appelle une API

En JavaScript, on utilise `fetch()` — c'est comme ouvrir une page web, mais pour les programmes :

```javascript
const response = await fetch("https://www.reddit.com/r/AI/search.json?q=LLM");
const data = await response.json();
// data contient les posts trouves
```

---

## RSS — Really Simple Syndication

RSS est un **format standard pour partager des articles**. Beaucoup de sites publient un fichier RSS qui liste leurs derniers articles.

C'est comme un sommaire automatique du site, mis a jour en continu.

**Exemple** : `https://www.luxurydaily.com/rss/feed/marketing-advertising/` retourne un fichier XML :

```xml
<rss>
  <channel>
    <title>Luxury Daily</title>
    <item>
      <title>Dior lance un filtre AR</title>
      <link>https://luxurydaily.com/dior-ar</link>
      <description>Dior collabore avec Snap...</description>
      <pubDate>Mon, 17 Apr 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

Agent Scout telecharge ce fichier, le parse (lit la structure XML), et en extrait les articles.

**Avantage du RSS** : pas besoin de cle API, pas de rate limiting, c'est gratuit et standard.

---

## JSON — JavaScript Object Notation

JSON est un **format de texte pour structurer des donnees**. C'est le langage universel des APIs.

```json
{
  "title": "Dior lance un filtre AR",
  "url": "https://luxurydaily.com/dior-ar",
  "score": 342
}
```

**XML vs JSON :** RSS utilise XML (avec des balises `<title>`). Les APIs modernes utilisent JSON (avec des cles `"title"`). Les deux font la meme chose — structurer de l'information. JSON est juste plus leger et plus facile a lire en JavaScript.

---

## Promise.allSettled — Lancer des choses en parallele

En JavaScript, les operations reseau sont **asynchrones** — on lance la requete et on attend la reponse. Mais si on attend chaque source une par une, c'est lent.

```javascript
// SEQUENTIEL (lent) : 3s + 3s + 3s = 9s total
const reddit = await fetchReddit();     // attend 3s
const bluesky = await fetchBluesky();   // attend 3s
const rss = await fetchRss();           // attend 3s

// PARALLELE (rapide) : max(3s, 3s, 3s) = 3s total
const results = await Promise.allSettled([
  fetchReddit(),
  fetchBluesky(),
  fetchRss(),
]);
```

**Pourquoi `allSettled` et pas `all` ?**
- `Promise.all` : si UNE source echoue, TOUT echoue. Pas bon.
- `Promise.allSettled` : chaque source reussit ou echoue independamment. Si Reddit est en panne, on a quand meme les articles RSS.

---

## Variables d'environnement (.env)

Les mots de passe et cles API ne doivent **jamais** etre ecrits dans le code. On les met dans un fichier `.env` :

```
RESEND_API_KEY=re_xxxxx
APIFY_API_KEY=apify_api_xxxxx
VPS_URL=http://46.225.59.42:3001
```

Le code lit ces valeurs avec `process.env.RESEND_API_KEY`. Le fichier `.env` n'est jamais commit sur Git (il est dans `.gitignore`).

**Pourquoi ?** Si tu publies ton code sur GitHub, tout le monde pourrait voir tes cles. Et changer un mot de passe ne necessite pas de modifier le code.

---

## TypeScript — JavaScript avec des types

JavaScript est un langage ou tu peux faire n'importe quoi :

```javascript
// JavaScript : ca "marche" mais c'est un bug
function ajouter(a, b) { return a + b; }
ajouter("3", "5")  // retourne "35" (concatenation!) au lieu de 8
```

TypeScript ajoute des **types** qui attrapent ces bugs avant meme de lancer le code :

```typescript
function ajouter(a: number, b: number): number { return a + b; }
ajouter("3", "5")  // ERREUR TypeScript : "3" n'est pas un number
```

Dans Agent Scout, TypeScript verifie par exemple qu'une fonction qui dit retourner `SourceResult` retourne bien un objet avec `source`, `items`, et optionnellement `error`.

---

## Docker — Des conteneurs pour isoler les services

Docker est un **systeme d'emballage** pour les logiciels. Au lieu d'installer Ollama et l'API bridge directement sur le serveur, on les met chacun dans un conteneur.

C'est comme mettre chaque outil dans sa propre boite :
- Boite 1 : l'API bridge (Node.js)
- Boite 2 : Ollama (le modele IA)

Les boites sont isolees entre elles mais peuvent communiquer via un reseau Docker interne.

**Avantages :**
- Si l'API bridge plante, Ollama continue de tourner
- On peut mettre a jour l'un sans toucher l'autre
- Le meme conteneur marche sur n'importe quel serveur

---

## Cron — Executer des taches a heure fixe

Cron est le planificateur de taches de Linux. Il execute une commande a des moments precis.

```
30 9 * * * /opt/agent-scout/cron-run.sh
│  │  │ │ │
│  │  │ │ └── jour de la semaine (0-7, * = tous)
│  │  │ └──── mois (1-12, * = tous)
│  │  └────── jour du mois (1-31, * = tous)
│  └───────── heure (0-23)
└──────────── minute (0-59)
```

`30 9 * * *` = "tous les jours a 9h30".

Notre cron lance `cron-run.sh` qui execute les deux agents l'un apres l'autre.