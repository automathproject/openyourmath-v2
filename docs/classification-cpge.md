# Classification CPGE des exercices

Proposition de conception. Seule la phase 0 (programmes officiels en Markdown,
`content/referentiels/cpge/`) est réalisée.

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
6. **Hors des sources `.tex`.** Les `.tex` appartiennent à exobase
   ([sync-exobase.md](sync-exobase.md)). La classification CPGE est produite et
   validée dans OpenYourMath, comme les métadonnées sémantiques. Elle est donc
   versionnée ici, à côté de `content/metadata/`.

## Modèle de données

### Référentiel : `content/referentiels/cpge/`

```text
content/referentiels/cpge/
├── README.md               format des programmes
├── sources.json            liens vers les annexes officielles (BO 2021)
├── sources/*.pdf           PDF téléchargés (non versionnés,
│                           pnpm fetch:programmes-cpge)
├── programmes/
│   ├── mpsi-mp2i.md        MPSI, MP2I — 1re année
│   ├── pcsi.md             PCSI       — 1re année
│   ├── ptsi.md             PTSI       — 1re année
│   ├── bcpst1.md           BCPST      — 1re année
│   ├── mp-mpi.md           MP, MPI    — 2e année
│   ├── pc.md               PC         — 2e année
│   ├── psi.md              PSI        — 2e année
│   ├── pt.md               PT         — 2e année
│   └── bcpst2.md           BCPST      — 2e année
└── concordance.json        (phase 2) sections voisines entre programmes
```

Le Markdown est la source de vérité. Un script de build (phase 1,
`scripts/build-referentiel-cpge.js`) l'analyse et produit une liste de nœuds :

```json
{
  "id": "mpsi-mp2i.nombres-complexes.f",
  "programme": "mpsi-mp2i",
  "filieres": ["MPSI", "MP2I"],
  "annee": 1,
  "partie": "Premier semestre",
  "section": "mpsi-mp2i.nombres-complexes",
  "titre": "Racines n-ièmes",
  "ordre": 57,
  "contenus": ["Description des racines n-ièmes de l'unité, …"]
}
```

Quand une section est découpée en parties « A - », « B - » (voir le README du
référentiel), `section` désigne la partie, et un champ `section_mere` désigne
la section générale. La navigation peut ainsi afficher les deux niveaux.

Le script fait échouer le build si un identifiant disparaît alors qu'une
classification y renvoie. C'est ce qui protège le référentiel lors d'une
future réforme des programmes : on ajoute alors un nouveau jeu de fichiers
(par exemple `programmes/2027/`), et l'ancien reste en place tant que des
rattachements pointent dessus.

### Rattachements : `content/classifications/cpge/<source>/<uuid>.json`

Un fichier par exercice, comme `content/metadata/`. Cela évite les conflits de
fusion et suit le même cycle de vie :

```json
{
  "uuid": "abcd",
  "content_hash": "…",
  "rattachements": [
    {
      "noeud": "mpsi-mp2i.nombres-complexes.f",
      "origine": "llm",
      "confiance": 0.86
    },
    {
      "noeud": "pcsi.nombres-complexes.f",
      "origine": "concordance",
      "confiance": 0.7
    },
    {
      "noeud": "mp-mpi.structures-algebriques.a",
      "origine": "manuel",
      "valide": true
    }
  ]
}
```

- `origine` vaut `manuel`, `llm`, `concordance` ou `chapitre` (a priori déduit
  du chapitre universitaire).
- `valide: true` marque une relecture humaine. Un rattachement validé n'est
  jamais écrasé par un traitement automatique.
- `content_hash` permet de reclasser les rattachements non validés quand
  l'énoncé change, comme pour l'indexation sémantique.

### SQLite (phase 1)

```sql
CREATE TABLE cpge_noeuds (
  id TEXT PRIMARY KEY,           -- mpsi-mp2i.nombres-complexes.f
  programme TEXT NOT NULL,       -- mpsi-mp2i
  annee INTEGER NOT NULL,        -- 1 | 2
  partie TEXT,                   -- Premier semestre | Programme
  section_id TEXT NOT NULL,      -- = id pour un nœud de section
  titre TEXT NOT NULL,
  ordre INTEGER NOT NULL         -- ordre du texte officiel
);
CREATE TABLE cpge_filieres (filiere TEXT, programme TEXT, PRIMARY KEY (filiere, programme));
CREATE TABLE exercise_cpge (
  uuid TEXT NOT NULL,
  noeud_id TEXT NOT NULL,
  origine TEXT NOT NULL,
  confiance REAL,
  valide INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uuid, noeud_id)
);
CREATE INDEX idx_exercise_cpge_noeud ON exercise_cpge(noeud_id);
```

`exercise_cpge` est la table d'association, sur le modèle de
`exercise_authors`. Filtrer une section entière revient à un préfixe :
`noeud_id = :s OR noeud_id LIKE :s || '.%'`.

## Alimentation

1. **A priori par chapitre.** Une table de correspondance entre chapitres
   universitaires et sections candidates part de
   `scripts/chapitres_complet.json`, aujourd'hui inutilisé. Elle est maintenue
   à la main (environ 140 chapitres) et sert à restreindre les candidats.
2. **Étiquetage par LLM.** On étend le pipeline B (`index-exercises.js`,
   Ollama puis Albert). Le modèle reçoit l'énoncé, le résumé et les concepts
   déjà calculés, ainsi que les seules sous-sections candidates, avec leurs
   lignes de contenu comme contexte. Il renvoie des identifiants et une
   confiance. Tout identifiant absent du référentiel est rejeté.
3. **Concordance.** On propage les rattachements vers les sections voisines
   des autres programmes, avec une confiance réduite.
4. **Validation humaine.** Une vue de relecture par section de programme
   permet d'accepter ou de rejeter les rattachements en série.
5. **crouzet/pcsi.** Ces exercices suivent un cours de PCSI. Leurs 9 chapitres
   se rattachent directement aux sections `pcsi.*` (origine `chapitre`, à
   valider). La correction `\niveau{PCSI} → L1` se propose ensuite vers
   exobase. D'ici là, les requêtes traitent `PCSI` comme un alias hérité.

## Intégration dans l'application

- **Navigation `/browse`** : un onglet « Prépa » en plus de la navigation par
  niveau. On y parcourt filière → semestre (1re année) → section →
  sous-section, avec des compteurs. La page de section affiche le bandeau du
  programme officiel en introduction, un contenu que l'on a déjà gratuitement.
- **Recherche** : paramètres `filiere=PCSI` et `cpge=<id de nœud ou de
section>`. Le bouton « CPGE » de la barre latérale devient « a au moins un
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
| 1     | Analyseur Markdown → nœuds, tables SQLite, tests (unicité et stabilité des identifiants) | à faire |
| 2     | A priori par chapitre, étiquetage LLM, concordance, rattachement de crouzet/pcsi         | à faire |
| 3     | Navigation « Prépa », filtres de recherche, badges                                       | à faire |
| 4     | Éditeur `/create` et vue de validation                                                   | à faire |

## Questions ouvertes

- **Autres filières.** On peut ajouter TSI, TPC, TB ou ECG en ajoutant des
  fichiers de programme, sans changer le modèle.
- **Classification dans exobase ?** Si les rattachements validés doivent
  suivre les sources vers d'autres plateformes, il faudra les faire remonter
  dans exobase, comme `authors.json`. Pour l'instant, ils restent dans
  OpenYourMath, comme `content/metadata/`.
- **Le référentiel universitaire** (TODO du README) peut suivre le même
  modèle : fichier versionné, identifiants stables, table d'association.
