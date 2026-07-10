# Rapport de tests — mise en conformité ultrareview NutriVita

**Date** : 10 juillet 2026
**Branche** : `fix/ultrareview` (5 commits, base `origin/main` @ `c07caf6`)
**Environnement de validation** : PostgreSQL 16 local, Node 22, Jest 30 (backend) / react-scripts 5 (frontend).

## Résultat global

| Suite | Avant (baseline) | Après | État |
|---|---|---|---|
| Backend (Jest + Postgres) | 34 suites / 455 tests | **35 suites / 465 tests** | ✅ 100 % vert |
| Frontend (React Testing Library) | 11 suites / 42 tests* | **11 suites / 42 tests** | ✅ 100 % vert |
| Build frontend (`react-scripts build`) | — | **Compiled** (warnings eslint préexistants) | ✅ |
| Démarrage backend (`node server.js`) | — | **Routes câblées, DB init OK** | ✅ |

\* Le frontend n'avait aucune dépendance de test déclarée : les 42 tests **ne pouvaient pas
s'exécuter** avant ce chantier (voir M13). Ils tournent désormais en local et en CI.

10 tests de non-régression ont été ajoutés (`backend/tests/ultrareview.test.js`) pour prouver
les corrections majeures : E2, E4, M2, M4, M7 + validation code-barres.

## Traçabilité finding → correction → test → commit

| Réf | Sévérité | Correction | Vérification | Commit |
|---|---|---|---|---|
| C1 | 🔴 | JWT_SECRET retiré de CLAUDE.md + `.gitignore` complet | revue + procédure rotation (SECRET-ROTATION.md) | `02eab1d` |
| C2 | 🔴 | Routes `/products` `/scanner` `/vision` + catch-all ; redirect Strava `/bilan`→`/stats` | build + suites frontend | `02eab1d` |
| C3 | 🔴 | Service worker network-first + cache versionné v2 + `importScripts(sw-push)` | build frontend | `02eab1d` |
| E1 | 🟠 | `express-async-errors` (rejets async → handler d'erreurs) | 465 tests backend | `5067240` |
| E2 | 🟠 | State OAuth Strava signé (JWT) sur les deux flux | test `E2 signState/verifyState` | `5067240` |
| E3 | 🟠 | Webhook : `strava_id` + index unique + `ON CONFLICT` | 455 tests (dont s16-strava) | `5067240` |
| E4 | 🟠 | healthScore lit `pct_reference` | test `E4 micro > 0` | `5067240` |
| E5 | 🟠 | JWT 30 j → 7 j (token + cookie) | tests auth | `5067240` |
| E6 | 🟠 | logout purge stores + localStorage | suites frontend | `5067240` |
| E7 | 🟠 | Poids : conversion kg↔unité à l'affichage | suites frontend | `5067240` |
| E8 | 🟠 | Dupliquer J-1 : itère `res.data.entries` | suites frontend | `5067240` |
| E9 | 🟠 | render.yaml : DATABASE_URL, retrait disque sqlite, clés réelles | revue | `5067240` |
| M1 | 🟡 | `localDateStr()` (fuseau local, plus UTC) | suites frontend | `4a8171d` |
| M2 | 🟡 | Validation `grams` sur POST /journal | test `M2` (3 cas) | `4a8171d` |
| M3 | 🟡 | Projection poids 3500→7700 kcal/kg | revue + 455 tests | `4a8171d` |
| M4 | 🟡 | RGPD : purge + export `scanned_products` | test `M4 purge` | `4a8171d` |
| M6 | 🟡 | /weight/evolution ignore les jours non journalisés | revue + 455 tests | `4a8171d` |
| M7 | 🟡 | `/dishes/:id/log` garde de visibilité | test `M7` (2 cas IDOR) | `4a8171d` |
| M8 | 🟡 | Rate-limit dédié endpoints IA | revue | `4a8171d` |
| M12 | 🟡 | Keep-alive échoue si 0 ping OK | revue | `4a8171d` |
| M13 | 🟡 | CI : job frontend + libs `@testing-library` déclarées | CI exécute 42 tests | `4a8171d` |
| M14 | 🟡 | `globalTeardown` Jest purge les schémas `test_wN` | reruns propres | `4a8171d` |
| M15 | 🟡 | multer 1.x → 2.x (CVE DoS) | 455 tests (uploads) | `4a8171d` |
| M16 | 🟡 | Glucose : couleurs comparées en mg/dL | revue code | `4a8171d` |
| L× | 🟢 | password min 8, HS256, validation barcode, cap CSV, fenêtre N jours, NaN LIMIT, nav.stats, manifest, mobile URLs, docs | tests + revue | `5ff90db` |

## Points reportés (décision humaine / migration)

- **M5 — timestamps LibreView vs UTC** : corriger la sémantique de stockage re-daterait des
  lectures de glycémie **existantes** (donnée de santé). Nécessite une migration de données
  dédiée et une validation. **Non modifié** volontairement, documenté dans le rapport d'audit.
- **M17 — i18n en dur (BilanPage, etc.)** : l'app reste **fonctionnelle** (français). Refactor
  de traduction volumineux, sans impact fonctionnel — laissé en limitation connue pour éviter
  de déstabiliser les tests de non-régression du restylage.
- **🔒 Rotation du secret + purge historique git** : action propriétaire (déconnecte les
  sessions). Procédure prête dans `backend/SECRET-ROTATION.md`. **À faire après merge.**

## Comment reproduire

```bash
# Backend (nécessite un Postgres ; DATABASE_URL requis depuis S7)
cd backend && npm ci && DATABASE_URL=postgresql://user:pwd@localhost:5432/nutridz_test npm test

# Frontend
cd frontend && npm ci && npm run test:ci

# Build de production
cd frontend && npm run build
```
