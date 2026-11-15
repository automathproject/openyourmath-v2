# Éditeur de création d'exercice (`/create`)

Éditeur accessible depuis le menu **Créer** du header. Il permet de rédiger un
exercice au format de la plateforme et de l'exporter en `.tex` prêt à être
déposé dans `content/exercises/`.

Après l'export, suivre la procédure [Ajouter et déployer un
exercice](ajouter-et-deployer-un-exercice.md) pour déposer la source, valider
les images, reconstruire la base et publier l'exercice.

## Architecture

```
src/routes/create/+page.svelte          Page éditeur (double fenêtre)
src/lib/components/create/
  LatexToolbar.svelte                   Assistant LaTeX (palette de snippets)
  QcmEditor.svelte                      Édition d'un qcm (questions, réponses, distracteurs IA)
  ImportDropzone.svelte                 Glisser-déposer PDF / image / .tex
src/lib/latex/
  exerciseTex.js                        buildExerciseTex / parseExerciseTex (format source du site)
  texPreview.js                         LaTeX → HTML côté client pour l'aperçu (maths laissées à KaTeX)
src/lib/qcm/editor.js                   Brouillon de qcm : export / relecture au format content/qcm, blocs d'aperçu
src/lib/ia/
  assistPrompts.js                      Consignes envoyées à l'IA (exercices et qcm)
  qcmAssist.js                          Lecture des réponses de l'IA pour les qcm
src/routes/api/create/
  assist/+server.js                     Assistant IA de rédaction (Albert, openai/gpt-oss-120b)
  import/+server.js                     Restructuration PDF/image → .tex (Albert, Mistral-Small-3.2 vision)
```

## Fonctionnement

- **Double fenêtre** : à gauche, des blocs typés (description `\texte`,
  question `\question`, indication `\indication`, solution `\reponse`) avec
  métadonnées ; à droite, le rendu via `ExerciseContent` (identique au site)
  ou la source `.tex` générée.
- **Aperçu** : conversion LaTeX → HTML légère côté client (`texPreview.js`),
  mathématiques rendues par KaTeX. Les figures TikZ, images et blocs de code
  sont remplacés par des encarts (elles ne sont rendues qu'à la construction
  du site par le pipeline pandoc). Le bouton **Vérifier le rendu final** lance
  ponctuellement ce convertisseur de production côté serveur, notamment pour
  contrôler les tableaux ; toute nouvelle modification revient à l'aperçu
  instantané.
- **Assistant IA** (`/api/create/assist`) : point d'entrée principal de la
  rédaction. À partir d'un brief et d'un nombre de questions, il génère une
  séquence progressive. Les actions locales restent disponibles ensuite :
  améliorer un bloc (✨), ajouter une indication (💡) ou une solution (✅).
  Le contexte complet de l'exercice est transmis au modèle.
- **Révision globale** : une demande telle que « remplacer $a=2$ par $a=3$ et
  recalculer » génère une proposition structurée pour l'ensemble de l'exercice.
  Les différences sont affichées avant application ; aucune modification n'est
  appliquée sans confirmation.
- **Structure des questions** : les indications et solutions conservent dans le
  brouillon l'identifiant de leur question parente. Leur rattachement ne dépend
  donc plus de leur position dans l'éditeur ; l'export les remet dans l'ordre
  pédagogique attendu.
- **Import** (`/api/create/import`) : un PDF est converti en images côté
  client (pdfjs-dist, max 4 pages, JPEG ≤1600 px), une image est réduite de
  même, puis le modèle vision transcrit le document au format `.tex` du site.
  Les exercices indépendants détectés sont présentés à la sélection et
  enregistrés comme brouillons distincts, accessibles depuis la page. Un
  fichier `.tex` déposé est chargé directement sans IA.
- **Export** : `buildExerciseTex()` produit une source conforme au contrôle
  qualité (`pnpm check:tex`) — métadonnées dans l'ordre des sources, questions
  multiples dans un `enumerate` avec `\item`.
- **Brouillon** : l'exercice en cours est sauvegardé dans `localStorage`
  (`oym-create-draft-v1`) et restauré à l'ouverture de la page. L'exercice et
  le qcm en cours y sont conservés côte à côte, avec le mode actif.

## Créer un qcm

La bascule **Exercice / QCM** en tête de page change la nature du contenu. En
mode QCM, les blocs cèdent la place à des cartes de question : énoncé, type
(`\qtype`), réponses marquées justes ou fausses, commentaire par réponse
(`\feedback`) et explications. L'export suit le format de `content/qcm/`
(voir [QCM](qcm.md)) : une question par fichier dans le cas général ; plusieurs
questions font une série ordonnée, et `\serie{ordonnee}` est alors écrit
automatiquement. L'aperçu joue la question avec le composant du site, et un
encart « À corriger avant publication » signale ce que le contrôle des sources
refuserait (réponse juste absente, réponses identiques, accolades, `%`).
Un `.tex` de qcm déposé dans l'import s'ouvre directement dans ce mode.

### Distracteurs

Deux actions IA (`/api/create/assist`, modes `distractors` et `qcm`) :

- **✨ Distracteurs (IA)**, sur une question dont l'énoncé est rédigé : propose
  jusqu'à cinq réponses fausses, ajoutées à la suite des réponses. L'auteur
  peut préciser l'erreur à viser.
- **Générer la question**, depuis le panneau de tête : énoncé, réponses,
  distracteurs et correction à partir d'un brief.

La consigne (`DISTRACTOR_RULES` dans `assistPrompts.js`) repose sur un
principe : un distracteur est la réponse qu'obtient un étudiant qui commet
*une* erreur précise et fréquente. Le modèle doit résoudre la question,
recenser ces erreurs, mener chaque raisonnement erroné jusqu'au bout, puis
vérifier que le résultat est faux sans ambiguïté, plausible, distinct des
autres, de même forme que la réponse juste et non éliminable sans calcul.
Mieux vaut moins de distracteurs que du remplissage : la consigne le dit, et
le serveur n'exige pas le nombre demandé.

Le modèle répond dans un format balisé (`[DISTRACTEUR]`, puis `ERREUR`,
`CALCUL`, `REPONSE`, `VERIFICATION`, `VALIDE`, `FEEDBACK`) plutôt qu'en JSON,
pour que les contre-obliques du LaTeX n'aient pas à être échappées. Les champs
de raisonnement précèdent la réponse à dessein. `qcmAssist.js` en tire :

- la réponse et son commentaire (`\feedback`, montré à l'étudiant à la
  correction) ;
- l'**erreur visée**, affichée à l'auteur sous la réponse et jamais exportée :
  c'est elle qui permet de juger le distracteur d'un coup d'œil ;
- un filtre : sont écartés les distracteurs que le modèle invalide lui-même
  (`VALIDE : non`), les doublons et les réponses déjà présentes, à l'écriture
  près.

Les réponses d'une question générée sont mélangées (le modèle écrit la réponse
juste en premier) ; le bouton **Mélanger** fait de même à la demande. Rien de
tout cela ne dispense de relire : la fausseté d'une réponse n'est pas vérifiée
par le code.

## Garde-fous serveur

- Rate limiting par IP : 12 appels/min pour l'assistant, 3/min pour l'import.
- Quota soft partagé : 15 appels chat Albert/min (`albertQuota.js`).
- Import : max 4 pages, ~1 Mo par image, data-URL JPEG/PNG/WebP uniquement.
- En production (adapter-node), `BODY_SIZE_LIMIT=8M` est requis pour l'import
  (défini dans `docker-compose.yml`).

## Prévu plus tard

- Assistant de création de graphiques (TikZ) et de blocs de code Python
  (`\code`, SaveVerbatim).
