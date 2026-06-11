# HANDOFF — restylage NutriVita
_Dernière mise à jour : 2026-06-11 — par Claude_

## Phase en cours
Exécution du plan de restyling (subagent-driven-development).
Fondation CSS terminée (DES-01 + DES-02). Composants réutilisables en cours (DES-03).

## Tâches terminées
- **Task 1 — DES-01** : correction tokens dark mode (`e9a4243`) — `--bg-secondary: #1a1b2e`, `--bg-tertiary: #252642`
- **Task 2 — DES-02** : classes utilitaires CSS (`93d4a9f`) — `.card`, `.gradient-header`, `.pill`, `.macro-pill`, `.metric-card`, `.modal-overlay`

## Tâche en cours
- **Task 3 — DES-03 + REG-11a** : composant `GradientHeader` + test (TDD)

## Prochaines étapes (ordre du plan)
1. Task 3 : GradientHeader component + REG-11a
2. Task 4 : MacroPillCard component + REG-11b
3. Task 5 : MetricCard component + REG-11c
4. Task 6 : setupTests.js + renderWithProviders
5. Task 7a : baseline tests pré-restructuring (GREEN sur structure actuelle)
6. Tasks 7b-7g : restructuring nav 9→5 tabs + StatsPage
7. Tasks 8-16 : restyling écran par écran + tests REG

## ⚠️ Attention — travail antérieur sur origin/main
Les commits `fea6937`, `bfd0772`, `8919112`, `0e1f544` contiennent du restyling
v0 déjà appliqué avant le lancement du plan systématique. **Vérifier fichier par
fichier avant chaque modification** : si une page a déjà été restylée, adapter
la tâche (ajout des classes utilitaires manquantes, remplacement des composants
locaux par les partagés) plutôt que de réécrire à l'aveugle.

## Traçabilité (RTM)
| ID | Exigence | Test(s) | Commit | Statut | Couverture |
|----|----------|---------|--------|--------|------------|
| DES-01 | Tokens dark mode | visuel | e9a4243 | ✅ done | 100 % |
| DES-02 | Classes utilitaires CSS | visuel | 93d4a9f | ✅ done | 100 % |
| DES-03 | Composants réutilisables | REG-11a/b/c | — | 🔄 en cours | 0 % |
| DES-04 | Navigation 9→5 tabs | REG-02 | — | ⬜ à faire | 0 % |
| DES-05 | Restyling écrans | REG-03→11 | — | ⬜ à faire | 0 % |
| REG-01 | Auth JWT | BaselineReg.test | — | ⬜ à faire | 0 % |
| REG-02 | Navigation 5 onglets | Navigation.test | — | ⬜ à faire | 0 % |
| REG-03 | Scanner (modal JournalPage) | JournalPage.test | — | ⬜ à faire | 0 % |
| REG-04 | Vision (modal JournalPage) | JournalPage.test | — | ⬜ à faire | 0 % |
| REG-05 | Voice (modal JournalPage) | JournalPage.test | — | ⬜ à faire | 0 % |
| REG-06 | Recharts + StatsPage | StatsPage.test | — | ⬜ à faire | 0 % |
| REG-06b | Produits tab DishesPage | DishesPage.test | — | ⬜ à faire | 0 % |
| REG-07 | Export PDF | StatsPage.test | — | ⬜ à faire | 0 % |
| REG-08 | i18n + RTL | ProfilePage.test | — | ⬜ à faire | 0 % |
| REG-09 | Dark mode toggle | ProfilePage.test | — | ⬜ à faire | 0 % |
| REG-10 | PWA Service Worker | BaselineReg.test | — | ⬜ à faire | 0 % |
| REG-11a | GradientHeader | GradientHeader.test | — | 🔄 en cours | 0 % |
| REG-11b | MacroPillCard | MacroPillCard.test | — | ⬜ à faire | 0 % |
| REG-11c | MetricCard | MetricCard.test | — | ⬜ à faire | 0 % |

Couverture globale : 2/18 exigences ✅ (11 %)

## Problèmes ouverts
- Session limit atteinte pendant la code review de Task 2 (reviewer) — review manquante pour Task 2, à faire en début de prochaine session si bloquant.

## Dernier commit
- `93d4a9f` feat(css): add card, pill, macro-pill, metric-card, modal-overlay utility classes
