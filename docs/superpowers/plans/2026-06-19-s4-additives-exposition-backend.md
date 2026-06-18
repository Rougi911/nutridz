# S4 — Barres d'exposition aux additifs (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter `GET /api/stats/additives?days=N` qui agrège l'exposition de l'utilisateur aux additifs alimentaires sur une fenêtre glissante, sans aucune donnée de dose.

**Architecture:** Nouveau fichier `backend/routes/stats-additives.js` (pattern identique à `deficiencies.js`) monté sur `/api/stats` dans `server.js`. La classification EFSA vient de `data/additives.js` (déjà présent). La logique d'agrégation est extraite dans `calcAdditivesStats()` pour faciliter les TU.

**Tech Stack:** Node.js / Express, SQLite async (sqlite3), Jest + Supertest, `data/additives.js` (ADDITIVES_CLASSIFICATION).

---

## Scope note

Ce plan couvre SESSION 1 (backend, repo nutridz) uniquement.
SESSION 2 (frontend nutrivita-v0, `components/nutrivita/stats-screen.tsx`) est un plan séparé à créer dans le repo nutrivita-v0 une fois le backend déployé et vérifié en prod.

---

## File structure

| Opération | Fichier | Responsabilité |
|---|---|---|
| Créer | `backend/routes/stats-additives.js` | Route `GET /additives`, pure fn `calcAdditivesStats`, disclaimer REG-05 |
| Créer | `backend/tests/s4-additives.test.js` | TU sur `calcAdditivesStats` + HTTP supertest |
| Modifier | `backend/server.js` ligne ~92 | Monter le nouveau routeur sur `/api/stats` |

---

## Task 1 — Write the failing tests

**Files:**
- Create: `backend/tests/s4-additives.test.js`

- [ ] **Step 1.1 — Créer le fichier de tests**

Créer `backend/tests/s4-additives.test.js` avec le contenu suivant :

```js
'use strict';
/**
 * S4 — Tests exposition additifs (GET /api/stats/additives)
 *
 * TU-S4-1 : 2 entrées (Coca → E150D + E338 ; aliment sans additif)
 *           → counts.high=1, moderate=1, low=0, entries_with_additives=1, total_entries=2
 * TU-S4-2 : 0 entrées → total_entries=0, counts={high:0,moderate:0,low:0}, items=[]
 * TU-S4-3 : toutes les entrées sans additifs → entries_with_additives=0
 * TU-S4-4 : code inconnu dans additifs → ignoré, ne fausse pas les counts
 * TU-S4-5 : items triés high→moderate→low, puis count décroissant dans chaque niveau
 * TU-S4-6 : HTTP GET /api/stats/additives?days=abc → réponse contient days=7 (défaut)
 */

// ─── Mocks module-level (requis avant require du module) ────────────────────
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'test-user';
  next();
});

jest.mock('../data/additives', () => ({
  ADDITIVES_CLASSIFICATION: {
    E150d: { name: 'Caramel sulfite-ammoniacal', risk: 'high',     concern: 'test' },
    E338:  { name: 'Acide phosphorique',          risk: 'moderate', concern: 'test' },
    E330:  { name: 'Acide citrique',              risk: 'low',      concern: 'test' },
    E250:  { name: 'Nitrite de sodium',           risk: 'high',     concern: 'test' },
  },
}));

// DB mock — données configurables par test via mockEntriesRef
let mockEntriesRef = [];
jest.mock('../db', () => ({
  getDB: () => ({
    prepare: () => ({
      all: jest.fn().mockImplementation(() => Promise.resolve(mockEntriesRef)),
    }),
  }),
}));

const { calcAdditivesStats } = require('../routes/stats-additives');

// ─── TU-S4-1 ─────────────────────────────────────────────────────────────────
describe('TU-S4-1 — scénario spec (Coca + sans additif)', () => {
  test('counts.high=1, moderate=1, low=0', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E150D', 'E338']) },
      { id: 'e2', additifs: '[]' },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.counts.high).toBe(1);
    expect(r.counts.moderate).toBe(1);
    expect(r.counts.low).toBe(0);
    expect(r.entries_with_additives).toBe(1);
    expect(r.total_entries).toBe(2);
  });
});

// ─── TU-S4-2 ─────────────────────────────────────────────────────────────────
describe('TU-S4-2 — 0 entrées', () => {
  test('total_entries=0, items=[], counts tous à 0', () => {
    const r = calcAdditivesStats([]);
    expect(r.total_entries).toBe(0);
    expect(r.entries_with_additives).toBe(0);
    expect(r.items).toEqual([]);
    expect(r.counts).toEqual({ high: 0, moderate: 0, low: 0 });
  });
});

// ─── TU-S4-3 ─────────────────────────────────────────────────────────────────
describe('TU-S4-3 — entrées sans additifs', () => {
  test('entries_with_additives=0 même si total_entries > 0', () => {
    const entries = [
      { id: 'e1', additifs: '[]' },
      { id: 'e2', additifs: null },
      { id: 'e3', additifs: 'not-json' },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.total_entries).toBe(3);
    expect(r.entries_with_additives).toBe(0);
    expect(r.counts).toEqual({ high: 0, moderate: 0, low: 0 });
  });
});

// ─── TU-S4-4 ─────────────────────────────────────────────────────────────────
describe('TU-S4-4 — code inconnu ignoré', () => {
  test('E999 inconnu → counts toujours 0', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E999', 'XINVALID']) },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.counts).toEqual({ high: 0, moderate: 0, low: 0 });
    // entries_with_additives = 1 car la liste n'est pas vide (tags présents mais inconnus)
    // Comportement accepté : l'entrée est comptée dans entries_with_additives
    // mais aucun item ne remonte
    expect(r.items).toEqual([]);
  });
});

// ─── TU-S4-5 ─────────────────────────────────────────────────────────────────
describe('TU-S4-5 — tri items : high→moderate→low, puis count décroissant', () => {
  test('E250 (high, ×2) avant E150D (high, ×1) avant E338 (moderate, ×1)', () => {
    // E250 = high × 2 consommations
    // E150D = high × 1 consommation
    // E338 = moderate × 1 consommation
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E250', 'E150D', 'E338']) },
      { id: 'e2', additifs: JSON.stringify(['E250']) },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.counts.high).toBe(3);     // E250 × 2 + E150D × 1
    expect(r.counts.moderate).toBe(1); // E338 × 1
    expect(r.items[0].code).toBe('E250');   // high, count 2 → premier
    expect(r.items[1].code).toBe('E150D'); // high, count 1 → second
    expect(r.items[2].code).toBe('E338');  // moderate → troisième
  });
});

// ─── TU-S4-6 — HTTP endpoint ─────────────────────────────────────────────────
describe('TU-S4-6 — HTTP GET /api/stats/additives?days=invalid → days=7', () => {
  const express = require('express');
  const request = require('supertest');

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/stats', require('../routes/stats-additives'));
    return app;
  }

  test('days invalide → réponse days=7', async () => {
    mockEntriesRef = [];
    const app = buildApp();
    const res = await request(app).get('/api/stats/additives?days=abc');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('disclaimer');
    expect(res.body.disclaimer).toHaveProperty('fr');
    expect(res.body.disclaimer).toHaveProperty('en');
    expect(res.body.disclaimer).toHaveProperty('ar');
  });

  test('days=30 → réponse days=30', async () => {
    mockEntriesRef = [];
    const app = buildApp();
    const res = await request(app).get('/api/stats/additives?days=30');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
  });
});
```

- [ ] **Step 1.2 — Vérifier que les tests échouent (module introuvable attendu)**

```bash
cd backend && npx jest tests/s4-additives.test.js --no-coverage 2>&1 | head -30
```

Résultat attendu : `Cannot find module '../routes/stats-additives'` — confirme que le test est en attente d'implémentation.

---

## Task 2 — Implement the route

**Files:**
- Create: `backend/routes/stats-additives.js`

- [ ] **Step 2.1 — Créer le fichier de route**

Créer `backend/routes/stats-additives.js` :

```js
'use strict';
// SL-API-05 : GET /api/stats/additives — AL-S4 exposition additifs par période
const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { ADDITIVES_CLASSIFICATION } = require('../data/additives');

const router = express.Router();

// REG-05 — disclaimer tri-lingue, vocabulaire non clinique, pas de dose
const DISCLAIMER = {
  fr: 'Comptage d\'expositions (portions contenant l\'additif) basé sur votre journal alimentaire. Aucune dose (mg) n\'est calculée. La fiabilité dépend de la rigueur de saisie. Ces informations ne constituent pas un avis médical.',
  ar: 'عد التعرضات (الحصص التي تحتوي على المضاف الغذائي) بناءً على سجل تغذيتك. لا تُحسب أي جرعة (ملغ). الموثوقية تعتمد على دقة الإدخال. لا تُشكّل هذه المعلومات نصيحة طبية.',
  en: 'Exposure count (servings containing the additive) based on your food journal. No dose (mg) is calculated. Reliability depends on logging accuracy. This does not constitute medical advice.',
};

const VALID_DAYS = new Set([1, 7, 30, 365]);

// Normalise un tag additif (format OFF "en:e150d", display "E150D", ou clé "E150d")
// vers la clé de ADDITIVES_CLASSIFICATION (ex. "E150d", "E338").
function normalizeCode(tag) {
  const m = String(tag).match(/[eE](\d{3,4}[a-zA-Z]?)$/);
  return m ? `E${m[1].toLowerCase()}` : null;
}

// Pure function — testable sans DB
function calcAdditivesStats(entries) {
  const counts = { high: 0, moderate: 0, low: 0 };
  const itemMap = {};
  let entriesWithAdditives = 0;

  for (const entry of entries) {
    let tags = [];
    try { tags = JSON.parse(entry.additifs || '[]'); } catch (_) {}
    if (!Array.isArray(tags) || tags.length === 0) continue;

    entriesWithAdditives++;

    for (const tag of tags) {
      const code = normalizeCode(tag);
      if (!code) continue;
      const classif = ADDITIVES_CLASSIFICATION[code];
      if (!classif) continue; // code inconnu → ignoré

      counts[classif.risk]++;

      if (!itemMap[code]) {
        itemMap[code] = {
          code: code.toUpperCase(), // "E150d" → "E150D" pour affichage
          name: classif.name,
          risk: classif.risk,
          count: 0,
        };
      }
      itemMap[code].count++;
    }
  }

  const riskOrder = { high: 0, moderate: 1, low: 2 };
  const items = Object.values(itemMap).sort((a, b) => {
    const rd = riskOrder[a.risk] - riskOrder[b.risk];
    return rd !== 0 ? rd : b.count - a.count;
  });

  return {
    entries_with_additives: entriesWithAdditives,
    total_entries: entries.length,
    counts,
    items,
  };
}

// GET /api/stats/additives?days=N (N ∈ {1, 7, 30, 365}, défaut 7)
router.get('/additives', auth, async (req, res) => {
  const rawDays = parseInt(req.query.days, 10);
  const days = VALID_DAYS.has(rawDays) ? rawDays : 7;

  // Fenêtre [aujourd'hui-(days-1) ; aujourd'hui] → days jours inclusifs
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10); // YYYY-MM-DD

  const db = getDB();
  const entries = await db.prepare(`
    SELECT je.id, p.additifs
    FROM journal_entries je
    JOIN products p ON je.product_id = p.id
    WHERE je.user_id = ? AND je.date >= ?
  `).all(req.userId, sinceStr);

  const stats = calcAdditivesStats(entries);

  res.json({
    days,
    ...stats,
    disclaimer: DISCLAIMER,
  });
});

module.exports = router;
module.exports.calcAdditivesStats = calcAdditivesStats;
```

- [ ] **Step 2.2 — Vérifier que les tests passent**

```bash
cd backend && npx jest tests/s4-additives.test.js --no-coverage 2>&1
```

Résultat attendu : tous les TU-S4-1 à TU-S4-6 PASS. 0 failed.

---

## Task 3 — Mount the route in server.js

**Files:**
- Modify: `backend/server.js` ligne ~92

- [ ] **Step 3.1 — Ajouter le montage dans server.js**

Localiser la ligne :
```js
app.use('/api/stats',   require('./routes/deficiencies'));
```

La remplacer par :
```js
app.use('/api/stats',   require('./routes/deficiencies'));
app.use('/api/stats',   require('./routes/stats-additives'));
```

Express accepte plusieurs routeurs sur le même préfixe ; chaque routeur gère ses propres chemins (`/deficiencies` vs `/additives`).

- [ ] **Step 3.2 — Lancer le backend localement et vérifier l'endpoint**

```bash
cd backend && cp .env.example .env 2>/dev/null; node server.js &
sleep 2
curl -s -H "Authorization: Bearer INVALID" http://localhost:3001/api/stats/additives?days=7
```

Résultat attendu : `{"error":"Token invalide"}` (401) — prouve que la route est montée et que l'auth middleware est actif.

Arrêter le serveur local après vérification (`kill %1` ou Ctrl+C).

- [ ] **Step 3.3 — Relancer la suite de tests complète (non-régression)**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Résultat attendu : tous les tests existants continuent de passer + les nouveaux TU-S4.

---

## Task 4 — Commit and push

- [ ] **Step 4.1 — Vérifier le statut git**

```bash
git status
git diff backend/server.js
```

Vérifier : uniquement les 3 fichiers attendus apparaissent (stats-additives.js, s4-additives.test.js, server.js modifié).

- [ ] **Step 4.2 — Commit**

```bash
git add backend/routes/stats-additives.js backend/tests/s4-additives.test.js backend/server.js
git commit -m "$(cat <<'EOF'
feat: GET /api/stats/additives — exposition additifs S4 (AL-S4)

Agrège le nombre d'expositions (portions contenant l'additif)
par niveau EFSA (high/moderate/low) sur 1/7/30/365 jours.
Aucune dose calculée. Disclaimer REG-05 tri-lingue inclus.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4.3 — Push**

```bash
git push origin main
```

Render redéploie automatiquement (`nutridz` backend Web Service). Vérifier dans Render → Logs que le déploiement réussit (~3 min).

- [ ] **Step 4.4 — Smoke test en production**

```bash
# Remplacer TOKEN par un JWT valide obtenu via POST /api/auth/login
curl -s -H "Authorization: Bearer TOKEN" \
  "https://nutridz.onrender.com/api/stats/additives?days=7" | python -m json.tool
```

Réponse attendue (structure) :
```json
{
  "days": 7,
  "entries_with_additives": <entier>,
  "total_entries": <entier>,
  "counts": { "high": <n>, "moderate": <n>, "low": <n> },
  "items": [ ... ],
  "disclaimer": { "fr": "...", "ar": "...", "en": "..." }
}
```

---

## Self-review checklist

### Spec coverage

| Exigence spec | Tâche couvrant |
|---|---|
| Endpoint `GET /api/stats/additives?days=N` | Task 2 (router.get) |
| N ∈ {1,7,30,365}, défaut 7 | Task 2 (`VALID_DAYS`, TU-S4-6) |
| Fenêtre `[aujourd'hui-(N-1) ; aujourd'hui]` | Task 2 (date calc) |
| Logique : additifs depuis journal JOIN products | Task 2 (SQL + `calcAdditivesStats`) |
| Normalisation codes (multi-format) | Task 2 (`normalizeCode`, TU-S4-4) |
| Classification via `ADDITIVES_CLASSIFICATION` | Task 2 (import + lookup) |
| Comptage une exposition par (entrée × additif) | Task 2 (`itemMap[code].count++`) |
| Réponse JSON : days, entries_with_additives, total_entries, counts, items | Task 2 (res.json) |
| items trié risk (high→low) puis count décroissant | Task 2 (sort + TU-S4-5) |
| Aucune dose (mg) | Task 2 (disclaimer uniquement, pas de mg dans la réponse) |
| Aucune donnée d'autres utilisateurs | Task 2 (`WHERE je.user_id = ?`) |
| Disclaimer REG-05 tri-lingue | Task 2 (DISCLAIMER fr/ar/en) |
| Test spec (Coca → E150D+E338 ; sans additif → high=1,moderate=1,low=0) | TU-S4-1 |
| Montage `/api/stats` | Task 3 |

### Placeholder scan

Aucun TBD, TODO, ou "implement later" dans le plan.

### Type consistency

- `calcAdditivesStats(entries)` défini Task 2, importé dans Task 1 tests — cohérent.
- `module.exports.calcAdditivesStats` correspond à `const { calcAdditivesStats } = require(...)` dans tests — cohérent.
- Champ `code` dans items = toUpperCase() de la clé (ex. "E150D") — cohérent entre Task 1 TU-S4-5 et Task 2 implementation.
