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
- **Base de données** : SQLite 5.1.7 (sqlite3, async — pas better-sqlite3)
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
JWT_SECRET=MonAppNutriDZAlgerie2024SecretKey!
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
```

## Structure du projet

```
nutridz/
├── backend/
│   ├── server.js                     # Point d'entrée Express, trust proxy activé
│   ├── db.js                         # SQLite async (Statement class, .run/.get/.all retournent Promise)
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
│   │   └── nutrition.js              # Recherche cascade NUTRITION_DB → CIQUAL → USDA
│   ├── services/
│   │   ├── openfoodfacts.js          # Lookup code-barres mondial
│   │   ├── ocr.js                    # Tesseract.js OCR étiquettes (FR/AR/EN)
│   │   ├── foodvision.js             # Clarifai food-item-recognition + NUTRITION_DB locale
│   │   ├── strava.js                 # OAuth2 + récupération activités
│   │   ├── ciqual.js                 # Base ANSES France (200 aliments, recherche fuzzy)
│   │   └── usda.js                   # USDA FoodData (350k aliments mondiaux)
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
    │   ├── _redirects                # /* /index.html 200 (SPA fallback Render)
    │   └── icons/                    # icon-72.png à icon-512.png
    ├── src/
    │   ├── App.jsx                   # Routes : /journal /products /dishes /vision /history /bilan /profile + RGPD pages
    │   ├── index.js                  # Enregistrement Service Worker
    │   ├── i18n.js                   # Traductions FR/AR/EN + support RTL pour arabe
    │   ├── store/index.js            # Zustand : authStore, profileStore, journalStore, productsStore
    │   ├── utils/api.js              # axios instance + formules calcBMR/calcTDEE/calcTarget/calcWalkTime
    │   ├── components/
    │   │   ├── Layout.jsx            # Bottom nav 5 onglets : Journal/Produits/Plats/Bilan/Profil + footer RGPD
    │   │   ├── LanguageSelector.jsx  # AR/FR/EN
    │   │   ├── CookieBanner.jsx      # Bannière CNIL conforme
    │   │   ├── ActivityForm.jsx      # Ajout activité manuelle
    │   │   └── BarcodeScanner.jsx    # Quagga2 scanner (eslint-disable react-hooks/exhaustive-deps en haut)
    │   └── pages/
    │       ├── JournalPage.jsx       # Tableau de bord quotidien + bouton "+ Ajouter un plat"
    │       ├── ProductsPage.jsx      # Catalogue produits
    │       ├── ProductDetailPage.jsx # Fiche produit + add to journal
    │       ├── DishesPage.jsx        # Base de 60 plats + création custom avec autocomplete CIQUAL/USDA
    │       ├── DishDetailPage.jsx    # Fiche plat avec slider portion
    │       ├── FoodVisionPage.jsx    # Analyse photo plat (Clarifai) + 6 cuisines reconnues
    │       ├── HistoryPage.jsx       # Graphiques 7 jours
    │       ├── BilanPage.jsx         # 3 vues : Jour/Semaine/Mois (calendrier billet d'avion)
    │       ├── ProfilePage.jsx       # Profil + 4 onglets + section RGPD export/suppression
    │       ├── LoginPage.jsx
    │       ├── RegisterPage.jsx      # 2 cases RGPD obligatoires
    │       ├── PrivacyPage.jsx       # Politique confidentialité
    │       └── LegalPage.jsx         # Mentions légales
```

## Conventions critiques

### Backend SQLite async
La DB utilise sqlite3 (PAS better-sqlite3). Toutes les requêtes sont async :
```javascript
const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
const rows = await db.prepare('SELECT * FROM products').all();
const result = await db.prepare('INSERT INTO users (...) VALUES (?)').run(value);
```

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
| Journal alimentaire | ✅ | 4 repas par jour + macros |
| Scanner code-barres | ✅ | Quagga2 + OpenFoodFacts + base locale |
| OCR étiquettes | ✅ | Tesseract.js FR/AR/EN |
| Analyse photo plat | ✅ | Clarifai food-item-recognition (1000 appels/mois gratuit) |
| 6 cuisines reconnues | ✅ | France/Italie/Maghreb/Asie/USA/Moyen-Orient |
| Base de 60 plats | ✅ | 11 cuisines + création custom |
| Bilan calories | ✅ | 3 vues : Jour/Semaine/Mois (calendrier billet d'avion) |
| Intégration Strava | ✅ | OAuth + sync activités |
| Bases nutritionnelles | ✅ | NUTRITION_DB → CIQUAL → USDA (cascade) |
| Multilingue | ✅ | FR/AR/EN avec RTL pour arabe |
| Conformité RGPD | ✅ | Bannière cookies + export/suppression données |
| PWA installable | ✅ | iOS/Android, icônes, service worker, splash |
| Google Analytics | ⏳ | Code prêt, attend REACT_APP_GA_ID |
| Notifications push | ❌ | Pas encore implémenté |
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

- Migrer Clarifai → Gemini API (gratuit avec quotas plus généreux, meilleure reconnaissance)
- Notifications push de rappel de repas
- Mode hors ligne complet avec sync
- Dashboard admin (/admin) avec stats utilisateurs
- Intégration Apple Health / Google Fit (en plus de Strava)
- Recettes communautaires (utilisateurs partagent leurs plats)
- Domaine personnalisé `nutrivita.fr` (~10€/an sur OVH)
- Publication sur Google Play (25$ unique)

## Notes importantes

- **Plan gratuit Render** : backend s'endort après 15min, 30-60s pour réveiller à la première requête
- **Clarifai** : 1000 analyses/mois gratuit, modèle `food-item-recognition` ou fallback `general-image-recognition`
- **USDA** : 1000 req/heure avec clé gratuite, sinon DEMO_KEY limité à ~30/jour
- **Strava** : OAuth2 redirige vers `/api/activity/strava/callback`, le state param contient userId
- **PowerShell Windows** : `Ctrl+V` ne marche pas dans Claude Code, utiliser clic droit pour coller
- **Limite quota Claude Code** : se réinitialise à 4h du matin Paris pour le plan Pro

## Pour économiser les crédits Claude Code

1. **Décrire précisément** ce qu'on veut sans ambiguïté
2. **Référencer ce fichier CLAUDE.md** au début de chaque session
3. **Limiter le scope** : "modifie juste backend/routes/auth.js" plutôt que "améliore l'auth"
4. **Une tâche à la fois** plutôt que des listes longues
5. **Utiliser des fichiers .txt** sur le Bureau pour les longs prompts au lieu de coller dans le terminal
6. **Demander à Claude Code de NE PAS relire les fichiers** s'il les a déjà vus dans la session
