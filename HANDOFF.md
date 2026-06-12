# HANDOFF — NutriVita
_Dernière mise à jour : 2026-06-12 — par Claude_

## Phase en cours
**P2 TERMINÉE** — Implémentation backend SL-API-01 (interpret), migration Gemini, AGS utility, bugs 4a/4b/4c.
Gate P2 : GO (revue-code + reglementaire, 2026-06-12) → Prochaine étape : Phase P3 (endpoints SL-API-02 à SL-API-06).

## Changements P2 appliqués

| Tâche | Fichiers modifiés | Statut |
|-------|-------------------|--------|
| Migration Clarifai → Gemini | backend/services/foodvision.js | ✅ |
| POST /api/interpret (SL-API-01) | backend/routes/interpret.js (nouveau) | ✅ |
| AGS utility (DEF-11) | backend/services/agsUtils.js (nouveau) | ✅ |
| Route registered | backend/server.js | ✅ |
| Bug 4b (dishes.js kcal fallback) | backend/routes/dishes.js | ✅ |
| Bug 4a (ciqual.js regex) | Déjà corrigé avant P2 | ✅ |
| Tests P2 | backend/tests/p2.test.js (17 tests) | ✅ |
| Gate docs | docs/gates.md | ✅ |

**Tests : 37/37 PASS** (3 suites : glucoseMetrics, activityCap, p2)

## Détail technique P2

### foodvision.js — Gemini
- `callGemini(base64Image, mimeType)` via REST axios → `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
- Modèle : `process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'`
- Sortie `[{name, value}]` identique à l'ancienne interface Clarifai
- `callGemini` exportée pour usage dans interpret.js
- Suppression totale de CLARIFAI_API_URL et CLARIFAI_API_KEY

### POST /api/interpret (SL-API-01)
- Entrée : `{ mode: "photo"|"voice"|"text", payload, lang, mimeType? }`
- Sortie : `{ intents: [...] }`
- mode photo → callGemini vision (concepts → intents type "food")
- mode voice/text → callGeminiText avec prompt JSON strict, REG-05 interdit médical
- Nutrition : cascade CIQUAL → USDA, jamais LLM. null si non trouvé (nutrition_found: false)
- confidence < 0.6 → needs_confirmation: true
- 422 si JSON Gemini non parseable. 502 si Gemini indisponible.
- Parsing défensif : strip backticks, regex fallback, try/catch

### agsUtils.js (DEF-11)
- `calcMonthlyAGSTarget(profile)` → `{ target_g, default_used, tdee_used }`
- Formule : `TDEE × 10% ÷ 9 × 30`
- Fallback 2000 kcal si TDEE absent/invalide, `default_used: true`

### dishes.js bug 4b
- Condition `ing.kcal_per100 != null || ing.kcal != null` (accepte les deux champs)
- `const kcal100 = ing.kcal_per100 ?? ing.kcal ?? 0` (kcal_per100 prioritaire)

## Variable d'environnement à ajouter sur Render (backend)
```
GEMINI_API_KEY=...          # Gemini 2.5 Flash-Lite (remplace CLARIFAI_API_KEY)
GEMINI_MODEL=gemini-2.5-flash-lite   # optionnel, valeur par défaut
```
CLARIFAI_API_KEY peut être supprimée de Render.

## Corrections P1.5-B appliquées

| DEF | Gravité initiale | Fichiers modifiés | Statut |
|-----|-----------------|-------------------|--------|
| DEF-06 | MAJEUR | glucoseMetrics.js, GlucoseTrackingPage.jsx | ✅ RÉSOLU |
| DEF-07 | MAJEUR | routes/activity.js | ✅ RÉSOLU |
| DEF-08 | MAJEUR | glucoseMetrics.js | ✅ RÉSOLU |
| DEF-09 | MAJEUR | glucoseMetrics.js, routes/glucose.js, db.js | ✅ RÉSOLU |
| DEF-10 | MAJEUR (spec) | docs/cycle-v-nutrivita.md | ✅ RÉSOLU |
| DEF-11 | MAJEUR (spec) | docs/sl-api.md | Spec ✅ / Code P2 ✅ |
| DEF-12 | MAJEUR | server.js, middleware/auth.js, routes/auth.js | ✅ RÉSOLU |
| DEF-13 | MINEUR | db.js, routes/auth.js | ✅ RÉSOLU |
| DEF-14 | MINEUR (spec) | docs/sl-api.md, docs/cycle-v-nutrivita.md | ✅ RÉSOLU |
| DEF-15 | MINEUR (spec) | docs/sl-api.md, docs/cycle-v-nutrivita.md | ✅ RÉSOLU |

Tests ajoutés : `backend/tests/glucoseMetrics.test.js` (16 tests) + `backend/tests/activityCap.test.js` (7 tests)

## Corrections P1.5-A appliquées

| DEF | Gravité initiale | Fichiers modifiés | Statut |
|-----|-----------------|-------------------|--------|
| DEF-01 | KO BLOQUANT | GlucoseTrackingPage.jsx, i18n.js | ✅ RÉSOLU |
| DEF-02 | KO BLOQUANT | backend/routes/auth.js | ✅ RÉSOLU |
| DEF-03 | KO BLOQUANT | RegisterPage.jsx, store/index.js, routes/auth.js, db.js, i18n.js | ✅ RÉSOLU |
| DEF-04 | KO BLOQUANT | — | Hors périmètre marché DZ — session juridique dédiée |
| DEF-05 | KO BLOQUANT | GlucoseTrackingPage.jsx, i18n.js | ✅ RÉSOLU |
| DEF-16 | MINEUR | i18n.js | ✅ RÉSOLU |
| COR-08 | Régression CORS | backend/server.js, docs/sl-api.md | ✅ RÉSOLU |

## Tâches de restyling terminées (Tasks 1–16)

| Task | Description | Commit | Statut |
|------|-------------|--------|--------|
| 1 | DES-01 — tokens dark mode | e9a4243 | ✅ |
| 2 | DES-02 — classes CSS utilitaires | 93d4a9f | ✅ |
| 3 | DES-03 + REG-11a — GradientHeader | d8dddd2 | ✅ |
| 4 | DES-03 + REG-11b — MacroPillCard | fd9249d | ✅ |
| 5 | DES-03 + REG-11c — MetricCard | 19b400a | ✅ |
| 6 | setupTests + renderWithProviders | 3762eac | ✅ |
| 7a | Baseline pré-restructuring (GREEN) | 0845dab | ✅ |
| 7b | BilanPage embedded + activeTabOverride | b854861 | ✅ |
| 7c | HistoryPage embedded prop | 565a599 | ✅ |
| 7d | StatsPage + REG-06/07 | 980bbb6 | ✅ |
| 7e | App.jsx routes 9→5 | 0c41d5e | ✅ |
| 7f | Layout.jsx 5-tab nav (DES-04) | 3ee0c3d | ✅ |
| 7g | Navigation REG-02 + full suite green gate | 7b13eca | ✅ |
| 8 | REG-01, REG-10 baseline | da8894d | ✅ |
| 9 | JournalPage + REG-03/04/05 | 7283a24 | ✅ |
| 10 | DishesPage + REG-06b | 243efa9 | ✅ |
| 11 | DishDetailPage | 4f93048 | ✅ |
| 12 | GlucoseTrackingPage | 752f58a | ✅ |
| 13 | ProfilePage + REG-08/09 | 96bb317 | ✅ |
| 14 | Landing + Login + Register + Onboarding | d02b317 | ✅ |
| 15 | BilanPage shared MetricCard | fa3de20 | ✅ |
| 16 | Suite complète (42/42) + build ✅ | — | ✅ |

## Prochaine étape
Phase P3 — Endpoints SL-API-02 à SL-API-06 :
- SL-API-02 : GET /api/activity/bilan/:date (mis à jour avec cap 1000 kcal DEF-07)
- SL-API-03 : GET /api/groceries/summary (AGS dynamique DEF-11 — agsUtils.js prêt)
- SL-API-04 : GET /api/nutrition/micronutrients
- SL-API-05 : Strava webhook STRAVA_VERIFY_TOKEN obligatoire (COR-05)
- SL-API-06 : Scanned products upsert logic (COR-09)

## Règle absolue — dépendances de test
@testing-library/jest-dom, @testing-library/react et @testing-library/user-event (v13)
sont embarqués par react-scripts 5.0.1. **Ne jamais les ajouter en devDependencies.
Ne jamais créer ni modifier package.json ou package-lock.json.**
user-event = v13 (API synchrone, pas d'await sur userEvent.click()).
