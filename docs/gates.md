# NutriVita — Journal des Gates (Cycle en V)

| Date | Gate | Verdict | Détail | Ecarts différés |
|------|------|---------|--------|-----------------|
| 2026-06-12 | SL-API v1 | GO (spec) / NO-GO (code existant) | Spec corrigée sur 6 bloquants. Code existant contient 5 KO réglementaires différés. | Voir tableau ci-dessous |
| 2026-06-12 | SL-API v1 (P1.5-A) | GO | Double GO : reglementaire + revue-code. DEF-01/02/03/05/16 levés. DEF-04 hors périmètre marché FR. | — |
| 2026-06-12 | SL-API v1 (P1.5-B) | GO | GO : critique-algo (5/5 formules CONFORME) + revue-code après correction auth.js. DEF-06/07/08/09/12/13/10/14/15 levés. DEF-11 spec corrigée (TDEE dynamique) — implémentation endpoint reportée en P2. | DEF-11 code (P2) |

---

## Gate SL-API — Détail des corrections et écarts différés

### Corrections bloquantes appliquées dans docs/sl-api.md

| ID | Source | Correction |
|---|---|---|
| COR-01 | critique-spec #3 | Ajout règle explicite : si cascade CIQUAL/USDA ne trouve pas d'aliment → `nutrition: null, nutrition_found: false` ; jamais fallback vers valeurs Gemini |
| COR-02 | critique-spec #2 / reglementaire #2 | Remplacement de "Probable"→"Apports très faibles", "A surveiller"→"Apports à améliorer" — terminologie non clinique, conforme REG-05 |
| COR-03 | critique-spec #1 | Ajout du contenu normatif AL-10 dans SL-API-01 pour rendre la traçabilité vérifiable |
| COR-04 | critique-algo #1 | Clarification que les valeurs MET AL-02 correspondent à l'intensité modérée du code ; le webhook DOIT utiliser ces valeurs |
| COR-05 | critique-spec #7 / reglementaire #7 | Webhook POST /api/strava/webhook : validation `STRAVA_VERIFY_TOKEN` rendue obligatoire sans condition "si disponible" |
| COR-06 | critique-algo #4 / critique-spec #14 | Garde statistique glycémie < 12 mesures reformulée comme exigence normative (non plus commentaire) |
| COR-07 | critique-algo #12 | Note sur le calcul AGS mensuel (base fixe 2000 kcal vs TDEE utilisateur) — décision différée à Ahmed |
| COR-08 | critique-spec #13 | CORS whitelist : suppression de `nutrivita-v0.onrender.com` (frontend lecture seule, pas de prod) |
| COR-09 | critique-spec #6 | Logique d'upsert `scanned_products` clarifiée (pas de contrainte UNIQUE SQL, logique applicative décrite) |
| COR-10 | critique-spec #8 | Tableau des valeurs ANSES ajouté dans SL-API-04 (fer, calcium, vitamine D, B12, magnésium, folates H/F) |

---

### Écarts différés (décision Ahmed requise ou implémentation phase suivante)

| ID | Gravité | Source | Description | Action requise |
|---|---|---|---|---|
| DEF-01 | ~~KO BLOQUANT~~ RÉSOLU 2026-06-12 | reglementaire KO-1 | Disclaimer glycémie non masquable ajouté dans GlucoseTrackingPage.jsx via t('glucose.disclaimer') | ✅ |
| DEF-02 | ~~KO BLOQUANT~~ RÉSOLU 2026-06-12 | reglementaire KO-3 | Export et delete couvrent glucose_readings, weight_entries, favorites, push_subscriptions | ✅ |
| DEF-03 | ~~KO BLOQUANT~~ RÉSOLU 2026-06-12 | reglementaire KO-4 | Case consentGlucose séparée, opt-in, stockée en DB (consent_glucose_date + version) | ✅ |
| DEF-04 | KO BLOQUANT (code) | reglementaire KO-5 | PrivacyPage.jsx ne mentionne ni loi 18-07 ni ANPDP — marché algérien | Prérequis bloquant de l'ouverture marché DZ — session juridique dédiée, hors périmètre actuel (marché France) |
| DEF-05 | ~~KO BLOQUANT~~ RÉSOLU 2026-06-12 | reglementaire KO-2 (note) | Label renommé GMI (estimation indicative) + note gmiDisclaimer — aucun texte diagnostique | ✅ |
| DEF-06 | ~~MAJEUR~~ RÉSOLU 2026-06-12 | critique-algo #4 | Garde `< 12 mesures` ajoutée dans `calculatePeriodMetrics()` — retourne `insufficient_data: true` | ✅ |
| DEF-07 | ~~MAJEUR~~ RÉSOLU 2026-06-12 | critique-algo #3 | `Math.min(burned_kcal, 1000)` ajouté dans GET /activity/bilan/:date | ✅ |
| DEF-08 | ~~MAJEUR~~ RÉSOLU 2026-06-12 | critique-algo #5 | CV avec écart-type d'échantillon `/ (n-1)` — formule correcte dans `calculateCV` | ✅ |
| DEF-09 | ~~MAJEUR~~ RÉSOLU 2026-06-12 | critique-algo #6 | `calculateTIR(readings, targetMin, targetMax)` + colonnes `glucose_target_min/max_mg_dl` dans profiles + endpoint lit profil | ✅ |
| DEF-10 | ~~MAJEUR~~ RÉSOLU 2026-06-12 | critique-algo #7 | Tolérance TU-05 élargie à ±0.3 dans cycle-v-nutrivita.md (décision Ahmed) | ✅ |
| DEF-11 | MAJEUR (spec corrigée) | critique-algo #12 | Spec AL-09 mise à jour : AGS = TDEE×10%÷9×30 (dynamique) — implémentation endpoint SL-API-03 reportée en P2 | Spec ✅ / Code P2 |
| DEF-12 | ~~MAJEUR~~ RÉSOLU 2026-06-12 | critique-spec #12 | `process.exit(1)` si JWT_SECRET absent dans server.js ; fallback retiré de auth.js et middleware | ✅ |
| DEF-13 | ~~MINEUR~~ RÉSOLU 2026-06-12 | critique-spec #11 | Migration weight_history→weight_entries + DROP TABLE dans initDB() ; CREATE TABLE supprimé | ✅ |
| DEF-14 | ~~MINEUR~~ RÉSOLU 2026-06-12 | critique-spec #4 | AL-12 créé (sélection/validation langue) ; EB-11 rattaché à AL-12 dans matrice | ✅ |
| DEF-15 | ~~MINEUR~~ RÉSOLU 2026-06-12 | critique-spec #9 | EB-13 marqué HORS PERIMETRE Phase 3 ; AL-13 créé pour EB-14 (diabetic_mode) | ✅ |
| DEF-16 | ~~MINEUR~~ RÉSOLU 2026-06-12 | reglementaire note | Disclaimer Forbes arabe complété : "لأغراض إعلامية فقط" — équivalent "à titre indicatif uniquement" | ✅ |
