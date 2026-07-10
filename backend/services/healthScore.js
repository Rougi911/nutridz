// P1-5 backend — Score Santé hebdomadaire (fonctions pures, testables).
// Agrège les richesses déjà calculées par NutriVita : adhérence calorique,
// qualité produits (additifs EFSA classés), micronutriments vs VNR ANSES,
// équilibre macros. Aucune requête DB ici : la route fournit les données brutes.
//
// Pondération : 40 % adhérence, 25 % qualité, 20 % micro, 15 % macros.

const { calcDeficiencies } = require('./micronutrientsService');
const { classifyAdditive } = require('./additiveClassify');

const WEIGHTS = { adherence: 0.4, quality: 0.25, micro: 0.2, macro: 0.15 };
// Répartition macros cible par défaut (le profil serveur ne stocke pas de split).
// TODO : exposer un split macro par profil pour personnaliser ce composant.
const DEFAULT_SPLIT = { p: 0.25, c: 0.45, f: 0.30 };

/** Date UTC (YYYY-MM-DD) il y a `daysAgo` jours. */
function utcDateStr(daysAgo = 0, from = new Date()) {
  return new Date(from.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
}

/** N derniers jours UTC (du plus ancien au plus récent). */
function lastNDates(n, endDaysAgo = 0) {
  const out = [];
  for (let i = n - 1 + endDaysAgo; i >= endDaysAgo; i--) out.push(utcDateStr(i));
  return out;
}

/** Numéro de semaine ISO (pour l'axe de l'historique). */
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function qualityForEntries(entries) {
  // entries: [{ additifs: '[]'|array }]
  if (!entries.length) return 0;
  let weight = 0;
  let good = 0;
  for (const e of entries) {
    let add = e.additifs;
    if (typeof add === 'string') {
      try { add = JSON.parse(add); } catch { add = []; }
    }
    if (!Array.isArray(add)) add = [];
    // Pire risque du produit = pénalité (high=1, moderate=0.5, sinon 0).
    let worst = 0;
    for (const code of add) {
      const c = classifyAdditive(typeof code === 'string' ? code : code?.code);
      const r = c && c.risk === 'high' ? 1 : c && c.risk === 'moderate' ? 0.5 : 0;
      if (r > worst) worst = r;
    }
    good += 1 - worst;
    weight += 1;
  }
  return Math.round((good / weight) * 100);
}

function componentsForDates(dates, dailyMap, entries, targetKcal, profile, monthNum) {
  const dateSet = new Set(dates);
  const dayEntries = entries.filter((e) => dateSet.has(e.date));

  let logged = 0;
  let inBand = 0;
  const macroDiffs = [];
  const tgtG = {
    p: (targetKcal * DEFAULT_SPLIT.p) / 4,
    c: (targetKcal * DEFAULT_SPLIT.c) / 4,
    f: (targetKcal * DEFAULT_SPLIT.f) / 9,
  };
  const tgtTot = tgtG.p + tgtG.c + tgtG.f || 1;
  const tgtPct = { p: tgtG.p / tgtTot, c: tgtG.c / tgtTot, f: tgtG.f / tgtTot };

  for (const d of dates) {
    const agg = dailyMap.get(d);
    if (!agg || agg.kcal <= 0) continue;
    logged += 1;
    const ratio = agg.kcal / (targetKcal || 2000);
    if (ratio >= 0.8 && ratio <= 1.15) inBand += 1;
    const tot = agg.protein + agg.carbs + agg.fat || 1;
    const act = { p: agg.protein / tot, c: agg.carbs / tot, f: agg.fat / tot };
    macroDiffs.push(Math.abs(act.p - tgtPct.p) + Math.abs(act.c - tgtPct.c) + Math.abs(act.f - tgtPct.f));
  }

  const adherence = logged > 0 ? Math.round((inBand / logged) * 100) : 0;
  const macro = macroDiffs.length
    ? Math.round(Math.max(0, 100 - (macroDiffs.reduce((s, x) => s + x, 0) / macroDiffs.length) * 100))
    : 0;
  const quality = dayEntries.length ? qualityForEntries(dayEntries) : 0;

  // Micronutriments : réutilise le service ANSES existant (entries {name, grams}).
  let micro = 0;
  try {
    const microEntries = dayEntries.map((e) => ({ name: e.name, grams: e.grams }));
    const defs = calcDeficiencies(microEntries, Math.max(1, dates.length), profile || {}, monthNum);
    if (defs && defs.length) {
      // E4 (ultrareview) : calcDeficiencies retourne `pct_reference`, pas `pct` —
      // l'ancien `n.pct || 0` valait toujours 0 → 20% du score santé perdus.
      micro = Math.round(defs.reduce((s, n) => s + Math.min(100, n.pct_reference || 0), 0) / defs.length);
    }
  } catch {
    micro = 0;
  }

  return { adherence, quality, micro, macro };
}

function weightedTotal(c) {
  return Math.round(
    c.adherence * WEIGHTS.adherence +
      c.quality * WEIGHTS.quality +
      c.micro * WEIGHTS.micro +
      c.macro * WEIGHTS.macro,
  );
}

/**
 * @param {Object} args
 * @param {Array<{date,kcal,carbs,protein,fat}>} args.dailyAgg  agrégats journaliers (jusqu'à 56 j)
 * @param {Array<{date,name,grams,additifs}>}    args.entries   entrées journal (56 j) pour qualité + micro
 * @param {number} args.targetKcal
 * @param {Object} args.profile  { sexe, age, latitude_approx }
 * @returns {{ total, prevTotal, components, history, actions }}
 */
function computeHealthScore({ dailyAgg, entries, targetKcal, profile }) {
  const monthNum = new Date().getUTCMonth() + 1;
  const dailyMap = new Map(dailyAgg.map((r) => [r.date, r]));

  const thisWeek = lastNDates(7, 0);
  const components = componentsForDates(thisWeek, dailyMap, entries, targetKcal, profile, monthNum);
  const total = weightedTotal(components);

  const prevWeek = lastNDates(7, 7);
  const prevHasData = prevWeek.some((d) => dailyMap.has(d));
  const prevComponents = componentsForDates(prevWeek, dailyMap, entries, targetKcal, profile, monthNum);
  const prevTotal = prevHasData ? weightedTotal(prevComponents) : null;

  const history = [];
  for (let w = 7; w >= 0; w--) {
    const dates = lastNDates(7, w * 7);
    const hasData = dates.some((d) => dailyMap.has(d));
    const sc = hasData ? weightedTotal(componentsForDates(dates, dailyMap, entries, targetKcal, profile, monthNum)) : 0;
    history.push({ week: `S${isoWeek(dates[dates.length - 1])}`, score: sc });
  }

  const actions = [];
  const ranked = Object.entries(components).sort((a, b) => a[1] - b[1]);
  for (const [key] of ranked) {
    if (actions.length >= 3) break;
    if (key === 'quality') actions.push({ points: 6, key: 'reduceUltraProcessed' });
    else if (key === 'micro') actions.push({ points: 4, key: 'addLegumes' });
    else if (key === 'adherence') actions.push({ points: 3, key: 'logMissedDay' });
    else if (key === 'macro') actions.push({ points: 3, key: 'moreProtein' });
  }

  return { total, prevTotal, components, history, actions };
}

module.exports = { computeHealthScore, qualityForEntries, componentsForDates, WEIGHTS };
