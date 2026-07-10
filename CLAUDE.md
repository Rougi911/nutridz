# NutriVita — Contexte du projet

## Vue d'ensemble

NutriVita est une application de nutrition intelligente déployée en PWA, ciblant le marché français puis algérien. Anciennement nommée NutriDZ, rebaptisée NutriVita.

**Tagline** : Your Daily Wellness Companion

## URLs de production

- **Frontend (PWA)** : https://nutridz-web.onrender.com
- **Backend (API)** : https://nutridz.onrender.com
- **GitHub** : https://github.com/Rougi911/nutridz

## Stack technique

### Backend
- **Runtime** : Node.js 20.11.0 sur Render (plan gratuit)
- **Framework** : Express 4.18 + helmet + cors + express-rate-limit
- **Base de données** : PostgreSQL via `pg` (node-postgres), Pool max 5 sur chaîne **pooled** Neon (S7). Couche `db.js` async garde l'interface historique (`prepare().get/all/run`, `exec`, `withClient`, `transaction`). *Migration depuis SQLite faite sur branche `feat/postgres` — voir « Stack base de données (PostgreSQL) » plus bas.*
- **Authentification** : JWT (bcryptjs)
- **Yarn** comme package manager sur Render

### Frontend
- **Framework** : React 18 + React Router
- **State** : Zustand (avec persist localStorage)
- **HTTP** : axios
- **Graphiques** : Recharts
- **Notifications** : react-hot-toast
- **Icônes** : Tabler Icons (CDN)
- **Build** : Create React App
- **PWA** : Service Worker + manifest.json + icônes 72→512px

### Hébergement
- **Render.com** plan gratuit (le service s'endort après 15min inactivité, 30-60s pour réveiller)
- 2 services : `nutridz` (backend Web Service) et `nutridz-web` (Static Site)

## Variables d'environnement Render

### Backend (`nutridz`)
```
NODE_ENV=production
NODE_VERSION=20.11.0
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require  # PostgreSQL Neon (chaîne POOLED). Requis depuis S7.
JWT_SECRET=...                        # ⚠️ JAMAI
FRONTEND_URL=https://nutridz-web.onrender.com
CLARIFAI_API_KEY=...                  # Reconnaissance d'aliments par photo
USDA_API_KEY=...                      # Base nutritionnelle USDA FoodData
STRAVA_CLIENT_ID=...                  # OAuth Strava
STRAVA_CLIENT_SECRET=...
STRAVA_REDIRECT_URI=https://nutridz.onrender.com/api/activity/strava/callback
```

### Frontend (`nutridz-web`)
```
REACT_APP_API_URL=https://nutridz.onrender.com/api
REACT_APP_GA_ID=G-XXXXXXXXXX          # Google Analytics (optionnel)
REACT_APP_VAPID_PUBLIC_KEY=...        # Push notifications (générer avec web-push generate-vapid-keys)
```

## Structure du projet

```
nutridz/
├── backend/
│   ├── server.js                     # Point d'entrée Express, trust proxy activé
│   ├── db.js                         # PostgreSQL via pg (Statement traduit ?/@clé → $n ; .run/.get/.all → Promise ; RETURNING auto, withClient/transaction)
│   ├── package.json                  # yarn start = node server.js
│   ├── middleware/
│   │   └── auth.js                   # JWT, expose req.userId (PAS req.user)
│   ├── routes/
│   │   ├── auth.js                   # Login/register + GET /user/export, DELETE /user/account (RGPD)
│   │   ├── products.js               # CRUD produits
│   │   ├── journal.js                # Entrées journal alimentaire
│   │   ├── profile.js                # Profil + BMR/TDEE calculés serveur
│   │   ├── scanner.js                # Code-barres + OCR Tesseract
│   │   ├── vision.js                 # Analyse de plat par photo
│   │   ├── activity.js               # Strava + bilan calories ingérées/dépensées
│   │   ├── dishes.js                 # Base de 60 plats avec recettes
│   │   ├── nutrition.js              # Recherche cascade NUTRITION_DB → CIQUAL → USDA
│   │   ├── weight.js                 # CRUD entrées de poids + estimation composition Forbes
│   │   ├── glucose.js                # CRUD lectures glycémie + import CSV LibreView + métriques GMI/TIR/CV
│   │   ├── voice.js                  # POST /parse — parsing saisie vocale (aliments/poids/glucose)
│   │   ├── favorites.js              # CRUD favoris plats (table favorites, INSERT OR IGNORE)
│   │   └── notifications.js          # POST/DELETE /subscribe — abonnements push (table push_subscriptions)
│   ├── services/
│   │   ├── openfoodfacts.js          # Lookup code-barres mondial
│   │   ├── ocr.js                    # Tesseract.js OCR étiquettes (FR/AR/EN)
│   │   ├── foodvision.js             # Clarifai food-item-recognition + NUTRITION_DB locale
│   │   ├── strava.js                 # OAuth2 + récupération activités
│   │   ├── ciqual.js                 # Base ANSES France (3186 aliments, recherche fuzzy)
│   │   ├── usda.js                   # USDA FoodData (350k aliments mondiaux)
│   │   ├── glucoseMetrics.js         # GMI, TIR, CV, distribution + parsing LibreView CSV
│   │   └── voiceParser.js            # parseFoodInput / parseWeightInput / parseGlucoseInput (FR/EN/AR)
│   ├── data/
│   │   ├── ciqual.json               # 200 aliments CIQUAL pré-chargés
│   │   └── translations.json         # EN↔FR↔AR pour 200 labels
│   └── scripts/
│       └── downloadCiqual.js         # Optionnel : importer les 3000 aliments CIQUAL complet
│
└── frontend/
    ├── public/
    │   ├── manifest.json             # PWA NutriVita
    │   ├── index.html                # Meta PWA + Apple touch icons
    │   ├── sw.js                     # Service Worker cache offline
    │   ├── sw-push.js                # Service Worker push events (push + notificationclick)
    │   ├── _redirects                # /* /index.html 200 (SPA fallback Render)
    │   └── icons/                    # icon-72.png à icon-512.png
    ├── src/
    │   ├── App.jsx                   # Routes : "/" landing/redirect, + private layout pour toutes les pages + OnboardingModal
    │   ├── index.js                  # Enregistrement Service Worker
    │   ├── i18n.js                   # Traductions FR/AR/EN + support RTL pour arabe
    │   ├── store/index.js            # Zustand : authStore, profileStore, journalStore, productsStore
    │   ├── store/useFavoritesStore.js # Zustand favoris : fetchFavorites, addFavorite, removeFavorite, isFavorite
    │   ├── utils/api.js              # axios instance + formules calcBMR/calcTDEE/calcTarget/calcWalkTime
    │   ├── utils/exportPDF.js        # exportBilanPDF(elementId, filename) — jsPDF + html2canvas
    │   ├── contexts/
    │   │   └── ThemeContext.jsx       # ThemeProvider + useTheme() — dark/light, persist localStorage
    │   ├── hooks/
    │   │   └── usePushNotifications.js # subscribe/unsubscribe Web Push (nécessite REACT_APP_VAPID_PUBLIC_KEY)
    │   ├── components/
    │   │   ├── Layout.jsx            # Bottom nav 9 onglets : Journal/Produits/Plats/Scanner/Vision/Bilan/Historique/Glycémie/Profil + footer RGPD
    │   │   ├── LanguageSelector.jsx  # AR/FR/EN
    │   │   ├── CookieBanner.jsx      # Bannière CNIL conforme
    │   │   ├── ActivityForm.jsx      # Ajout activité manuelle
    │   │   ├── BarcodeScanner.jsx    # Quagga2 scanner (eslint-disable react-hooks/exhaustive-deps en haut)
    │   │   ├── Skeleton.jsx          # SkeletonLine, SkeletonCircle, SkeletonCard — animation skeleton-pulse
    │   │   ├── VoiceInput.jsx        # Web Speech API — start/stop micro, callback onResult(transcript)
    │   │   └── OnboardingModal.jsx   # Modal 4 étapes (welcome/corps/objectif/features), flag localStorage
    │   └── pages/
    │       ├── LandingPage.jsx       # Page publique "/" : hero + 6 features + CTA → /register ou /login
    │       ├── JournalPage.jsx       # Tableau de bord quotidien + saisie poids + saisie vocale + dupliquer J-1
    │       ├── ProductsPage.jsx      # Catalogue produits
    │       ├── ProductDetailPage.jsx # Fiche produit + add to journal
    │       ├── DishesPage.jsx        # Base de 60 plats + création custom + favoris (étoile + filtre)
    │       ├── DishDetailPage.jsx    # Fiche plat avec slider portion + bouton favori ⭐
    │       ├── FoodVisionPage.jsx    # Analyse photo plat (Clarifai) + 6 cuisines reconnues
    │       ├── HistoryPage.jsx       # Graphiques 7 jours
    │       ├── BilanPage.jsx         # 4 vues : Jour/Semaine/Mois + Évolution + bouton export PDF 📄
    │       ├── ProfilePage.jsx       # Profil + 4 onglets + RGPD + dark mode toggle + carte notifications push
    │       ├── GlucoseTrackingPage.jsx # Saisie manuelle + import LibreView CSV + métriques GMI/TIR/CV + ScatterChart
    │       ├── LoginPage.jsx
    │       ├── RegisterPage.jsx      # 2 cases RGPD obligatoires
    │       ├── PrivacyPage.jsx       # Politique confidentialité
    │       └── LegalPage.jsx         # Mentions légales
```

## Conventions critiques

### Backend PostgreSQL (pg) async
La DB utilise `pg` (node-postgres) sur la chaîne **pooled** Neon. Toutes les requêtes sont async :
```javascript
const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
const rows = await db.prepare('SELECT * FROM products').all();
const result = await db.prepare('INSERT INTO users (...) VALUES (?)').run(value); // result.lastInsertRowid
```
La couche `db.js` traduit les placeholders `?` (positionnels) et `@clé` (nommés) → `$n`, ajoute
`RETURNING *` aux `INSERT` (→ `lastInsertRowid`, `undefined` sur `ON CONFLICT DO NOTHING`),
et parse `int8`/`numeric` en `number`. Transactions : `db.withClient(fn)` / `db.transaction(fn)`
sur un **client dédié libéré en `finally`** (jamais sur le pool partagé).

### Stack base de données (PostgreSQL) — règles SQL
SQL Postgres, **pas SQLite**. À respecter pour toute nouvelle requête :
- **Upsert** : `INSERT ... ON CONFLICT (cols) DO UPDATE/NOTHING` (jamais `INSERT OR IGNORE/REPLACE`).
- **Auto-id** : lire `result.lastInsertRowid` (la couche ajoute `RETURNING`), jamais `rowid`.
- **Dates** : pas de `strftime`/`date('now', ...)`. Calculer les coupures « now − N jours » **en JS**
  et passer en paramètre ; sinon `to_char()`, `::date`, `now() - interval '…'`. Les colonnes
  métier date/heure sont stockées en **TEXT** (`YYYY-MM-DD`), `TIMESTAMPTZ` pour `created_at`/`scanned_at`.
- **Schéma** (`db.js`) : `SERIAL`, `TIMESTAMPTZ DEFAULT now()`, `ADD COLUMN IF NOT EXISTS`, seeds `ON CONFLICT`.
- **FK appliquées** (contrairement à SQLite) : insérer les lignes parentes d'abord (ex. `users` avant `journal_entries`).
- **Pas de prepared statements nommés** (incompatible pgbouncer mode transaction).
- **Tests** : service Postgres en CI, `DATABASE_URL` requis, **schéma isolé par worker Jest**
  (`search_path=test_w$JEST_WORKER_ID`). Sans `DATABASE_URL`, `getDB()` lève.
- **Cache OFF** : `services/offCache.js` = mémoire + table `off_cache(barcode, payload JSONB, fetched_at)`
  (persistant après spin-down), best-effort.

### Auth middleware
`req.userId` (PAS `req.user.id`). Toutes les routes protégées doivent utiliser `req.userId`.

### CORS
Liste blanche dans `server.js` :
```javascript
const allowedOrigins = [
  'https://nutridz-web.onrender.com',
  'http://localhost:3000',
  'http://localhost:19006'
];
```

### Trust proxy
`app.set('trust proxy', 1)` est obligatoire après `helmet()` pour express-rate-limit sur Render.

### CIQUAL recherche fuzzy
Utilise regex `\u0300-\u036f` pour la suppression des accents (pas les caractères combinés littéraux).

## Fonctionnalités implémentées

| Module | Status | Détails |
|---|---|---|
| Auth JWT | ✅ | Login/register + Strava OAuth |
| Profil + BMR/TDEE | ✅ | Calcul automatique objectifs |
| Journal alimentaire | ✅ | 4 repas par jour + macros + modifiers + saisie vocale + dupliquer J-1 |
| Scanner code-barres | ✅ | Quagga2 + OpenFoodFacts + base locale |
| OCR étiquettes | ✅ | Tesseract.js FR/AR/EN |
| Analyse photo plat | ✅ | Clarifai food-item-recognition (1000 appels/mois gratuit) |
| 6 cuisines reconnues | ✅ | France/Italie/Maghreb/Asie/USA/Moyen-Orient |
| Base de 60 plats | ✅ | 11 cuisines + création custom + favoris ⭐ |
| Bilan calories | ✅ | 4 vues : Jour/Semaine/Mois + Évolution + export PDF 📄 |
| Intégration Strava | ✅ | OAuth + sync activités |
| Bases nutritionnelles | ✅ | NUTRITION_DB → CIQUAL (3186 aliments) → USDA (cascade) |
| Suivi du poids | ✅ | Saisie quotidienne + courbe évolution + estimation composition corporelle (Forbes) |
| Suivi glycémique | ✅ | Saisie manuelle + import LibreView CSV + métriques GMI/TIR/CV + ScatterChart |
| Parser vocal | ✅ | Texte transcrit → aliments/poids/glycémie structurés (FR/EN/AR, POST /api/voice/parse) |
| Multilingue | ✅ | FR/AR/EN avec RTL pour arabe |
| Conformité RGPD | ✅ | Bannière cookies + export/suppression données |
| PWA installable | ✅ | iOS/Android, icônes, service worker, splash |
| Dark mode | ✅ | CSS custom properties + ThemeContext + toggle Profil |
| Skeleton loaders | ✅ | DishesPage, GlucoseTrackingPage, BilanPage, JournalPage |
| Lazy loading | ✅ | BilanPage, GlucoseTrackingPage, DishDetailPage (-19.5 kB bundle) |
| Onboarding guidé | ✅ | Modal 4 étapes au premier login (corps/objectif/features) |
| Landing page publique | ✅ | `/` hero + 6 features + CTA, redirige vers journal si connecté |
| Notifications push | ⚠️ | Infrastructure prête (table `push_subscriptions` + route + hook) — VAPID key à configurer sur Render |
| Google Analytics | ⏳ | Code prêt, attend REACT_APP_GA_ID |
| Mode hors ligne complet | ❌ | Cache basique uniquement |

## Workflows fréquents

### Modification + déploiement
```bash
# Dans Claude Code
# Décrire la modification voulue, Claude Code fait l'édition + git push
# Render redéploie automatiquement les deux services (~3 min backend, ~5 min frontend)
```

### Vérifier les logs
- Backend : Render → `nutridz` → Logs
- Frontend : Render → `nutridz-web` → Deploys → cliquer sur un déploiement

### Tester l'API
```
https://nutridz.onrender.com/api/health
```
Réponse attendue : `{"status":"ok","version":"1.0.0"}`

## Bugs connus à corriger

1. **ciqual.js** — accent-removal regex doit utiliser `\u0300-\u036f` au lieu de caractères combinés littéraux
2. **dishes.js POST** — handler ignore les ingrédients CIQUAL/USDA sans product_id dans le calcul des calories
3. **DishesPage.jsx** — n'envoie pas les données nutritionnelles des ingrédients non-locaux au backend

## Idées futures à creuser

**Fonctionnalités** :
- Notifications push de rappel de repas/mesure glycémie *(infra prête, ajouter VAPID key + cron backend)*
- Mode hors ligne complet avec sync intelligente
- Recettes communautaires (utilisateurs partagent leurs plats)
- Intégration Apple Health / Google Fit (en plus de Strava)
- Corrélation glycémie ↔ repas avec alertes/patterns

**Performance & UX** :
- Optimisation bundle size (tree shaking, code splitting)
- Service worker plus agressif (cache stratégies)
- Animations de transition entre pages

**SEO & Marketing** :
- Meta tags OpenGraph pour partage social
- Blog intégré pour SEO
- Domaine custom `nutrivita.fr` (~10€/an OVH)
- Publication Google Play (25$ unique)
- Dashboard admin (/admin) avec stats utilisateurs

## Historique des chantiers

| Chantier | Phase | Fonctionnalité | Commit |
|---|---|---|---|
| #1–#2 | — | Auth, journal, scanner, vision, plats, RGPD, CIQUAL+USDA | `fd32ade`…`62b471b` |
| #3 | Phase 1 | Suivi du poids backend (weight_history, /api/weight, composition Forbes) | `228ab3f` |
| #3 | Phase 2 | UI poids : card JournalPage + onglet Évolution BilanPage (Recharts) | `6564ad3` |
| #4 | Phase 1 | Suivi glycémique backend (glucose_readings, métriques GMI/TIR/CV, LibreView CSV) | `7dab676` |
| #4 | Phase 2 | UI glycémie : GlucoseTrackingPage (saisie, import CSV, ScatterChart, métriques) | `da5bef8` |
| #5 | Phase 1 | Parser vocal backend : voiceParser.js + POST /api/voice/parse (FR/EN/AR) | `02810a6` |
| #5 | Phase 2 | VoiceInput.jsx frontend : Web Speech API, intégration Journal + Glucose | `40f1ffe` |
| #6 | — | Polish : dark mode, skeleton loaders, lazy loading, favoris plats, dupliquer J-1 | `e889949` |
| #7 | — | Features avancées : export PDF, onboarding, push infra, landing page publique | `a149285` |
| S7 | — | Migration SQLite → PostgreSQL (couche pg, schéma PG, scan_month/off_cache, CI Postgres) | branche `feat/postgres` (PR #1) |

## Notes importantes

- **Base PostgreSQL (Neon)** : `DATABASE_URL` = chaîne **pooled** (`-pooler`, pgbouncer transaction). La couche `db.js` retire `channel_binding` automatiquement si le pooler refuse le SASL. Repartir propre est OK (l'ancienne SQLite prod était éphémère). Au lancement public : **Render Starter** (supprime le spin-down) + **Neon sans auto-suspend**. Migration livrée sur branche `feat/postgres` (PR) — bascule = humain (créer Neon + `DATABASE_URL` Render + merge + vérifier la persistance après un redéploiement).
- **Plan gratuit Render** : backend s'endort après 15min, 30-60s pour réveiller à la première requête
- **Clarifai** : 1000 analyses/mois gratuit, modèle `food-item-recognition` ou fallback `general-image-recognition`
- **USDA** : 1000 req/heure avec clé gratuite, sinon DEMO_KEY limité à ~30/jour
- **Strava** : OAuth2 redirige vers `/api/activity/strava/callback`, le state param contient userId
- **Push notifications** : infra prête (table + route + hook), mais nécessite `REACT_APP_VAPID_PUBLIC_KEY` (frontend) + `VAPID_PRIVATE_KEY` + `VAPID_EMAIL` (backend) + npm `web-push` + cron d'envoi côté serveur
- **Onboarding** : flag `nutridz-onboarding-done` dans localStorage. Pour re-tester, supprimer cette clé
- **Landing page** : route `/` publique — les users connectés sont redirigés automatiquement vers `/journal`
- **PowerShell Windows** : `Ctrl+V` ne marche pas dans Claude Code, utiliser clic droit pour coller
- **Limite quota Claude Code** : se réinitialise à 4h du matin Paris pour le plan Pro

## Pour économiser les crédits Claude Code

1. **Décrire précisément** ce qu'on veut sans ambiguïté
2. **Référencer ce fichier CLAUDE.md** au début de chaque session
3. **Limiter le scope** : "modifie juste backend/routes/auth.js" plutôt que "améliore l'auth"
4. **Une tâche à la fois** plutôt que des listes longues
5. **Utiliser des fichiers .txt** sur le Bureau pour les longs prompts au lieu de coller dans le terminal
6. **Demander à Claude Code de NE PAS relire les fichiers** s'il les a déjà vus dans la session

## Workflow superpowers — restylage frontend (NutriVita)

### Objectif courant
Appliquer le design de nutrivita-v0 au frontend React (frontend/) SANS régression.
Design reproduit dans le stack actuel (CRA + CSS custom properties + ThemeContext).
PAS de migration Tailwind. On ne touche qu'à frontend/ ; backend/ et mobile/ ne changent pas.

### Source du design (référence visuelle seulement)
Repo : https://github.com/Rougi911/nutrivita-v0 (Next.js + Tailwind + shadcn/ui).
À cloner en lecture seule pour extraire palette, typo, rayons, ombres, espacements,
structure des écrans. NE PAS copier le code Next/Tailwind : réimplémenter en CSS.

### Règles non négociables
- Aucune régression des fonctionnalités (auth JWT, scanner, OCR, vision, Recharts,
  export PDF, i18n FR/AR/EN + RTL, dark mode, PWA).
- TDD adapté : pour chaque écran, d'abord un test de non-régression, puis on style,
  puis on vérifie que le test passe toujours. Tests en Jest + React Testing Library.
- Préserver RTL (arabe) et dark mode sur chaque écran restylé.
- Un commit par écran/composant ; push immédiat.

### Déploiement
- Service Render surveillé : nutridz-web (Static Site) — ID : srv-d82aqjm7r5hc73ebc1t0
- Workspace : My Workspace (tea-d8274k0g4nts73fit3jg). Auto-deploy sur push.
- Statut lu via le MCP Render. Si build échoué : lire les logs, corriger, re-push, sans interrompre.

### Fichiers d'état
SPEC.md (exigences DES-xx / REG-xx), PLAN.md (généré), HANDOFF.md (avancement), REPORT.md (RTM).

### Contexte
Réécrire HANDOFF.md après chaque écran et avant saturation. À la reprise après /clear :
ne lire que CLAUDE.md, SPEC.md, PLAN.md, HANDOFF.md, REPORT.md.

## Checkpoint obligatoire (subagent-driven)
Avant toute code quality review, le sous-agent doit :
1. Committer le code de la tâche.
2. Réécrire HANDOFF.md (tâche faite, prochaine, RTM, dernier hash).
La review tourne APRÈS — jamais avant.

## Calibrage des reviews
- Tâches CSS/tokens : review légère (conformité spec + RTL + pas de style inline). Max 5 min.
- Tâches composants : review standard.
- Tâches navigation/écrans : review complète avec tests.

## Commits antérieurs à vérifier
origin/main contient du travail de restyling antérieur (0e1f544, 8919112, bfd0772, fea6937).
Avant chaque tâche de restyling d'écran (Tasks 9-15), vérifier si l'écran est déjà
partiellement restylé — ne pas écraser, merger intelligemment.

## Dépendances de test — règle absolue
@testing-library/jest-dom, @testing-library/react et @testing-library/user-event (v13)
sont déjà embarqués par react-scripts 5.0.1. Ne jamais les ajouter en devDependencies.
Ne jamais créer ni modifier package.json ou package-lock.json dans ce projet.
user-event utilisé dans ce projet = v13 (API synchrone, userEvent.click() sans await).

## Boucle de dev autonome (déclencheur : « lance la boucle »)
Quand l'utilisateur dit « lance la boucle » (ou équivalent), exécuter ceci sans redemander :

1. Lire `C:\AppliSanteNutriVita\BACKLOG.md` et appliquer les **règles de la boucle** en tête de ce fichier.
2. Travailler **uniquement dans le repo nutridz (backend)**.
3. Prendre la **première tâche non cochée** de ce périmètre → implémenter → `npm test` →
   si vert : `git add` (fichiers touchés) + commit conventionnel + `git push` → mettre à jour le
   **Journal** du backlog + cocher la case.
4. Enchaîner la tâche suivante du même périmètre, **sans redemander**.

**Règle d'autonomie (priorité)** : avancer **jusqu'au bout** sans redemander. Pour tout choix SANS impact fonctionnel ni réglementaire, prendre l'option par défaut raisonnable, la noter, et continuer.

**S'ARRÊTER et demander confirmation UNIQUEMENT si :**
- choix à **impact fonctionnel** visible (comportement/UX produit ambigu, options divergentes) ;
- choix à **impact réglementaire** (RGPD, REG-05, données de santé) ;
- action **🔒** (secrets, purge historique git, bascule BDD prod, permissions, **cutover prod** déconnectant des users) ;
- la tâche concerne le **frontend v0design** (autre repo → session séparée) ;
- blocage après 2 essais (laisser la case décochée, noter le blocage sous la tâche, passer à la suivante).

**Périmètre interdit sans validation humaine** : ne jamais pousser en prod une tâche 🔒.
**Rappel** : ne jamais committer de secret (`.env`, tokens, `*.db`) ni modifier `package.json`/`package-lock.json` frontend.
