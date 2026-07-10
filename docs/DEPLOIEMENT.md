# 🌿 NutriDZ — Guide de déploiement complet

> ⚠️ **MAJ ultrareview (07/2026)** : depuis la migration S7, la base est **PostgreSQL (Neon)**,
> plus SQLite. `DATABASE_URL` (chaîne pooled Neon) est **obligatoire** au démarrage du backend.
> Les mentions « SQLite » / sauvegarde de fichier `.db` ci-dessous sont **obsolètes** — la
> persistance et les sauvegardes sont gérées côté Neon. Déploiement réel : Render (voir `render.yaml`).

## Architecture de l'application

```
nutridz/
├── backend/          → API Node.js + Express + PostgreSQL (Neon)
│   ├── server.js     → Point d'entrée
│   ├── db.js         → Base de données + seed produits
│   ├── routes/
│   │   ├── auth.js   → Inscription / connexion (JWT)
│   │   ├── products.js → Catalogue produits algériens
│   │   ├── journal.js  → Journal alimentaire
│   │   └── profile.js  → Profil + calculs nutritionnels
│   └── middleware/
│       └── auth.js   → Vérification JWT
│
├── frontend/         → React + Zustand + Recharts
│   └── src/
│       ├── pages/    → Journal, Produits, Historique, Profil
│       ├── store/    → État global (auth, profil, journal)
│       └── utils/    → API axios + formules nutritionnelles
│
└── docker-compose.yml → Déploiement en un seul commande
```

---

## Option 1 : Déploiement local (développement)

### Prérequis
- Node.js 18+ (`node --version`)
- npm 9+

### 1. Lancer le backend

```bash
cd backend
cp .env.example .env
# Éditez .env et changez JWT_SECRET !
npm install
npm start
# API disponible sur http://localhost:3001
```

### 2. Lancer le frontend

```bash
cd frontend
npm install
npm start
# App disponible sur http://localhost:3000
```

---

## Option 2 : Déploiement production avec Docker (recommandé)

### Prérequis
- Un VPS Ubuntu (2 Go RAM minimum)
- Docker + Docker Compose installés
- Un nom de domaine (ex: nutridz.dz)

### Installation Docker sur Ubuntu

```bash
# Sur votre VPS
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Reconnectez-vous
```

### Déploiement

```bash
# 1. Copier le projet sur le VPS
scp -r nutridz/ user@votre-vps:/opt/nutridz

# 2. Sur le VPS
cd /opt/nutridz
cp .env.example .env

# 3. Générer un JWT_SECRET sécurisé
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "FRONTEND_URL=https://nutridz.dz" >> .env

# 4. Lancer l'application
docker compose up -d --build

# 5. Vérifier que tout tourne
docker compose ps
docker compose logs -f backend
```

### Accès
- Frontend : http://votre-ip (ou https://nutridz.dz si DNS configuré)
- API : http://votre-ip/api/health

---

## Option 3 : Déploiement Render.com (gratuit pour commencer)

Render est idéal pour une startup — plan gratuit suffisant pour tester.

### Backend sur Render

1. Aller sur https://render.com → New → Web Service
2. Connecter votre repo GitHub
3. Paramètres :
   - **Root Directory** : `backend`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment Variables** :
     - `JWT_SECRET` = (générer une valeur aléatoire longue)
     - `NODE_ENV` = `production`

### Frontend sur Render (Static Site)

1. New → Static Site
2. **Root Directory** : `frontend`
3. **Build Command** : `npm install && npm run build`
4. **Publish Directory** : `build`
5. **Environment Variables** :
   - `REACT_APP_API_URL` = `https://votre-backend.onrender.com/api`

---

## Option 4 : Déploiement Railway.app

Railway déploie en 2 minutes depuis GitHub.

```bash
# Installer Railway CLI
npm install -g @railway/cli
railway login

# Dans le dossier backend
cd backend
railway init
railway up

# Dans le dossier frontend
cd ../frontend
railway init
railway up
```

Ajouter les variables d'environnement dans le dashboard Railway.

---

## Option 5 : Application mobile (React Native)

Pour publier sur l'App Store / Google Play :

### Installation Expo (le plus simple)

```bash
npm install -g @expo/cli

# Créer l'app mobile
npx create-expo-app nutridz-mobile
cd nutridz-mobile

# Installer les dépendances
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install zustand axios react-native-gesture-handler
npm install expo-camera expo-barcode-scanner  # Pour scanner les codes-barres
```

### Structure mobile
Le code frontend React peut être réutilisé à ~70% en React Native,
en remplaçant les éléments HTML par leurs équivalents RN :
- `<div>` → `<View>`
- `<p>`, `<span>` → `<Text>`
- `<input>` → `<TextInput>`
- Navigation → React Navigation

### Publication

```bash
# Android (APK)
expo build:android

# iOS (nécessite un compte Apple Developer à 99$/an)
expo build:ios
```

---

## Endpoints API disponibles

### Authentification
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/auth/register | Créer un compte |
| POST | /api/auth/login | Se connecter |

### Produits
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/products?q=&category= | Rechercher des produits |
| GET | /api/products/:id | Détail d'un produit |
| GET | /api/products/categories | Liste des catégories |
| POST | /api/products | Ajouter un produit (auth) |

### Journal
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/journal?date= | Journal du jour |
| POST | /api/journal | Ajouter une entrée |
| DELETE | /api/journal/:id | Supprimer une entrée |
| GET | /api/journal/history?days=7 | Historique 7 jours |

### Profil
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/profile | Profil + métriques calculées |
| PUT | /api/profile | Mettre à jour le profil |
| POST | /api/profile/weight | Enregistrer le poids du jour |
| GET | /api/profile/weight/history | Historique poids |

---

## Étapes suivantes recommandées

### Court terme
- [ ] Enrichir la base de produits (OpenFoodFacts API pour les produits DZ)
- [ ] Ajouter un scanner de code-barres (expo-camera)
- [ ] Notifications de rappel de repas

### Moyen terme
- [ ] Remplacer SQLite par PostgreSQL pour la production à grande échelle
- [ ] Ajouter Redis pour le cache des produits fréquents
- [ ] Intégration OpenFoodFacts : `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- [ ] Système de contributions communautaires (signaler/corriger un produit)

### Long terme
- [ ] Reconnaissance d'image (IA pour identifier les plats algériens)
- [ ] Recommandations personnalisées basées sur les habitudes
- [ ] Mode hors ligne (PWA + sync)
- [ ] Tableau de bord nutritionniste/médecin

---

## Sécurité en production

```bash
# Toujours HTTPS en production — certificat SSL gratuit avec Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d nutridz.dz

# Sauvegarder la base SQLite tous les jours
echo "0 2 * * * tar -czf /backups/nutridz-$(date +%Y%m%d).db.gz /opt/nutridz/data/nutridz.db" | crontab -
```
