# NutriVita — Spec de restyling frontend

**Date :** 2026-06-10
**Périmètre :** `frontend/` uniquement — `backend/` et `mobile/` intacts.
**Source de vérité design :** `DesignApp/NutriVita/v0design/` (Next.js + Tailwind + shadcn, lecture seule).
**Stack cible :** Create React App + CSS custom properties + ThemeContext (pas de migration Tailwind, pas de framer-motion).

---

## Objectif

Adopter le design NutriVita du v0design dans le frontend React existant, sans régression fonctionnelle et avec une couverture de tests user-event par écran.

---

## Exigences de design (DES-xx)

### DES-01 — Tokens CSS

Les tokens de `src/index.css` doivent correspondre au thème NutriVita de `v0design/app/globals.css`.

**Light mode :** tokens déjà alignés — aucune modification.

**Dark mode :** deux divergences à corriger dans `[data-theme="dark"]` :

| Token | Valeur actuelle | Valeur cible |
|---|---|---|
| `--bg-secondary` | `#13131f` | `#1a1b2e` |
| `--bg-tertiary` | `#2a2a3d` | `#252642` |

Tous les autres tokens restent inchangés.

### DES-02 — Classes utilitaires CSS

Ajouter dans `src/index.css` (sans supprimer l'existant) :

**`.card`**
```css
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 16px;
  box-shadow: 0 2px 8px var(--shadow);
}
```

**`.gradient-header`** — bande colorée en haut de chaque écran principal
```css
.gradient-header {
  padding-block: 20px 24px;
  padding-inline: 16px;
  border-end-start-radius: 24px;
  border-end-end-radius: 24px;
  color: #fff;
}
.gradient-header h1 { font-size: 1.25rem; font-weight: 700; }
.gradient-header p  { font-size: 0.875rem; opacity: 0.8; }
```

**`.pill`** — filtres, badges, onglets internes
```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-block: 6px;
  padding-inline: 14px;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
}
.pill.active { background: var(--accent-blue); color: #fff; }
```

**`.macro-pill`** — carte macro (icône + valeur + barre de progression)
```css
.macro-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 12px;
}
.macro-pill__bar {
  height: 6px;
  width: 100%;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  overflow: hidden;
}
.macro-pill__fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--accent-blue);
  transition: width 0.5s ease;
}
.macro-pill__fill--complete { background: var(--accent-green); }
```

**`.metric-card`** — carte métrique avec statut (dark-safe via `color-mix`)
```css
.metric-card {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.metric-card--good {
  background: color-mix(in srgb, var(--accent-green) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-green) 25%, transparent);
}
.metric-card--warning {
  background: color-mix(in srgb, var(--accent-yellow) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-yellow) 25%, transparent);
}
.metric-card--danger {
  background: color-mix(in srgb, var(--accent-red) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-red) 25%, transparent);
}
```

### DES-03 — Composants React réutilisables

Trois nouveaux composants dans `src/components/`. Toutes les valeurs directionnelles utilisent des propriétés CSS logiques (`padding-inline`, `margin-inline-start`, `inset-inline-start`) pour préserver le RTL arabe.

**`GradientHeader.jsx`**
- Props : `title` (string), `subtitle` (string, optionnel), `icon` (string emoji, optionnel), `variant` (`"indigo"` | `"emerald"` | `"glucose"` | `"slate"`, défaut `"indigo"`), `children` (slot droite)
- Mapping variant → classe CSS (les noms de classes existants dans `index.css` ne suivent pas les noms de variants) :

| variant | classe CSS |
|---|---|
| `"indigo"` | `gradient-hero` |
| `"emerald"` | `gradient-health` |
| `"glucose"` | `gradient-glucose` |
| `"slate"` | `gradient-slate` |

- Rendu : `<div className={`gradient-header ${VARIANT_MAP[variant]}`}>` avec `h1` + `p` + slot `children`
- Classes CSS : `.gradient-header` + les classes ci-dessus (déjà dans `index.css`)

**`MacroPillCard.jsx`**
- Props : `icon` (emoji), `value` (number), `target` (number), `label` (string), `unit` (string, défaut `"g"`)
- Rendu : `.macro-pill` avec emoji, valeur/unité, label, `.macro-pill__bar > .macro-pill__fill` (width = min(value/target*100, 100)%)
- La barre passe en `--complete` quand `value >= target`

**`MetricCard.jsx`**
- Props : `label` (string), `value` (string|number), `unit` (string, optionnel), `status` (`"good"` | `"warning"` | `"danger"` | `"neutral"`, défaut `"neutral"`), `statusText` (string, optionnel)
- Rendu : `.metric-card .metric-card--{status}` avec label, valeur+unité, badge statut

### DES-04 — Navigation (consolidation 9→5 onglets)

**`Layout.jsx`** : tableau `NAV` réduit à 5 entrées :

| Onglet | Route | Icône Tabler |
|---|---|---|
| Journal | `/journal` | `ti-notebook` |
| Plats | `/dishes` | `ti-soup` |
| Stats | `/stats` | `ti-chart-bar` |
| Glycémie | `/glucose` | `ti-droplet` |
| Paramètres | `/profile` | `ti-user` |

Retrait de la language bar du header Layout — déplacée dans ProfilePage.

**Routes conservées hors nav principale** (accessibles via liens internes) :
- `/login`, `/register`, `/` (landing)
- `/dishes/:id`, `/products/:id`
- `/confidentialite`, `/mentions-legales`

**Routes supprimées de `App.jsx` :**
- `/products` (list) → supprimée ; le contenu est intégré dans DishesPage
- `/scanner`, `/vision` → supprimées ; accès via modal overlay depuis JournalPage et DishesPage
- `/bilan`, `/history` → remplacées par `/stats` (StatsPage fusionne les deux)

`App.jsx` doit ajouter la route `/stats` et retirer `/products`, `/scanner`, `/vision`, `/bilan`, `/history`.

### DES-05 — Restyling par écran

#### JournalPage (`/journal`) — variant `indigo`
- `GradientHeader` variant `indigo` avec date du jour en subtitle
- 3 boutons quick-add dans le header (droite via slot `children`) : Scanner `ti-barcode`, Vision `ti-camera`, Voice `ti-microphone`
- Les boutons quick-add ouvrent les composants existants (`BarcodeScanner`, `FoodVisionPage`, `VoiceInput`) en **modal overlay** (état booléen local dans JournalPage) — la logique métier est inchangée
- Ring SVG calories : CSS pur (SVG `stroke-dasharray` + `stroke-dashoffset` animé via `.progress-ring-circle`)
- 4 sections repas : `.card` avec icône Tabler + titre + liste entrées
- Saisie poids : `.card` input

#### DishesPage (`/dishes`) — sans gradient header
- Absorbe `ProductsPage` : onglet "Produits" ajouté aux filtres cuisine existants (`.pill`)
- Barre de recherche en `.card` (input avec icône `ti-search`)
- Filtres cuisine : `.pill` / `.pill.active`
- Grille 2 colonnes : `.card` par plat (emoji + nom + calories + macros)
- Quick-actions (Scanner CB, Photo) : boutons `.pill.active` en haut de page
- `ProductDetailPage` et `DishDetailPage` : accessibles via clic sur carte, routes conservées

#### DishDetailPage (`/dishes/:id`) — variant `emerald`
- `GradientHeader` variant `emerald`
- Slider portion : `<input type="range">` avec `accent-color: var(--accent-blue)`
- Macros : 4 `MacroPillCard` en grille 2×2

#### StatsPage (`/stats`, nouveau) — variant `emerald`
- Fusionne `BilanPage` et `HistoryPage`
- `GradientHeader` variant `emerald`
- Onglets internes Jour / Semaine / Mois / Évolution : `.pill` / `.pill.active`
- Graphiques Recharts conservés intacts
- Bouton export PDF conservé intact

#### GlucoseTrackingPage (`/glucose`) — variant `glucose`
- `GradientHeader` variant `glucose`
- Métriques GMI / TIR / CV : `MetricCard` avec statut dynamique
- ScatterChart Recharts conservé intact
- Import CSV LibreView conservé intact

#### ProfilePage (`/profile`) — variant `slate`
- `GradientHeader` variant `slate`
- `LanguageSelector` déplacé ici (retiré du Layout header)
- 4 onglets internes : `.pill` / `.pill.active`
- Cartes paramètres : `.card`
- Toggle dark mode conservé intact

#### LandingPage (`/`) — variant `indigo`
- Hero : `.gradient-hero` full-width
- 6 feature cards : `.card`
- CTA buttons : `.pill.active`

#### LoginPage / RegisterPage
- Formulaire centré dans `.card` (max-width 400px)
- Inputs : `border: 1px solid var(--border-color)`, `border-radius: var(--radius-md)`

#### OnboardingModal
- 4 étapes : `.card` modal avec header `.gradient-hero`

---

## Exigences de non-régression (REG-xx)

### REG-01 — Auth JWT
Le flux login → token JWT → accès aux routes protégées fonctionne. Test : render `LoginPage`, submit formulaire, vérifier redirection vers `/journal`.

### REG-02 — Navigation 5 onglets
Clic sur chaque onglet nav affiche le bon écran. Test : render `App`, cliquer `Plats` → texte "Base de données" visible ; cliquer `Stats` → graphiques/onglets visibles.

### REG-03 — Scanner code-barres
Le callback de résultat du scanner est branché et alimente l'ajout au journal depuis le nouveau point d'entrée (bouton header JournalPage). Test : render `JournalPage`, cliquer bouton scanner, simuler un résultat de scan (appel du callback `onDetected` avec un code-barres), vérifier que `api.post('/journal', ...)` est appelé avec les données du produit correspondant.

### REG-04 — Vision alimentaire
Le callback de résultat de la vision est branché et alimente l'ajout au journal depuis le nouveau point d'entrée (bouton header JournalPage). Test : render `JournalPage`, cliquer bouton photo, simuler un résultat de reconnaissance (appel du callback `onResult` avec un aliment), vérifier que `api.post('/journal', ...)` est appelé avec les données de l'aliment reconnu.

### REG-05 — Saisie vocale (quick-add depuis JournalPage header)
`VoiceInput` se monte et le callback `onResult` est branché depuis le nouveau point d'entrée header. Test : render `JournalPage`, cliquer bouton micro dans le header, vérifier que le composant `VoiceInput` est monté et que l'élément déclencheur est accessible.

### REG-06 — Graphiques Recharts + HistoryPage dans StatsPage
- `GlucoseTrackingPage` rend son ScatterChart sans crash avec données mockées.
- Dans `StatsPage`, l'onglet actif par défaut (ex. "Jour") rend le contenu de `BilanPage` avec ses graphiques Recharts.
- Dans `StatsPage`, cliquer l'onglet "Évolution" rend le contenu de `HistoryPage` avec ses graphiques Recharts (données 7 jours mockées).
Test : render `StatsPage` avec données mockées ; vérifier présence des conteneurs graphiques Bilan ; cliquer onglet "Évolution", vérifier présence des conteneurs graphiques History.

### REG-06b — Onglet Produits dans DishesPage
L'onglet "Produits" dans DishesPage liste les produits via `axios` et permet la recherche. Test : render `DishesPage` avec `api.get('/products')` mocké retournant une liste de 3 produits ; cliquer filtre "Produits" ; vérifier que les 3 produits sont affichés ; saisir un terme de recherche, vérifier que seuls les produits correspondants sont visibles.

### REG-07 — Export PDF
Bouton export PDF dans StatsPage appelle `exportBilanPDF`. Test : render `StatsPage`, cliquer bouton export, vérifier appel du mock.

### REG-08 — i18n FR/AR/EN + RTL
Changement de langue en AR active `dir="rtl"` sur le document. Test : render `ProfilePage` (nouveau point de `LanguageSelector`), sélectionner AR, vérifier `document.documentElement.dir === 'rtl'`.

### REG-09 — Dark mode
Toggle dark mode dans ProfilePage ajoute `data-theme="dark"` sur le `<html>`. Test : render `ProfilePage`, cliquer toggle, vérifier attribut.

### REG-10 — PWA / Service Worker
`src/index.js` enregistre le Service Worker. Test : vérifier que `navigator.serviceWorker.register` est appelé au montage (mock `navigator.serviceWorker`).

### REG-11 — Composants design system (DES-03)
Tests de rendu unitaires pour les trois nouveaux composants :

- **`GradientHeader`** : render avec `variant="indigo"` → le div racine a la classe `gradient-hero` ; avec `variant="glucose"` → classe `gradient-glucose` ; `subtitle` rendu dans `<p>` ; `children` rendu dans le slot droite.
- **`MacroPillCard`** : render avec `value=60, target=100` → barre à 60% de largeur (style inline) ; avec `value=100, target=100` → barre a la classe `macro-pill__fill--complete`.
- **`MetricCard`** : render avec `status="good"` → div a la classe `metric-card--good` ; avec `statusText="Objectif atteint"` → texte présent dans le DOM.

---

## Stratégie de tests

**Stack :** Jest + React Testing Library + `@testing-library/user-event`.

**Structure :** `src/tests/<NomEcran>.test.jsx` par écran.

**Ordre d'exécution par écran :**
1. Écrire le test REG (état original) → vérifier qu'il est **vert**
2. Appliquer le restyling de l'écran
3. Relancer le test → vérifier qu'il reste **vert**

**Mocks systématiques :**
- `axios` : `jest.mock('../utils/api')` retournant des fixtures JSON
- `navigator.serviceWorker` : mock global dans `setupTests.js`
- `window.matchMedia` : mock pour ThemeContext
- Stores Zustand : `useJournalStore`, `useProfileStore` etc. initialisés avec état minimal

---

## Contraintes

- Pas d'ajout de dépendances npm (ni framer-motion, ni Tailwind)
- Toutes les animations : CSS pur (keyframes existants dans `index.css`)
- Propriétés directionnelles : `padding-inline`, `margin-inline-start`, `inset-inline-start` dans tous les nouveaux composants
- `color-mix()` pour les fonds semi-transparents des `MetricCard` (pas de `rgba()` hardcodé)
- `backend/` et `mobile/` : zéro modification
