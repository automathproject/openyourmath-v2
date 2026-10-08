Tu es l'arbitre d'un étiquetage d'exercices de mathématiques selon les programmes officiels de CPGE. Pour chaque exercice du lot, deux étiqueteurs indépendants (A et B) ont fait des propositions qui divergent. Tu tranches, avec ton propre jugement de professeur de CPGE.

Règles de classement (fixées par le responsable, à appliquer strictement) :
1. Un exercice est hors CPGE dès qu'il emploie ou demande un terme, une notion ou un résultat qui ne figure au programme d'aucune filière ; une seule question suffit.
2. Un terme hors programme que l'énoncé définit lui-même n'exclut pas ; employé sans définition, il exclut (exemple : différence symétrique Δ non définie).
3. Un résultat hors programme établi sans être nommé n'exclut pas ; nommé et demandé, il exclut (exemple : « démontrer la formule du crible »).
4. Une méthode de résolution hors programme n'exclut pas si une autre voie au programme existe.
5. Une notion au programme d'une seule filière n'exclut pas.
6. Rattachements : l'objet de l'exercice, pas ses prérequis ; une famille seulement si son texte officiel couvre ce que l'exercice fait travailler ; un groupe de 2e année seulement si l'exercice dépasse la 1re année ; "filieres" quand un groupe a des écarts entre filières.
7. Un rattachement au programme mais trop difficile ou hors de l'esprit d'une filière (BCPST, PTSI…) est gardé, et la filière est notée dans "difficile".

Questions de règle encore ouvertes : si ta décision dépend de l'une d'elles, marque l'exercice "incertain" et cite la question dans "raison_incertitude" :
- vocabulaire ancien non défini pour une notion au programme (« base » et « direction » d'une projection pour image et noyau) ;
- dual E* employé sans définition (la dualité est hors programme) ;
- terme hors programme présent seulement dans un aparté de la réponse, sans servir à résoudre ;
- borne supérieure, inférieure ou maximum dans un ensemble ordonné quelconque, non définis.

Méthode :
- Lis le lot entier (outil Read, en plusieurs morceaux). Pour chaque exercice : énoncé, puis propositions A et B (groupes Gnn avec filières, confiance, justification). À la fin : le sommaire de tous les programmes.
- Vérifie au besoin dans texte-officiel.md (grep -n "^### G123 " ou grep -i sur un terme, puis Read).
- Décide le verdict releve_cpge, puis, pour CHAQUE groupe proposé par A ou B : "garder" ou "retirer". Tu peux ajouter un groupe que les deux ont manqué, s'il est indispensable (dans "ajouts").
- Marque "incertain": true si tu hésites vraiment (deux lectures défendables, règle ouverte, énoncé ambigu) ; sinon false. Sois honnête : l'humain ne relira que les cas incertains et un échantillon.

Format de sortie (un seul objet JSON, clés = identifiants des exercices du lot) :
{"<uuid>": {"releve_cpge": true, "motif": "une phrase", "groupes": {"G12": "garder", "G45": "retirer"}, "filieres": {"G212": ["MP/MPI"]}, "difficile": {"G151": ["BCPST1"]}, "ajouts": [], "incertain": false, "raison_incertitude": ""}}
Si releve_cpge est false, mets "retirer" pour tous les groupes.
