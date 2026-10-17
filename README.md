# Miroir RTL — version arabe d'une mise en page, script Adobe Illustrator

**MiroirRTL.jsx** fabrique en un clic la **version de droite à gauche** (arabe, hébreu, persan, ourdou) d'une mise en page faite en français ou en anglais : affiche, flyer, menu, carte de visite, écran d'application, emballage, signalétique bilingue.

Il inverse **la mise en page, pas les objets**. Chaque bloc va à sa place symétrique sur le plan de travail mais **reste lisible** :

- textes réalignés (gauche ↔ droite, retraits inversés) ;
- logos, photos, illustrations, codes QR et codes-barres gardés à l'endroit ;
- groupes « composants » (puce + texte, bouton, carte) réordonnés de l'intérieur ;
- seuls les **pictos directionnels** (flèches, chevrons, triangles « suivant ») retournés.

> ⚠️ **Non testé dans Illustrator.** Le code a été vérifié (syntaxe ES3/ES5) et testé sous Node.js, sur des données et sur un DOM Illustrator simulés (voir « Tests »). Travaillez sur une copie de votre fichier.

## Le problème

Faire la version arabe d'une maquette française, c'est :

- refaire toute la mise en page en miroir à la main ;
- ne surtout pas utiliser Objet > Transformation > Symétrie : elle retourne aussi les lettres, les logos et les photos ;
- retourner les flèches une par une ;
- repasser chaque texte en alignement à droite.

Les solutions trouvées en ligne n'inversent que les positions de tous les objets autour du centre du plan de travail : les blocs bougent, mais les textes restent alignés à gauche, l'intérieur des groupes ne change pas et les flèches pointent toujours dans le mauvais sens.

Dans Figma, ce travail est automatisé par au moins sept plug-ins (RTL Layout, Lingolense, RTLAuto à 99 $/an, RTL Mirror & Translate, RTeller, Aura RTL, RTL Master…). **Dans Illustrator, aucun outil ne le fait.**

## Ce que fait le script

1. **Copie miroir (par défaut)** : un nouveau plan de travail « *nom* RTL » est créé à droite de tous les autres, ou en dessous s'il n'y a plus de place sur la table de montage. Le contenu y est dupliqué puis inversé, et **l'original reste intact**. Vous pouvez aussi choisir « Modifier sur place ».
2. **Blocs à leur place symétrique** : chaque bloc est déplacé, sans être retourné, pour que son bord gauche prenne la place de son bord droit. Le fond, les bandeaux et les cadres restent cohérents.
3. **Textes** (point et captif) :
   - alignement gauche ↔ droite, y compris « justifié, dernière ligne à gauche/droite » ; le centré et le justifié ne changent pas ;
   - retraits gauche/droite échangés ;
   - un texte incliné de θ passe à −θ (option) ;
   - un texte de point garde exactement sa hauteur, même tourné ;
   - en option, les paragraphes passent en direction RTL (version « Moyen-Orient » d'Illustrator).
4. **Groupes qui contiennent du texte** (puce + libellé, bouton, carte produit, ligne de tableau) : le script les **ouvre** et réordonne leur intérieur. La puce passe à droite du texte, la flèche d'un bouton passe à gauche du libellé.
5. **Objets gardés à l'endroit** :
   - les groupes sans texte vivant (logos, illustrations, icônes) restent des blocs rigides ;
   - les images liées ou incorporées ne sont **jamais** retournées ;
   - les formes non groupées qui se touchent (logo vectorisé non groupé, mot vectorisé) restent **ensemble**, avec une tolérance en pt. Un fond ou un cadre qui contient d'autres objets ne les « colle » pas, pas plus qu'un bandeau pleine largeur ;
   - les noms contenant *logo, marque, brand, شعار, qr, barcode, code-barre, photo, signature, carte…* (liste modifiable) gardent le bloc rigide, même s'il contient du texte vivant.
6. **Pictos directionnels retournés**, reconnus de deux façons :
   - **par leur nom** (calque, objet ou symbole) : *arrow, flèche, chevron, caret, next, prev, back, suivant, précédent, retour, سهم, التالي, السابق, →, ›…* (liste modifiable ; « back » ne déclenche pas sur « background ») ;
   - **par leur forme** : le dessin est symétrique par rapport à un axe horizontal ou diagonal mais pas par rapport à l'axe vertical, c'est-à-dire qu'il « pointe » à gauche, à droite ou en diagonale. → ↗ › ▶ et une flèche dans un rond sont retournés ; ↑ ⌂ ○ □ ★ ne le sont pas. Seuls les objets de moins de 20 % du plan de travail sont analysés (réglable).
7. **Liste de vérification** avant d'appliquer : chaque picto proposé est coché (☑) avec sa raison (nom, forme ou balise) et sa taille. Sélectionnez des lignes et cliquez sur « Ne pas retourner » ou « Retourner » (le double-clic inverse aussi). La liste donne aussi le nombre de textes, de blocs et de groupes réordonnés.
8. **Chevauchements créés signalés** : un bloc rigide en forme de L est déplacé sans être retourné, et peut donc venir toucher un voisin. Le script repère les objets qui se touchent *après* le miroir mais pas *avant*, et les nomme dans la vérification et dans le rapport. Ils sont signalés, pas corrigés.
9. **Rapport final** : blocs déplacés, textes réalignés, pictos retournés, objets et calques ignorés, chevauchements à vérifier.

### Balises (dans le nom, panneau Calques)

| Balise | Effet |
|---|---|
| `#fixe` (`#keep`) | bloc rigide : déplacé, jamais retourné ni réordonné |
| `#miroir` (`#flip`) | toujours retourné (bulle de BD, main qui pointe…) |
| `#reste` (`#stay`) | ne bouge pas (élément centré ou repère imposé) |

### Portées

- **Plan de travail actif** (par défaut) : les objets dont le centre est sur le plan de travail.
- **Tous les plans de travail** : chacun est inversé autour de son propre axe et, en mode copie, toute la planche est recopiée avec le même décalage.
- **Sélection** : en copie, elle est placée à droite de la sélection. Sur place, l'axe est au choix le centre du plan de travail ou le centre de la sélection (pour inverser un composant sans le déplacer).

### Garde-fous

- Les calques **masqués ou verrouillés** sont ignorés et nommés dans le rapport.
- Sur place, les objets **verrouillés** sont ignorés. En mode copie, leurs copies sont déverrouillées le temps du déplacement puis reverrouillées.
- Les **textes chaînés** : l'alignement est inversé une seule fois, par le premier cadre, et chaque cadre change de place.
- Les **textes curvilignes et verticaux** sont déplacés sans être réalignés (signalé).
- Un **groupe masqué** (masque d'écrêtage) qui contient du texte est ouvert. Sa boîte est celle du masque, pas celle du contenu caché.
- Pas d'objet, rien de sélectionné ou aucun document ouvert : un message explicite s'affiche et rien n'est modifié.
- Les réglages sont mémorisés dans un petit fichier texte local (`MiroirRTL_settings.txt` dans le dossier des données utilisateur). Il n'y a **aucun appel réseau ni aucune collecte de données**.
- Le dialogue est en français ou en anglais selon la langue d'Illustrator.

### Limites (v1.0.0)

- **La détection par la forme se trompe parfois** : un logo *non nommé* symétrique haut/bas (par exemple un carré et un losange alignés), un « E » vectorisé isolé, une loupe ou un bouton lecture ▶ sont proposés au retournement. C'est pour cela que la liste de vérification est affichée par défaut : décochez-les, nommez le groupe « logo » ou ajoutez `#fixe`.
- Les flèches dessinées par un **contour avec pointe de flèche** (options de contour) sont reconnues par leur nom seulement, car les pointes ne sont pas lisibles par script. Elles sont bien retournées si elles sont reconnues ou marquées `#miroir`.
- Par la forme, seules les flèches horizontales (→ ←) et à 45° (↗ ↘ ↙ ↖) sont reconnues ; une flèche inclinée à 20° ou 70° doit être nommée ou marquée `#miroir`. Les flèches verticales (↑ ↓) ne sont jamais retournées.
- Les symboles sont reconnus **par leur nom** (le dessin d'un symbole n'est pas analysé).
- Les objets rigides inclinés (photo tournée de 5°) gardent leur angle. Seuls les textes passent à −θ.
- Les dégradés et motifs d'une forme suivent la forme ; ils ne sont pas inversés.
- Le texte n'est **pas traduit** : vous remplacez ensuite le français par l'arabe dans des cadres déjà alignés à droite et placés en miroir.
- L'analyse de forme est limitée à 200 objets par plan de travail (au-delà, seuls les noms comptent).
- Illustrator annule normalement un script en une seule fois (Ctrl/Cmd+Z), mais cela n'a pas été vérifié ici : travaillez sur une copie.

## Installation

1. Téléchargez `MiroirRTL.jsx`.
2. Choisissez l'une de ces deux méthodes :
   - **Sans installation** : Fichier > Scripts > Autre script… (Ctrl+F12 / Cmd+F12), puis choisissez le fichier.
   - **Dans le menu** : copiez le fichier dans le dossier des scripts d'Illustrator, puis redémarrez Illustrator. Le script apparaît dans Fichier > Scripts.
     - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts\`
     - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts/`

Remplacez `fr_FR` par le dossier de langue de votre installation (`en_US`, `ar_AE`, `en_AE`…).

## Utilisation

1. Ouvrez la maquette (de préférence une copie), activez le plan de travail à inverser ou sélectionnez des objets.
2. Fichier > Scripts > MiroirRTL.
3. Choisissez la portée et le résultat (copie miroir conseillée), puis les options de textes, de pictos et de blocs.
4. Vérifiez la liste des pictos à retourner, décochez les faux positifs, puis cliquez sur **Appliquer**.
5. Lisez le rapport, vérifiez les chevauchements signalés, puis remplacez les textes par leur traduction arabe.

**Conseils** :
- groupez (Ctrl+G) les logos et dessins, et nommez les flèches ;
- groupez chaque « composant » qui contient du texte (puce + libellé, bouton) : son intérieur sera réordonné ;
- un composant qui ne doit pas être réordonné reçoit `#fixe`.

## Version ciblée

Illustrator CC 2018 à 2026 (ExtendScript, ES3 strict : ni `let`/`const`, ni fonctions fléchées, ni JSON natif, ni `Array.prototype.forEach`/`indexOf`), Windows et macOS.

**Statut : non testé dans Illustrator.**

## Pourquoi c'est nouveau

Voici ce qui a été vérifié le 17 octobre 2026.

- **Illustrator natif** : Objet > Transformation > Symétrie, outil Miroir et « Transformation individuelle » retournent la géométrie, y compris les lettres. Rien dans les nouveautés 2026 (plans de travail : noms, couleurs, verrouillage, duplication), et pas de mode « mise en page RTL ».
- **Adobe Community** : les fils « Flip / Mirror / Reflect whole Artboard » et « Is it possible to flip/reflect the entire canvas? » proposent un court script qui inverse les positions de tous les objets autour du centre du plan de travail (`resize(-100, 100)` autour de l'origine). Les textes et les photos y sont *retournés*, il n'y a ni réalignement, ni ouverture des composants, ni tri flèches/logos.
- **Graphic Design Stack Exchange** : « How to mirror/flip the whole artboards in Illustrator document at once? » renvoie à l'outil Miroir avec origine au centre, à Transformation individuelle ou à PitStop Pro dans Acrobat. Toutes ces solutions retournent le contenu.
- **Figma** : RTL Layout, Lingolense, RTLAuto (99 $/an), RTL Mirror & Translate, RTeller, Aura RTL et RTL Master font exactement ce travail (mise en page en miroir, flèches retournées, logos gardés, texte à droite), mais **seulement dans Figma** (ou Pixso/Penpot). Le guide comparatif de Smartling indique que l'inversion RTL n'est automatique que pour InDesign *dans leur flux de traduction*, pas pour Illustrator.
- **GitHub** : 0 dépôt pour « illustrator rtl mirror », « illustrator rtl layout », « illustrator mirror layout », « illustrator flip layout arabic » et « jsx rtl mirror ». La recherche de code `RIGHT_TO_LEFT_DIRECTION` + `artboardRect` ne renvoie rien.
- **Catalogues de scripts** :
  - creold : MirrorMove répète un déplacement en miroir, SwapObjects échange deux objets ;
  - Alexander Ladygin, John Wundes, Josh Duncan, wckdtall, Kelso Cartography, shspage, sttk3, Vexy : rien de tel.
- **Outils RTL pour Illustrator** : RTL Fixer (texte arabe à coller) et les réglages Moyen-Orient d'Illustrator (direction de paragraphe) traitent le texte, pas la mise en page.

## Tests

Les tests ont été lancés sous Node.js 20 (`node tests/test-core.js` puis `node tests/test-mock.js`).

- **Syntaxe** : analyse acorn en ECMAScript 3 et en ECMAScript 5 sans erreur.
- **Moteur pur** (136 vérifications) :
  - boîtes, balises et mots-clés (accents, pluriels, « back » ≠ « background », arabe, symboles) ;
  - alignements et matrices, réglages enregistrés et relus ;
  - reconnaissance des formes : flèches dans les 6 orientations, flèches en deux tracés, flèche dans un rond, chevron ouvert, parenthèse en Bézier. Sur **300 flèches aux proportions aléatoires**, 299 sont reconnues. Sur **600 polygones aléatoires**, aucun faux positif. Les 200 flèches verticales ne sont jamais retournées. Les cercles, rectangles, étoile, maison, cœur et « F » ne sont pas retournés. Le calcul paresseux a été comparé au calcul complet sur toutes ces formes ;
  - regroupement : balayage comparé à la force brute sur 60 jeux aléatoires, contenant et bandeau sans lien ;
  - plan de décision sur une affiche type ;
  - **400 mises en page aléatoires** : chaque bloc arrive à sa place symétrique sans déformation, l'ordre gauche/droite s'inverse et les écarts internes sont conservés. Deux passages donnent l'original sauf quand un chevauchement a été créé, et chaque cas de ce type (11) a été signalé.
- **DOM Illustrator simulé** (63 vérifications) :
  - affiche complète en copie : nouveau plan de travail, originaux intacts, texte de point dont l'ancre passe au bord droit, texte captif (3 paragraphes, retraits), puce et libellé, flèche reflétée exactement, flèche verticale, photo, lettres collées, logo à texte vivant, `#reste`, objet verrouillé, texte incliné, symbole nommé ;
  - mode sur place appliqué deux fois = document d'origine ;
  - tous les plans de travail, avec repli dessous quand la table de montage est pleine, et message quand il n'y a plus de place ;
  - sélection (bouton : la flèche passe à gauche et pointe à gauche), avec les deux axes ;
  - messages (aucun document, rien de sélectionné, plan vide, anglais) ;
  - convention de signe de matrice inversée ;
  - textes chaînés, groupe masqué, annulation à la vérification, picto décoché ;
  - options désactivées, direction RTL, chevauchement en L signalé ;
  - **120 documents aléatoires** inversés deux fois = identiques ;
  - dialogues ScriptUI simulés (réglages → vérification → rapport, Annuler, portée Sélection sans sélection).
- **Mutations volontaires** : 12 erreurs introduites exprès dans le code (axe, correction verticale, auto-vérification de l'angle, retraits, contenants, bandeaux, seuils de forme, verrouillés, chaînés, décalage de copie, frontières de mots-clés, groupes « logo »). Toutes sont détectées par les tests.

**Non testé dans Illustrator** : le comportement réel de `duplicate`, `resize(-100, 100)`, `rotate`, `paragraphAttributes`, `paragraphDirection`, des dialogues ScriptUI et de l'annulation en une fois n'a pas pu être vérifié.

## Licence

MIT © 2026 Amirouche Amwanes, voir [LICENSE](LICENSE). Le code est entièrement original.
