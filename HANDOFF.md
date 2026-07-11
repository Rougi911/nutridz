# HANDOFF — NutraLance
_Dernière mise à jour : 2026-07-10 — mise en conformité ultrareview_

## Phase en cours
**Mise en conformité ultrareview** (branche `fix/ultrareview`) : correction des 3 critiques,
9 élevés, ~17 moyens et ~12 faibles de l'audit multi-agents. Détail complet : `RAPPORT-TESTS.md`
et le rapport d'audit dans le projet claude.ai. Tests : **backend 455 (34 suites) + frontend 42
(11 suites) au vert**, plus les tests de non-régression ajoutés pour les fixes majeurs.

⚠️ **Action humaine restante (🔒)** : rotation du `JWT_SECRET` sur Render + purge de
l'historique git (le secret a été committé jusqu'en 07/2026) — procédure : `backend/SECRET-ROTATION.md`.

### Historique antérieur (pour mémoire)
**P3 TERMINÉE** — SL-API-02/03/04/05 implémentés et gatés.
Gate P3 : GO (revue-code + reglementaire, 2026-06-12) — commit "backend : scan produits + bilan courses + carences + webhooks Strava (cycle V)"

## Changements P3 appliqués

| Tâche | Fichiers | Statut |
|-------|----------|--------|
| SL-API-02 POST /api/scan (AL-08, COR-09) | backend/routes/scan.js (nouveau) | ✅ |
| SL-API-03 GET /api/groceries/summary (AL-09) | backend/routes/scan.js | ✅ |
| SL-API-04 GET /api/stats/deficiencies (AL-07) | backend/routes/deficiencies.js (nouveau) | ✅ |
| SL-API-05 Strava webhooks GET+POST | backend/routes/strava.js (nouveau) | ✅ |
| Micronutrients service (AL-07) | backend/services/micronutrientsService.js (nouveau) | ✅ |
| Additives risk data (AL-08) | backend/data/additives.json (nouveau) | ✅ |
| getActivityById + export mapStravaType | backend/services/strava.js | ✅ |
| DB: scanned_products + profil colonnes | backend/db.js | ✅ |
| Routes enregistrées | backend/server.js | ✅ |
| Tests P3 (42 tests) | backend/tests/p3.test.js (nouveau) | ✅ |
| Gate docs | docs/gates.md | ✅ |

**Tests : 79/79 PASS** (4 suites : glucoseMetrics, activityCap, p2, p3)

## Détail technique P3

### POST /api/scan (SL-API-02)
- Lookup OpenFoodFacts `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- AL-08 score = NutriScore base (A=90,B=75,C=55,D=35,E=15) − malus risque élevé (−30: E150c/d, E249-E252, E621) − risque modéré (−15: E471, E955, E951) clamped [0,100]
- verdict: ≥65→Excellent, 35-64→Médiocre, <35→Mauvais
- COR-09: upsert applicatif — vérification (user_id, barcode, mois) → UPDATE times_this_month ou INSERT
- Monté : /api/scan + /api/groceries (même router)

### GET /api/groceries/summary (SL-API-03)
- `?period=month|week` (défaut: month)
- Agrège sugars_g*times, salt_g*times, sat_fat_g*times
- Références OMS: sucres 50g/j×période, sel 5g/j×période, AGS = TDEE×10%÷9×période/30 (DEF-11)
- Couleurs: ≤80%→teal, 80-110%→amber, >110%→red
- TDEE calculé inline Mifflin-St Jeor + activity_level multiplier

### GET /api/stats/deficiencies (SL-API-04)
- Fenêtre 14 jours glissants; 204 si < 3 jours journal
- REG-04: disclaimer non vide obligatoire dans chaque réponse
- Micronutriments: fer, calcium, vitD, vitB12, magnésium, folates
- Lookup par mot-clé sur product.name → micronutrientsService.js (ANSES CIQUAL 2023 approximations)
- ANSES par sexe: fer H=9/F=16, Ca=950, vitD=15µg, B12=4µg, Mg H=380/F=300, folates=330µg
- Facteur vitD: latitude_approx > 35 ET mois ∈ {10,11,12,1,2,3} → seuil 80% (sinon 70%)
- REG-03: lat arrondie au degré (Math.round)
- REG-05: status = "Apports très faibles" | "Apports à améliorer" | "Apports satisfaisants"

### Webhooks Strava (SL-API-05)
- GET /api/strava/webhook : valide hub.mode=subscribe + hub.verify_token + retourne hub.challenge
- POST /api/strava/webhook : vérifie verify_token dans body (COR-05 obligatoire); répond 200 immédiatement; traitement async (setImmediate)
- AL-02: MET modérée = course 9.0, vélo 7.0, marche 3.5, natation 6.0, muscu 5.0
- Priorité kcal: kilojoules×0.239 → calories → MET×poids×heures
- Lookup userId par strava_athlete_id dans profiles

### micronutrientsService.js
- `lookupMicro(productName)` → fuzzy keyword matching sur 16 catégories d'aliments
- `calcDeficiencies(entries, dayCount, profile, month)` → pure function exportée et testée
- Exportée pour tests unitaires

### services/strava.js — nouveautés
- `getActivityById(activityId, accessToken)` — GET /activities/{id} (pour webhook)
- `mapStravaType` maintenant exportée

## Variables d'environnement à ajouter sur Render (backend)

```
STRAVA_VERIFY_TOKEN=...    # Token arbitraire à choisir — obligatoire pour activer les webhooks Strava
GEMINI_API_KEY=...         # Gemini 2.5 Flash-Lite (depuis P2)
GEMINI_MODEL=gemini-2.5-flash-lite   # optionnel
```

Après déploiement, enregistrer le webhook Strava :
```
POST https://www.strava.com/api/v3/push_subscriptions
  client_id=STRAVA_CLIENT_ID
  client_secret=STRAVA_CLIENT_SECRET
  callback_url=https://nutridz.onrender.com/api/strava/webhook
  verify_token=STRAVA_VERIFY_TOKEN
```

## Changements P2 appliqués (rappel)

| Tâche | Fichiers | Statut |
|-------|----------|--------|
| Migration Clarifai → Gemini | backend/services/foodvision.js | ✅ |
| POST /api/interpret (SL-API-01) | backend/routes/interpret.js | ✅ |
| AGS utility (DEF-11) | backend/services/agsUtils.js | ✅ |
| Bug 4b dishes.js kcal fallback | backend/routes/dishes.js | ✅ |

**Tests P2 : 37/37 PASS**

## Corrections P1.5-A/B appliquées (rappel)

| DEF | Statut |
|-----|--------|
| DEF-01/02/03/05/06/07/08/09/12/13/16 | ✅ RÉSOLU |
| DEF-04 | Hors périmètre marché DZ |

## Tâches de restyling terminées (Tasks 1–16) — toutes ✅

## Prochaine étape
P3 terminée. La prochaine phase est P4 ou les tâches de restyling frontend restantes (selon roadmap Ahmed).

## Règle absolue — dépendances de test
@testing-library/jest-dom, @testing-library/react, @testing-library/user-event (v13) embarqués
par react-scripts 5.0.1. **Ne jamais ajouter en devDependencies. Ne jamais modifier package.json.**
user-event = v13 (API synchrone, sans await sur userEvent.click()).
