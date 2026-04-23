# Methodes Git utilisees lors du refactor multi-agent

Ce document retrace les operations Git utilisees pendant la session de refactor d'agent-scout en monorepo multi-agent, avec le contexte et la raison de chaque choix.

---

## 1. Creer une branche de feature

```bash
git checkout -b feat/multi-agent-monorepo
```

**Pourquoi ?** On isole le travail de refactor dans une branche dediee. `main` reste stable et deployable pendant qu'on restructure tout le code. Si le refactor tourne mal, on peut abandonner la branche sans impact.

**Pattern :** `feat/` pour les nouvelles fonctionnalites, `fix/` pour les corrections, `refactor/` pour la restructuration.

---

## 2. Suivre l'evolution des commits

```bash
git log --oneline feat/multi-agent-monorepo --not main
```

**Pourquoi ?** Affiche uniquement les commits de la branche qui ne sont pas sur `main`. Permet de verifier que chaque etape du refactor a bien ete commit separement.

**Sans `--not main` :** on verrait tout l'historique du depot. Avec, on ne voit que le delta.

---

## 3. Commit atomiques par etape

Chaque etape du refactor a ete commit separement :

```bash
git commit -m "refactor: move types to shared/ with AgentConfig type"
git commit -m "refactor: move date-filter to shared/"
git commit -m "refactor: make synthesize.ts accept systemPrompt as parameter"
# ... etc
```

**Pourquoi ?** Un commit atomique fait une seule chose coherent. Si un commit casse quelque chose, on peut le revert sans perdre le reste. Ca facilite aussi le code review : chaque commit a un but clair.

**Convention de messages :** `type: description` ou type = `feat`, `fix`, `refactor`, `docs`, `chore`.

---

## 4. Stash pour les changements temporaires

```bash
git stash
# ... operation qui necessite un arbre propre (filter-branch) ...
git stash pop
```

**Pourquoi ?** `git filter-branch` refuse de tourner si il y a des changements non commit dans l'arbre. Le stash sauvegarde temporairement le travail en cours, puis le restaure apres.

**Quand utiliser :** Quand une operation Git demande un "clean working tree" mais tu as du travail en cours que tu ne veux pas encore commit.

---

## 5. Supprimer un secret de l'historique Git

```bash
git filter-branch --force --tree-filter '
  if [ -f CLAUDE.md ]; then
    sed -i "" "s/sk_live_xxxxx/REDACTED/g" CLAUDE.md
  fi
' -- 6ddfda5..HEAD
```

**Pourquoi ?** GitHub Push Protection bloque les push qui contiennent des secrets meme dans les commits anciens. Un simple `git rm` ou edit dans le fichier actuel ne suffit pas — le secret est encore dans l'historique.

**`filter-branch` vs `filter-repo` :** `filter-branch` est l'outil historique (disponible par defaut). `git-filter-repo` est plus moderne et rapide mais necessite une installation. Pour un cas simple comme remplacer une chaine, `filter-branch` suffit.

**Attention :** Cette operation reecrit l'historique. Les commits apres `6ddfda5` ont de nouveaux hashes. Si quelqu'un d'autre avait deja pull la branche, il devra `git reset --hard origin/feat/multi-agent-monorepo`.

---

## 6. Pousser une branche de feature

```bash
git push -u origin feat/multi-agent-monorepo
```

**Le `-u` :** Set upstream. Cree le lien entre la branche locale et la branche remote. Les prochains `git push` n'auront pas besoin de specifier la branche.

**Echec attendu :** Le premier push a echoue a cause du secret dans CLAUDE.md. Apres `filter-branch`, l'historique a ete reecrit et le push a reussi.

---

## 7. Squash-merge dans main

```bash
git checkout main
git merge --squash feat/multi-agent-monorepo
git commit -m "feat: multi-agent monorepo -- add luxe-digital agent"
```

**Pourquoi le squash ?** Sur main, on veut un historique propre et lisible. 10 commits de refactor intermediaires n'interessent personne qui lit l'historique. Le squash condense tout en un seul commit qui resume la feature.

**`--squash` vs merge normal :**
- `--squash` : cree un commit unique. Historique lineaire, facile a lire.
- Merge normal : conserve chaque commit. Utile quand les commits individuels ont du sens pour l'historique du projet.

**Notre cas :** Les 10 commits intermediaires (move types, move date-filter, etc.) sont des etapes techniques sans valeur pour l'historique long terme. Un seul commit "multi-agent monorepo" est plus clair.

---

## 8. Verifier avant de pousser

```bash
npx vitest run     # 62 tests passent
npx tsc --noEmit   # TypeScript compile
git log --oneline  # verifier l'historique
```

**Pourquoi ?** Ne jamais push sur main sans verifier que les tests passent et que le code compile. C'est la securite minimale avant un merge.

---

## 9. Pousser sur main

```bash
git push origin main
```

**Ce qui se passe apres :** GitHub Actions detecte le push sur `main`, lance les tests, puis deploie sur le VPS via SSH (selon le workflow `.github/workflows/deploy.yml`).

---

## Recapitulatif du flux complet

```
1. git checkout -b feat/multi-agent-monorepo    # Isoler le travail
2. (implentation + commits atomiques)             # Chaque etape = 1 commit
3. git filter-branch (si secret detecte)          # Nettoyer l'historique
4. git push -u origin feat/multi-agent-monorepo  # Partager la branche
5. npx vitest run && npx tsc --noEmit            # Verifier
6. git checkout main                              # Revenir sur main
7. git merge --squash feat/multi-agent-monorepo   # Squash-merge
8. git commit                                     # Commit unique
9. git push origin main                           # Deployer
```

---

## Commandes utiles non utilisees cette fois

| Commande | Usage |
|---|---|
| `git rebase -i` | Reorganiser/combiner des commits avant merge |
| `git cherry-pick` | Appliquer un commit specifique d'une autre branche |
| `git bisect` | Trouver le commit qui a introduit un bug |
| `git blame` | Voir qui a ecrit chaque ligne d'un fichier |
| `git worktree` | Travailler sur plusieurs branches en parallele sans stash |