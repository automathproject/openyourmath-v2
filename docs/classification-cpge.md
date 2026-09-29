# Classification CPGE des exercices

Conception et état d'avancement. Les phases 0 (programmes officiels en
Markdown) et 1 (référentiel en base) sont réalisées. Le référentiel et les
rattachements relus appartiennent à exobase, et OpenYourMath les importe par
`pnpm sync:exobase` ([sync-exobase.md](sync-exobase.md)).

## Constat

La classification actuelle est un axe unique, porté par des macros du `.tex` et
stocké en colonnes texte mono-valuées (`scripts/schema.sql`) :

```text
niveau (L1…M1) → module → chapitre → sous-chapitre (+ thème libre)
```

Elle ne peut pas exprimer la place d'un exercice dans les classes
préparatoires :

- **Un exercice concerne plusieurs filières à la fois.** Un exercice sur les
  racines $n$-ièmes de l'unité relève de MPSI et de PCSI ; un exercice de
  réduction relève de MP, PC et PSI, mais pas au même endroit du programme.
  Une valeur unique de `niveau` ne peut pas porter cela.
- **Les programmes ne suivent pas le découpage universitaire.** Le programme
  est organisé en semestres (1re année), puis en sections et sous-sections
  lettrées. Leurs limites diffèrent de celles des chapitres exo7 : en MPSI, la
  trigonométrie est une sous-section de « Compléments de calcul algébrique et
  de trigonométrie », et les équations différentielles linéaires sont vues dès
  le premier semestre avec les primitives.
- **Le mélange existe déjà.** Les 115 exercices `crouzet/pcsi` ont
  `\niveau{PCSI}`, qui mêle niveau et filière. Le bouton « CPGE » de
  `SearchPageSidebar.svelte` ne filtre rien : aucune valeur `CPGE` n'existe.

## Principes

1. **Un second axe, orthogonal.** La classification CPGE s'ajoute à la
   classification universitaire sans la remplacer. Un exercice reste
   `L1 / Algèbre / Nombres complexes` et reçoit en plus des rattachements CPGE.
2. **Le référentiel, c'est le texte officiel.** Chaque nœud rattachable est une
   section ou une sous-section d'un programme publié au BO, avec un
   identifiant stable écrit dans le Markdown (`{#mpsi-mp2i.nombres-complexes.f}`).
   On ne crée pas de taxonomie « CPGE » maison : elle dériverait des textes, et
   l'on perdrait la possibilité de citer la ligne exacte du programme.
3. **Granularité : la sous-section.** C'est le grain que les professeurs
   utilisent (« MPSI, nombres complexes, f) racines $n$-ièmes »). Il est assez
   fin pour être utile et assez stable pour être étiqueté de façon fiable. Le
   rattachement à une section entière reste possible quand elle n'a pas de
   sous-section. Les lignes de contenu ne sont pas des nœuds : elles n'ont pas
   d'identifiant stable. On s'en sert comme contexte pour l'étiquetage.
4. **Multi-valué, par programme.** On rattache un exercice à autant de nœuds
   que nécessaire, dans chaque programme concerné. On ne tente pas de fusionner
   les programmes en une taxonomie commune. Une table de concordance entre
   sections voisines (MPSI ↔ PCSI ↔ PTSI, MP ↔ PSI ↔ PC ↔ PT, BCPST) sert
   seulement à proposer des rattachements.
5. **Filières et programmes sont distincts.** MPSI et MP2I partagent un même
   texte de mathématiques, de même que MP et MPI. À l'inverse, la filière
   BCPST a un texte par année. On filtre par filière, qui se résout en un ou
   plusieurs programmes : `MP2I → mpsi-mp2i`, `MPI → mp-mpi`,
   `BCPST → bcpst1, bcpst2`.
6. **Le contenu à exobase, le dérivé à OpenYourMath.** Un rattachement relu
   décrit l'exercice, comme `\module{}` ou `\chapitre{}`. Il doit suivre la
   source vers tous les exports, et se lire en ouvrant le `.tex`. exobase porte
   donc le référentiel, et les sources portent les rattachements relus dans la
   macro `\cpge{}`. OpenYourMath porte ce qui en dérive : la base, l'affichage et les
   propositions automatiques tant qu'elles ne sont pas relues, comme les autres
   métadonnées IA.

| Élément                                         | Dépôt        | Chemin                                                                      |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Programmes, `sources.json`, format              | exobase      | `content/referentials/cpge/`                                                |
| Validation de structure, téléchargement des PDF | exobase      | `tools/check_programmes_cpge.mjs`, `tools/import/fetch_programmes_cpge.mjs` |
| Correspondance chapitres → sections (phase 2)   | exobase      | `content/referentials/`, à côté de `amscc-exo7-compatibility.json`          |
| Rattachements relus                             | exobase      | `\cpge{}` des sources `.tex` (`content/FORMAT.md`)                          |
| Définition de `\cpge` pour la compilation       | Exercices    | `_preambules/general.tex`                                                   |
| Propositions non relues (phase 2)               | OpenYourMath | `content/metadata/<source>/<uuid>.json`, champ `cpge`                       |
| Analyseur, tables, build                        | OpenYourMath | `scripts/build-referentiel-cpge.js`                                         |
| Rendu KaTeX, instantané des identifiants        | OpenYourMath | `tests/build/referentiel-cpge.test.js`                                      |

## Modèle de données

### Référentiel : `content/referentials/cpge/`

Importé d'exobase, avec les autres référentiels (AMSCC, Exo7, tables de
compatibilité) :

```text
content/referentials/cpge/
├── README.md               format des programmes
├── sources.json            liens vers les annexes officielles (BO 2021)
└── programmes/
    ├── mpsi-mp2i.md        MPSI, MP2I — 1re année
    ├── pcsi.md             PCSI       — 1re année
    ├── ptsi.md             PTSI       — 1re année
    ├── bcpst1.md           BCPST      — 1re année
    ├── mp-mpi.md           MP, MPI    — 2e année
    ├── pc.md               PC         — 2e année
    ├── psi.md              PSI        — 2e année
    ├── pt.md               PT         — 2e année
    └── bcpst2.md           BCPST      — 2e année
```

Les PDF officiels ne sont versionnés nulle part. exobase les télécharge au
besoin dans `sources/raw/cpge/` (répertoire ignoré par Git).

Le Markdown est la source de vérité. `scripts/utils/parse-programme-cpge.js`
l'analyse : chaque titre `###` ou `####` qui porte un identifiant devient un
nœud.

```json
{
  "id": "mpsi-mp2i.nombres-complexes.f",
  "programme": "mpsi-mp2i",
  "type": "sous-section",
  "parent_id": "mpsi-mp2i.nombres-complexes",
  "partie": "Premier semestre",
  "semestre": 1,
  "lettre": "f",
  "titre": "f) Racines $n$-ièmes",
  "texte": null,
  "contenus": [
    {
      "contenu": "Description des racines $n$-ièmes de l’unité, …",
      "commentaire": "Notation $\\mathbb{U}_n$.<br>Représentation géométrique."
    }
  ],
  "ordre": 15
}
```

- **Filières et année.** Elles sont portées par le programme (front matter),
  pas par le nœud.
- **Parties.** Une partie « A - », « B - » est une section dont `parent_id`
  désigne la section générale. L'arbre est donc programme → section générale
  → partie → sous-section, ou programme → section → sous-section.
- **Contenu du nœud.** `texte` reçoit le bandeau et les notes, en Markdown.
  `contenus` reçoit les lignes du tableau.

Les 9 programmes donnent 881 nœuds : 210 sections et 671 sous-sections.

Deux garde-fous protègent les identifiants :

- **Au build.** `scripts/build-referentiel-cpge.js` échoue si un rattachement
  renvoie à un identifiant absent du référentiel.
- **Aux tests.** L'instantané versionné `tests/build/__snapshots__/cpge-identifiants.txt`
  liste tous les identifiants. Toute modification fait échouer les tests
  jusqu'à la mise à jour délibérée de l'instantané (`npx vitest run -u`).
  Elle apparaît alors dans le diff.

Lors d'une future réforme des programmes, on ajoute un nouveau jeu de fichiers
(par exemple `programmes/2027/`). L'ancien reste en place tant que des
rattachements pointent dessus.

### Rattachements

**Relus : la macro `\cpge{}` de la source.** Elle reçoit une liste
d'identifiants séparés par des virgules, à côté des autres métadonnées :

```latex
\niveau{L1}
\module{Algèbre}
\chapitre{Nombres complexes}
\cpge{mpsi-mp2i.nombres-complexes.f, pcsi.nombres-complexes.f}
```

- **Ce que la macro contient.** Seuls les identifiants y figurent, sans
  origine ni confiance : ce qui est dans la source est relu, par définition.
- **Validation.** Les deux validateurs de sources, `tools/check_exercise_sources.py`
  dans exobase et `pnpm test:tex` ici, refusent un identifiant mal formé ou
  répété (`invalid-cpge`) et un identifiant absent du référentiel
  (`unknown-cpge-node`).
- **Compilation.** Le préambule du dépôt Exercices définit `\cpge` comme une
  commande sans effet. Sans cette définition, un exercice qui la porte ne
  compile plus.
- **Analyse et édition.** L'analyseur LaTeX ignore la macro. Le build la lit
  directement dans les `.tex`, comme les fiches lisent `\exo7id{}`. L'éditeur
  `/create` la conserve quand il rouvre une source.
- **En base.** Les rattachements relus prennent l'origine `source`, avec
  `valide = 1`.

**Proposés (phase 2) : `content/metadata/<source>/<uuid>.json`, dans
OpenYourMath.** L'étiquetage automatique écrit ses propositions dans les
métadonnées sémantiques de l'exercice, sous un champ `cpge`. Elles suivent le
même cycle de vie que le résumé et les concepts : rattachées au `content_hash`,
recalculées quand l'énoncé change. `origine` dit comment la proposition a été
obtenue : `llm`, `concordance` (propagée depuis une filière voisine) ou
`chapitre` (déduite du chapitre universitaire). Une proposition acceptée à la
relecture est ajoutée au `\cpge{}` de la source, puis remonte dans exobase par
`pnpm sync:exobase:push`, comme une correction de source. Elle n'est ensuite
plus jamais écrasée par un traitement automatique.

### SQLite

Les tables sont définies dans `scripts/schema.sql` et remplies par
`pnpm build:referentiel-cpge`, dernière étape de `pnpm build:content`.
`pnpm check:referentiel-cpge` vérifie sans écrire. Chaque construction
reconstruit les tables entièrement.

| Table             | Contenu                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `cpge_programmes` | un texte officiel : titre, année, BO, NOR, liens, empreinte du Markdown |
| `cpge_filieres`   | filière → programme (`MP2I → mpsi-mp2i`, `BCPST → bcpst1` et `bcpst2`)  |
| `cpge_noeuds`     | les nœuds ci-dessus, `contenus` en JSON                                 |
| `exercise_cpge`   | rattachement exercice ↔ nœud : origine, confiance, validation           |

`exercise_cpge` est la table d'association, sur le modèle de
`exercise_authors`. Un rattachement dont l'exercice est absent de la base
n'est pas écrit. Il reste dans son fichier et revient quand l'exercice est
publié.

Pour filtrer une section entière, on suit `parent_id`, pas le préfixe de
l'identifiant : celui d'une partie « A - » ne prolonge pas celui de sa section
générale.

```sql
WITH RECURSIVE sous(id) AS (
  SELECT :section
  UNION ALL SELECT n.id FROM cpge_noeuds n JOIN sous ON n.parent_id = sous.id
)
SELECT uuid FROM exercise_cpge WHERE noeud_id IN (SELECT id FROM sous);
```

## Alimentation

1. **A priori par chapitre.** Une table de correspondance entre chapitres
   universitaires et sections candidates, rangée dans exobase à côté de
   `amscc-exo7-compatibility.json`, sur le même modèle : une décision par
   chapitre, y compris « pas d'équivalent ». Elle part des référentiels Exo7 et
   AMSCC, maintenant importés dans `content/referentials/`, et sert à
   restreindre les candidats.
2. **Étiquetage par LLM.** On étend le pipeline B (`index-exercises.js`,
   Ollama puis Albert). Le modèle reçoit l'énoncé, le résumé et les concepts
   déjà calculés, ainsi que les seules sous-sections candidates, avec leurs
   lignes de contenu comme contexte. Il renvoie des identifiants et une
   confiance. Tout identifiant absent du référentiel est rejeté.
3. **Concordance.** On propage les rattachements vers les sections voisines
   des autres programmes, avec une confiance réduite.
4. **Validation humaine.** Une vue de relecture par section de programme
   permet d'accepter ou de rejeter les propositions en série. Les
   rattachements acceptés remontent dans exobase.
5. **crouzet/pcsi.** Ces exercices suivent un cours de PCSI. Leurs 9 chapitres
   se rattachent directement aux sections `pcsi.*` (origine `chapitre`). Ces
   rattachements sont écrits dans leur `\cpge{}` après relecture, avec la
   correction
   `\niveau{PCSI} → L1`. D'ici là, les requêtes traitent `PCSI` comme un alias
   hérité.

## Intégration dans l'application

- **Navigation `/browse`** : un onglet « Prépa » en plus de la navigation par
  niveau. On y parcourt filière → semestre (1re année) → section →
  sous-section, avec des compteurs. La page de section affiche le bandeau du
  programme officiel en introduction, un contenu que l'on a déjà gratuitement.
- **Recherche** : paramètres `filiere=PCSI` et `cpge=<nœud>`, où le nœud est
  une section ou une sous-section. Le bouton « CPGE » de la barre latérale devient « a au moins un
  rattachement ».
- **Page d'exercice** : des badges « MPSI · S1 · Nombres complexes — f)
  Racines n-ièmes » renvoient vers le texte du programme.
- **Éditeur `/create`** : un champ de rattachements CPGE avec autocomplétion
  sur les nœuds, et des suggestions de `metadataTask()` fondées sur le
  référentiel plutôt que sur la base.
- **Fiches** : on peut générer automatiquement une fiche par section de
  programme (les exercices validés dans l'ordre du texte officiel).

## Phases

| Phase | Contenu                                                                                  | État    |
| ----- | ---------------------------------------------------------------------------------------- | ------- |
| 0     | Programmes officiels (9 textes, 11 filières) convertis en Markdown structuré             | fait    |
| 1     | Analyseur Markdown → nœuds, tables SQLite, tests (unicité et stabilité des identifiants) | fait    |
| 2     | A priori par chapitre, étiquetage LLM, concordance, rattachement de crouzet/pcsi         | à faire |
| 3     | Navigation « Prépa », filtres de recherche, badges                                       | à faire |
| 4     | Éditeur `/create` et vue de validation                                                   | à faire |

## Questions ouvertes

- **Autres filières.** On peut ajouter TSI, TPC, TB ou ECG en ajoutant des
  fichiers de programme, sans changer le modèle.
- **Le référentiel universitaire** (TODO du README) existe déjà dans exobase
  (`content/referentials/amscc/referentiel.md`) et arrive maintenant avec la
  synchronisation. Il reste à le brancher de la même manière : analyseur,
  table, identifiants stables.
