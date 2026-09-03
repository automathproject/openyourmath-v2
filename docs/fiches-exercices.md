# Fiches d'exercices

Une **fiche** est une liste thématique d'exercices, éditorialisée : un titre, un
auteur, une date, et une suite de références groupées sous des sections. Elle ne
porte aucun énoncé — seulement un ordre et une structure sur des exercices qui
existent déjà dans le corpus.

```text
content/fiches/<source>/*.txt  →  tables fiches + fiche_items  →  application
        (importé d'exobase)          (pnpm build:fiches)
```

## Format source

Les fiches sont des fichiers `.txt` LaTeX, propriété d'exobase au même titre que
les exercices (voir [sync-exobase.md](sync-exobase.md)).

```latex
\fiche{f00012, bodin, 2007/09/01}

\titre{Fonctions continues}

\section{Pratique}
\insertion{671, 670, 677}

\section{Théorie}
\insertion{639, 645, 642, 646}

\finfiche
```

| Commande | Rôle |
|---|---|
| `\fiche{id, auteur, date}` | En-tête. La date `YYYY/MM/DD` est normalisée en ISO. |
| `\titre{...}` | Titre de la fiche. |
| `\part` `\section` `\subsection` `\subsubsection` | Titres, du plus englobant au plus fin. Tous facultatifs. |
| `\insertion{...}` | Références d'exercices : liste (`671, 670`) et plages (`2889-2899`). |
| `\finfiche` | Fin de la fiche. |

Le texte libre entre les commandes est conservé : celui qui précède le premier
titre devient l'introduction de la fiche, le reste devient une note rattachée au
titre courant. `\tableofcontents`, `\setcounter` et `\label` sont ignorés.

### Ce que le format autorise réellement

Trois particularités du corpus exo7 que le parser prend en charge, et qu'il faut
garder en tête avant de simplifier quoi que ce soit :

- **Un titre peut porter à la fois des exercices et des sous-titres.** Dans
  `fic00080`, `\section{Coniques}` a trois exercices propres puis trois
  sous-sections. Un modèle où seules les feuilles portent des exercices serait
  faux.
- **Les titres contiennent du LaTeX** (`Propriétés de $\Nn$`,
  `\'Equations linéaires`) : ils passent par `MathRenderer` à l'affichage,
  jamais bruts.
- **La profondeur est très inégale.** Sur les 167 fiches exo7, 125 sont des
  listes plates et 39 n'ont qu'un niveau de sections ; seules 3 vont plus loin,
  dont deux ouvrages entiers (`fic00080`, 2174 exercices ; `fic00166`, 656).

## Résolution des références

Une fiche exo7 désigne ses exercices par l'entier de leur `\exo7id{}`, pas par
leur uuid OpenYourMath. Le lien est reconstruit au build **depuis les sources
`.tex`**, qui font autorité, et non depuis le cache : le cache n'est invalidé
que par le hash du `.tex`, donc un champ ajouté au parser d'exercices y
resterait absent jusqu'à une reconstruction complète.

Les tables stockent l'uuid résolu — l'application n'a jamais à connaître les
identifiants exo7 — et `fiche_items.source_ref` conserve la référence d'origine
pour le diagnostic.

Une source absente du registre `REFERENCE_SCHEMES` de
[`scripts/build-fiches.js`](../scripts/build-fiches.js) est réputée référencer
directement des uuid : c'est ce que feront les fiches rédigées dans
OpenYourMath.

## Modèle en base

`fiche_items.section_path` porte le chemin de titres au format JSON — `[]` pour
une fiche plate, `["Pratique"]` pour un niveau, `["Géométrie","Coniques"]`
au-delà. Un chemin plutôt qu'un arbre, pour trois raisons : la position reste la
clé de navigation, un titre mixte se représente sans cas particulier, et
regrouper à l'affichage n'est qu'un partitionnement des items contigus de même
chemin.

Une référence dont l'exercice est absent du corpus est conservée avec un
`exercise_uuid` nul, et comptée dans `fiches.missing_count` : la fiche reste
fidèle à sa source, et la lacune reste réparable sans réimport.

L'index `idx_fiche_items_exercise` donne la relation inverse — les fiches où
figure un exercice donné.

## Commandes

```bash
pnpm build:fiches     # construit les tables (inclus dans pnpm build:content)
pnpm check:fiches     # lit et résout sans écrire ; sort en 1 au moindre écart
```

`build:fiches` reconstruit intégralement les deux tables à chaque exécution.
Elle ne s'interrompt que sur un identifiant de fiche en double, qui rendrait le
résultat faux ; une lacune amont laisse la fiche utilisable et n'est que
signalée.

## Lacunes connues

`pnpm check:fiches` signale aujourd'hui 5 références sans exercice, sur 4762 :

| Fiche | Référence exo7 | Cause |
|---|---|---|
| `fic00121` | 5676 | absent du corpus |
| `fic00166` | 7261, 7435, 7828 | absents du corpus |
| `fic00166` | 7904 | `content/exercises/exo7/7904.tex` n'a pas de `\uuid{}` |

Le cas `7904` est un défaut de source réparable dans exobase : sans `\uuid{}`,
le parser d'exercices lui en attribue un aléatoire à chaque reconstruction du
cache, et l'exercice n'est jamais publié en base. La correction se remonte avec
`pnpm sync:exobase:push`.
