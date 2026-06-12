# SL-API — Spécification Logicielle Backend NutriVita

**Document** : Annexe SL-API du Cycle en V NutriVita  
**Référence cadre** : `docs/cycle-v-nutrivita.md`  
**Statut** : Brouillon — en cours de gate SL-API  
**Date de production** : 2026-06-12

---

## 1. EXISTANT — Inventaire de l'état réel (Phase 1, lecture seule)

### 1.1 Structure des routes actuelles

| Préfixe monté | Fichier | Endpoints principaux |
|---|---|---|
| `/api/auth` et `/api/user` | `routes/auth.js` | POST /register, POST /login, GET /user/export, DELETE /user/account |
| `/api/products` | `routes/products.js` | CRUD produits locaux |
| `/api/journal` | `routes/journal.js` | CRUD entrées journal alimentaire par date/repas |
| `/api/profile` | `routes/profile.js` | GET/PUT profil + calcul BMR/TDEE côté serveur |
| `/api/scanner` | `routes/scanner.js` | GET /barcode/:code, POST /ocr, POST /save, GET /search |
| `/api/vision` | `routes/vision.js` | POST / (Clarifai food-item-recognition + base locale) |
| `/api/activity` | `routes/activity.js` | GET /strava/auth, GET /strava/callback, GET /strava/today, POST /manual, GET /bilan/:date, GET /stats/weekly, GET /stats/monthly |
| `/api/dishes` | `routes/dishes.js` | GET /, GET /cuisines, GET /:id, POST / (création custom), POST /:id/log |
| `/api/nutrition` | `routes/nutrition.js` | Recherche cascade CIQUAL→USDA→products |
| `/api/modifiers` | `routes/modifiers.js` | CRUD modificateurs de portion |
| `/api/weight` | `routes/weight.js` | CRUD poids quotidien + courbe |
| `/api/glucose` | `routes/glucose.js` | CRUD lectures + import CSV LibreView + metrics GMI/TIR/CV |
| `/api/voice` | `routes/voice.js` | POST /parse — parsing vocal texte FR/EN/AR |
| `/api/favorites` | `routes/favorites.js` | CRUD favoris plats |
| `/api/notifications` | `routes/notifications.js` | POST/DELETE /subscribe push web |

### 1.2 Schéma SQLite réel

Toutes les tables sont définies dans `backend/db.js` via `initDB()`.

#### users
| Colonne | Type | Contraintes |
|---|---|---|
| id | TEXT | PK |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### profiles
| Colonne | Type | Notes |
|---|---|---|
| user_id | TEXT | PK, FK→users |
| age | INTEGER | DEFAULT 30 |
| weight | REAL | DEFAULT 70 (kg) |
| height | INTEGER | DEFAULT 170 (cm) |
| sexe | TEXT | 'h'/'f' |
| activity_level | TEXT | sédentaire/light/modéré/intense |
| sport | TEXT | type d'activité principal |
| goal | TEXT | perte/maintien/prise |
| pace | TEXT | modere/rapide |
| strava_access_token | TEXT | ajouté via ALTER TABLE |
| strava_refresh_token | TEXT | ajouté via ALTER TABLE |
| strava_athlete_id | TEXT | ajouté via ALTER TABLE |
| strava_token_expires_at | INTEGER | UNIX timestamp |
| strava_athlete_name | TEXT | ajouté via ALTER TABLE |

**Absent** : `glucose_target_min`, `glucose_target_max`, `country`, `latitude_approx`, `diabetic_mode` — à ajouter pour SL-API-04 et SL-API-06.

#### products
| Colonne | Type | Notes |
|---|---|---|
| id | INTEGER | PK AUTOINCREMENT |
| barcode | TEXT | UNIQUE |
| name | TEXT | NOT NULL |
| brand | TEXT | NOT NULL |
| emoji | TEXT | |
| score | TEXT | Nutri-Score lettre (A-E) |
| kcal_per100 | REAL | NOT NULL |
| glucides | REAL | |
| proteines | REAL | |
| lipides | REAL | |
| fibres | REAL | |
| sel | REAL | |
| additifs | TEXT | JSON array |
| comment | TEXT | |
| image_url | TEXT | |
| category | TEXT | |
| is_algerian | INTEGER | |
| source | TEXT | ajouté via ALTER TABLE |
| created_at | DATETIME | |

**Absent pour SL-API-02/03** : `nutri_score` (valeur alphanumérique déjà dans `score`), `nova`, `sat_fat_g`, `times_this_month`, `additives_json`, `verdict` — la table `products` sert de catalogue général ; une table dédiée `scanned_products` est à créer.

#### journal_entries
| Colonne | Type | Notes |
|---|---|---|
| id | TEXT | PK (UUID) |
| user_id | TEXT | FK→users |
| date | TEXT | YYYY-MM-DD |
| meal_type | TEXT | petit_dejeuner/dejeuner/diner/collation |
| product_id | INTEGER | FK→products |
| grams | REAL | |
| kcal | REAL | |
| glucides/proteines/lipides/fibres | REAL | |
| modifiers_json | TEXT | JSON array |
| logged_at | DATETIME | |

#### weight_history *(dupliquée — voir weight_entries)*
| id | INTEGER | PK |
| user_id | TEXT | FK |
| weight | REAL | |
| date | TEXT | |

#### weight_entries *(table principale pour suivi)*
| Colonne | Type | Notes |
|---|---|---|
| id | INTEGER | PK AUTOINCREMENT |
| user_id | TEXT | |
| weight_kg | REAL | |
| body_fat_pct | REAL | nullable |
| date | TEXT | UNIQUE(user_id, date) |
| notes | TEXT | |
| created_at | DATETIME | |

#### glucose_readings
| Colonne | Type | Notes |
|---|---|---|
| id | INTEGER | PK AUTOINCREMENT |
| user_id | TEXT | NOT NULL |
| glucose_mg_dl | REAL | NOT NULL — stockage TOUJOURS en mg/dL (AL-04 ✅) |
| reading_type | TEXT | fasting/pre_meal/post_meal/bedtime/random/cgm |
| timestamp | TEXT | ISO8601 |
| notes | TEXT | |
| source | TEXT | manual/libreview_csv/voice |
| created_at | DATETIME | |

#### activities
| Colonne | Type | Notes |
|---|---|---|
| id | TEXT | PK (UUID) |
| user_id | TEXT | FK→users |
| date | TEXT | YYYY-MM-DD |
| type | TEXT | course/velo/marche/natation/muscu |
| duration_min | INTEGER | |
| distance_km | REAL | |
| calories_burned | REAL | |
| source | TEXT | manual/strava |
| strava_id | TEXT | déduplique les sync Strava |
| created_at | DATETIME | |

#### dishes
| Colonne | Type | Notes |
|---|---|---|
| id | INTEGER | PK AUTOINCREMENT |
| name/name_fr/name_ar/name_en | TEXT | i18n |
| description/description_fr/description_ar/description_en | TEXT | |
| emoji | TEXT | |
| cuisine | TEXT | française/italienne/maghrébine/… |
| category | TEXT | plat/entree/dessert |
| default_portion_g | INTEGER | |
| kcal_per_portion | INTEGER | |
| glucides/proteines/lipides/fibres | REAL | |
| ingredients_json | TEXT | array JSON |
| difficulty/prep_time_min/cook_time_min | TEXT/INT | |
| is_user_created | INTEGER | 0=seed, 1=custom |
| created_by_user_id | TEXT | |

#### favorites, push_subscriptions, dish_analyses
Voir `db.js` — structures simples, aucun impact SL-API.

### 1.3 Middleware d'authentification

- Fichier : `middleware/auth.js`
- JWT signé avec `process.env.JWT_SECRET` (fallback dangereux `nutridz_secret_key` en dev)
- Expose **`req.userId`** (string UUID) — **jamais `req.user.id`**
- Réponses : 401 si token absent, 403 si invalide/expiré

### 1.4 Intégration Clarifai actuelle (via `routes/vision.js` + `services/foodvision.js`)

- Modèle : `food-item-recognition` (Clarifai, 1000 appels/mois gratuit)
- Fallback : `general-image-recognition` si modèle food indisponible
- Flux : base64 → Clarifai → concepts (nom + proba) → lookup `NUTRITION_DB` locale → réponse JSON
- **Absent** : aucun endpoint `/api/interpret` unifié texte/voix/photo ; la vision est isolée

### 1.5 Intégration Strava OAuth2 actuelle (`routes/activity.js` + `services/strava.js`)

- Flux OAuth2 : GET `/strava/auth` → redirect Strava → GET `/strava/callback?code=&state=userId`
- Le `state` contient le `userId` (pas de JWT dans le callback car c'est un redirect navigateur)
- Tokens stockés dans `profiles` (5 colonnes ajoutées via ALTER TABLE)
- Rafraîchissement automatique dans `getValidToken()` si `expires_at - 60s ≤ now`
- Récupération activités : `GET /athlete/activities?after=<debut_journee>`
- Pas de webhook Strava actuellement (synchronisation pull uniquement, pas push)

### 1.6 Cascade CIQUAL/USDA actuelle (`services/ciqual.js`, `services/usda.js`, `routes/nutrition.js`)

- Ordre cascade : NUTRITION_DB locale → CIQUAL (200 aliments pré-chargés en `data/ciqual.json`) → USDA FoodData
- CIQUAL : recherche fuzzy par nom FR/EN avec normalisation NFD + `ACCENT_RE = /[̀-ͯ]/g`
- USDA : requêtes API avec `USDA_API_KEY`, fallback `DEMO_KEY` (~30 req/jour)
- Format retourné : `{ source, nom_fr, nom_en, kcal, proteines, glucides, lipides, fibres, sel }`

### 1.7 Bugs connus documentés

| ID | Localisation | Description | Statut |
|---|---|---|---|
| BUG-01 | `services/ciqual.js:24` | Regex accent documentée comme bug dans CLAUDE.md — **DÉJÀ CORRIGÉE** en `[̀-ͯ]` dans le code actuel | Corrigé |
| BUG-02 | `routes/dishes.js:89-108` | POST /api/dishes : si `ing.product_id` est null mais `ing.kcal_per100` est fourni (ingrédient CIQUAL/USDA), le calcul des calories utilise `ing.kcal_per100` — le branch `else if (ing.kcal_per100 != null)` existe. Cependant si ni `product_id` ni `kcal_per100` ne sont présents, l'ingrédient est silencieusement ignoré | Partiel |
| BUG-03 | `frontend/src/pages/DishesPage.jsx` | Lors de la création d'un plat custom, le frontend n'envoie pas les données nutritionnelles (`kcal_per100`, `glucides`, etc.) pour les ingrédients CIQUAL/USDA (sans `product_id`) — résultat : calories = 0 pour ces ingrédients | Frontend, non corrigé |

---

## 2. SPÉCIFICATION — Endpoints à créer (Phase 2)

### SL-API-01 — POST /api/interpret

**Référence** : EB-01, EB-02, AL-10  
**Authentification** : JWT requis (`Authorization: Bearer <token>`)

> **AL-10 (rappel normatif)** — Gemini 2.5 Flash-Lite, sortie JSON stricte :
> `{ "intents": [ { "type": "meal"|"activity"|"glucose", "items": [...], "confidence": 0..1 } ] }`
> meal.items = [{name, quantity_g}], activity = {sport, durée_min}, glucose = {valeur, unité, contexte}.
> Toute confidence < 0.6 → écran de confirmation obligatoire avant enregistrement.
> **Les valeurs nutritionnelles viennent TOUJOURS de la cascade CIQUAL/USDA, jamais de l'IA.**

#### Requête
```json
{
  "mode": "text" | "voice" | "photo",
  "payload": "<string texte libre ou base64 image>",
  "lang": "fr" | "ar" | "en"
}
```

| Champ | Type | Obligatoire | Validation |
|---|---|---|---|
| mode | string | ✅ | enum : text, voice, photo |
| payload | string | ✅ | non vide ; base64 valide si mode=photo |
| lang | string | ✅ | enum : fr, ar, en |

#### Traitement (AL-10)

1. Appel Gemini 2.5 Flash-Lite avec prompt structurant la sortie JSON stricte.
2. Prompt système : "Extrait uniquement des entités (repas, activité, glycémie). Réponds en JSON strict, aucun commentaire, aucun conseil médical ou nutritionnel."
3. Réponse Gemini attendue :
```json
{
  "intents": [
    {
      "type": "meal",
      "items": [{"name": "chorba", "quantity_g": 350}],
      "confidence": 0.85
    },
    {
      "type": "activity",
      "sport": "course",
      "duration_min": 30,
      "confidence": 0.9
    },
    {
      "type": "glucose",
      "value": 115,
      "unit": "mg/dL",
      "context": "post_meal",
      "confidence": 0.8
    }
  ]
}
```
4. Pour chaque intent avec `confidence < 0.6` : ajouter `"needs_confirmation": true`.
5. Pour les intents `meal` : résoudre chaque item.name via la cascade CIQUAL/USDA (jamais les valeurs nutritionnelles de Gemini).
   - Si la cascade ne retourne aucun résultat pour un item : inclure l'item avec `nutrition: null` et `nutrition_found: false`. **NE JAMAIS utiliser les valeurs Gemini comme fallback nutritionnel.**
6. **REG-05** : Gemini ne sert qu'à extraire des entités. Aucune valeur nutritionnelle, diagnostic ni conseil ne vient du LLM.

#### Réponse 200
```json
{
  "intents": [
    {
      "type": "meal",
      "items": [
        {
          "name": "chorba",
          "quantity_g": 350,
          "nutrition": {
            "source": "ciqual",
            "kcal": 112,
            "glucides": 14.5,
            "proteines": 7.0,
            "lipides": 2.8
          }
        }
      ],
      "confidence": 0.85,
      "needs_confirmation": false
    }
  ],
  "raw_text": "j'ai mangé une chorba"
}
```

#### Codes d'erreur
| Code | Condition |
|---|---|
| 400 | payload manquant ou invalide (base64 mal formé si photo) |
| 422 | Gemini n'a extrait aucune intention exploitable |
| 502 | Gemini indisponible — `{"error": "Service IA temporairement indisponible", "fallback": "Utilisez la saisie manuelle"}` |

#### Variables d'environnement requises
- `GEMINI_API_KEY` — fourni par Ahmed sur Render, jamais codé en dur

---

### SL-API-02 — POST /api/scan

**Référence** : EB-04, AL-08  
**Authentification** : JWT requis

#### Requête
```json
{
  "barcode": "3017620425035"
}
```

| Champ | Type | Obligatoire | Validation |
|---|---|---|---|
| barcode | string | ✅ | non vide, 8-14 caractères numériques |

#### Traitement (AL-08)

1. Lookup OpenFoodFacts : `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
2. Extraire : `product_name`, `nutriments` (kcal_100g, sugars_100g, salt_100g, saturated-fat_100g), `nutriscore_grade`, `additives_tags`, `nova_group`.
3. Calcul du score AL-08 :
   - Base Nutri-Score : A=90, B=75, C=55, D=35, E=15 ; absent=50
   - Malus additifs à risque élevé (E150d, E249, E250, E251, E252, E621) : -30/additif
   - Malus additifs à risque modéré (E471, E955, E951) : -15/additif
   - Score final borné [0 ; 100]
4. Verdict : ≥75 → "Excellent", 50-74 → "Médiocre", <50 → "Mauvais"
5. Persistance dans `scanned_products` (INSERT OR REPLACE) avec `times_this_month` incrémenté.

#### Réponse 200
```json
{
  "product_name": "Nutella",
  "barcode": "3017620425035",
  "nutri_score": "E",
  "nova": 4,
  "score": 5,
  "verdict": "Mauvais",
  "additives_in_cause": ["E150d"],
  "nutrients_per100": {
    "kcal": 530,
    "sugars_g": 56.3,
    "salt_g": 0.1,
    "sat_fat_g": 10.6
  }
}
```

#### Codes d'erreur
| Code | Condition |
|---|---|
| 400 | barcode manquant ou format invalide |
| 404 | Produit inconnu sur OpenFoodFacts |
| 502 | OpenFoodFacts indisponible |

---

### SL-API-03 — Table scanned_products + GET /api/groceries/summary

**Référence** : EB-10, AL-09

#### Schéma SQL (à créer dans `db.js`)
```sql
CREATE TABLE IF NOT EXISTS scanned_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  verdict TEXT NOT NULL CHECK(verdict IN ('Excellent','Médiocre','Mauvais')),
  additives_json TEXT DEFAULT '[]',
  nutri_score TEXT,
  nova INTEGER,
  sugars_g REAL DEFAULT 0,
  salt_g REAL DEFAULT 0,
  sat_fat_g REAL DEFAULT 0,
  times_this_month INTEGER DEFAULT 1,
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scanned_user_date ON scanned_products(user_id, scanned_at);
```

Tous les noms de colonnes sont en `snake_case` (convention SL-03 ✅).

**Logique d'upsert** : la clé métier est `(user_id, barcode, strftime('%Y-%m', scanned_at))`. Lors d'un scan :
- Si une ligne existe pour ce triplet dans le mois courant → `UPDATE scanned_products SET times_this_month = times_this_month + 1, scanned_at = CURRENT_TIMESTAMP WHERE user_id = ? AND barcode = ? AND strftime('%Y-%m', scanned_at) = strftime('%Y-%m','now')`
- Sinon → `INSERT INTO scanned_products (..., times_this_month) VALUES (..., 1)`

Une contrainte UNIQUE au niveau SQL n'est pas ajoutée car la même ligne peut être rescannée des mois différents.

#### GET /api/groceries/summary?period=month

**Authentification** : JWT requis  
**Paramètre** : `period` = "month" (par défaut) ou "week"

**Traitement (AL-09)** :
1. Agréger `sugars_g * times_this_month`, `salt_g * times_this_month`, `sat_fat_g * times_this_month` sur la période.
2. Repères OMS mensuels :
   - Sucres libres : < 50 g/j × 30 = 1500 g/mois
   - Sel : < 5 g/j × 30 = 150 g/mois
   - AGS : < 10 % apport énergétique journalier × 30 (calculé sur base 2000 kcal/j → < 22 g/j → 660 g/mois)
3. Calcul % du repère pour chaque nutriment.
4. Code couleur : ≤ 80 % → "teal", 80-110 % → "amber", > 110 % → "red"
5. Liste des additifs à risque du mois (union des `additives_json`).

**Réponse 200** :
```json
{
  "period": "month",
  "year": 2026,
  "month": 6,
  "sugars": { "total_g": 820, "reference_g": 1500, "pct": 55, "color": "teal" },
  "salt":   { "total_g": 145, "reference_g": 150,  "pct": 97, "color": "amber" },
  "sat_fat": { "total_g": 240, "reference_g": 660,  "pct": 36, "color": "teal" },
  "risk_additives": ["E150d", "E621"],
  "products_scanned": 14
}
```

---

### SL-API-04 — GET /api/stats/deficiencies

**Référence** : EB-08, AL-07  
**Authentification** : JWT requis

#### Requête
Aucun paramètre de requête. Tout est déduit de `req.userId`.

#### Données préalables requises (à ajouter à `profiles`)
```sql
ALTER TABLE profiles ADD COLUMN country TEXT DEFAULT 'FR';
ALTER TABLE profiles ADD COLUMN latitude_approx REAL DEFAULT 46.0;
```
`latitude_approx` = latitude arrondie au degré (ex. 36 pour Alger, 46 pour Paris) — **jamais la position précise (REG-03)**.

#### Traitement (AL-07)
1. Récupérer les entrées journal des 14 derniers jours glissants.
2. Pour chaque aliment du journal, agréger via la cascade CIQUAL les micronutriments couverts : fer, calcium, vitamine D, vitamine B12, magnésium, folates.
3. Comparer les totaux aux références ANSES (par sexe et tranche d'âge adulte) :

   | Nutriment | Homme adulte (réf. ANSES 2021) | Femme adulte |
   |---|---|---|
   | Fer | 9 mg/j | 16 mg/j |
   | Calcium | 950 mg/j | 950 mg/j |
   | Vitamine D | 15 µg/j | 15 µg/j |
   | Vitamine B12 | 4 µg/j | 4 µg/j |
   | Magnésium | 380 mg/j | 300 mg/j |
   | Folates | 330 µg/j | 330 µg/j |

   Statuts (vocabulaire non clinique — REG-05) :
   - < 50 % de la référence sur 14 jours → statut `"Apports très faibles"`
   - 50-70 % → statut `"Apports à améliorer"`
   - > 70 % → pas de signal (nutriment non inclus dans la réponse)
4. Facteur vitamine D : si `latitude_approx > 35` ET mois ∈ {10, 11, 12, 1, 2, 3} → abaisser le seuil de `"A surveiller"` de 70 % à 80 % (synthèse cutanée réduite).

#### Réponse 200
```json
{
  "period_days": 14,
  "disclaimer": "Estimation indicative basée sur vos 14 derniers jours de journal. Ne remplace pas un bilan sanguin.",
  "deficiencies": [
    {
      "nutrient": "vitamine_d",
      "status": "Apports très faibles",
      "pct_reference": 38,
      "reference_unit": "µg/j",
      "reference_value": 15,
      "geographic_factor": true
    },
    {
      "nutrient": "fer",
      "status": "Apports à améliorer",
      "pct_reference": 62,
      "reference_unit": "mg/j",
      "reference_value": 9
    }
  ]
}
```

**REG-04** : `disclaimer` est obligatoire et non vide dans chaque réponse.  
**REG-05** : le champ `status` utilise uniquement `"Apports très faibles"` ou `"Apports à améliorer"` — jamais `"carence avérée"`, jamais de nom de maladie, aucun terme clinique.

#### Codes d'erreur
| Code | Condition |
|---|---|
| 204 | Moins de 3 jours de journal disponibles — réponse vide, pas d'estimation |

---

### SL-API-05 — Webhooks Strava

**Référence** : EB-05, AL-02

#### GET /api/strava/webhook (validation du hub)

Route **sans authentification JWT** (appelée par les serveurs Strava).

**Paramètres query** :
- `hub.mode` : doit valoir `"subscribe"`
- `hub.verify_token` : doit correspondre à `process.env.STRAVA_VERIFY_TOKEN`
- `hub.challenge` : challenge Strava à renvoyer

**Réponse 200** :
```json
{ "hub.challenge": "<valeur reçue>" }
```

**Réponse 403** : si `verify_token` ne correspond pas.

#### POST /api/strava/webhook (réception d'événement)

Route **sans authentification JWT** (appelée par les serveurs Strava).

**Sécurité OBLIGATOIRE** : le body du POST Strava contient un champ `verify_token`. Cette valeur DOIT être comparée à `process.env.STRAVA_VERIFY_TOKEN`. Si la comparaison échoue ou si `STRAVA_VERIFY_TOKEN` n'est pas défini, répondre 403 et rejeter silencieusement l'événement sans traitement. Aucune alternative conditionnelle n'est permise.

**Body Strava** :
```json
{
  "object_type": "activity",
  "object_id": 12345678,
  "aspect_type": "create",
  "owner_id": 987654,
  "event_time": 1718100000
}
```

**Traitement** :
1. Ignorer si `object_type != "activity"` ou `aspect_type != "create"`.
2. Retrouver l'utilisateur NutriVita lié à `owner_id` (Strava athlete_id) via `profiles.strava_athlete_id`.
3. Si aucun utilisateur trouvé : répondre 200 (silencieux — ne pas révéler l'existence d'utilisateurs).
4. Récupérer les détails de l'activité via l'API Strava : `GET /activities/{object_id}`.
5. Calculer les kcal (AL-02) :
   - Si `kilojoules` disponible : `kcal = kilojoules * 0.239`
   - Sinon si `calories` disponible (native Strava) : utiliser `calories`
   - Sinon : `kcal = MET[type] * poids_kg * (duration_h)` avec poids depuis `profiles`
   - **Les kcal natives Strava sont prioritaires** (AL-02 ✅)
   - Valeurs MET AL-02 (spec) : course 9.0, vélo 7.0, marche 3.5, natation 6.0, musculation 5.0 — ces valeurs correspondent à l'intensité modérée dans le code existant. Les niveaux d'intensité légère/intense sont une extension du code non spécifiée dans AL-02 ; le fallback webhook DOIT utiliser la valeur modérée.
6. Insérer dans `activities` (INSERT OR IGNORE sur `strava_id` pour dédupliquer).
7. Répondre 200 immédiatement (avant les traitements asynchrones si nécessaire pour respecter le timeout Strava).

**Réponse 200** : `{}` (corps vide — Strava requiert un 200 rapide)

#### Variables d'environnement requises
- `STRAVA_CLIENT_ID` — fourni par Ahmed
- `STRAVA_CLIENT_SECRET` — fourni par Ahmed
- `STRAVA_VERIFY_TOKEN` — chaîne secrète choisie par Ahmed, fournie à Strava lors de l'abonnement webhook

---

### SL-API-06 — Glycémie : stockage et cibles (confirmation)

**Référence** : EB-09, AL-04, AL-05

#### Stockage (AL-04 ✅ déjà conforme)
- `glucose_readings.glucose_mg_dl` : REAL, stockage TOUJOURS en mg/dL.
- Conversions à l'affichage uniquement :
  - g/L = `mg_dl / 100`
  - mmol/L = `mg_dl / 18.016`

#### Cibles utilisateur (à ajouter)
```sql
ALTER TABLE profiles ADD COLUMN glucose_target_min_mg_dl REAL DEFAULT 70;
ALTER TABLE profiles ADD COLUMN glucose_target_max_mg_dl REAL DEFAULT 180;
```
Exposition via GET /api/profile (champs `glucose_target_min_mg_dl`, `glucose_target_max_mg_dl`).

#### Répartition des calculs (AL-05)
| Calcul | Côté | Justification |
|---|---|---|
| GMI | Serveur (`services/glucoseMetrics.js`) | Déjà implémenté via GET /api/glucose/metrics |
| TIR | Serveur | Idem, utilise les cibles personnalisées si disponibles |
| CV | Serveur | Idem |
| Distribution (zones) | Serveur | Idem |
| Conversion d'unité à l'affichage | Client | Responsabilité UI — ne pas dupliquer côté serveur |

**Note anti-doublon** : le serveur calcule GMI/TIR/CV via GET /api/glucose/metrics. Le frontend ne doit pas recalculer ces valeurs — il consomme les résultats du serveur.

**Garde statistique (AL-05) — exigence normative** : l'endpoint GET /api/glucose/metrics DOIT retourner
`{ "insufficient_data": true, "total_readings": N, "message": "Données insuffisantes (N mesures ponctuelles)" }`
si `total_readings < 12`. Les champs `gmi`, `tir`, `cv` sont absents de la réponse dans ce cas.
Cette garde est couverte par TU-02. Le code actuel (`calculatePeriodMetrics()`) ne l'implémente pas — correction obligatoire avant gate implémentation.

---

## 3. MATRICE DE TRAÇABILITÉ EB→AL→SL-API→TI

| EB | AL | SL-API | TI | Remarque |
|---|---|---|---|---|
| EB-01 | AL-10 | SL-API-01 (mode=photo) | TI-01 | |
| EB-02 | AL-10 | SL-API-01 (mode=text/voice) | TI-02 | |
| EB-04 | AL-08 | SL-API-02 | TI-03 | |
| EB-05 | AL-02 | SL-API-05 (webhook) | TI-04 | Webhook + pull today |
| EB-08 | AL-07 | SL-API-04 | TU-08 | REG-03/04 applicables |
| EB-09 | AL-04/AL-05 | SL-API-06 | TI-05, TU-01/TU-02 | REG-04/05 applicables |
| EB-10 | AL-09 | SL-API-03 | TI-03 | |
| EB-03 | AL-10 (cascade) | /api/nutrition (existant) | TU-08 partiel | Cascade CIQUAL/USDA déjà présente |
| EB-06 | AL-01/AL-02/AL-03 | /api/activity/stats (existant) | TU-03/TU-04 | |
| EB-07 | AL-06 | /api/weight (existant) | TU-05 | REG-04 |
| EB-11 | — | Tous endpoints (lang param) | VAL-11 | RTL pour arabe |
| EB-12 | — | Architecture REST + PWA | VAL-12 | |
| EB-13 | — | Phase 3 uniquement | — | REG-06/07 bloquants avant impl. |
| EB-14 | — | /api/profile (existant) | VAL-14 | diabetic_mode à ajouter |

---

## 4. VARIABLES D'ENVIRONNEMENT REQUISES

Toutes sont fournies par Ahmed directement sur Render. **Aucune ne doit être codée en dur dans le code source.**

| Variable | Usage | Fourni par |
|---|---|---|
| `GEMINI_API_KEY` | SL-API-01 : appels Gemini 2.5 Flash-Lite | Ahmed (Google AI Studio) |
| `USDA_API_KEY` | Cascade USDA (existant) | Ahmed |
| `STRAVA_CLIENT_ID` | OAuth2 Strava + webhook | Ahmed |
| `STRAVA_CLIENT_SECRET` | OAuth2 Strava + webhook | Ahmed |
| `STRAVA_REDIRECT_URI` | OAuth2 callback | Ahmed (`https://nutridz.onrender.com/api/activity/strava/callback`) |
| `STRAVA_VERIFY_TOKEN` | **Nouveau** — validation webhook SL-API-05 | Ahmed (à générer et configurer dans Strava) |
| `JWT_SECRET` | Auth middleware (existant) | Ahmed |
| `FRONTEND_URL` | CORS + redirections OAuth | Ahmed (`https://nutridz-web.onrender.com`) |
| `CLARIFAI_API_KEY` | Vision photo (existant) | Ahmed |

---

## 5. CONVENTIONS TECHNIQUES (rappel SL-03)

- `req.userId` — jamais `req.user.id`
- Champs snake_case : `weight_kg`, `glucose_mg_dl`, `calories_burned`, `sat_fat_g`
- Arabe dans le code : échappements `\uXXXX` uniquement
- SQLite async : `await db.prepare(sql).get/all/run(params)` — jamais `better-sqlite3`
- CORS whitelist : `nutridz-web.onrender.com`, `nutrivita-v0.onrender.com` (frontend de production Phase 4), `localhost:3000` — correction COR-08 rétabli 2026-06-12
- OPTIONS preflight : `app.options('*', cors(corsOptions))` déjà en place ✅
