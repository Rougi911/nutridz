// Classification des additifs alimentaires selon le statut EFSA
// Sources :
//   - EFSA réévaluations des additifs alimentaires (Programme 2010–2024)
//   - Règlement (CE) n° 1333/2008 relatif aux additifs alimentaires
//   - CIRC (Centre International de Recherche sur le Cancer) — Groupe 1 / 2A / 2B
//   - Décret n° 2022-65 du 25 janvier 2022 (interdiction E171 en France)
//
// Niveaux de risque :
//   high     : DJA abaissée, usage restreint, ou réévaluation EFSA défavorable.
//              Inclut nitrites (E249–E252), benzoates (E210–E213), sulfites (E220–E228),
//              colorants azoïques (E102, E110, E122, E124, E129), E171, E150d, E320, E321, E407, E952.
//   moderate : Sous surveillance EFSA, réévaluation en cours, ou incertitude modérée.
//              Inclut phosphates (E338–E343), édulcorants (E950–E955), émulsifiants (E450–E472e).
//   low      : Réévaluation EFSA favorable, usage bien établi, risque faible dans les doses autorisées.
//              Inclut vitamines (E300–E307), acides organiques (E270, E330), pectines (E440), etc.

// ─── Classification par code E ───────────────────────────────────────────────

const ADDITIVES_CLASSIFICATION = {
  // ── Colorants (E1xx) ───────────────────────────────────────────────────────
  E100:  { name: 'Curcumine',                           risk: 'low',      concern: 'Colorant naturel — réévaluation EFSA 2022 favorable' },
  E101:  { name: 'Riboflavine (Vitamine B2)',           risk: 'low',      concern: 'Colorant vitaminique naturel — sans risque démontré' },
  E102:  { name: 'Tartrazine',                          risk: 'high',     concern: 'Colorant azoïque — hyperactivité enfant (EFSA 2008) ; étiquetage avertissement obligatoire' },
  E110:  { name: 'Sunset Yellow FCF (Jaune orangé S)',  risk: 'high',     concern: 'Colorant azoïque — hyperactivité enfant (EFSA 2008) ; étiquetage avertissement obligatoire' },
  E120:  { name: 'Cochenille (Acide carminique)',       risk: 'moderate', concern: 'Allergies signalées ; réévaluation EFSA 2015 en attente confirmation' },
  E122:  { name: 'Carmoisine',                          risk: 'high',     concern: 'Colorant azoïque — hyperactivité enfant (EFSA 2008) ; étiquetage avertissement obligatoire' },
  E124:  { name: 'Ponceau 4R',                         risk: 'high',     concern: 'Colorant azoïque — hyperactivité enfant (EFSA 2008) ; étiquetage avertissement obligatoire' },
  E129:  { name: 'Rouge allura AC',                    risk: 'high',     concern: 'Colorant azoïque — hyperactivité enfant (EFSA 2008) ; étiquetage avertissement obligatoire' },
  E131:  { name: 'Bleu patenté V',                     risk: 'moderate', concern: 'Réactions allergiques signalées ; réévaluation EFSA en cours' },
  E132:  { name: 'Indigotine',                         risk: 'moderate', concern: 'Données toxicologiques limitées ; réévaluation EFSA 2015' },
  E133:  { name: 'Bleu brillant FCF',                  risk: 'moderate', concern: 'Données insuffisantes sur génotoxicité selon EFSA 2013' },
  E150a: { name: 'Caramel nature',                     risk: 'low',      concern: 'Pas de préoccupation de sécurité à des doses normales — EFSA 2011' },
  E150b: { name: 'Caramel au sulfite',                 risk: 'moderate', concern: 'Formation possible de précurseurs soufrés ; données incomplètes' },
  E150c: { name: 'Caramel ammoniacal',                 risk: 'moderate', concern: 'Précurseur 4-méthylimidazole (4-MeI) à doses élevées — EFSA 2011' },
  E150d: { name: 'Caramel sulfite-ammoniacal',         risk: 'high',     concern: 'Précurseur 4-méthylimidazole (4-MeI) — avis EFSA défavorable ; taux restreints' },
  E160a: { name: 'Carotènes (bêta-carotène)',          risk: 'low',      concern: 'Antioxydant naturel — réévaluation EFSA 2012 favorable' },
  E162:  { name: 'Rouge de betterave (Bétanine)',      risk: 'low',      concern: 'Colorant naturel — aucun risque démontré à usage alimentaire normal' },
  E171:  { name: 'Dioxyde de titane',                  risk: 'high',     concern: 'Interdit en France depuis le 2022-01-01 (décret 2022-65) — génotoxicité potentielle (EFSA 2021)' },
  E172:  { name: 'Oxydes et hydroxydes de fer',        risk: 'low',      concern: 'Usage limité (dragées, produits de boulangerie) — réévaluation EFSA 2015 favorable' },

  // ── Conservateurs (E2xx) ──────────────────────────────────────────────────
  E200:  { name: 'Acide sorbique',                     risk: 'low',      concern: 'Réévaluation EFSA 2015 favorable — DJA 3 mg/kg/j' },
  E202:  { name: 'Sorbate de potassium',               risk: 'low',      concern: 'Réévaluation EFSA 2015 favorable (exprimée en acide sorbique)' },
  E210:  { name: 'Acide benzoïque',                    risk: 'high',     concern: 'Combinaison avec E300 forme benzène ; hyperactivité enfant avec colorants (EFSA 2008)' },
  E211:  { name: 'Benzoate de sodium',                 risk: 'high',     concern: 'Combinaison avec acide ascorbique → benzène ; hyperactivité enfant (EFSA 2008)' },
  E212:  { name: 'Benzoate de potassium',              risk: 'high',     concern: 'Mêmes préoccupations que E211 — benzoates groupe' },
  E213:  { name: 'Benzoate de calcium',                risk: 'high',     concern: 'Mêmes préoccupations que E211 — benzoates groupe' },
  E220:  { name: 'Dioxyde de soufre',                  risk: 'high',     concern: 'Irritant voies respiratoires ; réactions chez asthmatiques ; allergènes déclaratoires UE' },
  E221:  { name: 'Sulfite de sodium',                  risk: 'high',     concern: 'Même profil que E220 — groupe sulfites ; allergènes déclaratoires UE' },
  E222:  { name: 'Bisulfite de sodium',                risk: 'high',     concern: 'Même profil que E220 — groupe sulfites ; allergènes déclaratoires UE' },
  E223:  { name: 'Métabisulfite de sodium',            risk: 'high',     concern: 'Même profil que E220 — groupe sulfites ; allergènes déclaratoires UE' },
  E224:  { name: 'Métabisulfite de potassium',         risk: 'high',     concern: 'Même profil que E220 — groupe sulfites ; allergènes déclaratoires UE' },
  E226:  { name: 'Sulfite de calcium',                 risk: 'high',     concern: 'Même profil que E220 — groupe sulfites ; allergènes déclaratoires UE' },
  E227:  { name: 'Bisulfite de calcium',               risk: 'high',     concern: 'Même profil que E220 — groupe sulfites ; allergènes déclaratoires UE' },
  E228:  { name: 'Bisulfite de potassium',             risk: 'high',     concern: 'Même profil que E220 — groupe sulfites ; allergènes déclaratoires UE' },
  E249:  { name: 'Nitrite de potassium',               risk: 'high',     concern: 'Précurseur nitrosamines cancérigènes (CIRC groupe 1 — charcuteries) ; réévaluation EFSA 2017' },
  E250:  { name: 'Nitrite de sodium',                  risk: 'high',     concern: 'Précurseur nitrosamines cancérigènes (CIRC groupe 1 — charcuteries) ; réévaluation EFSA 2017' },
  E251:  { name: 'Nitrate de sodium',                  risk: 'high',     concern: 'Conversion en nitrite in vivo — réévaluation EFSA 2017' },
  E252:  { name: 'Nitrate de potassium',               risk: 'high',     concern: 'Conversion en nitrite in vivo — réévaluation EFSA 2017' },
  E260:  { name: 'Acide acétique',                     risk: 'low',      concern: 'Vinaigrette alimentaire — EFSA 2018 : aucune préoccupation de sécurité' },
  E262:  { name: 'Acétate de sodium',                  risk: 'low',      concern: 'EFSA 2018 favorable — même groupe que acide acétique' },
  E270:  { name: 'Acide lactique',                     risk: 'low',      concern: 'Acide naturel de fermentation — EFSA 2013 favorable' },
  E280:  { name: 'Acide propionique',                  risk: 'low',      concern: 'EFSA 2014 favorable — DJA non spécifiée' },
  E282:  { name: 'Propionate de calcium',              risk: 'moderate', concern: 'Données sur comportement (études enfants) insuffisantes — réévaluation EFSA recommandée' },
  E290:  { name: 'Dioxyde de carbone',                 risk: 'low',      concern: 'Gaz naturel — aucun risque alimentaire démontré' },

  // ── Antioxydants (E3xx) ───────────────────────────────────────────────────
  E300:  { name: 'Acide ascorbique (Vitamine C)',       risk: 'low',      concern: 'Antioxydant vitaminique — EFSA 2015 favorable ; attention combinaison avec benzoates' },
  E301:  { name: 'Ascorbate de sodium',                 risk: 'low',      concern: 'EFSA 2015 favorable — même groupe que E300' },
  E306:  { name: 'Tocophérols (Vitamine E)',            risk: 'low',      concern: 'Antioxydants naturels — EFSA 2015 favorable' },
  E307:  { name: 'Alpha-tocophérol',                   risk: 'low',      concern: 'EFSA 2015 favorable — même groupe que E306' },
  E320:  { name: 'Butylhydroxyanisole (BHA)',           risk: 'high',     concern: 'IARC groupe 2B (cancérogène possible) ; DJA abaissée par EFSA 2012' },
  E321:  { name: 'Butylhydroxytoluène (BHT)',           risk: 'high',     concern: 'Perturbation endocrinienne suspectée ; DJA très basse — EFSA 2012' },
  E322:  { name: 'Lécithines',                         risk: 'low',      concern: 'EFSA 2017 favorable — émulsifiant naturel largement étudié' },
  E330:  { name: 'Acide citrique',                     risk: 'low',      concern: 'Acide naturel omniprésent — EFSA 2014 : aucune préoccupation de sécurité' },
  E331:  { name: 'Citrates de sodium',                 risk: 'low',      concern: 'EFSA 2014 favorable — même groupe que E330' },
  E332:  { name: 'Citrates de potassium',              risk: 'low',      concern: 'EFSA 2014 favorable — même groupe que E330' },
  E333:  { name: 'Citrates de calcium',                risk: 'low',      concern: 'EFSA 2014 favorable — même groupe que E330' },
  E334:  { name: 'Acide tartrique',                    risk: 'low',      concern: 'Acide naturel du raisin — EFSA 2014 favorable' },
  E338:  { name: 'Acide phosphorique',                 risk: 'moderate', concern: 'Apport phosphate inorganique — impact os/reins à consommation élevée (EFSA 2019)' },
  E339:  { name: 'Phosphates de sodium',               risk: 'moderate', concern: 'Même profil que E338 — groupe phosphates (EFSA 2019)' },
  E340:  { name: 'Phosphates de potassium',            risk: 'moderate', concern: 'Même profil que E338 — groupe phosphates (EFSA 2019)' },
  E341:  { name: 'Phosphates de calcium',              risk: 'moderate', concern: 'Même profil que E338 — groupe phosphates (EFSA 2019)' },
  E343:  { name: 'Phosphates de magnésium',            risk: 'moderate', concern: 'Même profil que E338 — groupe phosphates (EFSA 2019)' },

  // ── Émulsifiants / épaississants (E4xx) ──────────────────────────────────
  E400:  { name: 'Acide alginique',                    risk: 'low',      concern: 'EFSA 2017 favorable — polysaccharide marin naturel' },
  E401:  { name: 'Alginate de sodium',                 risk: 'low',      concern: 'EFSA 2017 favorable — même groupe que E400' },
  E407:  { name: 'Carraghénanes',                      risk: 'high',     concern: 'Inflammation intestinale (études animales) ; EFSA 2018 : réduction DJA pour nourrissons ; préoccupation microbiote' },
  E410:  { name: 'Farine de graine de caroube',        risk: 'low',      concern: 'EFSA 2017 favorable — fibre naturelle' },
  E412:  { name: 'Gomme guar',                         risk: 'low',      concern: 'EFSA 2012 favorable — fibre soluble naturelle' },
  E415:  { name: 'Gomme xanthane',                     risk: 'low',      concern: 'EFSA 2017 favorable — produit de fermentation bactérienne' },
  E420:  { name: 'Sorbitol',                           risk: 'low',      concern: 'EFSA 2008 favorable — effet laxatif à doses élevées signalé (>50 g/j)' },
  E422:  { name: 'Glycérol',                           risk: 'low',      concern: 'EFSA 2017 favorable — composé naturel du métabolisme lipidique' },
  E440:  { name: 'Pectines',                           risk: 'low',      concern: 'EFSA 2017 favorable — fibre soluble naturelle des fruits' },
  E450:  { name: 'Diphosphates',                       risk: 'moderate', concern: 'Même profil que E338 — groupe phosphates (EFSA 2019)' },
  E451:  { name: 'Triphosphates',                      risk: 'moderate', concern: 'Même profil que E338 — groupe phosphates (EFSA 2019)' },
  E452:  { name: 'Polyphosphates',                     risk: 'moderate', concern: 'Même profil que E338 — groupe phosphates (EFSA 2019)' },
  E471:  { name: 'Mono et diglycérides d\'acides gras', risk: 'moderate', concern: 'Impact potentiel microbiote (EFSA 2017) ; données insuffisantes sur certains esters' },
  E472e: { name: 'DATEM (Mono-diacétyltartrates de mono/diglycérides)', risk: 'moderate', concern: 'Réévaluation EFSA 2020 — données insuffisantes sur génotoxicité' },
  E481:  { name: 'Stéaroyl-2-lactylate de sodium (SSL)', risk: 'moderate', concern: 'Réévaluation EFSA 2020 — données manquantes sur certains métabolites' },

  // ── Exhausteurs de goût et divers (E5xx–E9xx) ─────────────────────────────
  E500:  { name: 'Carbonates de sodium',               risk: 'low',      concern: 'EFSA 2013 favorable — levure chimique' },
  E501:  { name: 'Carbonates de potassium',            risk: 'low',      concern: 'EFSA 2013 favorable — même groupe que E500' },
  E503:  { name: 'Carbonates d\'ammonium',             risk: 'low',      concern: 'EFSA 2013 favorable — levure chimique' },
  E504:  { name: 'Carbonates de magnésium',            risk: 'low',      concern: 'EFSA 2013 favorable — agent de charge' },
  E508:  { name: 'Chlorure de potassium',              risk: 'low',      concern: 'EFSA 2017 favorable — substitut de sel' },
  E509:  { name: 'Chlorure de calcium',                risk: 'low',      concern: 'EFSA 2018 favorable — coagulant fromager' },
  E510:  { name: 'Chlorure d\'ammonium',               risk: 'moderate', concern: 'Usage limité — données insuffisantes à long terme selon EFSA 2018' },
  E516:  { name: 'Sulfate de calcium',                 risk: 'low',      concern: 'EFSA 2016 favorable — coagulant tofu, agent affermissant' },
  E621:  { name: 'Glutamate monosodique (MSG)',         risk: 'moderate', concern: 'Hypersensibilité signalée (syndrome du restaurant chinois) ; apport sodium caché élevé' },
  E627:  { name: 'Guanylate disodique',                risk: 'moderate', concern: 'Déconseillé aux personnes souffrant de goutte ; synergique E621' },
  E631:  { name: 'Inosinate disodique',                risk: 'moderate', concern: 'Déconseillé aux personnes souffrant de goutte ; synergique E621' },
  E635:  { name: 'Ribonucléotides disodiques',         risk: 'moderate', concern: 'Mélange E627+E631 — même profil (goutte, synergiste umami)' },
  E900:  { name: 'Diméthylpolysiloxane',               risk: 'low',      concern: 'EFSA 2018 favorable — antimoussant, usage friture' },
  E950:  { name: 'Acésulfame K',                       risk: 'moderate', concern: 'Données sur effets métaboliques à long terme insuffisantes — EFSA 2000 (réévaluation demandée)' },
  E951:  { name: 'Aspartame',                          risk: 'moderate', concern: 'IARC 2B (2023) ; OMS 2023 : utilisation déconseillée pour perte de poids ; contre-indiqué PKU' },
  E952:  { name: 'Acide cyclamique',                   risk: 'high',     concern: 'Interdit aux USA ; cancérogène suspecté chez l\'animal ; EFSA 2000 DJA très basse' },
  E954:  { name: 'Saccharine',                         risk: 'moderate', concern: 'IARC anciennement groupe 2B (retiré) ; données insuffisantes sur microbiote (2022)' },
  E955:  { name: 'Sucralose',                          risk: 'moderate', concern: 'Perturbation microbiote intestinal (étude 2023) ; EFSA réévaluation prévue' },
  E960:  { name: 'Glycosides de stéviol (Stévia)',     risk: 'low',      concern: 'EFSA 2010 favorable — édulcorant naturel ; DJA 4 mg/kg/j' },
  E965:  { name: 'Maltitol',                           risk: 'low',      concern: 'EFSA 2011 favorable — polyol ; effet laxatif à doses élevées (>40 g/j)' },
  E967:  { name: 'Xylitol',                            risk: 'low',      concern: 'EFSA 2011 favorable — polyol ; toxic pour chiens (hors usage humain)' },
  E1442: { name: 'Phosphate de diamidon hydroxypropylé', risk: 'moderate', concern: 'Amidon modifié — réévaluation EFSA 2017 en cours ; données insuffisantes' },
};

// ─── Dictionnaire noms → code E ──────────────────────────────────────────────
// Permet de retrouver un code E à partir d'un nom en clair (FR ou EN).
// Utilisé pour normaliser les noms d'additifs issus d'OpenFoodFacts ou d'étiquettes.
// Les clés sont en minuscules et peuvent contenir des variantes orthographiques courantes.

const ADDITIVES_NAMES = {
  // E100
  'curcumine':                           'E100',
  'curcumin':                            'E100',

  // E101
  'riboflavine':                         'E101',
  'riboflavin':                          'E101',
  'vitamine b2':                         'E101',

  // E102
  'tartrazine':                          'E102',
  'yellow 5':                            'E102',

  // E110
  'sunset yellow':                       'E110',
  'sunset yellow fcf':                   'E110',
  'jaune orange s':                      'E110',
  'jaune orangé s':                      'E110',
  'yellow 6':                            'E110',

  // E120
  'cochenille':                          'E120',
  'acide carminique':                    'E120',
  'carmine':                             'E120',
  'carmin':                              'E120',

  // E122
  'carmoisine':                          'E122',
  'azorubine':                           'E122',

  // E124
  'ponceau 4r':                          'E124',
  'rouge cochenille a':                  'E124',

  // E129
  'rouge allura':                        'E129',
  'rouge allura ac':                     'E129',
  'allura red':                          'E129',
  'allura red ac':                       'E129',
  'red 40':                              'E129',

  // E131
  'bleu patente v':                      'E131',
  'bleu patenté v':                      'E131',
  'patent blue v':                       'E131',

  // E132
  'indigotine':                          'E132',
  'indigo carmine':                      'E132',
  'blue 2':                              'E132',

  // E133
  'bleu brillant fcf':                   'E133',
  'brilliant blue fcf':                  'E133',
  'blue 1':                              'E133',

  // E150a
  'caramel nature':                      'E150a',
  'plain caramel':                       'E150a',

  // E150b
  'caramel au sulfite':                  'E150b',
  'caustic sulphite caramel':            'E150b',

  // E150c
  'caramel ammoniacal':                  'E150c',
  'ammonia caramel':                     'E150c',

  // E150d
  'caramel sulfite ammoniacal':          'E150d',
  'caramel au sulfite ammoniacal':       'E150d',
  'sulphite ammonia caramel':            'E150d',
  'sulfite ammonia caramel':             'E150d',

  // E160a
  'carotene':                            'E160a',
  'carotènes':                           'E160a',
  'beta-carotene':                       'E160a',
  'bêta-carotène':                       'E160a',
  'beta carotene':                       'E160a',

  // E162
  'rouge de betterave':                  'E162',
  'betanine':                            'E162',
  'beetroot red':                        'E162',

  // E171
  'dioxyde de titane':                   'E171',
  'dioxide de titane':                   'E171',
  'titanium dioxide':                    'E171',

  // E172
  'oxydes de fer':                       'E172',
  'iron oxides':                         'E172',

  // E200
  'acide sorbique':                      'E200',
  'sorbic acid':                         'E200',

  // E202
  'sorbate de potassium':                'E202',
  'potassium sorbate':                   'E202',

  // E210
  'acide benzoique':                     'E210',
  'acide benzoïque':                     'E210',
  'benzoic acid':                        'E210',

  // E211
  'benzoate de sodium':                  'E211',
  'sodium benzoate':                     'E211',

  // E212
  'benzoate de potassium':               'E212',
  'potassium benzoate':                  'E212',

  // E213
  'benzoate de calcium':                 'E213',
  'calcium benzoate':                    'E213',

  // E220
  'dioxyde de soufre':                   'E220',
  'sulphur dioxide':                     'E220',
  'sulfur dioxide':                      'E220',
  'so2':                                 'E220',

  // E221
  'sulfite de sodium':                   'E221',
  'sodium sulphite':                     'E221',
  'sodium sulfite':                      'E221',

  // E222
  'bisulfite de sodium':                 'E222',
  'sodium bisulphite':                   'E222',
  'sodium bisulfite':                    'E222',

  // E223
  'metabisulfite de sodium':             'E223',
  'métabisulfite de sodium':             'E223',
  'sodium metabisulphite':               'E223',
  'sodium metabisulfite':                'E223',

  // E224
  'metabisulfite de potassium':          'E224',
  'métabisulfite de potassium':          'E224',
  'potassium metabisulphite':            'E224',
  'potassium metabisulfite':             'E224',

  // E249
  'nitrite de potassium':                'E249',
  'potassium nitrite':                   'E249',

  // E250
  'nitrite de sodium':                   'E250',
  'sodium nitrite':                      'E250',

  // E251
  'nitrate de sodium':                   'E251',
  'sodium nitrate':                      'E251',

  // E252
  'nitrate de potassium':                'E252',
  'potassium nitrate':                   'E252',

  // E260
  'acide acetique':                      'E260',
  'acide acétique':                      'E260',
  'acetic acid':                         'E260',
  'vinaigre':                            'E260',

  // E262
  'acetate de sodium':                   'E262',
  'acétate de sodium':                   'E262',
  'sodium acetate':                      'E262',

  // E270
  'acide lactique':                      'E270',
  'lactic acid':                         'E270',

  // E280
  'acide propionique':                   'E280',
  'propionic acid':                      'E280',

  // E282
  'propionate de calcium':               'E282',
  'calcium propionate':                  'E282',

  // E300
  'acide ascorbique':                    'E300',
  'ascorbic acid':                       'E300',
  'vitamine c':                          'E300',
  'vitamin c':                           'E300',

  // E301
  'ascorbate de sodium':                 'E301',
  'sodium ascorbate':                    'E301',

  // E306
  'tocopherols':                         'E306',
  'tocophérols':                         'E306',
  'tocopherol':                          'E306',
  'vitamine e':                          'E306',
  'vitamin e':                           'E306',

  // E307
  'alpha-tocopherol':                    'E307',
  'alpha-tocophérol':                    'E307',

  // E320
  'bha':                                 'E320',
  'butylhydroxyanisole':                 'E320',
  'butylated hydroxyanisole':            'E320',

  // E321
  'bht':                                 'E321',
  'butylhydroxytoluene':                 'E321',
  'butylhydroxytoluène':                 'E321',
  'butylated hydroxytoluene':            'E321',

  // E322
  'lecithine':                           'E322',
  'lécithine':                           'E322',
  'lecithin':                            'E322',
  'lecithine de soja':                   'E322',
  'lécithine de soja':                   'E322',
  'soy lecithin':                        'E322',
  'sunflower lecithin':                  'E322',
  'lecithine de tournesol':              'E322',
  'lécithine de tournesol':              'E322',

  // E330
  'acide citrique':                      'E330',
  'citric acid':                         'E330',

  // E334
  'acide tartrique':                     'E334',
  'tartaric acid':                       'E334',

  // E338
  'acide phosphorique':                  'E338',
  'phosphoric acid':                     'E338',

  // E407
  'carraghenane':                        'E407',
  'carraghénane':                        'E407',
  'carraghénanes':                       'E407',
  'carrageenan':                         'E407',
  'carrageenan gum':                     'E407',

  // E410
  'farine de graine de caroube':         'E410',
  'locust bean gum':                     'E410',
  'carob bean gum':                      'E410',

  // E412
  'gomme guar':                          'E412',
  'guar gum':                            'E412',

  // E415
  'gomme xanthane':                      'E415',
  'xanthan gum':                         'E415',
  'xanthane':                            'E415',

  // E440
  'pectine':                             'E440',
  'pectines':                            'E440',
  'pectin':                              'E440',

  // E471
  'mono et diglycérides d\'acides gras': 'E471',
  'mono- and diglycerides of fatty acids': 'E471',
  'monoglycerides':                      'E471',
  'diglycerides':                        'E471',
  'emulsifiant e471':                    'E471',

  // E500
  'carbonates de sodium':                'E500',
  'sodium carbonates':                   'E500',
  'bicarbonate de sodium':               'E500',
  'baking soda':                         'E500',

  // E621
  'glutamate monosodique':               'E621',
  'monosodium glutamate':                'E621',
  'glutamate de sodium':                 'E621',
  'msg':                                 'E621',

  // E627
  'guanylate disodique':                 'E627',
  'disodium guanylate':                  'E627',

  // E631
  'inosinate disodique':                 'E631',
  'disodium inosinate':                  'E631',

  // E635
  'ribonucleotides':                     'E635',
  'ribonucléotides disodiques':          'E635',
  'disodium ribonucleotides':            'E635',

  // E950
  'acesulfame k':                        'E950',
  'acésulfame k':                        'E950',
  'acesulfame potassium':                'E950',
  'ace k':                               'E950',

  // E951
  'aspartame':                           'E951',

  // E952
  'acide cyclamique':                    'E952',
  'cyclamate':                           'E952',
  'sodium cyclamate':                    'E952',

  // E954
  'saccharine':                          'E954',
  'saccharin':                           'E954',
  'sodium saccharin':                    'E954',

  // E955
  'sucralose':                           'E955',

  // E960
  'steviol':                             'E960',
  'stéviol':                             'E960',
  'stevia':                              'E960',
  'extrait de stevia':                   'E960',
  'steviol glycosides':                  'E960',
  'glycosides de steviol':               'E960',
  'glycosides de stéviol':               'E960',

  // E965
  'maltitol':                            'E965',

  // E967
  'xylitol':                             'E967',
};

// ─── Structure de compatibilité pour backend/routes/scan.js ─────────────────
// scan.js importe additives.json et l'accède via ADDITIVES.high_risk[code]
// et ADDITIVES.moderate_risk[code]. Ce mapping maintient la compatibilité.

const high_risk     = {};
const moderate_risk = {};

for (const [code, entry] of Object.entries(ADDITIVES_CLASSIFICATION)) {
  if (entry.risk === 'high') {
    high_risk[code] = { name: entry.name, concern: entry.concern };
  } else if (entry.risk === 'moderate') {
    moderate_risk[code] = { name: entry.name, concern: entry.concern };
  }
}

module.exports = {
  ADDITIVES_CLASSIFICATION,
  ADDITIVES_NAMES,
  // Legacy compatibility keys (used by scan.js via additives.json)
  high_risk,
  moderate_risk,
};
