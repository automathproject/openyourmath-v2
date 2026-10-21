Tu vérifies des problèmes de contenu signalés par des étiqueteurs automatiques dans des exercices de mathématiques (sources LaTeX du dépôt exobase). Les signalements peuvent être faux : ton travail est de les confirmer ou de les infirmer en lisant la source.

Dépôt (lecture seule, ne modifie rien) : /home/maxime/Documents/COET/git/plateformes/exobase
Chaque point de ton lot donne le signalement et le chemin du ou des fichiers .tex. Si le signalement cite un autre identifiant (4 caractères), trouve son fichier avec : find /home/maxime/Documents/COET/git/plateformes/exobase/content/exercises -name 'XXXX.tex'

Pour chaque point :
1. Lis le fichier .tex entier (et l'autre exercice cité, le cas échéant).
2. Vérifie le signalement. Pour une réponse déclarée fausse, refais le calcul toi-même, explicitement, et teste sur des petites valeurs (tu peux utiliser node -e pour calculer). Pour une coquille, cite le texte exact de la source.
3. Décide :
   - "confirmé" : le problème existe bien dans la source ;
   - "infirmé" : la source est correcte, ou le problème est négligeable ;
   - "incertain" : tu ne peux pas trancher.
4. Range-le dans une section :
   - "Réponses fausses" : résultat faux dans une réponse, correction ou indication ;
   - "Énoncés à revoir" : énoncé faux, incomplet, ambigu, corrompu, mal découpé ;
   - "Coquilles" : faute de frappe ou d'indice sans conséquence sur le sens mathématique ;
   - "Doublons" : seulement si deux exercices sont le même exercice (même énoncé, à la rédaction près). Un simple recoupement (une question commune, un résultat voisin) est "infirmé" ;
   - "Non retenu" pour les infirmés.
5. Rédige "texte" pour le ticket, en français, sobre et précis, une à trois phrases, LaTeX entre $...$ : où est le problème (question, ligne), ce qui est écrit, ce qui est juste. Pour une réponse fausse, donne la valeur correcte.

Écris dans le fichier de sortie indiqué un tableau JSON, un objet par point du lot, dans l'ordre :
[{"ids": ["PST8"], "chemins": ["content/exercises/exo7/1-L1/PST8.tex"], "verdict": "confirmé", "section": "Énoncés à revoir", "texte": "...", "verification": "ce que tu as lu et calculé, en deux phrases"}]
Vérifie ensuite que le fichier est un JSON valide avec autant d'objets que de points (lignes « - ») dans ton lot : node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' <fichier>

Ne lis que ton lot, cette consigne et les fichiers .tex concernés. À la fin, réponds en trois lignes : nombre de points, confirmés, infirmés ou incertains (identifiants).
