#!/bin/bash
# Reçoit le JSON de Claude Code sur stdin
read -r JSON_DATA

# On essaie les différentes variantes de clés possibles dans la v2.1
# .percentage ou .used_percentage | .model ou .model_name | .files ou .file_count | .tps
INFO=$(echo "$JSON_DATA" | jq -r '[
  (.percentage // .used_percentage // 0),
  (.model // .model_name // "Ollama"),
  (.files // .fileCount // .file_count // 0),
  (.tps // .tokens_per_second // 0),
  (.maxFileTokens // .max_file_tokens // 0)
] | @tsv' 2>/dev/null)

# Si INFO est vide, on ne fait rien pour éviter de casser l'affichage
[[ -z "$INFO" ]] && exit 0

read -r PERCENT MODEL FILES TPS MAX_TOKENS <<< "$INFO"

# Couleur dynamique
COLOR="\033[32m" # Vert
[[ "$PERCENT" -gt 50 ]] && COLOR="\033[33m" # Jaune
[[ "$PERCENT" -gt 85 ]] && COLOR="\033[31m" # Rouge

# Alerte fichier trop gros
WARNING=""
[[ "$MAX_TOKENS" -gt 10000 ]] && WARNING=" ⚠️  "

# Calcul économie rapide
SAVED=$(echo "scale=2; ($PERCENT * 0.18) / 100" | bc 2>/dev/null || echo "0.00")

# Affichage minimaliste (Look clean)
echo -e "[ ${COLOR}${PERCENT}%\033[0m ] | 📄 $FILES files | ⚡ $TPS t/s |$WARNING 🤖 $MODEL | \033[32mSaved: ~$SAVED$\033[0m"