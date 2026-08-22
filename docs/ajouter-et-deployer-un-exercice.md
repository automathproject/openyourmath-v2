# Ajouter et déployer un exercice

Cette procédure est le parcours de référence, depuis la création d'un exercice jusqu'à sa mise en ligne. Elle sépare les actions de la personne qui contribue le contenu de celles de la personne qui publie une version de l'application.

## Prérequis

- Node 22 et pnpm (voir `.nvmrc`) ;
- dépendances installées avec `pnpm install` ;
- Pandoc pour construire le contenu ;
- LaTeX uniquement si l'exercice contient du TikZ ;
- Ollama configuré, ou les identifiants Albert dans `.env`, pour l'indexation sémantique ;
- accès à GHCR et au serveur de production pour la publication.

> Le contrôle global `pnpm check:tex` échoue encore sur des sources historiques. Pour l'ajout d'un exercice, toujours valider le fichier ciblé comme indiqué ci-dessous.

## 1. Contribuer un exercice

### Créer et enregistrer la source

Depuis `/create`, exporter le `.tex`, le relire, puis le déposer sous :

```text
content/exercises/<source>/<uuid>.tex
```

`<source>` est le fournisseur ou corpus de l'exercice (`amscc`, `exo7`, etc.) et `<uuid>` doit correspondre à la commande `\uuid{...}` dans la source.

Exemple : `content/exercises/amscc/X7pQ.tex`.

Ne pas régénérer l'UUID après avoir commencé à nommer des fichiers associés. La validation détecte les collisions avec l'ensemble du corpus.

### Renseigner les métadonnées éditoriales

Les métadonnées éditoriales font partie de la source `.tex`. Les renseigner
dans l'éditeur avant l'export, puis les relire dans le fichier :

```latex
\uuid{X7pQ}
\titre{...}
\niveau{...}
\module{...}
\chapitre{...}
\sousChapitre{...}
\theme{...}
\auteur{...}
\organisation{...}
\datecreate{AAAA-MM-JJ}
\difficulte{1 à 5}
```

`titre`, `niveau`, `module`, `chapitre`, `thème`, auteur et difficulté sont
notamment utilisés dans les filtres et la recherche. Réutiliser les graphies
existantes plutôt que d'en créer de nouvelles. Si l'auteur n'est pas encore
dans le référentiel, ajouter ses informations et sa licence dans
`content/authors.json` avant le commit.

### Ajouter les images éventuelles

Pour une image externe référencée avec `\includegraphics`, versionner le fichier source sous :

```text
content/images/<source>/<format>/<nom>.<extension>
```

Formats pris en charge : `svg`, `png`, `jpg`, `jpeg`, `pdf`. La convention recommandée est `<uuid>-<numéro>`, par exemple :

```text
content/images/amscc/svg/X7pQ-1.svg
content/images/amscc/pdf/X7pQ-1.pdf
```

Référencer explicitement le format dans le LaTeX :

```latex
\includegraphics[width=0.7\linewidth]{svg/X7pQ-1}
```

Les artefacts sous `static/artifacts/` sont produits automatiquement ; ne pas les ajouter à Git.

### Valider, construire et générer les métadonnées sémantiques

Après avoir enregistré la source, lancer :

```bash
EXERCISE_UUID=X7pQ
pnpm exercise:prepare -- "$EXERCISE_UUID"
```

La commande localise la source à partir de son UUID, vérifie son format, son
unicité et ses images, reparse la source même si seuls ses fichiers image ont
changé, met à jour le cache et la base, compile TikZ si le fichier en contient
(pour cet UUID seulement), puis lance l'indexation ciblée.
Cette dernière utilise
Ollama si disponible, sinon Albert, pour produire un résumé, les concepts, les
méthodes et les objets mathématiques. Elle génère aussi l'embedding employé par
la recherche sémantique.

Pour préparer en une fois plusieurs nouveaux exercices, avant de les
commiter, utiliser :

```bash
pnpm exercises:prepare
```

Cette commande cible seulement les fichiers `.tex` ajoutés à Git sous
`content/exercises/` (non suivis ou ajoutés à l'index Git). Elle valide chaque
fichier, reparse ces sources et construit la base une seule fois, ne compile
que les artefacts TikZ de ces nouveaux fichiers, puis indexe les UUID trouvés.
Elle n'indexe pas les anciennes sources non indexées. Après un commit, utiliser
`pnpm exercise:prepare -- <uuid>` pour préparer un exercice individuellement.

Les métadonnées textuelles sont écrites dans un fichier versionné sous
`content/metadata/`, selon la même arborescence que la source. Pour l'exemple
ci-dessus :

```text
content/metadata/amscc/X7pQ.json
```

Relire ce fichier avant le commit : les termes mathématiques doivent être
corrects et pertinents. Si la source `.tex` change ensuite, son `content_hash`
change également : relancer l'indexation afin de régénérer les métadonnées
sémantiques correspondantes.

En cas d'erreur d'image, ajouter ou corriger le fichier sous `content/images/` et relancer la validation. En cas de collision d'UUID, générer un nouvel UUID dans l'éditeur puis renommer le fichier source et les images associées.

### Vérifier et commiter

```bash
git status --short
git diff --check
```

Pour un exercice avec images et indexation, les fichiers à commiter sont :

```text
content/exercises/<source>/<uuid>.tex
content/images/<source>/<format>/<uuid>-<numéro>.<extension>
content/metadata/<source>/<...>/<uuid>.json
```

Ne pas commiter `data/`, `cache/` ni `static/artifacts/` : ils sont générés.

```bash
EXERCISE_PATH=content/exercises/amscc/X7pQ.tex
METADATA_PATH=content/metadata/amscc/X7pQ.json
git add "$EXERCISE_PATH" \
  content/images/amscc/svg/X7pQ-1.svg \
  "$METADATA_PATH"
git commit -m "Ajoute l'exercice $EXERCISE_UUID"
git push origin main
```

## 2. Publier une version

Ces étapes sont à exécuter par la personne qui a l'accès au registre GHCR et au serveur de production.

### Préparer la release dans le dépôt

```bash
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
```

Vérifier que les nouveaux exercices ont été indexés avant la release. Si nécessaire, exécuter de nouveau l'indexation ciblée puis commiter les métadonnées :

```bash
EXERCISE_UUID=X7pQ
METADATA_PATH=content/metadata/amscc/X7pQ.json
node scripts/index-exercises.js --uuid "$EXERCISE_UUID"
git add "$METADATA_PATH"
git commit -m "Indexe l'exercice $EXERCISE_UUID"
git push origin main
```

Mettre ensuite à jour le champ `version` de `package.json`, commiter ce changement et pousser la branche. Le tag de l'image et la version affichée par l'application proviennent de ce champ.

```bash
pnpm release:content
```

Cette commande exige un dépôt propre sur `main`, exécute les tests de build,
reconstruit le cache et la base de façon incrémentale, vérifie que toutes les
images référencées sont bien présentes dans les artefacts Docker, puis construit et pousse
`ghcr.io/automathproject/openyourmath:<version>`. Elle affiche ensuite les
commandes exactes à lancer sur le serveur. Elle ne compile pas TikZ : cette
étape doit avoir été faite avec `pnpm exercise:prepare` ou
`pnpm exercises:prepare` avant le commit.

### Mettre à jour le serveur

Sur le serveur qui contient `docker-compose.yml` et le `Caddyfile`, définir la version publiée puis tirer et redémarrer le service applicatif :

```bash
export APP_VERSION=2.4.3
docker compose pull app
docker compose up -d app
docker compose ps
curl --fail --silent --show-error https://openyourmath.org/api/health
```

Le healthcheck interne du conteneur vérifie également `/api/health`.

### Retour arrière

Si la vérification de santé échoue après la mise à jour, relancer le service avec le tag précédemment connu comme sain :

```bash
export APP_VERSION=2.4.2
docker compose up -d app
curl --fail --silent --show-error https://openyourmath.org/api/health
```

## Checklist rapide

```text
[ ] Source .tex sous content/exercises/<source>/
[ ] Images sous content/images/<source>/<format>/, si nécessaire
[ ] pnpm check:tex -- <fichier> réussit
[ ] build de contenu réalisé, avec TikZ si nécessaire
[ ] indexation de l'UUID réalisée et métadonnée committée
[ ] Sources, images et métadonnées committées et poussées
[ ] Version package.json mise à jour et image GHCR poussée
[ ] Serveur tiré, redémarré et /api/health vérifié
```
