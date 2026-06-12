# NutriVita — Journal des Gates (Cycle en V)

| Date | Gate | Verdict | Détail | Ecarts différés |
|------|------|---------|--------|-----------------|
| 2026-06-12 | SL-API v1 | GO (spec) / NO-GO (code existant) | Spec corrigée sur 6 bloquants. Code existant contient 5 KO réglementaires différés. | Voir tableau ci-dessous |
| 2026-06-12 | SL-API v1 (P1.5-A) | GO | Double GO : reglementaire + revue-code. DEF-01/02/03/05/16 levés. DEF-04 hors périmètre marché FR. | — |

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
| DEF-06 | MAJEUR (code) | critique-algo #4 | `calculatePeriodMetrics()` calcule GMI/TIR pour n=1 mesure — garde < 12 absente | Corriger services/glucoseMetrics.js avant gate Implémentation |
| DEF-07 | MAJEUR (code) | critique-algo #3 | Plafond 1000 kcal/j AL-03 absent de GET /activity/bilan/:date | Corriger routes/activity.js |
| DEF-08 | MAJEUR (code) | critique-algo #5 | CV calculé avec variance population (÷ n) au lieu de variance échantillon (÷ n-1) | Corriger services/glucoseMetrics.js |
| DEF-09 | MAJEUR (code) | critique-algo #6 | TIR avec bornes fixes [70;180] — cibles personnalisées utilisateur non passées en paramètre | Corriger après ajout de `glucose_target_min/max` dans profiles |
| DEF-10 | MAJEUR (spec) | critique-algo #7 | TU-05 : résultat calculé 21.2 % vs spec 21.0 % (±0.1) — valeur de référence TU-05 à revoir | Ahmed valide si tolérance ±0.2 acceptable ou si formule doit être ajustée |
| DEF-11 | MAJEUR (spec) | critique-algo #12 | Seuil AGS mensuel basé sur 2000 kcal fixe au lieu du TDEE utilisateur — erreur 21-30 % pour profils actifs | Ahmed arbitre : seuil fixe (simple) vs TDEE dynamique |
| DEF-12 | MAJEUR (code) | critique-spec #12 | JWT_SECRET fallback codé en dur — le serveur doit refuser de démarrer si JWT_SECRET absent | Corriger server.js avant gate Implémentation |
| DEF-13 | MINEUR (code) | critique-spec #11 | Table `weight_history` dupliquée — dépréciation/suppression à planifier | Planifier migration en phase Implémentation |
| DEF-14 | MINEUR (spec) | critique-spec #4 | EB-11 sans AL assigné (i18n) — AL manquant | Créer AL-11 ou référencer AL existant |
| DEF-15 | MINEUR (spec) | critique-spec #9 | EB-13/EB-14 sans AL dans la matrice | Marquer EB-13 hors périmètre ; créer AL pour EB-14 diabetic_mode |
| DEF-16 | ~~MINEUR~~ RÉSOLU 2026-06-12 | reglementaire note | Disclaimer Forbes arabe complété : "لأغراض إعلامية فقط" — équivalent "à titre indicatif uniquement" | ✅ |
