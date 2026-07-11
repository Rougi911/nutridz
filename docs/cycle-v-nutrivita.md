CYCLE EN V NUTRIVITA — SPECIFICATIONS, AGENTS ET VALIDATION REGLEMENTAIRE
Document cadre dérivé des sessions de conception (design, architecture backend, analyse du mock v0, business plan).
Usage : fichier de référence à placer à la racine des deux projets et à charger dans Claude Code en début de chaque phase.

================================================================
0. REGLES DU PROCESSUS
================================================================
- Le développement suit le V : SB -> SA -> SL -> Implémentation -> TU -> TI -> Validation.
- Chaque étape de la descente est produite par un AGENT PRODUCTEUR puis évaluée par un AGENT CRITIQUE
  (définitions section 7). Boucle d'autocritique : le critique rend un verdict CONFORME / NON CONFORME
  avec liste d'écarts ; le producteur corrige ; maximum 2 boucles, ensuite arbitrage humain (Ahmed).
- Chaque étape se termine par un GATE : verdict du critique + checklist réglementaire de l'agent
  réglementaire (section 8). Aucun passage à l'étape suivante sans double GO. Tracer chaque gate
  dans docs/gates.md (date, verdict, écarts résiduels acceptés).
- Traçabilité obligatoire : toute exigence EB-xx doit être couverte par au moins un AL-xx ou SL-xx,
  et tout AL/SL par au moins un TU/TI, et tout EB par un critère VAL (matrice section 9).
- Toute modification d'une spec amont en cours de phase aval = retour au gate amont (pas de dérive).

================================================================
1. SPECIFICATION DE BESOIN (SB) — exigences fonctionnelles
================================================================
EB-01  Détection de plat par PHOTO : l'utilisateur photographie son assiette ; le système identifie
       le plat, les ingrédients et estime la portion ; l'utilisateur peut corriger avant validation.
EB-02  Saisie par VOIX en FR/AR/EN : une phrase libre peut contenir repas, activité sportive et/ou
       mesure de glycémie ; le système décompose et route chaque élément. Confirmation requise.
EB-03  Saisie MANUELLE : recherche d'aliments (cascade CIQUAL -> USDA -> 60 plats pré-enregistrés),
       composition de plats personnalisés, gestion des accents FR.
EB-04  SCAN code-barres des produits industriels : récupération composition, Nutri-Score, additifs ;
       signalement des additifs à risque.
EB-05  BILAN JOURNALIER : calories consommées vs objectif, ajusté de l'activité sportive
       (Strava automatique, voix, ou sélection manuelle d'activité avec durée).
EB-06  STATISTIQUES par jour / semaine / mois / année : calories, macros, poids, glycémie.
EB-07  SUIVI DU POIDS saisi par l'utilisateur + ESTIMATION masse graisseuse et musculaire.
EB-08  CARENCES POTENTIELLES estimées depuis l'alimentation enregistrée ET la position géographique
       (ex. vitamine D selon latitude/saison). Formulation non diagnostique.
EB-09  GLYCEMIE : saisie manuelle, vocale, import CSV, capteur connecté (Dexcom, phase 3) ;
       métriques cliniques GMI/TIR/CV, zones cibles personnalisables, unité g/L par défaut
       (mg/dL et mmol/L disponibles), alerte hypoglycémie, moyennes par contexte de mesure.
EB-10  SUIVI DES COURSES : historique des produits scannés consommés sur la semaine/le mois,
       bilan de surconsommation (sucres, sel, acides gras saturés) vs repères, alternatives.
EB-11  MULTILINGUE FR/AR/EN avec rendu RTL complet pour l'arabe.
EB-12  PWA accessible mobile et web (desktop : contenu centré max-w-md), comptes utilisateurs.
EB-13  PORTAIL PROFESSIONNEL DE SANTE (phase 3) : suivi multi-patients avec alertes, messagerie,
       ajustement de plan ; activé uniquement sur consentement explicite et révocable du patient.
EB-14  PERSONNALISATION : objectif (perte/maintien/prise/diabète), profil (âge, sexe, taille, poids),
       toggle "Je suis diabétique" masquant les fonctions glycémie si désactivé.

Exigences réglementaires (bloquantes à chaque gate) :
REG-01 RGPD : consentement explicite et granulaire à l'inscription ; opt-in séparé pour tout
       partage/monétisation de données (agrégées, anonymisées) ; registre des traitements.
REG-02 Droits utilisateur : export complet des données et suppression de compte effectifs (déjà
       présents dans l'app : à maintenir et tester à chaque release).
REG-03 Minimisation : la géolocalisation pour EB-08 se limite au pays/à la latitude approximative,
       jamais de position précise stockée.
REG-04 Disclaimers santé OBLIGATOIRES et non supprimables sur : carences ("estimation indicative,
       ne remplace pas un bilan sanguin"), composition corporelle ("estimation par formule"),
       glycémie ("ne remplace pas un avis médical ; en cas d'hypoglycémie, suivez le protocole de
       votre médecin").
REG-05 FRONTIERE DISPOSITIF MEDICAL (UE MDR 2017/745) : NutraLance reste une app de bien-être tant
       qu'elle AFFICHE des mesures et tendances sans émettre de recommandation thérapeutique.
       INTERDIT sans marquage CE : calcul de dose d'insuline, recommandation de traitement,
       interprétation diagnostique ("vous êtes diabétique"). Toute fonctionnalité approchant cette
       frontière = NO-GO automatique au gate + analyse juridique avant reprise. Même prudence pour
       l'Algérie (réglementation produits de santé) et la loi algérienne 18-07 sur les données.
REG-06 Hébergement : dès l'ouverture du portail pro (EB-13), les données de santé traitées pour le
       compte de professionnels imposent un hébergeur certifié HDS en France -> migration hors
       Render free tier à prévoir et budgéter en phase 3.
REG-07 AIPD (analyse d'impact) à réaliser AVANT toute monétisation de données et avant EB-13.

================================================================
2. SPECIFICATION D'ALGORITHMES (SA) — calculs et estimations
================================================================
AL-01 BESOINS CALORIQUES (objectif kcal/jour) :
      BMR (Mifflin-St Jeor) = 10*poids_kg + 6.25*taille_cm - 5*age + s  (s = +5 homme, -161 femme)
      TDEE = BMR * facteur (sédentaire 1.2 / léger 1.375 / modéré 1.55 / intense 1.725)
      Objectif = TDEE - 400 (perte) / TDEE (maintien) / TDEE + 300 (prise de masse).
AL-02 CALORIES D'ACTIVITE : kcal = MET * poids_kg * durée_heures.
      Table MET : course 9.0, vélo 7.0, marche 3.5, natation 6.0, musculation 5.0.
      Si l'activité vient de Strava avec kcal natives, les kcal Strava priment.
AL-03 ANNEAU CALORIQUE : restant = objectif + brûlé_activité - consommé.
      Le crédit d'activité est plafonné à 1000 kcal/jour (anti-compensation excessive).
AL-04 UNITES GLYCEMIE : stockage interne TOUJOURS en mg/dL.
      g/L = mg/dL / 100 ; mmol/L = mg/dL / 18.016. Conversion à l'affichage et à la saisie
      uniquement ; les seuils de zones sont convertis avec la même fonction.
AL-05 METRIQUES GLYCEMIQUES (sur la période sélectionnée) :
      GMI (%) = 3.31 + 0.02392 * moyenne(mg/dL)   [formule de Bergenstal]
      TIR (%) = part des mesures dans [70 ; 180] mg/dL (bornes = cible utilisateur si modifiée)
      CV (%) = écart-type / moyenne * 100 ; stable si < 36 %.
      Zones : <54 très basse, 54-70 basse, 70-180 cible, 180-250 haute, >250 très haute.
      GARDE STATISTIQUE (issue d'autocritique) : ces métriques sont définies pour des mesures
      continues (CGM). Avec des mesures ponctuelles : exiger >= 12 mesures sur la période, sinon
      afficher "données insuffisantes" ; mentionner "estimé sur N mesures ponctuelles".
AL-06 COMPOSITION CORPORELLE (estimation, EB-07) :
      Masse grasse % (Deurenberg) = 1.20*IMC + 0.23*age - 10.8*sexe - 5.4  (sexe : 1 homme, 0 femme)
      IMC = poids / taille_m². Masse musculaire estimée via masse maigre (Forbes) ; afficher la
      tendance plutôt que la valeur absolue. Disclaimer REG-04 systématique.
AL-07 CARENCES (EB-08) : pour chaque micronutriment couvert par CIQUAL (fer, calcium, vit D, B12,
      magnésium, folates), cumuler les apports sur 14 jours glissants et comparer aux références
      ANSES (par sexe/âge). Apports < 50 % de la référence = "Probable" ; 50-70 % = "A surveiller".
      Facteur géographique vit D : latitude > 35° ET mois entre octobre et mars => abaisser le seuil
      d'alerte (synthèse cutanée réduite). Ne JAMAIS écrire "carence avérée" ni nommer une maladie.
AL-08 SCORE PRODUIT (EB-04) : base = Nutri-Score fourni par OpenFoodFacts converti sur 100
      (A=90, B=75, C=55, D=35, E=15) ; malus additifs selon liste de risque (EFSA/OFF) :
      -30 par additif à risque élevé (ex. E150d, nitrites E249-E252, E621), -15 par additif à
      risque modéré (ex. E471, E955) ; borné [0;100]. Verdict : >=75 Excellent, 50-74 Médiocre,
      <50 Mauvais. Toujours citer les additifs en cause.
AL-09 BILAN COURSES MENSUEL (EB-10) : pour chaque produit scanné * quantité consommée déclarée,
      cumuler sucres, sel, AGS sur le mois ; comparer aux repères OMS rapportés au mois :
      sucres libres < 50 g/j, sel < 5 g/j, AGS < 10 % de l'apport énergétique. Affichage en % du
      repère avec code couleur (<=80 % teal, 80-110 % ambre, >110 % rouge).
AL-10 INTERPRETATION IA (EB-01, EB-02) : Gemini 2.5 Flash-Lite, sortie JSON stricte :
      { "intents": [ { "type": "meal"|"activity"|"glucose", "items": [...], "confidence": 0..1 } ] }
      meal.items = [{name, quantity_g}], activity = {sport, durée_min}, glucose = {valeur, unité,
      contexte}. Toute confidence < 0.6 => écran de confirmation obligatoire avant enregistrement.
      Les valeurs nutritionnelles viennent TOUJOURS de la cascade CIQUAL/USDA, jamais de l'IA.
AL-11 AUTO-AJUSTEMENT MACROS : quand un curseur bouge de delta, répartir -delta sur les deux autres
      proportionnellement à leurs valeurs ; somme strictement = 100 ; bornes min 10 %.

================================================================
3. SPECIFICATION LOGICIELLE (SL) — référence
================================================================
SL-01 Architecture : frontend Next.js (nutrivita-v0), backend Express/Node 20 (nutridz), SQLite
      async -> migration PostgreSQL au plus tard avant EB-13 ; déploiement Render, auto-deploy git.
SL-02 Endpoints à créer/confirmer : POST /api/interpret (AL-10), POST /api/scan + tables
      scanned_products (AL-08/09), GET /api/stats/deficiencies (AL-07), webhooks Strava (AL-02),
      conversions et cibles glycémie côté backend (AL-04/05).
SL-03 Conventions existantes (NE PAS dévier) : req.userId (jamais req.user.id), champs snake_case
      (weight_kg, glucose_mg_dl, calories_burned), arabe en échappements \uXXXX, CORS whitelist.
SL-04 UI : la spécification d'interface complète est le fichier refonte-design-nutrivita.txt
      (annexe SL-UI de ce document). Le prompt backend à venir constituera l'annexe SL-API.

================================================================
4. PLAN DE VERIFICATION — branche remontante
================================================================
TU (tests unitaires, miroir des AL — framework Vitest côté front, node:test ou Jest côté back) :
TU-01 AL-04 : toGlucose(120,"g/L")=1.20 ; toGlucose(120,"mmol/L")=6.66 ; aller-retour sans dérive.
TU-02 AL-05 : GMI(moyenne 154 mg/dL)=7.0 ; TIR sur jeu de 20 mesures connu ; CV ; <12 mesures =>
      "données insuffisantes".
TU-03 AL-01 : homme 34 ans, 178 cm, 78 kg, modéré => BMR 1759, TDEE 2726 (tolérance ±1 kcal).
TU-04 AL-02 : course 9.0 MET * 78 kg * 0.5 h = 351 kcal ; priorité kcal Strava vérifiée.
TU-05 AL-06 : Deurenberg homme 34 ans IMC 24.6 => 21.0 % (tolérance ±0.3 — DEF-10, décision Ahmed 2026-06-12).
TU-06 AL-08 : produit Nutri-Score D + E150d => 35-30 = 5 => "Mauvais" avec additif cité.
TU-07 AL-11 : (45,30,25) +10 sur glucides => (55,24.5,20.5) arrondi, somme 100 ; bornes min.
TU-08 AL-07 : jeu de 14 jours d'apports connus => statut attendu par nutriment ; bascule du
      facteur vitamine D selon latitude/mois.
TI (tests d'intégration, miroir des SL/SA) :
TI-01 Pipeline photo : image mockée -> JSON AL-10 -> matching cascade -> entrée journal -> anneau
      recalculé.
TI-02 Phrase vocale composite "j'ai mangé une chorba, couru 30 minutes, glycémie 1,15" => 3 entrées
      correctement routées et converties.
TI-03 Scan code-barres connu (OFF) => fiche produit + intégration au bilan mensuel.
TI-04 Webhook Strava simulé => activité créée, kcal correctes, anneau mis à jour.
TI-05 Changement d'unité glycémie dans Réglages => toutes les vues converties (accueil, écran
      glycémie, stats), seuils inclus.
VAL (validation, miroir des EB — recette manuelle scénarisée + checklist REG à chaque release) :
VAL-01..14 : un scénario utilisateur par EB-xx, exécuté dans les 3 langues pour EB-11 (dont RTL),
      sur mobile ET desktop pour EB-12. VAL-REG : présence effective des disclaimers REG-04 sur
      chaque écran concerné, export/suppression fonctionnels (REG-02), aucune formulation
      diagnostique ou thérapeutique dans les textes (REG-05) — revue exhaustive des chaînes i18n.

================================================================
5. MATRICE DE TRACABILITE (extrait — à maintenir dans docs/tracabilite.md)
================================================================
EB-01 -> AL-10, SL-02 -> TI-01 -> VAL-01
EB-02 -> AL-10, SL-02 -> TI-02 -> VAL-02
EB-04 -> AL-08, SL-02 -> TU-06, TI-03 -> VAL-04
EB-05 -> AL-01/02/03 -> TU-03/04, TI-04 -> VAL-05
EB-07 -> AL-06 -> TU-05 -> VAL-07 (+REG-04)
EB-08 -> AL-07 -> TU-08 -> VAL-08 (+REG-03/04)
EB-09 -> AL-04/05 -> TU-01/02, TI-05 -> VAL-09 (+REG-04/05)
EB-10 -> AL-09 -> TI-03 -> VAL-10
EB-11 -> AL-12 -> VAL-11 (lang param, RTL arabe)
EB-13 -> HORS PERIMETRE Phase 3 (REG-06/07 bloquants avant impl.)
EB-14 -> AL-13 -> VAL-14 (diabetic_mode toggle)

================================================================
6. DEROULEMENT DES SESSIONS CLAUDE CODE
================================================================
Phase SB/SA (déjà largement réalisée dans nos échanges) : session courte = créer les agents
(section 7), copier ce document dans docs/, faire tourner les critiques sur les sections 1 et 2,
consigner le gate 1 et le gate 2 dans docs/gates.md.
Phase SL/Implémentation UI : exécuter refonte-design-nutrivita.txt SOUS revue (agent revue-code en
fin de session) + écrire les TU-01/02/05/07 sur les fonctions pures du front.
Phase SL/Implémentation API : prompt backend (/api/interpret, scan, carences, webhooks) + TU back
+ TI-01..05.
Phase Validation : recette VAL + checklist REG, puis gate de release.
Parallélisation autorisée : une instance sur nutrivita-v0, une sur nutridz (dépôts distincts) ;
jamais deux instances sur le même dépôt sans worktrees.

================================================================
7. AGENTS CLAUDE CODE — créer ces fichiers dans .claude/agents/ de chaque projet
================================================================
--- .claude/agents/critique-spec.md ---
---
name: critique-spec
description: Agent critique des spécifications (SB/SA/SL). A invoquer après toute production ou modification de spec.
---
Tu es un relecteur exigeant de spécifications pour une app de santé/nutrition. Pour le document
fourni : (1) vérifie que chaque exigence est testable, non ambiguë, avec critère chiffré quand
c'est possible ; (2) vérifie la traçabilité (chaque EB couvert, chaque AL rattaché à un EB) ;
(3) cherche les contradictions entre sections et avec les conventions SL-03 ; (4) signale toute
formulation qui ferait basculer l'app vers le dispositif médical (REG-05) ou enfreindrait le RGPD.
Rends un verdict CONFORME ou NON CONFORME suivi d'une liste numérotée d'écarts, chacun avec sa
gravité (bloquant/majeur/mineur) et une proposition de correction. Ne corrige jamais toi-même.

--- .claude/agents/critique-algo.md ---
---
name: critique-algo
description: Agent critique des algorithmes de calcul et d'estimation. A invoquer sur la section SA et sur toute implémentation d'un AL-xx.
---
Tu es un vérificateur scientifique. Pour chaque algorithme : (1) vérifie la formule contre sa
source (Mifflin-St Jeor, Bergenstal, Deurenberg, MET, repères OMS/ANSES) ; (2) vérifie unités,
bornes, divisions par zéro, comportements aux cas limites (0 mesure, poids manquant, total != 100) ;
(3) vérifie que l'incertitude est honnêtement affichée (estimations, gardes statistiques AL-05) ;
(4) propose les valeurs de test attendues pour les TU. Verdict CONFORME/NON CONFORME + écarts
gradués. Ne corrige jamais toi-même.

--- .claude/agents/revue-code.md ---
---
name: revue-code
description: Agent de revue de code. A invoquer en fin de chaque session d'implémentation, avant commit final.
---
Tu relis le diff de la session. Contrôles : respect des specs SL et du design system (pas de
gradient, pas d'émoji, accent teal unique), conventions SL-03, gestion d'erreurs et états vides,
pas de secret en dur, i18n complet FR/AR/EN pour toute nouvelle chaîne, accessibilité de base,
build qui passe. Liste les problèmes par gravité avec fichier:ligne. Bloquant = le commit attend.

--- .claude/agents/testeur.md ---
---
name: testeur
description: Agent de tests. Ecrit et exécute les TU/TI du plan de vérification (section 4 du document cadre).
---
Tu écris les tests du plan de vérification en t'interdisant de modifier le code testé pour les
faire passer. Chaque test cite son identifiant (TU-xx/TI-xx) et l'exigence tracée. Si un test
échoue, tu rapportes l'écart au lieu d'assouplir l'assertion. Tu signales toute fonction de calcul
sans test associé.

--- .claude/agents/reglementaire.md ---
---
name: reglementaire
description: Agent de validation réglementaire. A invoquer à CHAQUE gate (fin de phase) et avant tout commit touchant données de santé, textes utilisateurs ou consentements.
---
Tu audites au regard de : RGPD (consentement granulaire, minimisation REG-03, droits REG-02),
disclaimers REG-04 présents et non contournables, frontière dispositif médical REG-05 (aucune
recommandation thérapeutique, aucun diagnostic, aucune dose), exigences HDS si données traitées
pour des professionnels (REG-06), loi algérienne 18-07 pour le marché DZ. Pour chaque point :
statut OK/KO/N.A. avec justification. Un seul KO bloquant = NO-GO du gate. Tu n'as pas le droit
de qualifier un KO bloquant en mineur pour faciliter la livraison.

================================================================
8. CHECKLIST REGLEMENTAIRE PAR GATE (résumé opérationnel)
================================================================
Gate SB : exigences REG intégrées et numérotées ; aucune fonctionnalité hors frontière REG-05.
Gate SA : formulations non diagnostiques (AL-07), gardes statistiques (AL-05), incertitudes
          affichées (AL-06) ; plafonds et bornes définis.
Gate SL : consentements et disclaimers présents dans les maquettes/écrans ; géoloc minimisée.
Gate Implémentation : revue-code OK + chaînes i18n auditées (3 langues) par l'agent réglementaire.
Gate Validation/Release : VAL-REG complet, export/suppression testés, docs/gates.md à jour.
