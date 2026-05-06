# OpenYourMath V2

Application web pour servir des exercices de mathématiques LaTeX avec recherche avancée.

## Démarrage rapide

### Développement local

```bash
# Installation des dépendances (Node 22 + pnpm via corepack)
pnpm install

# Générer le cache JSON et la base SQLite (à relancer quand le LaTeX change)
pnpm build:content

# Démarrer le serveur Vite (http://localhost:5173)
pnpm dev

# Variante: rebuild du contenu puis démarrer le serveur
pnpm dev:full
```

### Production (sans Docker)

```bash
# Build complet (contenu + bundle Node adapter)
pnpm build

# Vérifier le build localement
pnpm preview

# Lancer le serveur Node en production (PORT=3000 par défaut)
NODE_ENV=production node build
```

### Production (avec Docker)

```bash
# 1) Mettre à jour la version dans package.json (champ "version")
# Exemple: "2.3.2" -> "2.3.3"

# Préparer les artéfacts locaux si vous reconstruisez l'image
pnpm build:content:full

# 2) Construire + pousser l'image GHCR taggée avec package.json:version
pnpm docker:release

# 3) Démarrer la stack (Caddy + app) en mode interactif
pnpm docker:dev

# 4) Lancer en détaché (prod)
pnpm docker:prod

# Arrêt
docker compose down
```

Notes:

- `pnpm docker:build` et `pnpm docker:push` existent aussi si vous voulez séparer les étapes.
- Le tag Docker et la version affichée dans l'UI sont pilotés par `package.json` (`version`), sans variable `VERSION=...` à saisir manuellement.

## Configuration

Créer un fichier `.env` à la racine (jamais commité) :

```env
# Ollama — LLM local (prioritaire)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=mistral-small3.2:24b
OLLAMA_EMBED_MODEL=bge-m3

# Albert API — fallback si Ollama indisponible
ALBERT_API_KEY=sk-...
ALBERT_BASE_URL=https://albert.api.etalab.gouv.fr/v1
```

Ollama est utilisé en priorité pour la génération de résumés et les embeddings. Albert prend le relais si Ollama n'est pas disponible ou si le modèle n'est pas installé. Pour l'indexation sémantique, Ollama seul suffit (gratuit, hors-ligne).

## Indexation sémantique

```bash
# Après build:content, générer résumés + embeddings pour les nouveaux exercices
pnpm index:exercises

# Options utiles
pnpm index:exercises:force                  # réindexe tout
node scripts/index-exercises.js --uuid UUID # un seul exercice
node scripts/index-exercises.js --limit 50  # limiter à 50 exercices
node scripts/index-exercises.js --dry-run   # simuler sans écrire
```

Les résumés générés sont versionnés dans `content/metadata/` et commités dans git.
Les embeddings restent en local dans `cache/embeddings/` et dans la DB.

## Changement de machine

Les fichiers `data/` et `cache/` ne sont pas versionnés. Pour éviter de recalculer
tous les embeddings sur une nouvelle machine, transférer un snapshot de la DB via
une GitHub Release :

```bash
# Ancienne machine
source ~/.nvm/nvm.sh
nvm use
pnpm install
pnpm build:content
pnpm index:exercises
pnpm db:snapshot:pack
pnpm db:snapshot:publish
```

```bash
# Nouvelle machine
source ~/.nvm/nvm.sh
nvm use
pnpm install
pnpm db:snapshot:download
pnpm db:snapshot:restore
pnpm cache:embeddings:stats
pnpm dev
```

Prérequis : Node 22 (`.nvmrc`) et `gh` connecté (`gh auth login`). Par défaut,
les commandes utilisent le tag `db-snapshot-dev` et l'archive locale ignorée par
Git `data/openyourmath-db-snapshot.tgz`.

Voir aussi : [docs/embeddings-sync.md](docs/embeddings-sync.md).

## Structure

- `content/` : Sources LaTeX des exercices + métadonnées LLM versionnées (`content/metadata/`)
- `cache/` : Cache JSON des exercices parsés + embeddings locaux (`cache/embeddings/`)
- `scripts/` : Pipeline de build (LaTeX → JSON → SQLite) et indexation IA
- `src/` : Application SvelteKit
- `static/` : Assets statiques et artifacts

## Documentation

Voir `/docs` pour plus de détails.

- Scripts de debug/maintenance: `docs/debug-scripts.md`
