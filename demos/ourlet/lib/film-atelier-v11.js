// Ourlet · le film des quatre postes (v11 : la ligne de thermolaquage). La pièce fil rouge, la jardinière
// 8800-J, traverse la découpe, le pliage, la soudure et la peinture, en un plan-séquence calculé en code, gravé en trame
// de lignes. Tout est une fonction du temps : seek(t) donne toujours la même image.
//
// v9, étapes A et B (2026-10-10) :
// - un bras articulé de référence (bras-v9.js : robot six axes, cinématique inverse analytique, déplacements articulaires
//   et linéaires, profils en S) et un moteur qui sait tourner des solides (trace-gl-v9.js) ;
// - la découpe sur un vrai portique. Références : les machines de découpe laser à plat à portique mobile (« optique
//   volante ») : une poutre enjambe le petit côté de la table et court sur deux rails, un chariot court le long de la
//   poutre et porte le coulisseau vertical de la tête ; chaînes porte-câbles sur la poutre et le long d'un rail ; la tête
//   se lève en arc pendant les déplacements à vide entre deux contours (saut de tête), descend au perçage, remonte et va
//   se garer en fin de programme, du côté opposé à la sortie des pièces ;
// - la soudure dans une cellule robotisée. Références : les cellules de soudage à l'arc à plateau tournant (positionneur
//   à axe vertical) servies par deux robots six axes ; torches MIG à col de cygne ; l'angle extérieur d'une tôle de 2 mm
//   se soude en descendante, torche dans le secteur des deux faces, de plus en plus inclinée vers le bas du cordon pour
//   dégager la table ; approche, cordon et dégagement en ligne droite, déplacements en articulaire ; chaque robot revient
//   à sa pose de repos, bras replié, par son propre chemin ;
// - la caméra suit le travail : elle s'attarde sur un poste pendant qu'il travaille (une dérive lente), accompagne la
//   pièce d'un poste au suivant, et roule à la vitesse de la chaîne de peinture. Sa trajectoire est une ligne brisée
//   (où regarder, quand) lissée trois fois : position, vitesse et accélération continues, périodique sur le cycle. Le plan
//   de l'atelier est fixe (les postes sont où des bras peuvent se passer la pièce), il ne découle plus de la caméra ;
// - arêtes : celle de la matrice ne transparaît plus à travers la tôle (arêtes couchées dans le plan de leur face) ; le
//   tracé de coupe et les cordons passent dans le moteur (ils sont cachés par ce qui passe devant eux).
// v9, étapes C, D, E : un robot de manutention sur un rail au sol (septième axe) porte la pièce du laser au convoyeur,
// préhenseur à ventouses ; la jardinière sort du four, un palettiseur la pose sur la palette de la commande.
//
// v11 (2026-10-10), la peinture refaite comme une vraie ligne de thermolaquage, la seule couleur du film :
// - un convoyeur aérien : un rail profilé suspendu à la charpente, des chariots à galets au pas de la chaîne, une
//   balancelle (deux crochets à traverse) par cycle, à vitesse constante. Le rail descend du fond de l'atelier, longe la
//   ligne, remonte. Le robot de manutention amène la jardinière à côté de la balancelle, à sa vitesse, la glisse entre
//   les deux crochets, la pose, sort son préhenseur ; elle se balance d'un rien (un pendule amorti). Elle reste suspendue
//   dans la cabine, dans le four, jusqu'à ce que le palettiseur la décroche à la volée. Plus de convoyeur à rouleaux ;
// - la cabine de poudrage en écorché (caillebotis de la récupération, paroi du fond fendue pour les pistolets, ceinture
//   haute et fente du convoyeur au plafond), deux élévateurs à chariot en opposition de phase, pistolets à lance, tuyaux,
//   centrale à poudre ; quatre cônes de grains fins, pris dans la profondeur de la scène, qui enveloppent les arêtes ;
// - trois états de la matière : la tôle brute, claire ; la poudre, mate, qui se dépose grain à grain selon l'exposition
//   cumulée aux pistolets (moins au fond des creux) ; la peinture cuite, anthracite profond, liseré clair et reflet
//   satiné, encore chaude à la sortie du four ;
// - le four tunnel, à distance de la cabine (le poudrage est fini avant d'entrer) : sas d'entrée et de sortie, bouche à
//   la silhouette de la pièce, fente du convoyeur au toit, lueur chaude à l'intérieur ; la même jardinière en ressort
//   (plus de pièce en attente dans le four : la chaîne ne s'arrête pas) ;
// - le palettiseur est devant la ligne, replié quand il ne travaille pas ; la palette de la commande devant lui ;
// - la caméra accompagne la pièce suspendue à la vitesse de la chaîne, de l'accrochage au décrochage ;
// - le robot de manutention rentre au laser à 1,4 m/s en palier (il filait à 2,3 m/s).
//
// v10 (2026-10-10), dernière passe :
// - cadrage des bras : chacun est dans le cadre, replié et lisible, ou dehors. Le robot de manutention pose la pièce par
//   l'amont et quitte le champ avant que les pistolets ne soufflent ; chaque fois qu'il attend ou roule à vide (au laser,
//   pendant la soudure, en repartant du convoyeur) il se replie dans une pose de repos articulaire : bras relevé,
//   avant-bras rabattu, préhenseur bas devant lui, au-dessus de son rail (références : la pose de repli des robots de
//   manutention sur axe linéaire, qui roulent bras rentré dans le gabarit du chariot). Le repli se fait en deux temps qui
//   se recouvrent : la tourelle tourne, puis le bras se replie ; au retour le bras se déplie, puis la tourelle le ramène.
//   Il ne bouge plus pendant les deux passes : les torches attendent qu'il soit rangé, il ne revient qu'au bout du
//   second cordon. Les robots de soudure n'entrent dans le cadre qu'avec le panoramique ;
// - jeux : toutes les distances minimales du cycle calculées sur les volumes dessinés, 20 mm au moins hors des contacts
//   de travail (poinçons amincis en col de cygne, la pièce est posée et immobile avant que le poinçon ne descende entre
//   ses parois, et il en ressort avant qu'elle ne reparte) ;
// - la fin : la commande sur une vraie palette à dés (plateau, traverses, neuf dés, semelles), au premier plan ; la caméra descend un peu pour la
//   cadrer ; le palettiseur attend bas, bras tendu au-dessus du convoyeur de sortie. Références : les cellules de
//   palettisation en bout de ligne et les navettes de transfert de palettes sur rails au sol : la commande complète part
//   sur sa navette quand la caméra repart vers le laser ;
// - le four : un auvent court à la sortie (références : les hottes d'extrémité des fours tunnel), la jardinière en sort
//   par-dessous ; faisceaux de câbles des préhenseurs (sur l'avant-bras, en boucle par-dessus le poignet) ; ombre de
//   contact des pièces posées (plateau, convoyeur, palette) ; contour fin des socles au sol ;
// - lumières : l'arc et le point chaud du laser s'allument et s'éteignent en quelques images ; une étincelle part de
//   l'endroit où elle est née, refroidit en vol (du clair à l'ambre) et finit sa course après l'extinction ; les petits
//   trous sont tracés pleins (ils papillotaient entre point et anneau) ;
// - caméra : lissage porté à 900 ms (à-coup maximal de 1 215 à 848 mm/s³), tenue de fin de 2 s sous 60 mm/s ;
// - repli sans WebGL2 : ordre du peintre objet par objet (profondeur de chaque solide), plis en trait mixte.
//
// v7, la peinture comme une vraie ligne de poudrage automatique (références : les cabines de poudrage à élévateurs des
// lignes de thermolaquage industrielles, pistolets corona sur réciprocateurs, détection de pièce qui déclenche la
// pulvérisation ; l'enveloppement électrostatique, qui fait passer la poudre derrière les bords ; l'effet de cage de
// Faraday, qui poudre moins les faces intérieures ; le four tunnel à lanières).
//
// Références étudiées : les films produit de Teenage Engineering (économie de moyens, un rythme réglé sur l'objet) ; les
// vues des notices techniques (un objet, son outil, rien d'autre) ; les vidéos de procédé des fabricants de machines, pour
// la justesse des gestes seulement (aucun nom dans la page) ; la photogravure en trame de lignes ; pour la facture, les
// rendus « dessin au trait » des films de marque (trame attachée à la matière, flou de bougé, arêtes vues).
//
// Les gestes : découpe, les trous d'abord, le contour en dernier, à vitesse de coupe avec mise en vitesse et ralenti dans les
// angles ; le squelette reste sur la palette ; pliage, dans l'ordre de la gamme, retour élastique (92° sous charge, 90° quand le
// poinçon remonte), butées au contact puis reculées ; soudure, deux passes, des écailles bombées vers le départ du cordon ;
// peinture, une poudre qui enveloppe les bords. Tout départ se fait à vitesse nulle, toute arrivée aussi, sauf l'accrochage à
// la chaîne qui se fait à la vitesse de la chaîne. Durées et courbes : MOTION, plus les valeurs nouvelles réunies dans V9.
// Aucun texte n'est peint dans le canvas : la ligne de valeurs est du HTML (onValeurs).
import { fold, mesh, render, camera, makePart } from './part.js';
import { jardiniere } from './pieces.js';
import { createGravure, tonPack } from './gravure.js';
import { createTrace } from './trace-gl-v11.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';
import { P as TOK, ILLU } from '../tokens/tokens-v2.js';
import { clamp, lerp, add, sub, mulS, dot, cross, norm, newell, app3, mul3, rotY, rotZ, quad, box, prismX, cyl, moved, tramer, faceGL } from './solides-v11.js';
import { creerBras, programme, S5, trapeze, melange } from './bras-v11.js';

const seg = (t, a, b) => (b > a ? clamp((t - a) / (b - a)) : t >= b ? 1 : 0);
const wrapA = (d) => ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const lisse = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const REF = 0.36; // px CSS par mm dans le cadrage de référence (1 440 px) : convertit les vitesses d'écran des tokens
const vmm = (pxs) => pxs / REF / 1000; // px/s → mm/ms
const PR = MOTION.presse;
// chaine : la vitesse de la chaîne de peinture (le jeton MOTION.camera.travelling : la caméra la suit pièce au centre)
const V = { coupe: vmm(MOTION.laser.coupe.v), vide: vmm(MOTION.laser.vide.v), transfert: vmm(MOTION.convoyeur.v), chaine: vmm(MOTION.camera.travelling) };

// ---------- Valeurs nouvelles de la v9, à verser dans les tokens (MOTION) ----------
const V9 = {
  // caméra : largeur (ms) de chacun des trois lissages de sa trajectoire ; pour chaque poste, où regarde la caméra par
  // rapport au poste (mm) à l'arrivée de la pièce puis à son départ (une dérive lente entre les deux) ; arrive : l'instant
  // du cycle où elle a fini de venir de la palette de la commande au laser ; haut : la ligne d'horizon du cadre (part de sa hauteur)
  camera: { lissage: 900, tenue: 800, arrive: 3600, laser: [0, 400, 480], presse: [60, 220], presseB: [-80, 80], soudure: [300, 450], palette: [340, 420], plonge: 340, haut: 0.53 },
  // laser : accélération des déplacements à vide (3 g), saut de tête entre deux contours, hauteur de garage (mm) ; le portique
  // quitte son garage `prepare` ms avant le début du cycle et se pose `pose` ms avant le premier perçage
  // allume, eteint (ms) : le point chaud monte au perçage et s'éteint à la fin d'un contour (jamais d'une image à l'autre)
  laser: { accVide: 0.0294, saut: 34, garage: 120, prepare: 900, pose: 100, allume: 40, eteint: 70 },
  // l'arc de soudure : amorçage et extinction (ms)
  arc: { allume: 50, eteint: 90 },
  // presse : ouverture (mm : le poinçon ouvert laisse passer une paroi de 300 mm levée de 60 mm) ; avance (ms) : le tablier
  // commence à descendre pendant que le robot finit de poser la pièce (approche plus longue, donc plus douce)
  // glisse : la pièce est présentée en retrait de la matrice, puis glissée contre les butées (mm)
  // mi : le retour vif du poinçon (jeton retour) s'arrête à cette hauteur, puis il finit de s'ouvrir doucement (fin, ms)
  presse: { ouverture: 400, avance: 320, mi: 240, fin: 300, glisse: 110 },
  // soudure : approche et dégagement de la torche (ms), demi-tour du plateau (ms), retrait de la torche avant l'approche et
  // après le cordon (mm), inclinaison de la torche en haut puis en bas du cordon, retour au repos (ms), délai entre le
  // lâcher de la pièce et l'approche (ms), écailles par cordon, pied des robots (de part et d'autre, derrière le plateau),
  // direction d'approche de la torche
  soudure: { approche: 280, degage: 320, tour: 1150, pret: 190, recul: 210, pente: [0.3, 0.62], retour: 820, attente: 600, ecailles: 10, pied: [860, 380], vers: [0.95, 0.05] },
  // manutention (le robot sur rail) : le rail (y), la hauteur de son chariot ; durées (ms) : délai avant de bouger, venue
  // au-dessus du flan, descente, prise des ventouses, du laser à la presse, retournement sur place, d'un poste de la presse
  // à l'autre, de la presse au plateau, du plateau au convoyeur, accompagnement sur le convoyeur ; attente au laser (pointe
  // de l'outil par rapport au centre de la palette) ; côté : distance du chariot à la pièce le long du rail (au laser et au
  // poste A, au poste B, en attente à la soudure, au convoyeur, en attente au laser ; v11 : à l'accrochage il est en amont de la pièce) ; son écart le long du rail et sa descente pendant la soudure ; hauteurs (mm) : pièce
  // levée pour être retournée, flan porté, jardinière portée, préhenseur sorti de la pièce ; retour : instant du cycle où
  // le robot est revenu attendre au laser ; palette : instant où le changeur amène une tôle neuve (hors du cadre)
  // v10 : repos (degrés) : la pose de repli, six angles ; range : début et fin du repli après le lâcher au plateau (ms) ;
  // reprend : du bout du second cordon à la reprise de la pièce ; revient : début et fin du dépli avant la reprise ;
  // avance : il s'avance vers le flan avant la fin de la coupe ; deplie : début (avant) et fin (après) du dépli au laser ;
  // plie : début et fin du repli après le lâcher au convoyeur ; recouvre : part du geste prise par chacun de ses deux temps
  manutention: { rail: -950, chariot: 70, depart: 120, arrive: 650, descend: 320, ventouse: 160, versPresse: 2400, retourne: 1450, entrePostes: 2150, versSoudure: 2150, versChaine: 2200, tient: 120,
    attente: [700, -830, 450], cote: [650, 750, 226, -420, 560], ecart: 774, devant: -82, baisse: -307, avance: 400, deplie: [300, 600], plie: [800, 2600], recouvre: 0.72, range: [230, 1180], reprend: 810, revient: [1350, 420], repos: [120, 60, -145, 0, 35, 90], leve: 60, porteFlan: 140, porte: 120, haut: 600, retour: 2600, palette: 15000 },
  // la palette de la commande : hauteur, demi-entraxes des quatre places ; durées (ms) : respiration sur la commande
  // complète avant la fin du cycle (degage, tenue), de la prise à la pose ; porteZ : hauteur de la pièce portée ;
  // instant où la commande est enlevée (hors du cadre) ; départ de sa navette (part, course). Sa place : V11.palette
  palette: { h: 170, pas: [430, 165], degage: 900, tenue: 1250, porte: 1600, porteZ: 200, enleve: 14000, part: [300, 4700], course: 2800 },
  robot: { k: 0.86, manip: 1.4, palettiseur: 1.1 },
  // ombre de contact d'une pièce posée : deux traits [largeur en px, opacité] couchés sur le plan qui la porte
  contact: [[7, 0.13], [3, 0.3]],
};
// plan de l'atelier (mm, le long de la ligne) : du laser au premier poste de la presse, d'un poste de la presse à l'autre,
// de la presse au plateau de soudure, du plateau au début du convoyeur, longueur du four, convoyeur de sortie, puis du bout
// du convoyeur au laser de la ligne suivante
const PLAN = { presse: 2150, entrePostes: 1700, soudure: 1700, chaine: 2350, laserSuivant: 1560 };

// ---------- Valeurs nouvelles de la v11 : la ligne de thermolaquage (à verser dans les tokens, MOTION.peinture) ----------
// Références de métier (aucune marque à l'image) : les convoyeurs aériens à chaîne des lignes de peinture (un rail profilé
// suspendu à la charpente par des suspentes, des chariots à galets au pas de la chaîne, des balancelles accrochées à
// certains d'entre eux, une vitesse constante) ; les cabines de poudrage automatiques (sol en caillebotis au-dessus de la
// récupération, fente du convoyeur au plafond, pistolets à lance sur des élévateurs à chariot de part et d'autre, centrale
// à poudre et ses tuyaux) ; la poudre chargée qui suit les lignes du champ, enveloppe les arêtes et pénètre mal dans les
// creux (cage de Faraday) ; les fours tunnel à sas d'entrée et de sortie, convoyeur au-dessus du toit, fente à brosses.
const V11 = {
  // ligne (mm) : vitesse de la chaîne (mm/ms : 0,42 m/s ; le jeton MOTION.camera.travelling donnait 0,38) ; zb, le dessous
  // de la pièce suspendue ; pivot, l'œil des crochets sous les chariots ; rail (dessous,
  // dessus) ; pas visé de la chaîne (un nombre entier de chariots par cycle : le pas réel en découle, à 5 mm près ; une
  // balancelle par cycle, ses deux crochets à un pas de part et d'autre de son centre) ; avant : la ligne droite avant le point d'accrochage ;
  // rayon des deux courbes ; pente : de part et d'autre de la ligne droite le rail monte vers la charpente, dès la courbe
  // (palier : ce qui reste à niveau avant le point où le robot engage la pièce ; longueur de la pente, angle en degrés,
  // longueur de ses deux raccords, plat en haut) : la balancelle descend dans le cadre au moment de servir, et remonte en
  // repartant ; pistolets, four : distance du
  // point d'accrochage au plan des pistolets et à l'entrée du four (la pièce est sortie de la cabine avant d'y entrer) ;
  // cabine : sa longueur en amont et en aval des pistolets ; sas, chambre : le four ; fond : la profondeur de sa bouche ;
  // prise : de la sortie du four au point où le palettiseur décroche ; apres : la ligne droite après ce point
  ligne: { vitesse: 0.42, zb: 60, pivot: 932, rail: [969, 1029], pas: 435, avant: 600, rayon: 300, pente: { palier: 50, L: 2700, max: 45, raccord: 520, haut: 250 }, pistolets: 1000, cabine: [360, 260], four: 2120, sas: 170, chambre: 680, fond: 100, prise: 520, apres: 720 },
  // accrochage : la pièce arrive à côté de la balancelle (cote, mm, en y), 60 mm au-dessus des crochets (haut), à la
  // vitesse de la chaîne ; elle glisse entre les deux crochets (glisse : début et fin, ms, depuis la fin du transfert),
  // descend sur eux (pose) ; le préhenseur lâche, remonte hors de la pièce (sort, mm, en monte ms) en la suivant, puis
  // recule (recule : début, fin, ms après le lâcher ; mm) sans cesser de suivre la chaîne (suit, ms : le crochet arrière
  // le rattraperait), freine (frein, ms) et se replie
  accroche: { cote: 300, haut: 60, glisse: [-60, 380], pose: [190, 450], sort: 332, monte: 450, recule: [300, 800, 480], suit: 800, frein: 350 },
  // le balancement de la balancelle quand le préhenseur lâche : amplitude (mm), amortissement (ms), période (ms : le
  // pendule de 0,8 m), mise en mouvement (ms) ; libres : celui des crochets délestés (mm)
  balance: { a: 15, tau: 620, per: 1790, monte: 240, libres: 9 },
  // le retour du robot le long de son rail : il part dès qu'il a fini de suivre la chaîne, roule `dure` ms, rampes en
  // `rampe` (part de la durée) : 1,6 m/s en palier (un axe linéaire de manutention roule de 1 à 2 m/s) ; devance : son
  // chariot prend de l'avance (mm) pendant que le bras suit encore la chaîne (début, fin, ms après le lâcher)
  retour: { dure: 5200, rampe: 0.13, devance: [150, 800, 280] },
  // les transferts d'un poste à l'autre, pièce portée : le long du rail, un palier de vitesse entre deux rampes (part de
  // la durée pour chaque rampe) au lieu d'une courbe en S, dont la pointe passait 2 m/s : 1,6 m/s au plus
  rail: { rampe: 0.3 },
  // le décrochage par le palettiseur (ms avant ou après la prise) : il attend devant la ligne, en aval de la sortie du four
  // (attente : x depuis le point de prise, y, hauteur du plan des ventouses), entre au-dessus de la pièce (entre : en x ;
  // entreY : en y, un peu plus tard, quand il est entre les deux crochets), descend, prend, lève (leve, mm), sort la pièce
  // vers l'avant (sort, mm) en suivant la chaîne, puis la porte à sa place et revient attendre, préhenseur ramené devant
  // lui, dégagé de la commande
  decroche: { attente: [70, -380, 410], entre: [-900, -430], entreY: [-680, -400], descend: [-400, 0], leve: [160, 420, 70], sort: [340, 800, 300], suit: [600, 1050] },
  // le palettiseur et la palette, devant la ligne (x depuis le point de prise, y)
  palettiseur: [520, -360], palette: [700, -950],
  // caméra : pendant le poudrage et la cuisson elle accompagne la pièce à la vitesse de la chaîne ; avance (mm) : où elle
  // regarde par rapport à la pièce à l'accrochage, au milieu du four, à la prise ; baisse : elle descend d'autant (mm à
  // l'écran) pendant le poudrage et la cuisson : l'élévateur de devant et sa centrale restent dans le cadre ; soudure : de
  // même pendant la soudure (0 : essayé, cela coupait le haut du robot de soudure de droite)
  camera: { avance: [300, 700, 520], baisse: 60, soudure: 0 },
  // la peinture à l'image : part de papier dans la poudre déposée (mate, plus claire), dans la plaque et le liseré de la
  // peinture cuite ; part d'encre dans ses tailles ; reflet satiné (part, demi-largeur en mm, hauteur sur la paroi) ;
  // chaleur : la pièce sort chaude et refroidit en `froid` ms ; grain : pas du grain de poudre dans la matière (mm)
  peinture: { poudre: 0.42, plaque: 0.07, lisere: 0.6, taille: 0.6, satin: [0.2, 42, 250], froid: 2600, grain: 5.2 },
};

V.chaine = V11.ligne.vitesse;   // v11 : la chaîne de peinture a sa vitesse propre, constante (la caméra accompagne la pièce)

// départ arrêté : la courbe de MOTION, précédée d'une mise en vitesse tirée de la courbe d'appui (aucun démarrage à pleine vitesse)
const doux = (ease) => (x) => ease((1 - x) * EASE.appui(x) + x * x);
const APP = doux(EASE.approche), RET = doux(EASE.retour);
// raccord d'Hermite : de p0 (vitesse m0) à p1 (vitesse m1), vitesses exprimées sur la durée du raccord
const hermite = (p0, m0, p1, m1, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; };
// le même, de degré 5 : départ arrêté, arrivée à la vitesse m1, accélération nulle aux deux bouts (ni départ sec, ni à-coup à l'accrochage)
const hermite5 = (p0, p1, m1, u) => { const u3 = u * u * u; return p0 + (p1 - p0) * u3 * (10 + u * (-15 + 6 * u)) + m1 * u3 * (-4 + u * (7 - 3 * u)); };

// ---------- la découpe : vitesse le long du tracé, mise en vitesse au départ et ralenti dans les angles ----------
// pts : boucle fermée ; vmax en mm/ms ; acc en mm/ms². Renvoie la durée et la position à un instant (tracé parcouru, longueur)
function profilCoupe(pts, vmax, acc) {
  const P = [...pts, pts[0]], cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], ds = 1, n = Math.max(2, Math.ceil(L / ds)) + 1;
  const vl = new Float64Array(n).fill(vmax);
  // vitesse d'angle : pleine en ligne droite, réduite selon la déviation (90° : 40 % de la vitesse de coupe)
  for (let i = 1; i < P.length - 1; i++) {
    const a = [P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]], b = [P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]];
    const th = Math.acos(clamp((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1), -1, 1));
    const k = Math.round((cum[i] / L) * (n - 1)); vl[k] = Math.min(vl[k], vmax * Math.max(0.4, Math.cos(Math.min(th, Math.PI / 2))));
  }
  vl[0] = 0; vl[n - 1] = 0;
  const h = L / (n - 1);
  for (let i = 1; i < n; i++) vl[i] = Math.min(vl[i], Math.sqrt(vl[i - 1] ** 2 + 2 * acc * h));
  for (let i = n - 2; i >= 0; i--) vl[i] = Math.min(vl[i], Math.sqrt(vl[i + 1] ** 2 + 2 * acc * h));
  const ts = new Float64Array(n);
  for (let i = 1; i < n; i++) ts[i] = ts[i - 1] + (2 * h) / Math.max(1e-6, vl[i - 1] + vl[i]);
  const T = ts[n - 1];
  const sA = (t) => { // longueur parcourue au temps t
    if (t <= 0) return 0; if (t >= T) return L;
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
    return (lo + (t - ts[lo]) / (ts[hi] - ts[lo])) * h;
  };
  const point = (s) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const k = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return { p: [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k], i }; };
  return { L, T, sA, point, P };
}

// ---------- la trajectoire de la caméra : une ligne brisée (instant, position), lissée, périodique ----------
// cles : [[t, x], …] de t = 0 à t = Tc, avec x(Tc) = x(0) + P. Trois moyennes glissantes de largeur `lissage` (une courbe en
// cloche de 3 × lissage de large) : position, vitesse et accélération continues ; la caméra anticipe un départ et se pose
// après une arrivée. Renvoie x(t) pour tout t (monde périodique : x(t + Tc) = x(t) + P).
function trajetCamera(cles, Tc, P, lissage) {
  const N = Math.ceil(Tc / 4), pas = Tc / N, pente = P / Tc;
  const brise = (t) => { let i = 1; while (i < cles.length - 1 && cles[i][0] < t) i++; const [t0, x0] = cles[i - 1], [t1, x1] = cles[i]; return x0 + (x1 - x0) * clamp((t - t0) / ((t1 - t0) || 1)); };
  let a = new Float64Array(N); for (let i = 0; i < N; i++) a[i] = brise(i * pas) - pente * i * pas; // la part périodique
  const h = Math.max(1, Math.round(lissage / pas / 2));
  for (let tour = 0; tour < 3; tour++) {
    const b = new Float64Array(N); let s = 0;
    for (let k = -h; k <= h; k++) s += a[((k % N) + N) % N];
    for (let i = 0; i < N; i++) { b[i] = s / (2 * h + 1); s += a[(i + h + 1) % N] - a[(((i - h) % N) + N) % N]; }
    a = b;
  }
  const at = (i) => a[((i % N) + N) % N];
  return (t) => { // interpolation de Catmull-Rom entre les échantillons : la vitesse reste continue
    const u = t / pas, i = Math.floor(u), f = u - i, p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    return pente * t + 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  };
}

// ---------- la chronologie et le plan de l'atelier (déterministes, sans écran) ----------
// La ligne tourne en flux continu : une pièce part à chaque cycle (Tc). Chaque poste est une fonction périodique de
// l'instant du cycle ; une pièce est une fonction de son âge, qui dépasse un cycle (elle sort du four pendant que la
// suivante est déjà à la soudure). Toutes les lignes de l'atelier sont identiques : la caméra passe de l'une à la suivante.
export function filmAtelier({ piece = jardiniere } = {}) {
  const full = piece();
  const t = full.t, A = 800, B = 300, Hh = 300, C0 = [A / 2, B / 2], SOL = -46;
  const variants = [0, 1, 2, 3].map((n) => makePart({ ...full, holes: full.holes.slice(0, n) }));
  const gam = full.gamme || full.bends.map((_, k) => k);
  const M = V9.manutention, SO = V9.soudure, LAS = V9.laser, PAL = V9.palette;

  // ----- 1. découpe : programme de la tête (repère du développé) -----
  // garage du portique : au fond à gauche, du côté opposé à la sortie des pièces. Il s'en va préparer la coupe avant le
  // début du cycle (il glisse jusqu'au premier perçage pendant que la caméra arrive), puis coupe.
  const SHEET = [-340, 1140, -340, 640], HOME = [-548, 700];   // garé, le portique est hors du flan (la poutre à 18 mm de son bord)
  const ACC = V.coupe / (MOTION.micro.ms * 0.6); // la tête atteint sa vitesse de coupe en 60 % de MOTION.micro (environ 2 g)
  const steps = []; let tt = LAS.pose, pos = HOME;
  // déplacement à vide : durée bornée par la vitesse et par l'accélération du portique ; la tête saute entre deux contours,
  // remonte au garage pendant le dernier (z0, z1, saut : hauteurs au-dessus de la coupe)
  const rapid = (to, z0 = 0, z1 = 0, saut = LAS.saut) => {
    const d = Math.hypot(to[0] - pos[0], to[1] - pos[1]);
    steps.push({ k: 'vide', t0: tt, t1: tt + Math.max(MOTION.micro.ms, d / V.vide, 2 * Math.sqrt(d / LAS.accVide)), a: pos, b: to, z0, z1, saut }); tt = steps[steps.length - 1].t1; pos = to;
  };
  const cutLoop = (pts, idx, premier) => {
    const prof = profilCoupe(pts, V.coupe, ACC);
    if (premier) { steps.push({ k: 'vide', doux: true, t0: -LAS.prepare, t1: -LAS.pose, a: HOME, b: pts[0], z0: LAS.garage, z1: 0, saut: 0 }); pos = pts[0]; } else rapid(pts[0]);
    steps.push({ k: 'percage', t0: tt, t1: tt + MOTION.laser.percage.ms, at: pts[0], idx }); tt += MOTION.laser.percage.ms;
    steps.push({ k: 'coupe', t0: tt, t1: tt + prof.T, pts, L: prof.L, prof, idx }); tt += prof.T; pos = pts[0];
  };
  [...full.holes.keys()].sort((i, j) => Math.hypot(full.holes[i].meta.cx - HOME[0], full.holes[i].meta.cy - HOME[1]) - Math.hypot(full.holes[j].meta.cx - HOME[0], full.holes[j].meta.cy - HOME[1]))
    .forEach((i, n) => cutLoop(full.holes[i], i, n === 0));
  const ol = full.outline;
  let best = 0, bl = 0; ol.forEach((p, i) => { const q = ol[(i + 1) % ol.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; best = i; } });
  const mid = [(ol[best][0] + ol[(best + 1) % ol.length][0]) / 2, (ol[best][1] + ol[(best + 1) % ol.length][1]) / 2];
  cutLoop([mid, ...ol.slice(best + 1), ...ol.slice(0, best + 1)], 'contour', false);
  const tCoupe = tt; rapid(HOME, 0, LAS.garage, 0);
  const tGare = tt;
  const LONG = steps.filter((s) => s.k === 'coupe').reduce((s, x) => s + x.L, 0);
  const holeCut = (i, tau) => { const s = steps.find((x) => x.k === 'coupe' && x.idx === i); return s && tau >= s.t1; };
  const coupe = (tau) => { let L = 0; for (const s of steps) if (s.k === 'coupe') L += tau >= s.t1 ? s.L : tau > s.t0 ? s.prof.sA(tau - s.t0) : 0; return L; };

  // ----- les poses de la presse : le pli sur la ligne de la matrice (y = 0), la paroi derrière (+y) -----
  const poses = gam.map((bi, i) => {
    const bd = full.bends[bi], dx = bd.b[0] - bd.a[0], dy = bd.b[1] - bd.a[1], L = Math.hypot(dx, dy);
    let n = [-dy / L, dx / L];
    const child = full.faces[full.links[bi].faces.find((f) => f !== full.baseId)];
    const cc = child.loop.reduce((s, q) => [s[0] + q[0] / child.loop.length, s[1] + q[1] / child.loop.length], [0, 0]);
    const m = [(bd.a[0] + bd.b[0]) / 2, (bd.a[1] + bd.b[1]) / 2];
    if ((cc[0] - m[0]) * n[0] + (cc[1] - m[1]) * n[1] < 0) n = [-n[0], -n[1]];
    const rz = Math.PI / 2 - Math.atan2(n[1], n[0]);
    const off = [C0[0] - m[0], C0[1] - m[1]];
    return { bi, i, rz, c: [Math.cos(rz) * off[0] - Math.sin(rz) * off[1], Math.sin(rz) * off[0] + Math.cos(rz) * off[1]], L, poste: L > 500 ? 'A' : 'B' };
  });
  const BEAM = PLAN.entrePostes; // entre les deux postes d'outillage de la presse de 3 m

  // ----- le plan de l'atelier (fixe) -----
  // la peinture : convoyeur aérien, cabine, élévateurs, four tunnel (la pièce y disparaît entièrement), sortie où elle refroidit ;
  // au bout, le palettiseur et la palette de la commande, puis le laser de la ligne suivante
  // v11 : la pièce est suspendue au convoyeur aérien au point S.chaine ; elle passe la cabine (S.rideau : le plan des
  // pistolets), entre dans le four (S.four), en sort (S.sortie) ; le palettiseur la décroche en S.prise ; le rail tourne
  // ensuite vers le fond de l'atelier (S.bout : l'aplomb de sa branche de retour)
  const LG = V11.ligne, AC = V11.accroche, GUN = LG.pistolets;
  const S = { laser: 0 };
  S.presseA = S.laser + PLAN.presse; S.presseB = S.presseA + BEAM; S.soudure = S.presseB + PLAN.soudure; S.chaine = S.soudure + PLAN.chaine;
  S.rideau = S.chaine + GUN; S.four = S.chaine + LG.four; S.cabine = [S.rideau - LG.cabine[0], S.rideau + LG.cabine[1]];
  S.sortie = S.four + 2 * LG.sas + LG.chambre; S.prise = S.sortie + LG.prise; S.bout = S.prise + LG.apres + LG.rayon;
  S.palettiseur = S.prise + V11.palettiseur[0]; S.palette = [S.prise + V11.palette[0], V11.palette[1]];
  const P = S.bout + PLAN.laserSuivant - S.laser;
  const station = (ps) => (ps.poste === 'A' ? S.presseA : S.presseB);

  // ----- la chronologie d'un cycle (ms) -----
  const T = { coupe: [0, tCoupe] };
  T.prise = [tCoupe + M.depart, tCoupe + M.depart + M.arrive + M.descend];      // le préhenseur vient au-dessus du flan, descend
  let k = T.prise[1] + M.ventouse;                                              // les ventouses ont pris : il lève
  T.versPresse = [k, k + M.versPresse]; k = T.versPresse[1];
  T.coups = [];
  poses.forEach((ps, i) => {
    if (i > 0) {
      const prev = poses[i - 1], d2 = ps.poste !== prev.poste ? M.entrePostes : M.retourne;   // d'un poste à l'autre, ou retournée sur place
      T.coups.push({ k: 'repos', t0: k, t1: k + d2, from: prev, to: ps }); k += d2;
    }
    const c = { k: 'coup', ps, i, t0: k }; c.app = [k, k + PR.approche.ms]; c.appui = [c.app[1], c.app[1] + PR.appui.ms]; c.maint = [c.appui[1], c.appui[1] + PR.maintien.ms]; c.ret = [c.maint[1], c.maint[1] + PR.retour.ms]; c.t1 = c.ret[1];
    T.coups.push(c); k = c.t1;
  });
  T.presse = [T.versPresse[1], k];
  const last = poses[poses.length - 1], COUPS = T.coups.filter((s) => s.k === 'coup'), REPOS = T.coups.filter((s) => s.k === 'repos');
  T.versSoudure = [k, k + M.versSoudure]; k = T.versSoudure[1];
  T.lache = k + M.ventouse;                                                     // la pièce est posée sur le plateau, les ventouses lâchent
  // soudure : la torche approche, soude l'angle de haut en bas, se dégage ; le plateau fait demi-tour ; seconde passe
  const PASS = SO.ecailles * MOTION.soudure.ecaille; // une écaille par trempage
  k = T.lache + SO.attente; T.soudure = [k];
  T.approche1 = [k, k + SO.approche]; T.passe1 = [T.approche1[1], T.approche1[1] + PASS]; T.degage1 = [T.passe1[1], T.passe1[1] + SO.degage];
  T.tour = [T.degage1[1] - 140, T.degage1[1] - 140 + SO.tour];   // le plateau démarre quand les torches sont déjà à l'écart
  T.approche2 = [T.tour[1], T.tour[1] + SO.approche]; T.passe2 = [T.approche2[1], T.approche2[1] + PASS]; T.degage2 = [T.passe2[1], T.passe2[1] + SO.degage];
  T.soudure.push(T.degage2[1]); T.ecailles = SO.ecailles;
  T.reprise = T.passe2[1] + M.reprend;                                          // le préhenseur a repris la pièce (il ne revient qu'à la fin du second cordon)
  k = T.reprise + M.ventouse;
  // le robot amène la pièce à côté de la balancelle, à sa vitesse, la glisse entre les deux crochets et la pose dessus
  T.versChaine = [k, k + M.versChaine]; k = T.versChaine[1] + AC.pose[1];
  const dur = (mm) => mm / V.chaine;                                            // la chaîne roule à vitesse constante
  T.chaine = [k, k + dur(LG.four + A / 2)];                                     // accrochée ; entièrement entrée dans le four
  T.lacheChaine = k + M.tient;                                                  // le préhenseur l'accompagne un instant, puis lâche
  const xH = (a) => S.chaine + V.chaine * (a - T.chaine[0]);                    // le centre de la balancelle, et de la pièce qu'elle porte
  T.poudre = [k + dur(GUN - A / 2 - 70), k + dur(GUN + A / 2 + 70)];            // les pistolets soufflent (détection de pièce)
  T.four = [k + dur(LG.four - A / 2), k + dur(S.sortie - S.chaine - A / 2), k + dur(S.sortie - S.chaine + A / 2)];   // elle commence à entrer, à sortir, elle est sortie
  // cuite : quand elle est entièrement cachée (son arrière a passé le fond de la bouche, son avant n'est pas ressorti)
  T.cuite = k + dur(LG.four + (LG.fond + A / 2 + 2 * LG.sas + LG.chambre - A / 2) / 2);
  // la fin : la même jardinière sort du four, refroidit ; le palettiseur la décroche et la pose sur la palette de la
  // commande ; un temps de respiration
  T.prisePal = k + dur(S.prise - S.chaine);                                     // le palettiseur la prend sur ses crochets, à la volée
  T.pose = T.prisePal + PAL.porte;                                              // la quatrième jardinière est posée : la commande est complète
  const Tc = T.pose + PAL.degage + PAL.tenue;
  // l'âge d'une pièce : elle reste sur la palette jusqu'à ce que la commande soit enlevée, hors du cadre, au cycle suivant
  const LIFE = Tc + PAL.enleve;
  // le balancement de la pièce sur ses crochets quand le préhenseur la lâche (mm, le long de la chaîne) : un pendule amorti
  const BL = V11.balance;
  const balance = (a) => { const d = a - T.lacheChaine; return d <= 0 ? 0 : -BL.a * Math.exp(-d / BL.tau) * Math.sin((2 * Math.PI * d) / BL.per) * lisse(0, BL.monte, d); };

  // ----- le convoyeur aérien : sa voie en plan (abscisse curviligne s, 0 au point d'accrochage, dans le sens de la chaîne) -----
  // il descend de la charpente en venant du fond de l'atelier, tourne d'un quart de tour, longe la ligne (cabine, four,
  // décrochage), tourne et remonte vers le fond (une boucle fermée d'un pas de balancelle, dont le reste est hors du
  // cadre) ; un chariot à galets tous les `pas` mm ; les deux crochets d'une balancelle pendent des chariots voisins
  // du chariot qui passe au point d'accrochage à l'instant T.chaine[0]
  const VOIE = (() => {
    const R = LG.rayon, x0 = S.chaine - LG.avant, x1 = S.prise + LG.apres, q = (Math.PI * R) / 2, n = Math.round((V.chaine * Tc) / LG.pas), pas = (V.chaine * Tc) / n;
    // la voie en plan, selon l'abscisse horizontale sx : une branche, une courbe, la ligne droite, une courbe, une branche
    const plan = (sx) => {
      const x = S.chaine + sx;
      if (x < x0) { const d = x0 - x, th = d / R; return d < q ? { p: [x0 - R * Math.sin(th), R * (1 - Math.cos(th))], h: -th } : { p: [x0 - R, R + d - q], h: -Math.PI / 2 }; }
      if (x > x1) { const d = x - x1, th = d / R; return d < q ? { p: [x1 + R * Math.sin(th), R * (1 - Math.cos(th))], h: th } : { p: [x1 + R, R + d - q], h: Math.PI / 2 }; }
      return { p: [x, 0], h: 0 };
    };
    // la pente, de part et d'autre de la partie à niveau [sG, sD] : θmax entre deux raccords doux, puis un plat en haut ;
    // l'abscisse s est la longueur vraie du rail (la chaîne ne s'allonge pas dans la pente) : avance horizontale et montée
    // par intégration
    const PT = LG.pente, N = Math.ceil(PT.L / 5), tm = (PT.max * Math.PI) / 180, tab = [[0, 0]];
    const angle = (e) => tm * lisse(0, PT.raccord, e) * (1 - lisse(PT.L - PT.raccord, PT.L, e));
    for (let i = 1; i <= N; i++) { const th = angle(((i - 0.5) * PT.L) / N), d = PT.L / N; tab.push([tab[i - 1][0] + d * Math.cos(th), tab[i - 1][1] + d * Math.sin(th)]); }
    const monte = (e) => {   // → [avance horizontale, montée, pente]
      if (e >= PT.L) return [tab[N][0] + (e - PT.L), tab[N][1], 0];
      const u = (e / PT.L) * N, i = Math.min(N - 1, Math.floor(u)), f = u - i, a = tab[i], b = tab[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, angle(e)];
    };
    const sG = -(LG.avant + PT.palier), sD = x1 - S.chaine, Lp = PT.L + PT.haut;
    // un point de la voie : p (en plan), h (cap), z (montée), pente (positive quand la chaîne monte)
    const a = (s) => {
      if (s < sG) { const [hd, z, pe] = monte(sG - s); return { ...plan(sG - hd), z, pente: -pe }; }
      if (s > sD) { const [hd, z, pe] = monte(s - sD); return { ...plan(sD + hd), z, pente: pe }; }
      return { ...plan(s), z: 0, pente: 0 };
    };
    return { R, x0, x1, q, pas, n, sG, sD, s0: sG - Lp, s1: sD + Lp, a, s: (t) => V.chaine * (t - T.chaine[0]) };
  })();

  // ----- le robot de manutention, sur son rail (septième axe) -----
  // Il prend le flan par le dessus, sur son fond, et ne le lâche plus jusqu'au plateau de soudure ; il le reprend pour le
  // convoyeur aérien, puis revient le long du rail attendre le flan suivant. Sa trajectoire : la pointe de l'outil (x, y, z, lacet)
  // et le chariot sont des sommes de rampes en S qui se recouvrent (lever, avancer, tourner, poser : les coins sont arrondis,
  // rien ne s'arrête entre deux gestes) ; le bras s'en déduit à chaque instant par cinématique inverse.
  const BM = creerBras({ k: V9.robot.manip, outil: 'ventouses' }), RAD = Math.PI / 180;
  // une rampe : [début, fin, écart, profil (S5 par défaut)]
  const rampes = (v0, L) => (u) => { let v = v0; for (const [t0, t1, d, pr] of L) v += d * (pr || S5)(seg(u, t0, t1)); return v; };
  const PALIER = (x) => trapeze(x, V11.rail.rampe);              // v11 : le long du rail, vitesse d'axe linéaire
  const U0 = M.retour;                                           // le robot est revenu attendre au laser à cet instant du cycle
  const dep = (a) => (a < U0 ? a + Tc : a);                      // temps du robot, déroulé d'une attente au laser à la suivante
  const tA = T.prise[0], tV = T.versPresse, tS = T.versSoudure, tC = T.versChaine, p0 = poses[0], AT_ = M.attente;
  // v11, l'accrochage : le robot rattrape la balancelle par le côté (la pièce à AC.cote mm devant la ligne, AC.haut mm
  // au-dessus des crochets), la glisse entre les deux crochets, la pose, lâche, remonte son préhenseur hors de la pièce en
  // la suivant (tLib), freine, recule et se replie ; puis il rentre au laser le long de son rail, à vitesse d'axe linéaire
  // (un palier entre deux rampes : V11.retour)
  const RT = V11.retour, tLib = T.lacheChaine + AC.monte, tSuit = T.lacheChaine + AC.suit, xLib = xH(tSuit), xArret = xLib + (V.chaine * AC.frein) / 2;
  const tPart = tSuit, tRet1 = tPart + RT.dure;
  const GL = V9.presse.glisse;
  // pendant la soudure : il se range (RG : début et fin du geste après le lâcher), se replie dans sa pose de repos (QR,
  // des angles : bras rabattu en arrière, avant-bras revenu par-dessus l'épaule, préhenseur incliné devant lui), ne bouge
  // plus pendant les deux passes, et revient (RV : début et fin du geste avant la reprise) quand le second cordon finit
  const RG = M.range, RV = M.revient, QR = M.repos.map((d) => d * RAD);
  // il est replié de même en attendant au laser (il se déplie pour prendre le flan) et dès qu'il a lâché la pièce sur le
  // convoyeur aérien (il repart replié le long de son rail) : u est le temps du robot, d'une attente au laser à la suivante
  // Un geste de repli se fait en deux temps qui se recouvrent (chacun dure M.recouvre du geste) : pour se ranger, la
  // tourelle et la bride tournent d'abord (le préhenseur s'écarte encore haut), le bras se replie ensuite ; pour revenir,
  // le bras se déplie d'abord, la tourelle le ramène ensuite au-dessus de la pièce. Renvoie [part de la tourelle, part du bras].
  const temps2 = (u, t0, t1) => { const d = (t1 - t0) * M.recouvre; return [S5(seg(u, t0, t0 + d)), S5(seg(u, t1 - d, t1))]; };
  const replie = (u) => {
    const a = temps2(u, tA - M.deplie[0], tA + M.deplie[1]), b = temps2(u, T.lache + RG[0], T.lache + RG[1]);
    const c = temps2(u, T.reprise - RV[0], T.reprise - RV[1]), d = temps2(u, T.lacheChaine + M.plie[0], T.lacheChaine + M.plie[1]);
    // v11 : après l'accrochage, le bras se replie d'abord, la tourelle tourne ensuite (elle balaierait la ligne, où
    // passe le crochet arrière)
    return [1 - a[1] + b[0] * (1 - c[1]) + d[1], 1 - a[0] + b[1] * (1 - c[0]) + d[0]];
  };
  const gxAvant = rampes(S.laser + AT_[0], [
    [tA - M.avance, tA + M.arrive, -AT_[0]],                      // il s'avance le long du rail pendant que le portique finit
    [tV[0] + 150, tV[1] - 200, S.presseA + p0.c[0] - S.laser, PALIER],
    ...REPOS.map((r) => [r.t0 + 300, r.t1 - 300, station(r.to) + r.to.c[0] - station(r.from) - r.from.c[0], r.to.poste !== r.from.poste ? PALIER : S5]),
    [tS[0] + 350, tS[1] - 250, S.soudure - station(last) - last.c[0], PALIER],
    // pendant la soudure, il se range à droite, replié de profil le long de son rail, tourné vers la cellule
    [T.lache + RG[0], T.lache + RG[1], M.ecart], [T.reprise - RV[0], T.reprise - RV[1], -M.ecart],
  ]);
  const gx = (u) => {
    if (u < tC[0]) return gxAvant(u);
    if (u < tC[1]) return hermite5(S.soudure, xH(tC[1]), V.chaine * (tC[1] - tC[0] - 250), seg(u, tC[0] + 250, tC[1]));   // elle arrive à la vitesse de la chaîne, à la hauteur de sa balancelle
    if (u < tSuit) return xH(u);                                                                                         // il la suit : glissée, posée, lâchée, préhenseur sorti et reculé
    const w = clamp((u - tSuit) / AC.frein);                                                                              // le préhenseur freine en douceur (vitesse en S)
    return xLib + V.chaine * AC.frein * (w - w * w * w + w * w * w * w / 2) + (S.laser + AT_[0] - xArret) * trapeze(seg(u, tPart, tRet1), RT.rampe);   // puis le retour le long du rail
  };
  const gy = rampes(AT_[1], [
    [tA, tA + M.arrive, -AT_[1]], [tV[0] + 150, tV[1] - 500, p0.c[1] - GL], [tV[1] - 420, tV[1] - 40, GL],
    ...REPOS.filter((r) => r.to.poste !== r.from.poste).flatMap((r) => [[r.t0 + 250, r.t1 - 500, r.to.c[1] - r.from.c[1] - GL], [r.t1 - 680, r.t1 - 300, GL]]),
    [tS[0] + 350, tS[1] - 250, -last.c[1]],
    [T.lache + RG[0], T.lache + RG[1], M.rail + M.devant], [T.reprise - RV[0], T.reprise - RV[1], -M.rail - M.devant],   // en ligne droite jusqu'au-dessus du rail : la tourelle tourne peu, sans fouetter
    [tC[0] + 100, tC[0] + 900, -AC.cote], [tC[1] + AC.glisse[0], tC[1] + AC.glisse[1], AC.cote],             // à côté de la balancelle, puis entre ses crochets
    [T.lacheChaine + AC.recule[0], T.lacheChaine + AC.recule[1], -AC.recule[2]], [tRet1 - 1500, tRet1, AT_[1] + AC.recule[2]],
  ]);
  const gz = rampes(AT_[2], [
    [tA + 200, tA + M.arrive, 150 - AT_[2]], [tA + M.arrive, T.prise[1], 1 - 150],
    [tV[0], tV[0] + 450, M.porteFlan], [tV[1] - 450, tV[1], -M.porteFlan],
    ...REPOS.flatMap((r) => [[r.t0 + 150, r.t0 + 500, M.leve], [r.t1 - 600, r.t1 - 260, -M.leve]]),
    [tS[0] + 250, tS[0] + 750, M.porte], [tS[1] - 450, tS[1], -M.porte],
    [T.lache, T.lache + 420, M.haut], [T.lache + RG[0] + 300, T.lache + RG[1], M.baisse], [T.reprise - RV[0], T.reprise - 420, -M.baisse], [T.reprise - 420, T.reprise, -M.haut],
    [tC[0], tC[0] + 450, LG.zb + AC.haut], [tC[1] + AC.pose[0], tC[1] + AC.pose[1], -AC.haut],
    [T.lacheChaine, tLib, AC.sort], [tRet1 - 1500, tRet1, AT_[2] - 1 - LG.zb - AC.sort],
  ]);
  // les retournements : un demi-tour se fait dans le sens qui ramène le poignet vers son tour de départ (aucun enroulement)
  let cumul = 0; const tourne = (d) => { let w = wrapA(d); if (Math.abs(Math.abs(w) - Math.PI) < 1e-6) w = cumul > 0 ? -Math.PI : Math.PI; cumul += w; return w; };
  const lacet = rampes(0, [
    [tV[0] + 350, tV[1] - 350, tourne(p0.rz)],
    ...REPOS.map((r) => [r.t0 + 220, r.t1 - 330, tourne(r.to.rz - r.from.rz)]),
    [tS[0] + 450, tS[1] - 500, tourne(-last.rz)],
  ]);
  // le chariot, par rapport à la pointe : le robot travaille à droite de la pièce (il ne la cache pas à la caméra)
  const dxo = rampes(M.cote[4], [
    [tA - M.avance, tA + M.arrive, M.cote[0] - M.cote[4]],
    ...REPOS.filter((r) => r.to.poste !== r.from.poste).map((r) => [r.t0 + 150, r.t1 - 200, M.cote[1] - M.cote[0]]),
    [tS[0] + 150, tS[1] - 250, M.cote[0] - M.cote[1]],
    [T.lache + RG[0], T.lache + RG[1], M.cote[2] - M.cote[0]], [T.reprise - RV[0], T.reprise - RV[1], M.cote[0] - M.cote[2]],
    [tC[0] + 200, tC[1] - 200, M.cote[3] - M.cote[0]], [T.lacheChaine + RT.devance[0], T.lacheChaine + RT.devance[1], -RT.devance[2]], [tPart, tRet1, M.cote[4] - M.cote[3] + RT.devance[2]],
  ]);
  const ZM = SOL + M.chariot;                                    // le dessus du chariot, où le robot est boulonné
  const tenue = (a) => (a >= T.prise[1] && a < T.lache) || (a >= T.reprise && a < T.lacheChaine);
  function manip(a) {
    const u = dep(a), p = [gx(u), gy(u), gz(u)], lc = lacet(u), x7 = p[0] + dxo(u);
    const base = { p: [x7, M.rail, ZM], lacet: Math.PI / 2 };
    // le roulis de la bride suit le lacet de la pièce : q6 = q1 + 90° − lacet (outil vertical), au même tour d'un instant à l'autre
    // l'axe 1 : au repos de la soudure, la pointe est à gauche du fût, un peu en avant du rail (110°, butée à 170°)
    let q1 = Math.atan2(p[1] - M.rail, p[0] - x7) - Math.PI / 2; if (q1 < -2.1) q1 += 2 * Math.PI;
    let q = BM.ik({ p, a: [0, 0, -1], h: [Math.cos(lc), Math.sin(lc), 0] }, base, [q1, 1.2, -1.6, 0, 0.9, q1 + Math.PI / 2 - lc]);
    const [wt, wa] = replie(u); if ((wt > 0 || wa > 0) && q) q = q.map((v, i) => v + (QR[i] - v) * (i === 0 || i === 5 ? wt : wa));
    return { p, lacet: lc, x7, base, q, replie: wa };
  }

  // ----- le palettiseur, devant la ligne après le four : il décroche la jardinière refroidie et la pose sur la palette -----
  const BP = creerBras({ k: V9.robot.palettiseur, outil: 'ventouses' });
  const baseP = { p: [S.palettiseur, V11.palettiseur[1], SOL], lacet: Math.PI };   // v11 : devant la ligne, entre le rail et la palette
  const zPal = SOL + PAL.h, CASES = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([kx, ky]) => [S.palette[0] + kx * PAL.pas[0], S.palette[1] + ky * PAL.pas[1], zPal + t / 2]);
  const DER = CASES[3];                                          // la dernière place : au second rang, du côté de la ligne
  const UP = T.prisePal - 2700, depP = (a) => (a < UP ? a + Tc : a);
  // la commande complète part : sa navette l'emmène vers l'avant de l'atelier, hors du cadre, pendant que la caméra repart
  // vers le laser ; une palette de trois jardinières la remplace à PAL.enleve, quand la caméra est loin
  const depart = (a) => (a < PAL.enleve ? -PAL.course * S5(seg(a, PAL.part[0], PAL.part[1])) : 0);
  // v11, le décrochage à la volée : le préhenseur attend devant la ligne, au-dessus de la hauteur des parois ; quand la
  // pièce arrive il entre au-dessus d'elle en prenant sa vitesse (wE), descend, prend, la lève de ses crochets, la sort
  // vers l'avant (wS) sans cesser de suivre la chaîne, puis la porte à sa place (wP) et revient attendre (wR). La
  // position est un mélange lisse de ces buts : aucune vitesse ne casse.
  const DC = V11.decroche, tp = T.prisePal, ATT2 = [S.prise + DC.attente[0], DC.attente[1], DC.attente[2]];
  const wE = (u) => S5(seg(u, tp + DC.entre[0], tp + DC.entre[1])), wY = (u) => S5(seg(u, tp + DC.entreY[0], tp + DC.entreY[1])), wS = (u) => S5(seg(u, tp + DC.sort[0], tp + DC.sort[1]));
  const wP = (u) => S5(seg(u, tp + DC.suit[0], T.pose - 300)), wR = (u) => S5(seg(u, T.pose + 250, T.pose + 1200));
  // il suit la chaîne jusqu'à ce que la pièce soit sortie d'entre ses crochets, puis freine (vitesse en S)
  const tQ = tp + DC.suit[0], xSuit = (u) => { if (u < tQ) return xH(u); const w = clamp((u - tQ) / AC.frein); return xH(tQ) + V.chaine * AC.frein * (w - w * w * w + w * w * w * w / 2); };
  const hx = (u) => lerp(lerp(lerp(ATT2[0], xSuit(u), wE(u)), DER[0], wP(u)), ATT2[0], wR(u));
  const hy = (u) => lerp(lerp(lerp(lerp(ATT2[1], 0, wY(u)), -DC.sort[2], wS(u)), DER[1], wP(u)), ATT2[1], wR(u));
  const hz = rampes(ATT2[2], [
    [tp + DC.descend[0], tp + DC.descend[1], LG.zb + 1 - ATT2[2]], [tp + DC.leve[0], tp + DC.leve[1], DC.leve[2]],
    [tp + DC.suit[0], tp + DC.suit[1], PAL.porteZ - LG.zb - 1 - DC.leve[2]],
    [T.pose - 450, T.pose, DER[2] + 1 - PAL.porteZ], [T.pose + 100, T.pose + 500, 325], [T.pose + 350, T.pose + 1200, ATT2[2] - DER[2] - 326],
  ]);
  function palet(a) {
    const u = depP(a), p = [hx(u), hy(u), hz(u)];
    const q1 = Math.atan2(p[1] - baseP.p[1], p[0] - S.palettiseur) - Math.PI;
    const q = BP.ik({ p, a: [0, 0, -1], h: [1, 0, 0] }, baseP, [wrapA(q1), 1.2, -1.6, 0, 0.9, wrapA(q1) + Math.PI]);
    return { p, q };
  }

  // ----- la caméra : elle suit le robot de manutention et sa pièce, puis la jardinière suspendue ; elle passe le
  // four, s'attarde sur la commande complète, et repart vers le laser de la ligne suivante -----
  const CA = V9.camera, KA = V11.camera;
  const cles = [
    [0, S.palette[0] + CA.palette[1] - P], [CA.tenue, S.palette[0] + CA.palette[1] + 30 - P], [CA.arrive, S.laser + CA.laser[1]], [T.prise[1] - 300, S.laser + CA.laser[2]],
    [tV[1] + 400, S.presseA + CA.presse[0]], [COUPS[1].t1 + 250, S.presseA + CA.presse[1]],
    [COUPS[2].t0 + 300, S.presseB + CA.presseB[0]], [T.presse[1], S.presseB + CA.presseB[1]],
    [tS[1] + 600, S.soudure + CA.soudure[0]], [T.soudure[1], S.soudure + CA.soudure[1]],
    // v11 : elle accompagne la pièce suspendue à la vitesse de la chaîne (cabine, four, sortie), puis se pose sur la commande
    [T.chaine[0] - 300, xH(T.chaine[0] - 300) + KA.avance[0]], [T.cuite, xH(T.cuite) + KA.avance[1]], [T.prisePal - 400, xH(T.prisePal - 400) + KA.avance[2]],
    [T.pose - 600, S.palette[0] + CA.palette[0]], [Tc, S.palette[0] + CA.palette[1]],
  ];
  const camX = trajetCamera(cles, Tc, P, CA.lissage), camV = (tm) => (camX(tm + 2) - camX(tm - 2)) / 4;
  // pour l'image de fin, la caméra descend : la commande remonte dans le cadre, palette comprise (mm à l'écran) ; elle
  // remonte en repartant vers le laser
  // v11 : elle descend un peu pendant le poudrage (l'élévateur de devant reste dans le cadre), puis encore pour la fin
  const camH = trajetCamera([[0, CA.plonge], [CA.tenue, CA.plonge], [CA.arrive, 0], [T.presse[1], 0], [tS[1] + 600, KA.soudure], [T.soudure[1], KA.soudure], [T.chaine[0] - 600, 0], [T.chaine[0] + 500, 0], [T.poudre[0] + 300, KA.baisse], [T.four[1], KA.baisse], [T.pose - 200, CA.plonge], [Tc, CA.plonge]], Tc, 0, CA.lissage);
  const CH = [
    { id: 'decoupe', t: CA.arrive * 0.6 },                       // la caméra arrive au laser (le cycle commence sur la commande finie)
    { id: 'pliage', t: tV[0] + (tV[1] - tV[0]) * 0.6 },
    { id: 'soudure', t: tS[0] + (tS[1] - tS[0]) * 0.6 },
    { id: 'peinture', t: tC[0] + (tC[1] - tC[0]) * 0.6 },
  ];

  // le plateau de soudure : il fait demi-tour entre les deux passes (profil en S) ; un demi-tour le ramène à son dessin de départ
  const plateau = (a) => Math.PI * S5(seg(a, T.tour[0], T.tour[1]));

  // État d'une pièce à son âge
  function etat(age) {
    const f = full.bends.map(() => 0);
    let variant = 0; for (let i = 0; i < full.holes.length; i++) if (holeCut(i, age)) variant = i + 1;
    let rz = 0, c = [S.laser, 0], z = 0, punch = null, peinte = 0;
    if (age >= T.prise[1] && age < T.lache) { const u = age; c = [gx(u), gy(u)]; z = gz(u) - 1; rz = lacet(u); }   // tenue par le robot
    if (age >= T.presse[0]) {
      for (const st of T.coups) {
        if (age < st.t0) break;
        if (st.k === 'repos') continue;
        const over = 92 / 90;
        let fv = 0;
        if (age >= st.appui[0]) fv = over * EASE.appui(seg(age, st.appui[0], st.appui[1]));
        if (age >= st.ret[0]) fv = lerp(over, 1, EASE.retour(seg(age, st.ret[0], st.ret[1])));
        f[st.ps.bi] = fv;
        if (age < st.t1) {
          const open = V9.presse.ouverture, contact = t / 2, low = contact - 4;
          let zp;
          if (age < st.app[1]) zp = lerp(open, contact, APP(seg(age, st.app[0] - V9.presse.avance, st.app[1])));
          else if (age < st.maint[1]) zp = lerp(contact, low, EASE.appui(seg(age, st.appui[0], st.appui[1])));
          else zp = lerp(low, V9.presse.mi, RET(seg(age, st.ret[0], st.ret[1])));
          punch = { z: zp, poste: st.ps.poste };
        }
      }
      for (const st of T.coups) if (st.k === 'coup' && age >= st.t1) f[st.ps.bi] = 1;
    }
    if (age >= T.lache) { c = [S.soudure, 0]; z = 0; rz = plateau(age); }                                           // sur le plateau
    if (age >= T.reprise) { const u = age; c = [gx(u), gy(u)]; z = gz(u) - 1; rz = Math.PI + lacet(u); }             // reprise par le robot
    let chaud = 0;
    if (age >= T.lacheChaine) {
      // suspendue à sa balancelle, à la vitesse de la chaîne (elle se balance d'un rien quand le préhenseur la lâche) ;
      // elle traverse la cabine puis le four, dont elle ressort cuite, chaude, et refroidit
      rz = Math.PI; z = LG.zb; c = [xH(age) + balance(age), 0];
      if (age > T.cuite) { peinte = 1; chaud = 1 - lisse(T.four[1], T.four[1] + V11.peinture.froid, age); }   // cuite : cachée dans le four à cet instant
    }
    if (age >= T.prisePal && age < T.pose) { const p = palet(age).p; c = [p[0], p[1]]; z = p[2] - 1; }                // prise par le palettiseur
    if (age >= T.pose) { c = [DER[0], DER[1] + (age >= Tc ? depart(age - Tc) : 0)]; z = DER[2]; }                     // sur la palette, puis emmenée avec elle
    return { f, variant, rz, c, z, punch, peinte, chaud, posee: age >= T.pose, vis: age >= tCoupe && age < LIFE };
  }
  // le tablier de la presse : garé au-dessus du cadre hors de son travail ; il descend pendant que la pièce arrive et s'arrête
  // ouvert avant le premier coup, remonte pendant qu'elle repart vers la soudure
  const PARK_T = 1600;
  const tablier = (a, e) => {
    if (e && e.punch) return e.punch.z;
    // l'approche commence avant le coup, pendant que la pièce finit de se poser
    for (const st of COUPS) if (a >= st.app[0] - V9.presse.avance && a < st.app[0]) return lerp(V9.presse.ouverture, t / 2, APP(seg(a, st.app[0] - V9.presse.avance, st.app[1])));
    // après un coup, le poinçon est à mi-ouverture : il finit de s'ouvrir doucement
    let ouvert = V9.presse.ouverture; for (const st of COUPS) if (a >= st.t1 && a < st.t1 + V9.presse.fin) ouvert = lerp(V9.presse.mi, V9.presse.ouverture, S5(seg(a, st.t1, st.t1 + V9.presse.fin)));
    const dv = tV[1] - tV[0];
    return ouvert + PARK_T * (1 - APP(seg(a, tV[0], tV[0] + dv * 0.75))) + PARK_T * EASE.convoyeur(seg(a, tS[0] + 150, tS[1] + 400));
  };
  // les butées arrière d'un poste : reculées (120 mm), elles viennent au contact pendant que la pièce se pose, reculent dès
  // que le poinçon appuie (la paroi qui se lève les dégage)
  const butee = (a, poste) => {
    for (const st of T.coups) {
      if (st.k !== 'coup' || st.ps.poste !== poste) continue;
      if (a >= st.app[0] - PR.approche.ms && a < st.app[0]) return 120 * (1 - APP(seg(a, st.app[0] - PR.approche.ms, st.app[0])));
      if (a >= st.app[0] && a < st.appui[0]) return 0;
      if (a >= st.appui[0] && a < st.appui[0] + PR.retour.ms) return 120 * RET(seg(a, st.appui[0], st.appui[0] + PR.retour.ms));
    }
    return 120;
  };

  // ----- la cellule de soudure -----
  // avancement de chaque angle (passe 1 : les deux angles avant ; passe 2 : les deux autres, venus devant) : celui de la
  // torche, à vitesse constante entre deux rampes
  const ANGLES = [[0, 0], [A, 0], [A, B], [0, B]];
  const cordons = (age) => { const p1 = trapeze(seg(age, T.passe1[0], T.passe1[1])), p2 = trapeze(seg(age, T.passe2[0], T.passe2[1])); return [p1, p1, p2, p2]; };
  const arc = (a) => (a >= T.passe1[0] && a < T.passe1[1]) || (a >= T.passe2[0] && a < T.passe2[1]);
  // l'intensité de l'arc (0 à 1) : il s'amorce en V9.arc.allume ms, s'éteint en V9.arc.eteint ms après le cordon
  const feuArc = (a) => { let k = 0; for (const [p0, p1] of [T.passe1, T.passe2]) if (a >= p0 && a < p1 + V9.arc.eteint) k = Math.max(k, lisse(p0, p0 + V9.arc.allume, a) * (1 - lisse(p1, p1 + V9.arc.eteint, a))); return k; };
  // deux robots derrière le plateau, de part et d'autre (le robot de manutention sert le plateau par-devant) ; chacun soude
  // l'angle avant de son côté, en contournant le bout de la pièce. pied : position du socle par rapport à l'axe du plateau ;
  // repos : pose de repos (bras replié, torche vers le bas) ; vers : direction horizontale d'approche de la torche, dans
  // le secteur des deux faces de l'angle
  const BR = creerBras({ k: V9.robot.k });
  const robots = [-1, 1].map((cote) => {
    const pied = [cote * SO.pied[0], SO.pied[1]], vers = [-cote * SO.vers[0], SO.vers[1]];
    const base = { p: [S.soudure + pied[0], pied[1], SOL], lacet: Math.atan2(-pied[1], -pied[0]) }, repos = [cote * 12, 132, -148, 0, 60, 180].map((d) => d * RAD);
    // la pointe du fil, 2 mm hors de l'angle ; h vers le bas : le col de cygne se cambre vers le haut, le poignet est au-dessus
    const coin = (z, pente) => ({ p: [S.soudure + cote * (A / 2 + 2), -B / 2 - 2, z], a: norm([vers[0], vers[1], -pente]), h: [0, 0, -1] });
    const hors = (c, d) => ({ ...c, p: sub(c.p, mulS(c.a, d)) });
    const haut = coin(Hh - 8, SO.pente[0]), bas = coin(8, SO.pente[1]), pret = hors(haut, SO.pret), degage = hors(bas, SO.recul);
    const prog = programme(BR, base, repos, [
      { t: [T.lache - 300, T.soudure[0]], art: pret },                                         // le bras se présente quand la pièce est posée
      { t: T.approche1, lin: haut },
      { t: T.passe1, lin: bas, profil: trapeze },
      { t: T.degage1, lin: degage },
      { t: [T.degage1[1] + 40, T.tour[1] - 60], art: pret },                                   // il remonte pendant le demi-tour
      { t: T.approche2, lin: haut },
      { t: T.passe2, lin: bas, profil: trapeze },
      { t: T.degage2, lin: degage },
      { t: [T.degage2[1], T.degage2[1] + SO.retour], art: repos },
    ]);
    // la pointe du fil le long du cordon à l'instant a (elle reste au pied de l'angle après la passe) : d'où part une étincelle
    const fil = (a) => { const ps = a < T.tour[0] ? T.passe1 : T.passe2; return [haut.p[0], haut.p[1], lerp(haut.p[2], bas.p[2], trapeze(seg(a, ps[0], ps[1])))]; };
    return { base, prog, cote, fil };
  });

  // la tête du laser à l'instant a du cycle : position (repère du développé), hauteur au-dessus de la coupe, en coupe ou
  // non, perçage en cours, tracé du contour
  function tete(a) {
    const tau = a > Tc - LAS.prepare - 1 ? a - Tc : a;
    let hp = HOME, coupe = false, perce = false, trace = null, hz = LAS.garage, feu = 0, braise = null;
    if (tau > tGare) return { hp, coupe, perce, trace, hz, feu, braise };
    for (const s of steps) {
      if (tau < s.t0) break;
      if (s.k === 'vide') { feu = 0; const u = seg(tau, s.t0, s.t1), kk = s.doux ? S5(u) : EASE.vide(u), sn = Math.sin(Math.PI * u); hp = [lerp(s.a[0], s.b[0], kk), lerp(s.a[1], s.b[1], kk)]; hz = lerp(s.z0, s.z1, S5(u)) + s.saut * sn * sn; }
      else if (s.k === 'percage') { hp = s.at; hz = 0; perce = tau < s.t1; feu = lisse(s.t0, s.t0 + LAS.allume, tau); }
      else if (s.k === 'coupe') {
        hz = 0;
        if (tau < s.t1) {
          const L = s.prof.sA(tau - s.t0), at = s.prof.point(L);
          hp = at.p; coupe = true; feu = 1;
          if (s.idx === 'contour') trace = [...s.prof.P.slice(0, at.i), at.p];
        } else { hp = s.pts[0]; feu = 0; braise = tau < s.t1 + LAS.eteint ? { p: s.pts[0], k: 1 - lisse(s.t1, s.t1 + LAS.eteint, tau) } : null; }   // le contour fermé rougeoie encore un instant
      }
    }
    return { hp, coupe, perce, trace, hz, feu, braise };
  }
  // la tôle sur la palette du laser : neuve au début du cycle ; le squelette reste après la prise du flan, puis le changeur
  // de palettes en amène une neuve, hors du cadre
  const toleNeuve = (a) => a < tCoupe || a >= M.palette;
  return { full, variants, steps, T, LIFE, Tc, P, S, CH, LG, VOIE, xH, balance, DC, tLib, LONG, COUPS, etat, cordons, arc, feuArc, plateau, robots, BR, BM, BP, baseP, manip, palet, tenue, CASES, zPal, toleNeuve, tete, tablier, butee, coupe, ANGLES, C0, A, B, Hh, t, SOL, SHEET, HOME, tCoupe, BEAM, GUN, poses, camX, camV, camH, depart, cles, V: V.chaine, M, M0: PAL, PLAN };
}
﻿
// ---------- montage : trame, arêtes, valeurs ----------
export function mountFilm(host, { couleurs, teinte, pas = 3, oriente = true, onValeurs = null, onChapitre = null, reduced = null, autoplay = true, el = 27, az = -121 } = {}) {
  const rm = reduced ?? prefersReduced();
  const F = filmAtelier();
  const { T, S, P, Tc, A, B, Hh, BR, LG } = F, VO = F.VOIE;
  const canvas = document.createElement('canvas'), ink = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true'); ink.setAttribute('aria-hidden', 'true'); canvas.className = 'film-trame'; ink.className = 'film-encre';
  host.prepend(canvas, ink);
  const LUM = norm([-0.8, -0.35, 0.55]), AMB = 0.24;
  // moteur : WebGL2 (trame attachée à la matière) ; sinon, l'ancienne trame d'écran en 2D (repli)
  const tr = createTrace(canvas, { couleurs, teinte, aplat: 0.85, ep: [0.05, 0.92], lum: LUM, amb: AMB, chauds: [ILLU.chaud, ILLU.etincelle, TOK.ambre], peinture: { ...V11.peinture, demi: [A / 2, B / 2, Hh] } });
  const grav = tr ? null : createGravure(canvas, { pas, ep: [0.05, 0.92], epFond: 0, teinte, aplat: 0.85, oriente, packed: true, colx: 2, ...couleurs });
  const ENCRE = couleurs.trait1, TRAIT2 = couleurs.trait0, PAPIER = couleurs.fond, POUDRE = teinte || couleurs.trait1;

  // caméra : trois quarts, plongée, de loin ; elle regarde un point qui glisse le long de x (F.camX)
  const DIST = 16000, FOV = 11;
  const camAt = (x) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, tg = [x, 140, 170]; const c = camera({ eye: [tg[0] + DIST * Math.cos(e) * Math.cos(a), tg[1] + DIST * Math.cos(e) * Math.sin(a), tg[2] + DIST * Math.sin(e)], target: tg, fov: FOV }); c.t = tg; return c; };
  const CAM0 = camAt(0), VUE = CAM0.f; // l'orientation ne change pas pendant le travelling
  // la poudre (à verser dans MOTION.poudre) : élévateur à 1,3 s l'aller-retour (course 160 mm, environ 0,25 m/s), deux pistolets
  // à 160 mm l'un de l'autre, empreinte de 110 mm (en x) sur 55 mm (en z) à la face, saturation 6 ; grains : un toutes les
  // 7 ms par buse, 260 ms de vol ; la période est ajustée pour diviser le cycle (les élévateurs bouclent avec lui)
  // v11 : zc est la hauteur du pistolet du bas à mi-course (la pièce est suspendue, son dessous à LG.zb) ; un grain toutes
  // les 1,5 ms par buse, 320 ms de vol ; creux : part de l'exposition qui atteint les faces intérieures (cage de Faraday)
  const PDR = { per: Tc / Math.round(Tc / 1300), course: 80, zc: LG.zb + 70, ecart: 160, sx: 110, sz: 55, k: 9, dte: 1.5, vol: 320, creux: 0.55 };
  const YBUSE = B / 2 + 236;   // la sortie des buses, à 236 mm des grandes faces
  const ASIN98 = Math.asin(0.98);
  const zPistolet = (tau, ph = 0) => PDR.zc + PDR.course * Math.asin(0.98 * Math.sin((2 * Math.PI * tau) / PDR.per + ph)) / ASIN98;
  const W_MONDE = () => (host.clientWidth >= 900 ? 3300 : 2900);
  // trame du décor : dans le plan de chaque face, les lignes vont dans la direction dont l'image à l'écran est parallèle au
  // travelling ; le décor glisse alors le long de ses propres lignes (ni vitre, ni stroboscope) ; ancrage au repère de l'objet
  const S2 = (v) => [dot(v, CAM0.r), -dot(v, CAM0.u)], X2 = S2([1, 0, 0]), cr2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  function axeDecor(n) {
    const e1 = norm(Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0])), e2 = cross(n, e1);
    const c1 = cr2(S2(e1), X2), c2 = cr2(S2(e2), X2);
    let d = add(mulS(e1, c2), mulS(e2, -c1)); if (Math.hypot(...d) < 1e-6) d = e1; d = norm(d);
    if (dot(S2(d), X2) < 0) d = mulS(d, -1);
    return d;
  }
  function decor(polys, o = [0, 0, 0]) { // uv dans le repère de l'objet (origine o), normale gardée
    for (const p of polys) {
      p.n = p.n || newell(p.pts);
      if (p.uv) continue;
      const d = axeDecor(p.n), e = cross(p.n, d), uv = (q) => { const r = sub(q, o); return [dot(r, d), dot(r, e)]; };
      p.uv = p.pts.map(uv); if (p.holes) p.huv = p.holes.map((H) => H.map(uv));
    }
    return polys;
  }
  // ton d'une face : l'éclairage (Lambert, deux faces), puis la part de son groupe ; l'intérieur du four reste sombre.
  // Les maillages envoyés une fois font ce calcul dans le shader (ils peuvent tourner) ; la pièce, recalculée à chaque image, ici.
  // v11 : la tôle brute est claire (tailles fines) ; peinte, la pièce garde des tailles pleines sur sa plaque sombre
  const FACT = { piece: 0.74, piecePeinte: 1, tole: 0.74, sol: 0.5, outil: 0.6, four: 0.6, cabine: 0.42 };
  const tonDe = (n, g) => {
    if (g === 'dedans') return 0.9;
    let ndl = dot(n, LUM); if (dot(n, VUE) > 0) ndl = -ndl;
    return clamp((1 - (AMB + (1 - AMB) * Math.max(0, ndl))) * (FACT[g] ?? 0.6));
  };
  const gOf = (p) => p.g || (p.meta && p.meta.g);

  // ----- la bibliothèque du décor : chaque objet dans son repère, posé à son poste par un décalage (ou une rotation) -----
  const RAIL = F.M.rail, XR = [S.laser + 350, S.chaine + 640], XM = (XR[0] + XR[1]) / 2, zPal = F.zPal;
  // un profilé qui suit une ligne brisée (pts [[x, y, montée]…], demi-largeur hw, de z0 à z1) : le dessus et les deux
  // flancs ; seules les rives sont tracées (pas les joints entre deux tronçons)
  function ruban(pts, hw, z0, z1, meta) {
    const nr = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], d = norm([b[0] - a[0], b[1] - a[1], 0]); return [-d[1], d[0]]; });
    const G = pts.map((p, i) => [p[0] + nr[i][0] * hw, p[1] + nr[i][1] * hw]), Dr = pts.map((p, i) => [p[0] - nr[i][0] * hw, p[1] - nr[i][1] * hw]), out = [];
    const f = (a, b, c, d) => out.push({ ...quad(a, b, c, d, { ...meta }), aretes: [true, false, true, false] });
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i][2] || 0, b = pts[i + 1][2] || 0;
      f([...Dr[i], z1 + a], [...Dr[i + 1], z1 + b], [...G[i + 1], z1 + b], [...G[i], z1 + a]);
      f([...G[i], z1 + a], [...G[i + 1], z1 + b], [...G[i + 1], z0 + b], [...G[i], z0 + a]);
      f([...Dr[i], z0 + a], [...Dr[i + 1], z0 + b], [...Dr[i + 1], z1 + b], [...Dr[i], z1 + a]);
    }
    return out;
  }
  const OU = { g: 'outil' }, DX_TETE = 160; // la tête est portée devant la poutre, côté caméra, à 160 mm de son axe
  // la palette de la commande (mm) : épaisseurs du plateau, des traverses et des semelles, hauteur du chariot de la navette,
  // côté d'un dé (les dés prennent la hauteur qui reste sous PAL.h)
  const PALETTE = { deck: 22, traverse: 18, semelle: 20, chariot: 20, large: 100 };
  // le profil des poinçons (y, z) : 36 mm d'épaisseur, pour laisser 20 mm au poignet du robot qui tient la pièce
  const POINCON = [[-48, 320], [-12, 320], [-12, 64], [3, 10], [0, 0], [-6, 12], [-48, 72]];
  const CENTRALE = [440, -800];   // la centrale à poudre, par rapport au plan des pistolets
  const MAILLES = {
    palette: decor(box(-760, 760, -560, 560, -46, -6, { g: 'sol' })),
    // le portique du laser : deux rails et leurs glissières ; la poutre sur ses deux sommiers ; le chariot (une platine devant
    // la poutre, une potence qui tient la chaîne porte-câbles au-dessus d'elle) ; le coulisseau vertical et la tête (corps,
    // optique, buse)
    rails: decor([...box(-880, 990, -664, -604, -46, 26, OU), ...box(-880, 990, 604, 664, -46, 26, OU), ...box(-870, 980, -644, -624, 26, 36, OU), ...box(-870, 980, 624, 644, 26, 36, OU)]),
    traverse: decor([...box(-92, 92, -684, -584, 36, 250, OU), ...box(-92, 92, 584, 684, 36, 250, OU), ...box(-70, 70, -684, 684, 250, 390, OU)]),
    chariotLaser: decor([...box(-120, -70, -96, 96, 206, 412, OU), ...box(-120, 47, -12, 12, 412, 478, OU)]),
    teteLaser: decor([...box(-40, 40, -46, 46, 170, 452, OU), ...cyl([0, 0, 96], [0, 0, 170], 34, OU, 16), ...cyl([0, 0, 50], [0, 0, 96], 22, OU, 12), ...cyl([0, 0, 9], [0, 0, 50], 6, OU, 12, 19)]),
    // le sol de la ligne : les marquages de zones autour de chaque poste (un trait continu), l'allée de circulation derrière
    // la ligne (deux traits, parallèles au travelling : ils glissent sur eux-mêmes) ; rien n'est peint, seuls des traits clairs
    sol: (() => {
      const z = F.SOL + 0.5, cadre = (x0, x1, y0, y1) => [[[x0, y0, z], [x1, y0, z]], [[x1, y0, z], [x1, y1, z]], [[x1, y1, z], [x0, y1, z]], [[x0, y1, z], [x0, y0, z]]];
      const traits = [
        ...cadre(S.laser - 900, S.laser + 1100, -740, 760), ...cadre(S.presseA - 620, S.presseB + 620, -110, 520),
        ...cadre(S.soudure - 1080, S.soudure + 1080, -560, 600), ...cadre(S.cabine[0] - 260, S.sortie + 160, -1130, 640), ...cadre(S.prise - 330, S.palette[0] + 990, S.palette[1] - 470, -150),
      ].map(([a, b]) => [a, b, 0, 0.55]);
      for (const y of [1320, 1700]) traits.push([[S.laser - 1000, y, z], [S.laser - 1000 + P, y, z], 0, 0.55]);
      return [{ kind: 'face', meta: { g: 'sol', u: [1, 0, 0] }, n: [0, 0, 1], pts: [[S.laser, 0, z], [S.laser + 4, 0, z], [S.laser + 4, 4, z]], uv: [[0, 0], [4, 0], [4, 4]], traits, aretes: [false, false, false] }];
    })(),
    // le rail au sol qui longe la ligne, du laser à la cabine (le septième axe du robot de manutention) : une semelle, deux
    // rails, deux butées de fin de course ; son chariot, avec le bras qui tient la chaîne porte-câbles
    railManip: decor([...box(XR[0], XR[1], RAIL - 130, RAIL + 130, F.SOL, F.SOL + 12, { g: 'sol' }), ...box(XR[0], XR[1], RAIL - 105, RAIL - 75, F.SOL + 12, F.SOL + 40, OU), ...box(XR[0], XR[1], RAIL + 75, RAIL + 105, F.SOL + 12, F.SOL + 40, OU),
      ...box(XR[0] - 30, XR[0], RAIL - 130, RAIL + 130, F.SOL, F.SOL + 70, OU), ...box(XR[1], XR[1] + 30, RAIL - 130, RAIL + 130, F.SOL, F.SOL + 70, OU)]),
    chariotManip: decor([...box(-215, 215, RAIL - 165, RAIL + 165, F.SOL + 40, F.SOL + F.M.chariot, OU), ...box(-60, 60, RAIL - 285, RAIL - 165, F.SOL + 56, F.SOL + 88, OU)]),
    // la palette de la commande, quatre places en carré. Références : la palette à dés (plateau, trois traverses, neuf dés,
    // trois semelles : les fourches passent par les quatre côtés), posée sur le chariot bas de sa navette
    palette4: (() => {
      const { deck, traverse, de, semelle, chariot, large } = PALETTE, z0 = F.SOL + 14, z1 = z0 + chariot, z2 = z1 + semelle, z4 = zPal - deck, z3 = z4 - traverse, XS = [-760, 0, 760], YS = [-290, 0, 290], w = large / 2;
      return decor([
        ...box(-860, 860, -340, 340, z4, zPal, OU),                                                        // le plateau
        ...XS.flatMap((x) => box(x - w, x + w, -340, 340, z3, z4, OU)),                                    // les traverses, en travers
        ...XS.flatMap((x) => YS.flatMap((y) => box(x - w, x + w, y - w, y + w, z2, z3, OU))),              // les dés
        ...YS.flatMap((y) => box(-860, 860, y - w, y + w, z1, z2, OU)),                                    // les semelles, en long
        ...box(-870, 870, -380, 380, z0, z1, OU),                                                          // le chariot de la navette
      ]);
    })(),
    // la voie de la navette : deux rails au sol, de la palette vers l'avant de l'atelier (ils sortent du cadre)
    navette: decor(tramer([-480, 480].flatMap((x) => box(x - 22, x + 22, -F.M0.course - 700, 380, F.SOL, F.SOL + 14, OU)), [0, 1, 0])),
    jardiniere: (() => {
      const pt = F.variants[3], fo = fold(pt, 1), ctr = (q) => [q[0] - F.C0[0], q[1] - F.C0[1], q[2]];
      return mesh(pt, fo).filter((p) => p.kind !== 'bore').map((p) => {
        const M = fo.M.get(p.face), cx = [M[0], M[3], M[6]], cy = [M[1], M[4], M[7]], Tm = [M[9], M[10], M[11]];
        const uvL = (q) => { const d = sub(q, Tm); return [dot(d, cx) - F.C0[0], dot(d, cy) - F.C0[1]]; };
        const trous = p.holes && p.holes.length ? p.holes : null;
        return { kind: p.kind, pts: p.pts.map(ctr), uv: p.pts.map(uvL), holes: trous ? trous.map((H) => H.map(ctr)) : undefined, huv: trous ? trous.map((H) => H.map(uvL)) : undefined, meta: { g: 'piecePeinte', u: [1, 0, 0] }, peint: 3 };   // cuite : la couche est entière partout
      });
    })(),
    matrice: decor(prismX([[-40, -150], [40, -150], [40, -1], [9, -1], [0, -11], [-9, -1], [-40, -1]], -1500, 1500, OU)),
    // le tablier de la presse et ses deux postes d'outillage, autour du milieu de la presse ; poinçons en col de cygne :
    // le profil se creuse du côté de la paroi qui se lève, pour la dégager (sinon elle traverse le corps du poinçon)
    outillage: decor([
      ...box(-1500, 1500, -46, 46, 320, 410, OU),
      ...moved(prismX(POINCON, -400, 400, OU), -F.BEAM / 2),
      ...moved(prismX(POINCON, -(B - 2 * F.t - 2) / 2, (B - 2 * F.t - 2) / 2, OU), F.BEAM / 2),
    ]),
    // la butée arrière d'un poste : une traverse posée au sol derrière la matrice, deux doigts qui viennent toucher le bord
    // de la paroi à plier
    buteeA: decor([...box(-300, 300, 40, 90, -40, 24, OU), ...box(-276, -244, 0, 40, 0, 24, OU), ...box(244, 276, 0, 40, 0, 24, OU)]),
    buteeB: decor([...box(-120, 120, 40, 90, -40, 24, OU), ...box(-106, -74, 0, 40, 0, 24, OU), ...box(74, 106, 0, 40, 0, 24, OU)]),
    // le plateau tournant de la cellule de soudure : un pied fixe, un plateau à quatre rainures (on le voit tourner)
    piedPlateau: decor(cyl([0, 0, F.SOL], [0, 0, -28], 300, { g: 'sol' }, 32)),
    plateau: (() => {
      const p = tramer(cyl([0, 0, -28], [0, 0, -2], 470, OU, 48), [1, 0, 0], [0, 1, 0]);
      p[1].traits = [0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a); return [[90 * c, 90 * s, -2], [440 * c, 440 * s, -2]]; });
      return p;
    })(),
    // ---------- v11 : la ligne de thermolaquage ----------
    // le rail du convoyeur aérien, dans le repère de la ligne : un profilé qui vient du fond de l'atelier, tourne, longe la
    // ligne, tourne et repart ; ses suspentes montent vers la charpente, hors du cadre
    railAerien: (() => {
      const [z0, z1] = LG.rail, pts = [], sus = [], pt = (s) => { const w = VO.a(s); return [w.p[0], w.p[1], w.z]; };
      for (let s = VO.s0; s < VO.sG; s += 70) pts.push(pt(s));
      pts.push(pt(VO.sG));
      for (let s = VO.sD; s < VO.s1; s += 70) pts.push(pt(s));
      pts.push(pt(VO.s1));
      const out = decor(ruban(pts, 21, z0, z1, OU));
      for (let i = 0; i < 5; i++) sus.push([VO.x0 + 150 + ((VO.x1 - VO.x0 - 300) * i) / 4, 0, 0]);
      for (let d = 900; d < VO.sG - VO.s0; d += 1000) sus.push(pt(VO.sG - d), pt(VO.sD + d));
      out[0].traits = sus.map(([x, y, dz]) => [[x, y, z1 + dz], [x, y, z1 + dz + 2600]]);
      return out;
    })(),
    // un chariot à galets : une chape sous le rail, deux bras, deux galets qui roulent sur ses flancs (origine : son point
    // sur la voie, au sol ; x le long de la voie)
    chariotGalets: tramer([...box(-30, 30, -27, 27, LG.pivot + 9, LG.rail[0], OU), ...box(-11, 11, -40, -28, LG.rail[0], LG.rail[0] + 38, OU), ...box(-11, 11, 28, 40, LG.rail[0], LG.rail[0] + 38, OU),
      ...cyl([0, -49, LG.rail[0] + 27], [0, -40, LG.rail[0] + 27], 17, OU, 12), ...cyl([0, 40, LG.rail[0] + 27], [0, 49, LG.rail[0] + 27], 17, OU, 12)], [1, 0, 0]),
    // les deux crochets d'une balancelle (origine : l'œil, sous le chariot) : une tige, un retour vers la pièce, une
    // traverse qui porte son fond ; celui de l'avant et celui de l'arrière se font face
    ...Object.fromEntries([1, -1].map((sg) => {
      const L = LG.pivot - LG.zb + 8, xf = -sg * 64;
      return [sg > 0 ? 'crochetAv' : 'crochetAr', tramer([...cyl([0, 0, 9], [0, 0, -L], 8, OU, 8), ...cyl([0, 0, -L], [xf, 0, -L], 8, OU, 8), ...cyl([xf, -110, -L], [xf, 110, -L], 8, OU, 8)], [0, 0, 1], [1, 0, 0])];
    })),
    // la cabine de poudrage, en écorché (origine : le plan des pistolets) : le caillebotis de la récupération, au ras du
    // sol ; la paroi du fond, fendue pour les pistolets de l'élévateur arrière ; la ceinture haute, en porte-à-faux sur la
    // paroi ; au plafond, les deux rives de la fente du convoyeur. Ni paroi avant, ni poteaux, ni toit : rien ne cache la pièce.
    cabine: (() => {
      const xa = -LG.cabine[0], xb = LG.cabine[1], y0 = -330, y1 = 330, zc = 660, e = 24, p = 36, CB = { g: 'cabine' }, z = F.SOL + 0.6, gr = [];
      const zf = [LG.zb - 30, PDR.zc + PDR.ecart + PDR.course + 50];
      for (let x = xa + 40; x < xb - 10; x += 40) gr.push([[x, y0 + 14, z], [x, y1 - 14, z], 0, 0.55]);
      for (const y of [-220, -110, 0, 110, 220]) gr.push([[xa + 14, y, z], [xb - 14, y, z], 0, 0.55]);
      return decor([
        { ...quad([xa, y0, z], [xb, y0, z], [xb, y1, z], [xa, y1, z], { g: 'sol' }), traits: gr },
        { ...quad([xa, y1, F.SOL], [xb, y1, F.SOL], [xb, y1, zc], [xa, y1, zc], CB), holes: [[[-32, y1, zf[0]], [32, y1, zf[0]], [32, y1, zf[1]], [-32, y1, zf[1]]]] },
        quad([xa, y1, zc], [xb, y1, zc], [xb, y1 + e, zc], [xa, y1 + e, zc], CB),
        quad([xa, y1 + e, F.SOL], [xa, y1, F.SOL], [xa, y1, zc], [xa, y1 + e, zc], CB),
        ...box(xa + p, xb - p, y0, y0 + p, zc - p, zc, CB),
        ...[xa, xb - p].flatMap((x) => [...box(x, x + p, y0 + p, -70, zc - p, zc, CB), ...box(x, x + p, 70, y1, zc - p, zc, CB)]),
        ...box(xa, xb, -70, -40, zc - 30, zc, CB), ...box(xa, xb, 40, 70, zc - 30, zc, CB),
      ]);
    })(),
    // l'élévateur de devant : un socle, une colonne ; son chariot monte et descend avec deux pistolets à lance
    elevateur: decor([...box(-130, 130, -900, -730, F.SOL, F.SOL + 16, OU), ...box(-42, 42, -852, -782, F.SOL + 16, LG.zb + 470, OU)]),
    chariotAv: (() => {
      const out = decor(box(-62, 62, -782, -756, -46, PDR.ecart + 46, OU));
      for (const dz of [0, PDR.ecart]) { out.push(...decor(cyl([0, -756, dz], [0, -YBUSE - 40, dz], 13, OU, 10), [0, 0, dz])); out.push(...decor(cyl([0, -YBUSE - 40, dz], [0, -YBUSE, dz], 21, OU, 12, 11), [0, 0, dz])); }
      return out;
    })(),
    // l'élévateur du fond, derrière la paroi : ses pistolets passent par la fente
    chariotArr: (() => {
      const out = decor(box(-52, 52, 470, 500, -40, PDR.ecart + 40, OU));
      for (const dz of [0, PDR.ecart]) { out.push(...decor(cyl([0, 470, dz], [0, YBUSE + 40, dz], 13, OU, 10), [0, 0, dz])); out.push(...decor(cyl([0, YBUSE + 40, dz], [0, YBUSE, dz], 21, OU, 12, 11), [0, 0, dz])); }
      return out;
    })(),
    // la centrale à poudre, à côté de l'élévateur : une trémie sur quatre pieds, son couvercle, le bloc des pompes
    centrale: (() => {
      const [x, y] = CENTRALE, z = F.SOL;
      return decor([...box(x - 120, x + 120, y - 120, y + 120, z + 60, z + 330, OU), ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([a, b]) => box(x + a * 110 - 9, x + a * 110 + 9, y + b * 110 - 9, y + b * 110 + 9, z, z + 60, OU)),
        ...cyl([x, y, z + 330], [x, y, z + 368], 70, OU, 16), ...box(x - 172, x - 120, y - 60, y + 60, z + 150, z + 270, OU)]);
    })(),
    // le four tunnel (origine : la façade du sas d'entrée) : un sas, la chambre, un sas ; l'entrée découpée à la silhouette
    // de la pièce et de ses crochets ; le rail passe au-dessus du toit, les crochets par une fente qui court d'un bout à
    // l'autre ; l'intérieur rougeoie (groupe braise : une lueur, pas un halo) dans la bouche et au fond de la fente
    four: (() => {
      const sa = LG.sas, x1 = 2 * sa + LG.chambre, y0 = 360, ys = 290, z1 = 640, zs = 540, oy = 215, oz = LG.zb + 370, fe = 35, ep = 26, z0 = F.SOL, FO = { g: 'four' };
      const BZ = (t) => ({ g: 'braise', t });
      // une façade tournée vers −x, en deux moitiés de part et d'autre de la fente : extérieur (ye, ze), ouverture (yi, zi)
      const facade = (x, ye, ze, yi, zi) => [-1, 1].map((k) => { const pts = [[x, k * ye, z0], [x, k * ye, ze], [x, k * fe, ze], [x, k * fe, zi], [x, k * yi, zi], [x, k * yi, z0]]; return { kind: 'face', pts: k > 0 ? pts.reverse() : pts, meta: FO }; });
      const toit = (xa, xb, y, z) => [quad([xa, -y, z], [xb, -y, z], [xb, -fe, z], [xa, -fe, z], FO), quad([xa, fe, z], [xb, fe, z], [xb, y, z], [xa, y, z], FO)];
      const flanc = (xa, xb, y, z) => quad([xa, -y, z0], [xb, -y, z0], [xb, -y, z], [xa, -y, z], FO);
      const joue = (xa, xb, z) => quad([xa, fe, z - 48], [xb, fe, z - 48], [xb, fe, z], [xa, fe, z], BZ(0.34));
      const xf = LG.fond;
      return decor([
        // l'intérieur : le fond de la chambre, la paroi du sas, son sol ; les joues de la fente
        quad([xf, -ys + ep, z0], [xf, -ys + ep, zs - 2], [xf, ys - ep, zs - 2], [xf, ys - ep, z0], BZ(0.6)),
        quad([sa + 40, -fe, zs - 30], [sa + 40, -fe, z1 - 2], [sa + 40, fe, z1 - 2], [sa + 40, fe, zs - 30], BZ(0.6)),   // derrière la fente de la façade de la chambre
        quad([2, ys - ep, z0], [xf, ys - ep, z0], [xf, ys - ep, zs - ep], [2, ys - ep, zs - ep], BZ(0.42)),
        quad([2, -ys + ep, z0 + 1], [xf, -ys + ep, z0 + 1], [xf, ys - ep, z0 + 1], [2, ys - ep, z0 + 1], BZ(0.2)),
        joue(0, sa, zs), joue(sa, x1 - sa, z1), joue(x1 - sa, x1, zs),
        // la coque : façades, tableau de la bouche, flancs, toits
        ...facade(0, ys, zs, oy, oz), ...facade(sa, y0, z1, ys, zs),
        quad([0, oy, z0], [ep, oy, z0], [ep, oy, oz], [0, oy, oz], FO),
        flanc(0, sa, ys, zs), flanc(sa, x1 - sa, y0, z1), flanc(x1 - sa, x1, ys, zs),
        ...toit(0, sa, ys, zs), ...toit(sa, x1 - sa, y0, z1), ...toit(x1 - sa, x1, ys, zs),
      ]);
    })(),
  };
  // les solides du bras articulé (leur trame et leurs normales sont déjà dans leur repère)
  for (const n of BR.noms) { MAILLES[`bras:${n}`] = BR.pieces[n]; MAILLES[`manip:${n}`] = F.BM.pieces[n]; MAILLES[`pal:${n}`] = F.BP.pieces[n]; }
  // la tôle sur sa palette, dans le repère de la palette ; elle porte la trame de la pièce qui en sera découpée (uv du
  // développé ramené au centre) : rien ne saute quand la pièce prend sa place
  const uvD = (q) => [q[0] - F.C0[0], q[1] - F.C0[1]];
  const tole = (trous, apres) => {
    const nom = `tole:${trous.length}:${apres}`;
    if (!MAILLES[nom]) {
      const cs = (q) => [q[0] - F.C0[0], q[1] - F.C0[1], 0], [x0, x1, y0, y1] = F.SHEET, ct = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      MAILLES[nom] = [{ kind: 'face', meta: { g: 'tole' }, pts: ct.map(cs), uv: ct.map(uvD), n: [0, 0, 1], holes: trous.map((h) => h.map(cs)), huv: trous.map((h) => h.map(uvD)), cle: nom }];
    }
    return nom;
  };
  // un maillage sur la carte : ton selon la normale (dans le shader), arêtes vues décidées dans le shader ; la tôle ne trace
  // que ses découpes, à l'encre ; le sol et l'intérieur du four n'ont pas d'arêtes ; outils, robots et four en trait clair
  const mGL = new Map();
  // un petit trou (moins de TROUS.petit mm) fait quelques pixels à l'écran : son contour au trait normal laisse voir ou non
  // son fond selon sa place sur la grille des pixels, il papillote entre un point et un anneau. On le trace d'un trait qui
  // le remplit : un point plein, stable. (À verser dans les tokens : ILLU.trou.)
  const TROUS = { petit: 30, w: 2.6 };
  const wTrou = (h) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9, e = 1e9, g = -1e9; for (const q of h) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); e = Math.min(e, q[2]); g = Math.max(g, q[2]); } return Math.hypot(b - a, d - c, g - e) < TROUS.petit * Math.SQRT2 ? TROUS.w : 1.25; };
  const trousPleins = (f, G, contour) => { let k = contour; for (const h of f.holes || []) { const w = wTrou(h); for (let i = 0; i < h.length; i++) G.aretes[k + i][2] = w; k += h.length; } return G; };
  const mailleGL = (nom) => {
    let m = mGL.get(nom);
    if (!m) {
      m = tr.maille(MAILLES[nom].map((f) => {
        const g = gOf(f);
        if (g === 'dedans') return faceGL(f, { ton: 0.9, cuit: true, aretes: false });
        if (g === 'braise') return faceGL(f, { ton: f.meta.t, cuit: true, aretes: false, peint: 4 });   // l'intérieur du four : une lueur chaude
        if (g === 'tole') return trousPleins(f, faceGL({ ...f, aretes: f.pts.map(() => false) }, { ton: FACT.tole, w: 1.25, c: 0 }), 0);
        if (g === 'piecePeinte') return f.kind === 'face' ? trousPleins(f, faceGL(f, { ton: FACT.piecePeinte, w: 1.25, c: 6, aretes: true, peint: f.peint }), f.pts.length) : faceGL(f, { ton: FACT.piecePeinte, w: 1.25, c: 6, aretes: false, peint: f.peint });
        // les socles au sol (palette du laser, caillebotis de la cabine, pied du plateau) : un contour fin, sinon leur trame finit en peigne
        return faceGL(f, { ton: FACT[g] ?? 0.6, w: g === 'sol' ? 0.8 : 1, aretes: true });
      }));
      mGL.set(nom, m);
    }
    return m;
  };

  // tout le décor part sur la carte au montage (tôle dans ses cinq états compris) : aucune construction pendant la lecture
  const trousA = (tau) => (tau >= F.M.palette ? [] : tau >= F.tCoupe ? [F.full.outline] : F.full.holes.filter((_, i) => { const s = F.steps.find((x) => x.k === 'coupe' && x.idx === i); return s && tau >= s.t1; }));
  if (tr) {
    for (const tau of [0, ...F.steps.filter((x) => x.k === 'coupe').map((x) => x.t1), F.tCoupe]) tole(trousA(tau), tau >= F.tCoupe);
    for (const nom of Object.keys(MAILLES)) mailleGL(nom);
  }

  const surPli = (p, q, bd) => [p, q].every((r) => { const abx = bd.b[0] - bd.a[0], aby = bd.b[1] - bd.a[1], L = Math.hypot(abx, aby), k = ((r[0] - bd.a[0]) * abx + (r[1] - bd.a[1]) * aby) / (L * L); return Math.abs((r[0] - bd.a[0]) * aby - (r[1] - bd.a[1]) * abx) / L < 1e-3 && k > -1e-6 && k < 1 + 1e-6; });
  const PLIS = F.variants.map((v) => v.faces.map((f) => f.loop.map((p, i) => v.bends.findIndex((bd) => surPli(p, f.loop[(i + 1) % f.loop.length], bd)))));
  // le faisceau de la torche : du dévidoir (sur l'avant-bras) à l'arrière du corps de torche
  const CABLE = [[108 * BR.D.L3 / 440, -9, 104 * BR.D.L3 / 440], [44, 0, 0]];

  let view = null, cam = CAM0, ortho = !!tr, plonge = 0; // plonge : la caméra descendue de tant de mm (l'image remonte)
  const proj = (p) => {
    const v = sub(p, ortho ? cam.t : cam.eye), x = dot(v, cam.r), y = dot(v, cam.u);
    if (ortho) return [view.cx + x * view.s, view.cy - y * view.s];
    const z = dot(v, cam.f); return [view.cx + (x * cam.k / z) * view.s, view.cy - (y * cam.k / z) * view.s];
  };

  // ----- une chaîne porte-câbles : un ruban couché sur son appui, qui remonte en demi-cercle et revient vers ce qu'il
  // alimente. O : un point de l'appui sur l'axe du ruban ; d : le sens du ruban (la boucle est du côté +d) ; l : le travers ;
  // sf, sm : le bout fixe (en bas) et le bout mobile (en haut), le long de d ; vm : la vitesse du bout mobile ; L : la somme
  // des deux brins droits. La trame suit la longueur du ruban (une ligne par maillon, en travers) : elle court avec lui.
  const CPC = { R: 44, larg: 62, ep: 16, n: 4 };
  function chaine(out, O, d, l, sf, sm, vm, L) {
    const { R, larg, ep, n } = CPC, sb = (L + sf + sm) / 2, l1 = sb - sf, w = larg / 2, e = ep / 2;
    // sections de la fibre neutre : [position le long de d, hauteur, abscisse le long du ruban, part de la vitesse, normale extérieure (d, z)]
    const sec = [[sf, e, 0, 0, [0, -1]], [sb, e, l1, 0, [0, -1]]];
    for (let j = 1; j <= n; j++) { const th = (Math.PI * j) / n; sec.push([sb + R * Math.sin(th), e + R * (1 - Math.cos(th)), l1 + R * th, j / n, [Math.sin(th), -Math.cos(th)]]); }
    sec.push([sm, e + 2 * R, l1 + Math.PI * R + (sb - sm), 1, [0, 1]]);
    const pt = (c, ke, kw) => add(O, add(mulS(d, c[0] + c[4][0] * e * ke), add(mulS(l, w * kw), [0, 0, c[1] + c[4][1] * e * ke])));
    const face = (pts, uv, nrm, kv, ar) => {
      if (dot(newell(pts), nrm) < 0) { pts.reverse(); uv.reverse(); kv.reverse(); }
      out.faces.push({ kind: 'face', g: 'outil', pts, uv, vits: kv.map((x) => mulS(d, x * vm)), ar, meta: { g: 'outil', u: [...d] } });
    };
    for (let i = 0; i + 1 < sec.length; i++) {
      const a = sec[i], b = sec[i + 1], nm = norm([a[4][0] + b[4][0], a[4][1] + b[4][1]]), ext = add(mulS(d, nm[0]), [0, 0, nm[1]]);
      for (const ke of i === 0 ? [-1] : [1, -1]) { // face extérieure (sauf sous le brin posé), face intérieure
        const p = [pt(a, ke, -1), pt(a, ke, 1), pt(b, ke, 1), pt(b, ke, -1)];
        face(p, [[-w, a[2]], [w, a[2]], [w, b[2]], [-w, b[2]]], mulS(ext, ke), [a[3], a[3], b[3], b[3]], [[p[0], p[3]], [p[1], p[2]]]);
      }
      for (const kw of [-1, 1]) { // les deux chants
        const p = [pt(a, -1, kw), pt(a, 1, kw), pt(b, 1, kw), pt(b, -1, kw)];
        face(p, [[-e, a[2]], [e, a[2]], [e, b[2]], [-e, b[2]]], mulS(l, kw), [a[3], a[3], b[3], b[3]], [[p[0], p[3]], [p[1], p[2]]]);
      }
    }
  }

  // ----- la scène à l'instant tm : le décor posé à ses postes (instances), les solides articulés, les pièces et leur ombre
  // (faces), les tracés. Toutes les lignes de l'atelier sont au même instant a du cycle ; chaque ligne porte une pièce par
  // cycle écoulé depuis sa découpe (âges a, a + Tc, a + 2 Tc) -----
  const H_VIT = 8; // ms : pas de dérivation des vitesses
  const REFROIDIT = 900, ETI = { pas: 70, vie: 260, laser: [34, 180] };   // à verser dans MOTION.soudure : refroidissement du cordon, étincelles (pas, vie ; laser : les mêmes pour la coupe)
  // le faisceau d'un préhenseur à ventouses (vide, capteurs) : il court sur le dessus de l'avant-bras, puis saute le
  // poignet en boucle, du côté extérieur du pli, jusqu'à la main (il ne tourne pas avec la bride)
  function faisceau(out, f, B) {
    const k = B.D.L3 / 440, A = (v) => add(f.avant.p, app3(f.avant.R, mulS(v, k))), P = [[14, 0, 50], [128, 0, 50], [150, 0, 41], [316, 0, 41]].map(A);
    const b = add(f.main.p, app3(f.main.R, mulS([46, 0, 31], k))), dehors = norm(add(app3(f.avant.R, [0, 0, 1]), app3(f.main.R, [0.2, 0, 1])));
    for (let i = 0; i < 3; i++) out.vect.push({ k: 'cable', w: 2.6, droit: true, a: P[i], b: P[i + 1] });
    out.vect.push({ k: 'cable', w: 2.6, a: P[3], b, q: add(mulS(add(P[3], b), 0.5), mulS(dehors, 95 * k)) });
    return f;
  }
  function robot(out, B, prefixe, q, q0, base, base0) {
    const f = B.fk(q, base), f0 = B.fk(q0, base0);
    for (const n of B.noms) out.sol.push([`${prefixe}:${n}`, f[n], f0[n]]);
    return f;
  }
  // la pièce pliée (ses faces dans le repère du développé) : gardée tant qu'aucun pli n'est en cours (à plat, entre deux
  // coups de presse, finie) ; recalculée à chaque image seulement pendant qu'un pli se forme
  const PLIEES = new Map();
  function pliee(st) {
    const fige = st.f.every((x) => x === 0 || x === 1), cle = fige ? `${st.variant}:${st.f.join('')}` : null;
    let r = cle && PLIEES.get(cle);
    if (!r) { const pt = F.variants[st.variant], fo = fold(pt, (i) => st.f[i]); r = { fo, list: mesh(pt, fo).filter((p) => p.kind !== 'bore') }; if (cle) PLIEES.set(cle, r); }
    return r;
  }
  // une pièce à son âge, sur la ligne décalée de o
  function dessinerPiece(out, age, o) {
    const e = F.etat(age);
    if (!e.vis) return;
    if (e.posee) { out.inst.push(['jardiniere', [e.c[0] + o, e.c[1], e.z], [0, (e.c[1] - F.etat(age - H_VIT).c[1]) / H_VIT, 0]]); out.vect.push({ k: 'contact', c: [e.c[0] + o, e.c[1]], rz: 0, z: F.zPal + 0.3 }); return; }   // sur la palette : un maillage fixe
    if (age >= T.lache && age < T.reprise) out.vect.push({ k: 'contact', c: [e.c[0] + o, e.c[1]], rz: e.rz, z: -1.7 });   // sur le plateau de soudure
    if (e.chaud > out.chaud) out.chaud = e.chaud;
    const pieceA = (st) => {
      const cs2 = Math.cos(st.rz), sn2 = Math.sin(st.rz);
      const trp = (q) => { const x = q[0] - F.C0[0], y = q[1] - F.C0[1]; return [st.c[0] + o + cs2 * x - sn2 * y, st.c[1] + sn2 * x + cs2 * y, q[2] + st.z]; };
      return { ...pliee(st), trp };
    };
    const cur = pieceA(e), prev = pieceA(F.etat(age - H_VIT));
    const memes = prev.list.length === cur.list.length;
    const enChaine = age >= T.chaine[0], cut = enChaine ? [S.rideau + o, 1e9] : null;
    const expo = (p) => (p.kind === 'face' && p.side === 'top' ? PDR.creux : 1); // cage de Faraday : l'intérieur se poudre moins
    const lever = lisse(0.5, 14, e.z);
    // repli 2D : la poudre vient en un voile qui monte pendant que la pièce passe devant les pistolets
    const voile = enChaine && !e.peinte ? lisse(T.poudre[0] + 150, T.poudre[1] - 150, age) : 0;
    const plis = PLIS[e.variant];
    cur.list.forEach((p, i) => {
      const M = cur.fo.M.get(p.face) || [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
      const cx = [M[0], M[3], M[6]], cy = [M[1], M[4], M[7]], Tm = [M[9], M[10], M[11]];
      const uvL = (q) => { const d = sub(q, Tm); return [dot(d, cx) - F.C0[0], dot(d, cy) - F.C0[1]]; }; // le grain du développé
      const pts = p.pts.map(cur.trp), q2 = memes && prev.list[i].pts.length === p.pts.length ? prev.list[i].pts.map(prev.trp) : null;
      const holes = p.holes && p.holes.length ? p.holes.map((H) => H.map(cur.trp)) : undefined;
      let vits = q2 ? pts.map((q, j) => mulS(sub(q, q2[j]), 1 / H_VIT)) : null;
      if (vits && holes) {
        const ph = prev.list[i].holes;
        if (ph && ph.length === holes.length && ph.every((H, k) => H.length === holes[k].length)) { const h2 = ph.map((H) => H.map(prev.trp)); holes.forEach((H, k) => H.forEach((q, c) => vits.push(mulS(sub(q, h2[k][c]), 1 / H_VIT)))); }
        else vits = null;
      }
      const ax = [cx[0] * Math.cos(e.rz) - cx[1] * Math.sin(e.rz), cx[0] * Math.sin(e.rz) + cx[1] * Math.cos(e.rz), cx[2]];
      // les arêtes du contour qui sont des lignes de pli, et l'avancement de leur pli (trait mixte fin tant que le pli est à plat)
      let lp = null;
      if (p.kind === 'face') { const n = p.pts.length, mk = plis[p.face]; lp = p.pts.map((_, j) => { const b = mk[p.side === 'top' ? j : (2 * n - 2 - j) % n]; return b < 0 ? -1 : e.f[b]; }); }
      out.faces.push({ kind: p.kind, side: p.side, g: 'piece', pts, uv: p.pts.map(uvL), holes, huv: p.holes && p.holes.length ? p.holes.map((H) => H.map(uvL)) : undefined, vits, cut, peint: e.peinte ? 3 : enChaine ? expo(p) : 0, cuit: !!e.peinte, voile, plis: lp,
        cle: p.kind === 'face' ? `p:${e.variant}:${p.face}:${p.side}` : null, meta: { g: 'piece', u: ax } });
      // ombre portée : la pièce levée pose une ombre douce sur le sol (plus claire avec la hauteur) ; posée, rien
      if (lever > 0 && p.kind === 'face' && p.side === 'top') {
        const tons = pts.map((q) => 0.5 * lever * (1 - lisse(0, 520, q[2] - F.SOL)));
        out.faces.push({ kind: 'face', g: 'ombre', pts: pts.map((q, j) => [q[0], q[1], F.SOL + 1 + tons[j]]), uv: pts.map((q) => [q[0], q[1]]), n: [0, 0, 1], tons, holes: holes && holes.map((H) => H.map((q) => [q[0], q[1], F.SOL + 1])), huv: holes && holes.map((H) => H.map((q) => [q[0], q[1]])), vits: vits && vits.map((v) => [v[0], v[1], 0]), cle: `o:${e.variant}:${p.face}` });
      }
    });
    // les cordons de soudure, de haut en bas le long de chaque angle ; n : la bissectrice sortante de l'angle (le cordon
    // s'efface quand son angle se détourne de la caméra), t : le travers du cordon ; chaud : le bout encore chaud
    const cord = F.cordons(age), cr = Math.cos(e.rz), sr = Math.sin(e.rz), passe = age < T.tour[0] ? T.passe1 : T.passe2;
    const sousPoudre = e.peinte ? 0 : 1 - lisse(S.rideau - 250, S.rideau + 450, e.c[0]);   // la poudre couvre les cordons
    if (sousPoudre <= 0) return;
    F.ANGLES.forEach((q, i) => {
      if (cord[i] <= 0) return;
      const w = cur.trp([q[0], q[1], 0]), bx = Math.sign(q[0] - F.C0[0]), by = Math.sign(q[1] - F.C0[1]);
      const n = norm([cr * bx - sr * by, sr * bx + cr * by, 0]), a = [w[0] + n[0] * 2, w[1] + n[1] * 2, e.z + Hh - 2];
      out.vect.push({ k: 'cordon', a, b: [a[0], a[1], a[2] - (Hh - 4) * cord[i]], n, t: [-n[1], n[0], 0], p: cord[i], face: clamp(-dot(n, VUE) / 0.12) * sousPoudre, arriere: w[1] > e.c[1] + 1, chaud: (i < 2) === (passe === T.passe1) ? age - passe[1] : 1e9, peinte: enChaine });
    });
  }
  function scene(tm, xcam = null) {
    const out = { inst: [], sol: [], faces: [], vect: [], chaud: 0 };
    const pose = (nom, off, vit) => out.inst.push([nom, off, vit || null]);
    // ce qui peut être vu : la demi-largeur du cadre le long de x, plus une marge (un objet en avant ou en arrière du plan de
    // travail se décale à l'écran)
    const xc = xcam ?? F.camX(tm), half = W_MONDE() * 0.6 + 900;
    const inView = (x0, x1 = x0, marge = 450) => x1 > xc - W_MONDE() * 0.6 - marge && x0 < xc + W_MONDE() * 0.6 + marge;
    const a = ((tm % Tc) + Tc) % Tc, a0 = a - H_VIT;
    const mMin = Math.floor((xc - half - S.palettiseur - 600) / P) - 1, mMax = Math.ceil((xc + half - S.laser + 800) / P) + 1;
    for (let m = mMin; m <= mMax; m++) {
      const o = m * P;
      pose('sol', [o, 0, 0]);
      // laser : palette, tôle (entière, puis squelette), portique (rails, poutre, chariot, tête), chaîne porte-câbles
      if (inView(S.laser + o - 800, S.laser + o + 1000)) {
        const xl = S.laser + o;
        pose('palette', [xl, 0, 0]); pose('rails', [xl, 0, 0]);
        pose(tole(trousA(a), a >= F.tCoupe && a < F.M.palette), [xl, 0, 0]);
        const hd = F.tete(a), h2 = F.tete(a0);
        const hx = xl + hd.hp[0] - F.C0[0], hy = hd.hp[1] - F.C0[1], vx = (hd.hp[0] - h2.hp[0]) / H_VIT, vy = (hd.hp[1] - h2.hp[1]) / H_VIT, vz = (hd.hz - h2.hz) / H_VIT;
        pose('traverse', [hx + DX_TETE, 0, 0], [vx, 0, 0]);
        pose('chariotLaser', [hx + DX_TETE, hy, 0], [vx, vy, 0]);
        pose('teteLaser', [hx, hy, hd.hz], [vx, vy, vz]);
        // la chaîne porte-câbles du chariot, sur la poutre (celle de la poutre court derrière le rail du fond, hors de vue)
        if (inView(xl - 800, xl + 1000, 300)) chaine(out, [hx + DX_TETE + 16, 0, 390], [0, 1, 0], [1, 0, 0], -60, hy, vy, 630);
        if (hd.coupe || hd.perce) out.vect.push({ k: 'faisceau', a: [hx, hy, 9], b: [hx, hy, 0], tm: a, feu: hd.feu });
        if (hd.braise) out.vect.push({ k: 'braise', p: [xl + hd.braise.p[0] - F.C0[0], hd.braise.p[1] - F.C0[1], 0], tm: a, feu: hd.braise.k });
        // les étincelles de la coupe : chacune part de l'endroit où était la tête à sa naissance, à l'opposé de l'avance
        // v11 : une gerbe courte et serrée derrière la tête (une tôle mince crache surtout sous elle) : plus d'étincelles,
        // plus lentes, plus brèves ; aucune ne s'égare loin du trait
        if (a < F.tCoupe + ETI.vie) out.vect.push({ k: 'etincelles', tm: a, force: 0.34, pas: ETI.laser[0], vie: ETI.laser[1], source: (tb) => { const h1 = F.tete(tb); if (!h1.coupe) return null; const h0 = F.tete(tb - H_VIT); return { p: [xl + h1.hp[0] - F.C0[0], h1.hp[1] - F.C0[1], 0], dir: norm([(h0.hp[0] - h1.hp[0]) / H_VIT, (h0.hp[1] - h1.hp[1]) / H_VIT, 0.4]) }; } });
        if (hd.trace) out.vect.push({ k: 'trait', pts: hd.trace.map((q) => [xl + q[0] - F.C0[0], q[1] - F.C0[1], 0]) });
      }
      // presse : la matrice, les butées, le tablier et ses deux poinçons (descendus d'un bloc)
      if (inView(S.presseA + o - 700, S.presseB + o + 700)) {
        const xm = (S.presseA + S.presseB) / 2 + o, e = a >= T.presse[0] && a < T.presse[1] ? F.etat(a) : null, e2 = a0 >= T.presse[0] && a0 < T.presse[1] ? F.etat(a0) : null;
        pose('matrice', [xm, 0, 0]);
        const zT = F.tablier(a, e), zT2 = F.tablier(a0, e2);
        pose('outillage', [xm, 0, zT], [0, 0, (zT - zT2) / H_VIT]);
        for (const [poste, xP] of [['A', S.presseA + o], ['B', S.presseB + o]]) {
          const yb = F.butee(a, poste), yb2 = F.butee(a0, poste);
          pose(poste === 'A' ? 'buteeA' : 'buteeB', [xP, Hh + 8 + yb, 0], [0, (yb - yb2) / H_VIT, 0]);
        }
      }
      // le rail qui longe la ligne, son chariot et le robot de manutention, la chaîne porte-câbles du chariot
      if (inView(XR[0] + o, XR[1] + o, 700)) {
        pose('railManip', [o, 0, 0]);
        const mn = F.manip(a), m0 = F.manip(a0), x7 = mn.x7 + o, v7 = (mn.x7 - m0.x7) / H_VIT;
        chaine(out, [o, RAIL - 250, F.SOL], [1, 0, 0], [0, 1, 0], XM, mn.x7, v7, XR[1] - XM);
        if (inView(x7 - 1500, x7 + 1500, 700) && mn.q && m0.q) {
          pose('chariotManip', [x7, 0, 0], [v7, 0, 0]);
          faisceau(out, robot(out, F.BM, 'manip', mn.q, m0.q, { p: [x7, RAIL, mn.base.p[2]], lacet: mn.base.lacet }, { p: [m0.x7 + o, RAIL, mn.base.p[2]], lacet: mn.base.lacet }), F.BM);
        }
      }
      // soudure : le plateau tournant, les deux robots et leurs torches
      if (inView(S.soudure + o - 1100, S.soudure + o + 1100)) {
        const xs = S.soudure + o, ctr = [xs, 0, 0];
        pose('piedPlateau', ctr);
        out.sol.push(['plateau', { R: rotZ(F.plateau(a)), p: ctr }, { R: rotZ(F.plateau(a0)), p: ctr }]);
        for (const rb of F.robots) {
          const base = { p: [rb.base.p[0] + o, rb.base.p[1], rb.base.p[2]], lacet: rb.base.lacet };
          const f = robot(out, BR, 'bras', rb.prog.q(a), rb.prog.q(a0), base, base);
          out.vect.push({ k: 'cable', a: add(f.avant.p, app3(f.avant.R, CABLE[0])), b: add(f.outil.p, app3(f.outil.R, CABLE[1])), d: app3(f.outil.R, [-1, 0, 0]) });
          const feu = F.feuArc(a), dirE = app3(f.pointe.R, [-1, 0, 0]), fil = (tb) => { const q = rb.fil(tb); return [q[0] + o, q[1], q[2]]; };
          if (feu > 0) out.vect.push({ k: 'arc', at: F.arc(a) ? f.pointe.p : fil(a), tm: a, feu });
          if (a >= T.passe1[0] && a < T.passe2[1] + ETI.vie) out.vect.push({ k: 'etincelles', tm: a, force: 1, source: (tb) => (F.arc(tb) ? { p: fil(tb), dir: dirE } : null) });
        }
      }
      // v11 · peinture : le convoyeur aérien (rail, chariots à galets, chaîne, crochets), la cabine en écorché et ses deux
      // élévateurs en opposition de phase, la centrale à poudre et ses tuyaux, le four tunnel ; le dépôt et le nuage de poudre
      if (inView(VO.x0 - VO.R + o - 150, VO.x1 + VO.R + o + 150, 900)) {
        const xg = S.rideau + o, zg = zPistolet(a), zg2 = zPistolet(a, Math.PI);
        const vz = (zg - zPistolet(a0)) / H_VIT, vz2 = (zg2 - zPistolet(a0, Math.PI)) / H_VIT;
        pose('railAerien', [o, 0, 0]); pose('cabine', [xg, 0, 0]); pose('four', [S.four + o, 0, 0]); pose('centrale', [xg, 0, 0]);
        pose('elevateur', [xg, 0, 0]); pose('chariotAv', [xg, 0, zg], [0, 0, vz]); pose('chariotArr', [xg, 0, zg2], [0, 0, vz2]);
        // les tuyaux de poudre : de l'arrière de chaque lance à la centrale, en boucle basse (ils suivent le chariot)
        for (const [i, dz] of [0, PDR.ecart].entries()) {
          const p = [xg + 30, -784, zg + dz - 8], b = [xg + CENTRALE[0] - 36 + 72 * i, CENTRALE[1] + 14, F.SOL + 368];
          out.vect.push({ k: 'cable', w: 2.2, a: p, b, q: [(p[0] + b[0]) / 2 - 40, -900, Math.min(p[2], b[2]) - 150 - 60 * i] });
        }
        // la chaîne : un chariot tous les VO.pas mm, à vitesse constante ; les crochets pendent des deux chariots voisins du
        // centre d'une balancelle ; ils se balancent avec la pièce quand le préhenseur la lâche, et un rien quand on la leur prend
        const sT = VO.s(a), k0 = Math.ceil((VO.s0 - sT) / VO.pas), k1 = Math.floor((VO.s1 - sT) / VO.pas), dsv = F.V * H_VIT, zc = LG.pivot + 12;
        let avant = null;
        for (let k = k0; k <= k1; k++) {
          const sk = sT + k * VO.pas, w = VO.a(sk), px = w.p[0] + o;
          if (!inView(px - 500, px + 500, 300)) { avant = null; continue; }
          const w0 = VO.a(sk - dsv), Rz = rotZ(w.h), Rz0 = rotZ(w0.h);
          // dans la pente le chariot s'incline avec le rail, autour de son point sur le rail (son maillage a l'origine au sol)
          const incline = (wk, Rk) => { if (!wk.pente) return { R: Rk, p: [wk.p[0] + o, wk.p[1], wk.z] }; const Rp = mul3(Rk, rotY(-wk.pente)), v = app3(Rp, [0, 0, LG.rail[0]]); return { R: Rp, p: [wk.p[0] + o - v[0], wk.p[1] - v[1], wk.z + LG.rail[0] - v[2]] }; };
          out.sol.push(['chariotGalets', incline(w, Rz), incline(w0, Rz0)]);
          // la chaîne, du chariot précédent à celui-ci (en courbe : par petits tronçons)
          if (avant !== null) {
            const n = w.h !== 0 || avant.h !== 0 || w.z !== 0 || avant.z !== 0 ? 5 : 1; let q0 = avant.q;
            for (let i = 1; i <= n; i++) { const wi = i === n ? w : VO.a(sk - VO.pas * (1 - i / n)), q1 = [wi.p[0] + o, wi.p[1], zc + wi.z]; out.vect.push({ k: 'chaine', a: q0, b: q1 }); q0 = q1; }
          }
          avant = { h: w.h, z: w.z, q: [px, w.p[1], zc + w.z] };
          const r = ((k % VO.n) + VO.n) % VO.n;
          if (r !== 1 && r !== VO.n - 1) continue;
          const j = Math.round((k - (r === 1 ? 1 : -1)) / VO.n), th = (ag) => -Math.asin(clamp(F.balance(ag) / (LG.pivot - LG.zb), -0.2, 0.2)) + libre(ag, r === 1 ? 1 : -1);
          out.sol.push([r === 1 ? 'crochetAv' : 'crochetAr', { R: mul3(Rz, rotY(th(a + j * Tc))), p: [px, w.p[1], LG.pivot + w.z] }, { R: mul3(Rz0, rotY(th(a0 + j * Tc))), p: [w0.p[0] + o, w0.p[1], LG.pivot + w0.z] }]);
        }
        if (a >= T.chaine[0] && a < T.cuite + 300) out.depot = { v: F.V, t: a, sx: PDR.sx, zc: PDR.zc, course: PDR.course, per: PDR.per, sz: PDR.sz, ecart: PDR.ecart, k: PDR.k };
        if (a >= T.poudre[0] - 60 && a < T.poudre[1] + PDR.vol + 60) out.vect.push({ k: 'poudre', xg, o, tau: a });
      }
      // la fin de la ligne, devant le rail : le palettiseur, la palette de la commande et ses trois jardinières
      if (inView(S.prise + o - 500, S.palette[0] + o + 1000, 900)) {
        const dy = F.depart(a), vy = [0, (dy - F.depart(a0)) / H_VIT, 0];   // la commande complète part sur sa navette
        pose('navette', [S.palette[0] + o, S.palette[1], 0]);
        pose('palette4', [S.palette[0] + o, S.palette[1] + dy, 0], vy);
        for (const c of F.CASES.slice(0, 3)) { pose('jardiniere', [c[0] + o, c[1] + dy, c[2]], vy); out.vect.push({ k: 'contact', c: [c[0] + o, c[1] + dy], rz: 0, z: F.zPal + 0.3 }); }
        const base = { p: [F.baseP.p[0] + o, F.baseP.p[1], F.baseP.p[2]], lacet: F.baseP.lacet };
        faisceau(out, robot(out, F.BP, 'pal', F.palet(a).q, F.palet(a0).q, base, base), F.BP);
      }
      // les pièces de cette ligne
      for (let g = 0; g < 2; g++) {
        const age = a + g * Tc;
        if (age < F.tCoupe || age >= F.LIFE) continue;   // pas encore coupée, ou enlevée avec la commande
        const xp = F.etat(age).c[0] + o;
        if (inView(xp - 900, xp + 900, 500)) dessinerPiece(out, age, o);
      }
    }
    return out;
  }

  // préchauffe : les triangulations de la pièce et de son ombre, calculées une fois pour chaque état (à plat, levée, pliée,
  // retournée, peinte) avant la lecture ; aucun calcul nouveau ne tombe pendant le film
  if (tr) {
    const mi = (a) => (a[0] + a[1]) / 2, chauffe = [F.tCoupe + 1, T.prise[1] + 400, mi(T.versPresse), ...T.coups.map((c) => (c.k === 'coup' ? c.t1 - 1 : mi([c.t0, c.t1]))), mi(T.versSoudure), mi(T.tour), mi(T.versChaine), mi(T.chaine), T.prisePal + 500, T.pose + 100];
    tr.begin({});
    for (const tt of chauffe) for (const f of scene(tt).faces) { f.n = f.n || newell(f.pts); tr.face(f.pts, f.uv, 0, { trous: f.holes ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, cle: f.cle }); }
  }

  let t = 0, playing = false, dead = false, lastVal = '', lastCh = '', dtImg = 0;
  // vitesse de lecture (0 à 1) : la pause freine et la reprise repart sur une courbe courte, jamais d'arrêt sec
  let vitesse = 0, horloge = 0, rampe = null, raccord = null;
  const HAUT = [0, 0, 1], NUL = [0, 0, 0];
  // un cordon dans le moteur : un trait épais à l'encre, et ses écailles (deux traits de papier en chevron, bombés vers le
  // départ du cordon), au pas des trempages ; tailles en px d'écran (s : px par mm)
  function cordonGL(v, s) {
    if (v.face <= 0) return;
    tr.arete(v.a, v.b, 3.2, 0, v.n, 1e9, 0, v.face);
    const L = v.a[2] - v.b[2], pasE = (Hh - 4) / F.T.ecailles, d1 = 1.9 / s, d2 = 2.2 / s;
    for (let d = pasE; d < L - 1 / s; d += pasE) {
      const c = [v.a[0], v.a[1], v.a[2] - d], m = [c[0], c[1], c[2] + d2];
      tr.arete(add(c, mulS(v.t, d1)), m, 1, 2, v.n, 1e9, 0, v.face); tr.arete(m, sub(c, mulS(v.t, d1)), 1, 2, v.n, 1e9, 0, v.face);
    }
    // le bout du cordon encore chaud : il suit la torche, puis s'éteint (REFROIDIT ms)
    if (v.chaud < REFROIDIT) {
      const al = (v.chaud < 0 ? 1 : 1 - v.chaud / REFROIDIT) * v.face;
      tr.arete([v.b[0], v.b[1], v.b[2] + Math.min(L, 46)], v.b, 3.2, 5, v.n, 1e9, 0, 0.8 * al); tr.arete([v.b[0], v.b[1], v.b[2] + Math.min(L, 14)], v.b, 3.2, 4, v.n, 1e9, 0, 0.9 * al);
    }
  }
  // ----- les lumières chaudes (teintes ILLU.chaud, ILLU.etincelle, P.ambre), prises dans la profondeur de la scène -----
  const RC = CAM0.r, UC = CAM0.u;
  // un point lumineux : deux traits croisés dans le plan de l'image (largeur en px, couleur, opacité)
  const point = (p, w, c, al, s) => { const d = w / (4 * s); tr.arete(sub(p, mulS(RC, d)), add(p, mulS(RC, d)), w, c, NUL, 1e9, 0, al); tr.arete(sub(p, mulS(UC, d)), add(p, mulS(UC, d)), w, c, NUL, 1e9, 0, al); };
  // le point chaud d'un arc ou d'une coupe : un cœur, un halo court ; il vibre sans à-coup (deux sinus, jamais par sauts)
  // feu (0 à 1) : son intensité pendant qu'il s'allume ou s'éteint (il grossit et s'éclaire, il se resserre et pâlit)
  const pointChaud = (p, tm, k0, s, feu = 1) => { if (feu <= 0) return; const f = 0.5 + 0.25 * Math.sin(tm / 23) + 0.25 * Math.sin(tm / 9.7 + 1.3), k = k0 * (0.55 + 0.45 * feu); point(p, (9 + 4 * f) * k, 5, 0.3 * feu, s); point(p, (5 + 2 * f) * k, 4, 0.75 * feu, s); point(p, (2.4 + 1.1 * f) * k, 3, feu, s); };
  // quelques étincelles : au plus une tous les ETI.pas ms (une sur deux part), lancée vers `dir`, freinée par l'air, courbée
  // par la pesanteur ; un trait court qui s'éteint en ETI.vie ms. source(instant de naissance) : { p, dir } si l'arc ou la
  // coupe brûlait à cet instant, sinon null ; une étincelle née finit son vol même si l'arc s'est éteint depuis
  function etincelles(tm, source, force, pasE = ETI.pas, vie = ETI.vie) {
    for (let n = Math.ceil((tm - vie) / pasE); n <= Math.floor(tm / pasE); n++) {
      const h1 = hache(n * 3 + 1), h2 = hache(n * 3 + 2), h3 = hache(n * 3 + 3);
      if (h1 > 0.55) continue;
      const src = source(n * pasE); if (!src) continue;
      const { p, dir } = src;
      const age = tm - n * pasE, v0 = add(mulS(dir, (500 + 700 * h2) * force), mulS([(h3 - 0.5) * 500, (h2 - 0.5) * 500, 250 + 600 * h3], Math.min(1, force * 1.6)));
      const pos = (sd) => { const k = (1 - Math.exp(-3 * sd)) / 3; return [p[0] + v0[0] * k, p[1] + v0[1] * k, p[2] + v0[2] * k - 4905 * sd * sd]; };
      // elle part claire (ILLU.etincelle) et refroidit en vol : ambre (P.ambre) sur la seconde moitié de sa vie, puis s'éteint
      const a = pos(Math.max(0, age / 1000 - 0.022)), b = pos(age / 1000), k = age / vie;
      tr.arete(a, b, 1.4, 5, NUL, 1e9, 0, 0.9 * (1 - k) * lisse(0.25, 0.6, k));
      tr.arete(a, b, 1.4, 4, NUL, 1e9, 0, 0.95 * (1 - lisse(0.25, 0.6, k)));
    }
  }
  // le faisceau d'une torche : une courbe souple du dévidoir à l'arrière de la torche
  function cableGL(v) {
    const w = v.w || 2.4; if (v.droit) { tr.arete(v.a, v.b, w, 1, NUL); return; }
    const Q = v.q || add(v.b, mulS(v.d, 170)); let p0 = v.a;
    for (let i = 1; i <= 7; i++) { const k = i / 7, q = 1 - k, p1 = [0, 1, 2].map((j) => q * q * v.a[j] + 2 * q * k * Q[j] + k * k * v.b[j]); tr.arete(p0, p1, w, 1, NUL); p0 = p1; }
  }
  // ombre de contact : la pièce posée serre un trait d'ombre contre son pied, couché sur le plan qui la porte (ses parois
  // en cachent la moitié) ; deux passes, large et pâle, étroite et plus dense
  function contactGL(v) {
    const c = Math.cos(v.rz), s = Math.sin(v.rz), hx = F.A / 2 + 1, hy = F.B / 2 + 1;
    const Q = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([x, y]) => [v.c[0] + c * x - s * y, v.c[1] + s * x + c * y, v.z]);
    for (const [w, al] of V9.contact) for (let i = 0; i < 4; i++) tr.arete(Q[i], Q[(i + 1) % 4], w, 0, HAUT, 1e9, 0, al * (v.al ?? 1));
  }
  // saut : { x (caméra, mm), flou (déplacement de la caméra pendant l'obturation, mm), vx (mm/ms) } pendant un raccord de chapitre
  function draw(tm, saut = null) {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return false;
    cam = camAt(saut ? saut.x : F.camX(tm)); plonge = saut ? saut.h : F.camH(tm);
    const PF = window.__filmProf, n0 = PF ? performance.now() : 0;
    const sc = scene(tm, saut ? saut.x : null);
    const n1 = PF ? performance.now() : 0;
    if (tr) {
      const s = W / W_MONDE();
      view = { s, cx: W / 2, cy: H * V9.camera.haut - plonge * s };
      const vh = saut || dtImg <= 0 ? 0 : ((F.camH(tm + 2) - F.camH(tm - 2)) / 4) * vitesse; // la caméra descend : elle va vers −u
      // pas de la trame dans la matière : environ `pas` px à l'écran pour une face vue de trois quarts
      const fl = saut ? S2([saut.flou * s, 0, 0]) : [0, 0];
      tr.begin({ W, H, cam: { t: cam.t, r: cam.r, u: cam.u, f: cam.f }, s, cx: view.cx, cy: view.cy, pas: pas / (s * 0.75), chaleur: sc.chaud, dt: dtImg, vcam: saut ? [saut.vx, 0, 0] : dtImg > 0 ? [F.camV(tm) * vitesse - cam.u[0] * vh, -cam.u[1] * vh, -cam.u[2] * vh] : [0, 0, 0], flou: fl, depot: sc.depot || null });
      // obturation sur toute la durée de l'image : le filtre temporel juste pour une trame fine (une ligne qui avance d'un
      // demi-pas par image se fond au lieu de papillonner) ; à l'arrêt, aucune durée, l'image est nette
      for (const [nom, off, vit] of sc.inst) tr.instance(mailleGL(nom), off, vit);
      for (const [nom, p1, p0] of sc.sol) tr.solide(mailleGL(nom), p1, p0, H_VIT);
      for (const f of sc.faces) {
        f.n = f.n || newell(f.pts);
        tr.face(f.pts, f.uv, tonDe(f.n, f.cuit ? 'piecePeinte' : f.g), { trous: f.holes ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, tons: f.tons || null, peint: f.peint || 0, cut: f.cut, vits: f.vits, cle: f.cle });
        if (f.ar) { for (const [a, b] of f.ar) tr.arete(a, b, 1, 1, f.n); continue; }                     // chaînes porte-câbles : leurs deux rives, en trait clair
        if (f.g !== 'piece' || f.kind !== 'face' || dot(f.n, VUE) >= 0) continue; // arêtes vues de la pièce, à l'encre
        const R = f.pts, ce = f.cuit ? 6 : 0;   // peinte, la pièce prend un liseré clair (le satiné accroche les arêtes)
        for (let i = 0; i < R.length; i++) {
          const pl = f.plis ? f.plis[i] : -1, a = R[i], b = R[(i + 1) % R.length];
          if (pl < 0 || f.cuit) { tr.arete(a, b, 1.25, ce, f.n); continue; }
          // une ligne de pli : trait mixte fin sur la tôle à plat (elle n'est pas coupée), arête pleine dès que le pli se forme
          const kk = lisse(0, 0.12, pl);
          if (kk < 1) tr.arete(a, b, 0.9, 0, f.n, 1e9, 1, 0.8 * (1 - kk));
          if (kk > 0) tr.arete(a, b, 1.25, 0, f.n, 1e9, 0, kk);
        }
        for (const h of f.holes || []) { const w = wTrou(h); for (let i = 0; i < h.length; i++) tr.arete(h[i], h[(i + 1) % h.length], w, ce, f.n); }
      }
      // tracés pris dans la profondeur de la scène (ils sont cachés par ce qui passe devant eux) : le faisceau du laser et
      // son point chaud, le trait de coupe en cours, les cordons, les arcs, les étincelles, les faisceaux de torche
      for (const v of sc.vect) {
        if (v.k === 'faisceau') { tr.arete(v.a, v.b, 2, 0, NUL, 1e9, 0, v.feu); pointChaud(v.b, v.tm, 0.7, s, v.feu); }
        else if (v.k === 'braise') pointChaud(v.p, v.tm, 0.7, s, v.feu);
        else if (v.k === 'etincelles') etincelles(v.tm, v.source, v.force, v.pas, v.vie);
        else if (v.k === 'trait') {
          for (let i = 0; i + 1 < v.pts.length; i++) tr.arete(v.pts[i], v.pts[i + 1], 1.25, 0, HAUT);
          // le trait encore chaud derrière la tête : 60 mm d'ambre, qui s'éteint avec la distance
          let reste = 60;
          for (let i = v.pts.length - 1; i > 0 && reste > 0; i--) { const b = v.pts[i], a0 = v.pts[i - 1], L = Math.hypot(b[0] - a0[0], b[1] - a0[1]) || 1, k = Math.min(1, reste / L); tr.arete([b[0] + (a0[0] - b[0]) * k, b[1] + (a0[1] - b[1]) * k, 0], b, 1.6, 5, HAUT, 1e9, 0, 0.9 * reste / 60); reste -= L; }
        } else if (v.k === 'cordon') cordonGL(v, s);
        else if (v.k === 'cable') cableGL(v);
        else if (v.k === 'contact') contactGL(v);
        else if (v.k === 'arc') pointChaud(v.at, v.tm, 1, s, v.feu);
        else if (v.k === 'chaine') tr.arete(v.a, v.b, 1.5, 1, NUL, 1e9, 1, 0.9);
        else if (v.k === 'poudre') grains(v, (p0, p1, al) => tr.arete(p0, p1, 1.2, 7, NUL, 1e9, 0, 0.9 * al));
      }
      tr.end();
    } else dessin2d(sc, W, H);
    const n2 = PF ? performance.now() : 0;
    // les tracés vectoriels par-dessus (la poudre ; en repli : faisceau, tracé de coupe, cordons, arc)
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (ink.width !== cw || ink.height !== ch) { ink.width = cw; ink.height = ch; }
    const ic = ink.getContext('2d'); ic.setTransform(dpr, 0, 0, dpr, 0, 0); ic.clearRect(0, 0, W, H);
    ic.lineJoin = 'round'; ic.lineCap = 'round';
    // pendant le raccord, les tracés fins (arc, poudre) s'effacent avec la vitesse : le filé les emporterait
    ic.globalAlpha = saut && tr ? clamp(1 - Math.abs(saut.flou * (W / W_MONDE())) / 24) : 1;
    if (!tr) encre2d(ic);
    for (const v of sc.vect) {
      if (!tr && v.k === 'faisceau' && v.feu > 0.5) { const a = proj(v.a), b = proj(v.b); ic.strokeStyle = ENCRE; ic.lineWidth = 2; ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0], b[1]); ic.stroke(); }
      if (!tr && v.k === 'trait') { ic.strokeStyle = ENCRE; ic.lineWidth = 1.25; ic.beginPath(); v.pts.forEach((q, i) => { const a = proj(q); i ? ic.lineTo(a[0], a[1]) : ic.moveTo(a[0], a[1]); }); ic.stroke(); }
      if (!tr && v.k === 'cordon' && !v.arriere) {
        const a = proj(v.a), b = proj(v.b), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
        ic.strokeStyle = ENCRE; ic.lineWidth = 3.2; ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0], b[1]); ic.stroke();
        // écailles : des arcs bombés vers le départ du cordon, au pas des trempages
        const pitch = Math.max(3.5, L / Math.max(1, F.T.ecailles * v.p)); ic.lineWidth = 1; ic.strokeStyle = PAPIER;
        for (let d = pitch; d < L - 1; d += pitch) { const cx = a[0] + ux * d, cy = a[1] + uy * d; ic.beginPath(); ic.moveTo(cx + nx * 1.9, cy + ny * 1.9); ic.quadraticCurveTo(cx - ux * 2.2, cy - uy * 2.2, cx - nx * 1.9, cy - ny * 1.9); ic.stroke(); }
      }
      if (!tr && v.k === 'arc' && v.feu > 0.5) { const a = proj(v.at), r = 2.6 + 1.4 * (0.5 + 0.25 * Math.sin(v.tm / 23) + 0.25 * Math.sin(v.tm / 9.7 + 1.3)); ic.fillStyle = PAPIER; ic.strokeStyle = ENCRE; ic.lineWidth = 1.25; ic.beginPath(); ic.arc(a[0], a[1], r, 0, Math.PI * 2); ic.fill(); ic.stroke(); }
      if (!tr && v.k === 'poudre') { ic.strokeStyle = POUDRE; ic.lineWidth = 1.4; const a0 = ic.globalAlpha; grains(v, (p0, p1, al) => { const a = proj(p0), b = proj(p1); ic.globalAlpha = a0 * 0.8 * al; ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0] + 0.01, b[1]); ic.stroke(); }, PDR.dte * 4); ic.globalAlpha = a0; }
    }
    if (!saut) valeurs(tm);
    if (PF) { const n3 = performance.now(); PF.push([n1 - n0, n2 - n1, 0, n3 - n2, sc.faces.length, tm]); }
    return true;
  }

  // ----- le nuage de poudre (v11) : quatre buses (deux élévateurs en opposition de phase, deux pistolets chacun). Chaque
  // grain part d'une buse à un instant fixé (un toutes les PDR.dte ms), dans un cône ; il ralentit, puis le champ le
  // rabat sur la pièce : sur la face, ou, s'il la manque, par-dessus le bord vers la face intérieure, autour d'un bout,
  // sous le fond (l'enveloppement électrostatique) ; quelques-uns, perdus, tombent vers le caillebotis de la récupération.
  // Les pistolets ne soufflent que pendant que la pièce est devant eux (détection de pièce), montée et coupure douces.
  // fn(p0, p1, opacité) : un grain, son court sillage ; les traits sont pris dans la profondeur de la scène.
  function hache(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  // les crochets délestés se balancent un rien quand le palettiseur leur prend la pièce (radians ; sg : devant ou derrière)
  function libre(ag, sg) { const d = ag - T.prisePal - 420; return d <= 0 ? 0 : sg * (V11.balance.libres / (LG.pivot - LG.zb)) * Math.exp(-d / 900) * Math.sin((2 * Math.PI * d) / V11.balance.per) * lisse(0, 200, d); }
  function grains(v, fn, pasG = PDR.dte) {
    const { xg, o, tau } = v, Lp = PDR.vol, zb = LG.zb, top = zb + Hh, Dn = YBUSE - B / 2;
    for (let j = 0; j < 4; j++) {
      const cote = j < 2 ? -1 : 1, ph = cote < 0 ? 0 : Math.PI, dzj = (j % 2) * PDR.ecart;
      for (let n = Math.ceil((tau - Lp) / pasG); n <= Math.floor(tau / pasG); n++) {
        const te = n * pasG, u = (tau - te) / Lp, ce = F.xH(te) + o, rel = xg - ce;
        const on = lisse(-A / 2 - 70, -A / 2 - 10, rel) * (1 - lisse(A / 2 + 10, A / 2 + 70, rel));
        if (on <= 0) continue;
        const h1 = hache(n * 4 + j * 7919 + 1), h2 = hache(n * 4 + j * 7919 + 2), h3 = hache(n * 4 + j * 104729 + 3), h4 = hache(n * 4 + j * 1299709 + 4);
        const zN = zPistolet(te, ph) + dzj, N = [xg, cote * YBUSE, zN];
        const rr = Math.sqrt(h1), an = 2 * Math.PI * h2, xa = xg + Dn * 0.5 * rr * Math.cos(an), za = zN + Dn * 0.38 * rr * Math.sin(an);   // où il toucherait le plan de la face
        const ca = ce + F.V * Lp, x0 = ca - A / 2, x1 = ca + A / 2, yf = cote * (B / 2 + 1);                                                // la pièce à son arrivée
        let C1, E;
        if (za > top + 3) { C1 = [xa, cote * (B / 2 + 10), top + 24 + (za - top) * 0.5]; E = [xa + 8, cote * (B / 2 - 3), top - 20 - (za - top) * 1.4]; }             // par-dessus le bord, il revient sur la face intérieure
        else if (xa < x0 + 3) { C1 = [x0 - 24 - (x0 - xa) * 0.4, cote * (B / 2 + 8), za]; E = [x0 - 1, cote * (B / 2 - 26 - (x0 - xa) * 1.3), za]; }                 // autour du bout arrière
        else if (xa > x1 - 3) { C1 = [x1 + 24 + (xa - x1) * 0.4, cote * (B / 2 + 8), za]; E = [x1 + 1, cote * (B / 2 - 26 - (xa - x1) * 1.3), za]; }                 // autour du bout avant
        else if (za < zb + 3) {
          if (h4 < 0.55) { C1 = [xa, cote * (B / 2 + 6), zb - 22 - (zb - za) * 0.4]; E = [xa, cote * (B / 2 - 30 - (zb - za)), zb - 1]; }                            // sous le fond
          else { C1 = [xa, cote * (B / 2 + 46), zb - 30]; E = [xa + 34, cote * (B / 2 + 14 + 70 * h3), F.SOL + 3]; }                                               // perdu : vers le caillebotis
        } else { C1 = [lerp(xg, xa, 0.62), cote * (B / 2 + Dn * 0.36), lerp(zN, za, 0.62)]; E = [xa, yf, za]; }                                                     // sur la face
        const pos = (w) => { const k = 1 - (1 - w) ** 1.7, q = 1 - k; return [q * q * N[0] + 2 * q * k * C1[0] + k * k * E[0], q * q * N[1] + 2 * q * k * C1[1] + k * k * E[1], q * q * N[2] + 2 * q * k * C1[2] + k * k * E[2]]; };
        const al = on * lisse(0, 0.07, u) * (1 - lisse(0.86, 1, u)) * (0.4 + 0.6 * h3) * (0.55 + 0.45 * lisse(0.05, 0.4, u));   // serrés à la buse, ils y sont plus pâles
        if (al > 0.02) fn(pos(Math.max(0, u - 0.022)), pos(u), al);
      }
    }
  }

  // ----- repli sans WebGL2 : l'ancienne trame d'écran (gravure.js), peintre par couches, projection en perspective -----
  let couches = null;
  const traceP = (ctx, p) => { ctx.beginPath(); p.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); if (p.holes) for (const Hx of p.holes) { Hx.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); } };
  function dessin2d(sc, W, H) {
    const camP = camera({ eye: cam.eye, target: cam.t, fov: FOV }); cam = Object.assign(camP, { t: cam.t });
    const s = (W / W_MONDE()) * DIST / camP.k;
    view = { s, cx: W / 2, cy: H * V9.camera.haut - plonge * (W / W_MONDE()) };
    // Ordre du peintre, objet par objet. Tout au fond : l'intérieur des fours, puis les appuis (sol, tôle, caillebotis,
    // plateau, rails, matrice, butées, palettes) ; ensuite chaque objet (un solide de robot, une machine, une face de la
    // pièce) du plus loin au plus près de la caméra (profondeur de son centre) : les faces de la coque du four cachent
    // ce qui y est entré. Le tablier de la presse compte pour trois objets (la poutre, un poinçon par poste) : la paroi qui
    // se lève derrière un poinçon passe derrière lui, celle de devant passe devant.
    const L = { dedans: [], sol: [], four: [] }, objets = [];
    const APPUIS = new Set(['sol', 'plateau', 'piedPlateau', 'rails', 'railManip', 'palette4', 'navette', 'matrice', 'buteeA', 'buteeB', 'palette']);
    const prof = (q) => dot(sub(q, camP.eye), camP.f);
    const objet = (cle) => { const o = { polys: [], s: 0, n: 0 }; objets.push(o); return o; };
    const ajoute = (o, poly) => { o.polys.push(poly); for (const q of poly.pts) { o.s += prof(q); o.n++; } };
    const poser = (nom, mv, rv) => {
      const parts = new Map();
      for (const f of MAILLES[nom]) {
        const g = gOf(f);
        const poly = { kind: 'face', pts: f.pts.map(mv), holes: f.holes && f.holes.length ? f.holes.map((Hx) => Hx.map(mv)) : undefined, meta: { g, u: rv((f.meta && f.meta.u) || [1, 0, 0]), peint: g === 'piecePeinte' ? 1 : 0 } };
        if (g === 'dedans' || g === 'braise') { L.dedans.push(poly); continue; }
        if (APPUIS.has(nom) || g === 'tole' || g === 'sol') { L.sol.push(poly); continue; }
        // v11 : la pièce traverse la cabine et le four ; chaque face de la coque du four est un objet, la paroi du fond
        // de la cabine aussi (derrière la pièce), sa ceinture haute un autre (devant)
        let part = nom === 'four' ? `f${parts.size}` : nom === 'cabine' && f.pts.every((q) => q[1] >= 329) ? 1 : 0;
        if (nom === 'outillage') { const cx = f.pts.reduce((s, q) => s + q[0], 0) / f.pts.length, long = Math.max(...f.pts.map((q) => q[0])) - Math.min(...f.pts.map((q) => q[0])); part = long > 2000 || Math.abs(Math.abs(cx) - 1500) < 1 ? 0 : cx < 0 ? 1 : 2; }
        if (!parts.has(part)) parts.set(part, objet());
        ajoute(parts.get(part), poly);
      }
    };
    for (const [nom, off] of sc.inst) poser(nom, (q) => [q[0] + off[0], q[1] + off[1], q[2] + off[2]], (u) => u);
    for (const [nom, p1] of sc.sol) poser(nom, (q) => add(app3(p1.R, q), p1.p), (u) => app3(p1.R, u));
    for (const f of sc.faces) {
      if (f.g === 'ombre') continue;
      const meta = { g: f.g, u: f.meta.u, plis: f.plis }, poly = { kind: 'face', pts: f.pts, holes: f.holes, meta }, o = objet();
      if (f.g !== 'piece') { ajoute(o, poly); continue; }
      // v11 : plus de rideau ; la poudre est un voile de la teinte qui monte (encre2d), la peinture cuite un aplat
      ajoute(o, { ...poly, meta: { ...meta, peint: f.cuit ? 1 : 0, voile: f.voile || 0 } });
    }
    objets.sort((a, b) => b.s / (b.n || 1) - a.s / (a.n || 1));
    const listes = [L.dedans, L.sol, ...objets.filter((o) => o.n).map((o) => o.polys), L.four];
    for (const list of listes) for (const p of list) {
      const u = p.meta.u, q = p.pts[0], a = proj(q), b = proj([q[0] + u[0] * 60, q[1] + u[1] * 60, q[2] + u[2] * 60]);
      p.meta.ang = Math.hypot(b[0] - a[0], b[1] - a[1]) < 3 ? 0 : Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    const R = (list) => render(list, camP, { size: s, cx: view.cx, cy: view.cy, color: [255, 255, 255], ink: [0, 0, 0], amb: AMB, light: [-0.8, -0.35, 0.55], paths: false });
    couches = listes.map(R);
    const tonOf = (p) => { const sh = parseInt(p.fill.slice(4), 10) / 255, g = p.meta && p.meta.g; if (g === 'dedans' || g === 'braise') return 0.9; return clamp((1 - sh) * (FACT[g] ?? 0.6)); };
    grav.frame((ctx) => { for (const Lc of couches) for (const p of Lc) { traceP(ctx, p); ctx.fillStyle = tonPack(tonOf(p), (p.meta && p.meta.peint) || 0, (p.meta && p.meta.ang) || 0); ctx.fill('evenodd'); } });
  }
  function encre2d(ic) {
    if (!couches) return;
    for (const [li, Lc] of couches.entries()) for (const p of Lc) {
      traceP(ic, p);
      if (li > 0) { ic.globalCompositeOperation = 'destination-out'; ic.fill('evenodd'); ic.globalCompositeOperation = 'source-over'; }
      const g = p.meta && p.meta.g;
      if (g === 'piece' && p.meta.voile > 0) { const a0 = ic.globalAlpha; ic.globalAlpha = a0 * 0.45 * p.meta.voile; ic.fillStyle = POUDRE; ic.fill('evenodd'); ic.globalAlpha = a0; }
      const pl = g === 'piece' && p.meta.plis && p.meta.plis.length === p.pr.length ? p.meta.plis : null;
      if (pl && pl.some((x) => x >= 0 && x < 0.12)) {
        // une ligne de pli n'est pas coupée : trait mixte fin tant que la tôle est à plat (comme dans le moteur GL)
        ic.strokeStyle = ENCRE;
        for (let i = 0; i < pl.length; i++) {
          const a = p.pr[i], b = p.pr[(i + 1) % pl.length], mixte = pl[i] >= 0 && pl[i] < 0.12;
          ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0], b[1]); ic.setLineDash(mixte ? [10, 3, 2, 3] : []); ic.lineWidth = mixte ? 0.9 : 1.25; ic.stroke();
        }
        ic.setLineDash([]); ic.lineWidth = 1.25;
        if (p.holes) { ic.beginPath(); for (const Hx of p.holes) { Hx.forEach((q, i) => (i ? ic.lineTo(q[0], q[1]) : ic.moveTo(q[0], q[1]))); ic.closePath(); } ic.stroke(); }
      } else if (g !== 'dedans' && g !== 'braise' && g !== 'sol') { ic.lineWidth = g === 'piece' ? 1.25 : 1; ic.strokeStyle = g === 'piece' ? ENCRE : TRAIT2; ic.stroke(); }
    }
  }

  // ----- la ligne de valeurs, en HTML (onValeurs), et le chapitre en cours (onChapitre) -----
  const NB = ' ';
  const NF1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fr = (v) => NF1.format(v).replace(/[  ]/g, NB);
  const chapitreA = (c) => { let id = F.CH[0].id; for (const ch of F.CH) if (c >= ch.t - 0.5) id = ch.id; return id; }; // tolérance : le modulo flottant d'un saut de chapitre
  const COUPS = F.COUPS;
  // onValeurs(phrase, phrase courte, chapitre) : la phrase courte tient sur une ligne à 390 px (la page l'emploie sous 480 px)
  function valeurs(tm) {
    const a = ((tm % Tc) + Tc) % Tc, id = chapitreA(a);
    let txt = '', court = null;
    if (a >= T.prisePal - 400) { txt = 'La quatrième jardinière rejoint la commande sur sa palette'; court = `La commande de 4${NB}pièces est prête`; }
    else if (id === 'decoupe') txt = `Le laser a coupé ${fr(F.coupe(a) / 1000)}${NB}m sur ${fr(F.LONG / 1000)}`;
    else if (id === 'pliage') {
      // le pli en cours (ou le prochain) et son angle intérieur mesuré : 180° à plat, 88° sous charge, 90° au retour
      const cur = COUPS.find((c) => a < c.t1) || COUPS[COUPS.length - 1], fv = F.etat(a).f[cur.ps.bi];
      txt = `Le pli ${cur.i + 1} sur 4 est à ${fr(180 - 90 * fv)}°`;
    } else if (id === 'soudure') {
      const cd = F.cordons(a), n = cd.filter((x) => x >= 1).length, enCours = cd.some((x) => x > 0 && x < 1);
      if (enCours) { txt = `Les torches MIG soudent les angles ${n + 1} et ${n + 2}`; court = `Les torches soudent les angles ${n + 1} et ${n + 2}`; }
      else if (n === 0) { txt = 'Les torches MIG vont souder les quatre angles'; court = 'Les torches MIG vont souder'; }
      else txt = n >= 4 ? 'Les quatre angles sont soudés' : `${n} angles sur 4 sont soudés`;
    } else if (a < T.poudre[0] + 200) { txt = 'Le robot suspend la jardinière au convoyeur aérien'; court = 'Le robot suspend la jardinière'; }   // jusqu'à ce que la poudre couvre 1 %
    else if (a < T.poudre[1]) {
      // la part de la pièce passée devant les pistolets (la mesure qui change en direct)
      const pc = Math.round(100 * clamp((a - T.poudre[0] - 180) / (T.poudre[1] - T.poudre[0] - 360)));
      txt = `La poudre RAL${NB}7016 couvre ${pc}${NB}% de la jardinière`; court = `La poudre couvre ${pc}${NB}% de la pièce`;
    } else if (a < T.four[1] + 500) txt = `Le four cuit la poudre à 180${NB}°C`;
    else { txt = 'La peinture cuite refroidit à la sortie du four'; court = 'La peinture cuite refroidit'; }
    if (txt !== lastVal) { lastVal = txt; onValeurs && onValeurs(txt, court || txt, id); }
    if (id !== lastCh) { lastCh = id; onChapitre && onChapitre(id); }
  }

  // Une image : la rampe de vitesse (pause, reprise), puis le raccord de chapitre s'il y en a un, sinon la lecture.
  // Raccord de chapitre : la caméra file le long de l'atelier jusqu'au poste demandé (un panoramique filé, « whip pan », qui
  // masque le raccord dans son flou) ; à mi-course, au plus fort du filé, le temps de la scène passe de l'instant quitté à
  // celui du chapitre. Durée : deux gestes d'approche (partir, freiner) ; position en raccord d'Hermite, à la vitesse de la
  // caméra aux deux bouts (celle qu'elle a à l'instant quitté, celle qu'elle a à l'instant rejoint) : le film repart sans à-coup.
  const RAMPE = PR.approche.ms, DUREE_RACCORD = 2 * PR.approche.ms;
  function avancer(dt) {
    horloge += dt;
    if (rampe) { const u = seg(horloge - rampe.debut, 0, RAMPE); vitesse = lerp(rampe.v0, rampe.v1, EASE.convoyeur(u)); if (u >= 1) rampe = null; }
    const av = dt * vitesse;
    if (raccord) {
      const R = raccord, e = horloge - R.debut, u = clamp(e / R.dur);
      R.av += av;
      const x = hermite(R.x0, R.v0 * R.vit * R.dur, R.x1, R.v1 * R.vit * R.dur, u);
      const tm = u < 0.5 ? R.de + R.av : R.vers - (R.dur - e) * R.vit;
      if (u >= 1) { raccord = null; t = ((R.vers % Tc) + Tc) % Tc; dtImg = av; draw(t); }
      else { dtImg = dt; draw(tm, { x, h: lerp(F.camH(R.de), F.camH(R.vers), S5(u)), flou: x - R.xp, vx: (x - R.xp) / Math.max(dt, 1) }); R.xp = x; }
    } else { t += av; if (t >= Tc) t -= Tc; dtImg = av; draw(t); }
    if (!playing && !rampe && !raccord) { vitesse = 0; dtImg = 0; draw(t); return false; }
    return true;
  }
  // horloge : jusqu'à 120 i/s avec le moteur GL (un écran rapide montre un travelling plus fin), 60 en repli
  const tk = ticker((dt) => (dead ? false : avancer(dt)), { el: host, margin: '0px', fps: tr ? 120 : 60 });
  // le pliage se montre au poste B : la paroi courte se lève à côté du segment (au poste A, le poinçon de 800 mm la cache)
  const contour = F.steps.find((s) => s.k === 'coupe' && s.idx === 'contour'), coup0 = COUPS.find((c) => c.ps.poste === 'B') || COUPS[0];
  // images clés (mouvements réduits) : un instant parlant par poste
  const KEYS = {
    decoupe: contour.t0 + (contour.t1 - contour.t0) * 0.6,
    pliage: coup0.appui[0] + PR.appui.ms * 0.72,
    soudure: T.passe1[0] + (T.passe1[1] - T.passe1[0]) * 0.65,
    peinture: T.chaine[0] + F.GUN / F.V,
  };
  const api = {
    F, T, Tc, KEYS, CH: F.CH,
    get moteur() { return tr ? tr.mode : 'repli'; },
    play() { if (rm) return; playing = true; rampe = { v0: vitesse, v1: 1, debut: horloge }; tk.start(); },
    // la pause freine sur une courbe courte (MOTION.presse.approche, départ et arrêt doux) ; l'image finale est nette
    pause() { playing = false; if (rm) { dtImg = 0; api.redraw(); return; } rampe = { v0: vitesse, v1: 0, debut: horloge }; tk.start(); },
    get playing() { return playing; },
    seek(ms, dt = 0) { raccord = null; rampe = null; t = ((ms % Tc) + Tc) % Tc; dtImg = dt; api.redraw(); }, // dt : durée d'image simulée (banc d'essai du flou)
    chapitre(id) {
      const ch = F.CH.find((c) => c.id === id); if (!ch) return;
      if (rm || !tr || !host.clientWidth) { raccord = null; t = rm ? KEYS[id] : ch.t; dtImg = 0; api.redraw(); return; }
      // le poste demandé, à la période la plus proche (le monde est périodique : même image à (x + P, t + Tc))
      const de = raccord ? raccord.vers - raccord.dur * raccord.vit : t, x0 = raccord ? raccord.xp : F.camX(t);
      let vers = ch.t; for (const n of [-1, 1]) if (Math.abs(F.camX(ch.t + n * Tc) - x0) < Math.abs(F.camX(vers) - x0)) vers = ch.t + n * Tc;
      raccord = { de, vers, x0, x1: F.camX(vers), v0: F.camV(de), v1: F.camV(vers), xp: x0, debut: horloge, dur: DUREE_RACCORD, av: 0, vit: playing ? 1 : 0 };
      valeurs(((vers % Tc) + Tc) % Tc); // la ligne de valeurs et le chapitre suivent le clic tout de suite
      tk.start();
    },
    // banc d'essai : avance l'horloge d'une image, sans l'horloge du navigateur (images exactes)
    pas(dt) { tk.stop(); return avancer(dt); },
    redraw() { if (!dead && !draw(t)) requestAnimationFrame(() => api.redraw()); },
    get t() { return t; },
    destroy() { dead = true; tk.destroy(); ro.disconnect(); tr ? tr.destroy() : grav.destroy(); },
  };
  const ro = new ResizeObserver(() => { if (!playing) api.redraw(); });
  ro.observe(host);
  if (rm) { t = KEYS.decoupe; api.redraw(); } else { api.redraw(); if (autoplay) { vitesse = 1; api.play(); } }
  return api;
}
