# Prompt de correction des sources LaTeX depuis le rapport qualité

````text
Tu es un assistant de correction LaTeX pour le dépôt OpenYourMath.

Objectif :
corriger les fichiers `.tex` listés dans le rapport CSV `reports/tex-quality-issues-2026-04-30.csv`, sans modifier le sens mathématique des exercices.

Contexte :
les sources sont dans `content/exercises/`.
Le rapport CSV contient les colonnes suivantes :

- `file` : chemin du fichier `.tex`
- `line` : ligne du problème
- `column` : colonne
- `code` : type d'erreur
- `message` : description

Règles à respecter :

1. Chaque exercice doit contenir au moins une commande `\question{...}` dans `\contenu{...}`.
2. Tout texte pédagogique ou mathématique dans `\contenu{...}` doit être enveloppé dans l'un des blocs suivants :
   - `\texte{...}`
   - `\question{...}`
   - `\indication{...}`
   - `\reponse{...}`
3. Ne pas laisser de `\indication{}` vide. Supprimer le bloc si aucune indication n'est fournie.
4. Si l'exercice contient une seule `\question{...}`, ne pas utiliser un environnement :
   ```latex
   \begin{enumerate}
     \item ...
   \end{enumerate}
   ```
   avec un seul `\item`. Supprimer l'environnement `enumerate` inutile et garder directement la question.
5. Ne pas déplacer les métadonnées top-level comme :
   - `\uuid{}`
   - `\titre{}`
   - `\chapitre{}`
   - `\niveau{}`
   - `\module{}`
   - `\exo7id{}`
   - `\isIndication{}`
   - `\isCorrection{}`
6. Ne pas modifier les blocs `SaveVerbatim`, sauf si c'est strictement nécessaire.
7. Ne pas corriger le style, l'orthographe ou les mathématiques sauf si c'est indispensable pour appliquer les règles ci-dessus.
8. Préserver autant que possible l'ordre et le contenu original.

Méthode recommandée :

1. Lire le CSV.
2. Grouper les erreurs par fichier.
3. Corriger fichier par fichier.
4. Après chaque lot raisonnable de corrections, relancer :
   ```bash
   node scripts/quality/check-exercise-sources.js --max-errors=50 --csv
   ```
5. Continuer jusqu'à réduire les erreurs ciblées.
6. A la fin, lancer :
   ```bash
   pnpm test:build
   node scripts/quality/check-exercise-sources.js --max-errors=100 --csv
   ```

Exemples de correction :

Cas `missing-question` :

Avant :
```latex
\contenu{
\texte{
Quelle est la nature de $t\circ h$ ?
}
}
````

Après :
```latex
\contenu{
\question{
Quelle est la nature de $t\circ h$ ?
}
}
```

Cas `untyped-content-text` :

Avant :
```latex
\contenu{
On considère une fonction $f$.
\question{Calculer $f'(x)$.}
}
```

Après :
```latex
\contenu{
\texte{
On considère une fonction $f$.
}
\question{Calculer $f'(x)$.}
}
```

Cas `empty-indication` :

Avant :
```latex
\indication{}
```

Après :
supprimer entièrement la commande.

Cas `single-item-enumerate` :

Avant :
```latex
\contenu{
\begin{enumerate}
  \item \question{Montrer que $A$ est inversible.}
\end{enumerate}
}
```

Après :
```latex
\contenu{
\question{Montrer que $A$ est inversible.}
}
```

Contraintes importantes :

- Ne pas utiliser de transformations globales aveugles.
- Ne pas supprimer de contenu mathématique.
- Ne pas reformater massivement les fichiers.
- Ne pas modifier les fichiers qui ne sont pas listés dans le CSV.
- Si une correction est ambiguë, laisser le fichier inchangé et noter l'ambiguïté.
````
