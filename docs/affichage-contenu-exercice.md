# Affichage du contenu d'un exercice

## Architecture centrale

Tout l'affichage du contenu repose sur deux composants noyaux :

| Composant | Rôle |
|---|---|
| `src/lib/components/MathRenderer.svelte` | Rendu HTML brut + KaTeX (`auto-render`) à chaque `onMount`/`afterUpdate` |
| `src/lib/components/ExerciseContent.svelte` | Orchestration du contenu : tri, regroupement, affichage conditionnel |

---

## Contextes d'utilisation

`ExerciseContent` est utilisé dans quatre contextes distincts, chacun passant des props différentes.

### 1. Vue pleine page — `/exercise/[uuid]`

**Fichier :** `src/routes/exercise/[uuid]/+page.svelte`

```svelte
<ExerciseContent
  variant="full"
  showGlobalToggles={true}
  exercise={data.exercise}
  content={data.exercise.content || []}
  bind:showHint
  bind:showSolution
/>
```

- `ExerciseHeader` est rendu (titre, badges niveau/thème, difficulté, auteur, dates, UUID, bouton vidéo)
- Boutons globaux "Voir les indications / solutions" dans le header (conditionnels sur `exercise.hasIndication` / `exercise.hasSolution`)
- Numéros de question : badges ronds plein (`w-8 h-8`, fond `brand-600`)
- Boutons hint/solution : icônes emoji (💡 / ✅), taille `w-8 h-8`

### 2. Panneau latéral de prévisualisation — desktop

**Fichier :** `src/lib/components/ExercisePreview.svelte`

```svelte
<ExerciseContent
  variant="preview"
  showGlobalToggles={false}
  content={$previewState.exercise.content || []}
/>
```

- Pas de `exercise` passé → `ExerciseHeader` non rendu (le titre est géré par `ExercisePreview` lui-même)
- Numéro de question : texte simple coloré `brand`, sans badge rond
- Boutons hint/sol : petits pills texte ("Ind." / "Sol." / "✔")
- Pas de bordure gauche sur les groupes question (`border-left: 0`)

### 3. Prévisualisation mobile — overlay plein écran

**Fichier :** `src/lib/components/search/MobileExercisePreview.svelte`

```svelte
<ExerciseContent
  variant="preview"
  showGlobalToggles={false}
  exercise={currentExercise}
  content={currentExercise.content || []}
  bind:showHint
  bind:showSolution
/>
```

- Même rendu que la prévisualisation desktop (variant `preview`)
- `exercise` est passé mais `ExerciseHeader` est ignoré car `variant="preview"`
- `showHint` et `showSolution` sont remis à `false` à chaque changement d'exercice
- Navigation tactile : swipe droite → fermer, boutons ←/→ en pied de page

### 4. Vue liste d'exercices — `/exercise/list`

**Fichier :** `src/routes/exercise/list/+page.svelte`

```svelte
<ExerciseContent
  variant="full"
  showGlobalToggles={true}
  exercise={$selectedExercise}
  content={$selectedExercise.content || []}
  bind:showHint
  bind:showSolution
/>
```

- Identique à la vue pleine page côté `ExerciseContent`
- `position` peut être passé (`{ current, total }`) → apparaît dans le breadcrumb du header

---

## Logique interne d'`ExerciseContent`

### Données d'entrée

La prop `content` est un tableau de blocs, chaque bloc ayant :

| Champ | Valeurs possibles |
|---|---|
| `type` | `'text'`, `'question'`, `'hint'`/`'indication'`, `'reponse'`/`'solution'`/`'answer'` |
| `order` | Entier définissant la position globale |
| `html` | Contenu HTML brut (prioritaire) |
| `latex` | Contenu LaTeX (si pas de `html`) |
| `text` | Texte plain (enveloppé dans `<p>`) |

### Phase 1 — Tri global

```js
const allBlocksSorted = [...content].sort((a, b) => (a.order || 0) - (b.order || 0));
```

Tous les blocs sont triés par `order` avant tout regroupement. C'est l'ordre global qui fait foi, pas l'ordre de stockage.

### Phase 2 — Regroupement séquentiel

L'algorithme parcourt les blocs triés une seule fois en maintenant un `currentGroup` :

```
Pour chaque bloc :

  type === 'question'
    → Ferme le groupe précédent (push)
    → Ouvre un nouveau question-group { question, hints:[], solutions:[], questionIndex }

  type === 'hint' | 'indication'
    → Si currentGroup est un question-group  → ajoute à currentGroup.hints
    → Sinon                                  → crée un bloc standalone-hint indépendant

  type === 'reponse' | 'solution' | 'answer'
    → Si currentGroup est un question-group  → ajoute à currentGroup.solutions
    → Sinon                                  → crée un bloc standalone-solution indépendant

  type === 'text' (ou autre)
    → Ferme le groupe précédent
    → Crée un bloc standalone-text
```

> **Règle clé :** un hint/solution n'est attaché à une question que s'il la suit directement dans le flux trié. Dès qu'un bloc `text` interrompt la séquence, le groupe se ferme.

### Phase 3 — Rendu des blocs organisés

Quatre types de blocs sont produits :

| Type | Rendu |
|---|---|
| `standalone-text` | `<div class="content-block">` + `MathRenderer` |
| `standalone-hint` | `<details>` collapsible natif, `bind:open={showHint}` (état global) |
| `standalone-solution` | `<details>` collapsible natif, `bind:open={showSolution}` (état global) |
| `question-group` | Rendu structuré, voir ci-dessous |

#### Structure d'un `question-group`

```
┌─────────────────────────────────────────────────────┐
│ question-response-pair (border-l-4 brand)           │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ question-block                               │   │
│  │  [badge numéro] [contenu question] [💡] [✅] │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  (si hintStates[i] || showHint)                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ inline-hint (bg-yellow, border-l-4 yellow)   │   │
│  │  <contenu hint>                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  (si solutionStates[i] || showSolution)             │
│  ┌──────────────────────────────────────────────┐   │
│  │ inline-solution (bg-green, border-l-4 green) │   │
│  │  <contenu solution>                          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Hints et solutions s'affichent directement sous la question (pas dans un `<details>`), contrôlés uniquement par les états JS.

---

## Système de toggle à trois niveaux

```
showHint / showSolution  (props bindées depuis le parent)
        │
        │  Propagation : si la valeur change,
        │  TOUS les états locaux et hidden sont réinitialisés
        ▼
hintStates[i] / solutionStates[i]  (état local par question)
hiddenHintStates[i] / hiddenSolutionStates[i]  (masquage individuel explicite)
        │
        │  Toggle individuel via bouton 💡/✅ sur chaque question
        ▼
Condition d'affichage :
  isHintVisible(i)     = (hintStates[i] || showHint) && !hiddenHintStates[i]
  isSolutionVisible(i) = (solutionStates[i] || showSolution) && !hiddenSolutionStates[i]
```

**Comportement du bouton individuel :**

- Si l'item est **visible** et que le global est actif → `hiddenStates[i] = true` (masquage explicite)
- Si l'item est **visible** et que le global est inactif → `states[i] = false` (toggle classique)
- Si l'item est **caché** → `hiddenStates[i] = false` + `states[i] = true` (réouverture)

**Comportement lors d'un changement global :**

- Le changement global réinitialise `hiddenStates` entièrement (les overrides individuels sont effacés)
- La propagation reste unidirectionnelle : global → local, jamais l'inverse

---

## Rendu du contenu HTML

```js
// src/lib/components/ExerciseContent.svelte — processContentBlock()
if (block.html)   → utilise block.html tel quel
if (block.latex)  → utilise block.latex (type forcé 'latex')
if (block.text)   → enveloppe dans <p>block.text</p>
```

Le HTML résultant est passé à `MathRenderer` qui :
1. L'injecte via `{@html content}`
2. Lance KaTeX `auto-render` avec les délimiteurs `$…$`, `$$…$$`, `\(…\)`, `\[…\]`

---

## Pipeline complet

```
content[]
   │
   ▼ tri par order
allBlocksSorted[]
   │
   ▼ algorithme séquentiel (une passe)
organizedContent.blocks[]
   │
   ├─ standalone-text     → MathRenderer direct
   ├─ standalone-hint     → <details> natif + MathRenderer
   ├─ standalone-solution → <details> natif + MathRenderer
   └─ question-group
         ├─ question      → badge numéro + MathRenderer + boutons toggle
         ├─ hints[]       → inline conditionnel + MathRenderer
         └─ solutions[]   → inline conditionnel + MathRenderer
```

---

## Points de vigilance

### 1. `standalone-hint` avec état global partagé

Les `<details>` standalone sont bindés directement sur `showHint`/`showSolution` (l'état global), pas sur un état local indexé. Si plusieurs hints ou solutions standalone coexistent dans un même exercice, ils partagent le même état ouvert/fermé — on ne peut pas en ouvrir un sans ouvrir tous les autres.

### 2. Boutons globaux conditionnels sur `hasIndication`/`hasSolution`

Dans `ExerciseHeader`, les boutons "Voir les indications / solutions" n'apparaissent que si `exercise.hasIndication` ou `exercise.hasSolution` sont truthy. Si ces flags ne sont pas calculés côté serveur/base de données, les boutons globaux sont absents même si le contenu existe.

### 3. Re-render KaTeX potentiellement coûteux

`MathRenderer` relance KaTeX à chaque `afterUpdate`. Ouvrir/fermer une solution déclenche un re-render de tous les `MathRenderer` présents dans le composant parent.
