# Rotation des secrets — NutriVita backend

> Procédure pour le **propriétaire**. Les étapes 🔒 (purge d'historique git,
> rotation effective sur Render) ne sont **jamais** exécutées par la boucle de dev :
> elles nécessitent une validation humaine (cf. règle 8 du BACKLOG).

## Contexte (P0-1)

`backend/.env` n'est plus suivi par git (`git rm --cached`, fait dans `488dc4c`) et
`backend/.gitignore` bloque `.env`, `.env.*` (sauf `.env.example`) et `*.db`.

⚠️ **Le `.env` reste présent dans l'historique git** des anciens commits. Tant que
l'historique n'est pas purgé, considérer tous les secrets qui y ont figuré comme
**compromis** → les faire tourner.

## 1. 🔒 Purger l'historique (humain)

À faire en local, avec sauvegarde préalable du dépôt, puis force-push coordonné
(prévenir tout collaborateur, qui devra re-cloner) :

```bash
# Option recommandée : git-filter-repo
pip install git-filter-repo
git filter-repo --path backend/.env --invert-paths
git push origin --force --all
git push origin --force --tags
```

## 2. 🔒 Faire tourner les secrets (humain, sur Render)

Pour chaque secret ci-dessous : générer une nouvelle valeur, la mettre à jour dans
Render → service `nutridz` → Environment, puis redéployer.

| Secret | Comment régénérer |
|---|---|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` — **invalide toutes les sessions JWT existantes** (les users devront se reconnecter). |
| `STRAVA_CLIENT_SECRET` | Strava → API settings → *Revoke* puis nouveau secret. |
| `GEMINI_API_KEY` | Google AI Studio → révoquer l'ancienne clé, en créer une. |
| `USDA_API_KEY` | data.gov → demander une nouvelle clé (l'ancienne expire d'elle-même). |
| `STRAVA_VERIFY_TOKEN` | Chaîne aléatoire au choix ; resynchroniser l'abonnement webhook Strava. |

## 3. Vérifier

```
GET https://nutridz.onrender.com/api/health   →   {"status":"ok",...}
```

Puis re-tester un login (nouvelle session) et une analyse photo (Gemini).
