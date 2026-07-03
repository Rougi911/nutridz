// P1-4 backend — Glycémie × Repas (fonctions pures, testables).
// Croise le journal alimentaire horodaté et les lectures de glycémie pour
// produire une timeline de la journée, le delta post-prandial par repas et une
// détection de pattern sur 14 j. Différenciateur marché (aucun concurrent).
//
// NB : le journal ne stocke pas l'heure réelle du repas. On utilise logged_at
// si elle tombe le bon jour, sinon une heure par défaut par créneau. TODO :
// stocker une heure de repas explicite pour une corrélation plus précise.

const SLOT_MAP = { pdej: 'breakfast', dej: 'lunch', coll: 'snack', diner: 'dinner' };
const SLOT_ORDER = ['pdej', 'dej', 'coll', 'diner'];
const DEFAULT_SLOT_MIN = { pdej: 8 * 60, dej: 12 * 60 + 30, coll: 16 * 60 + 30, diner: 20 * 60 };

function minutesUTC(ts) {
  const d = new Date(ts);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Regroupe les repas par (date → créneau) avec kcal/glucides/heure/nom. */
function aggregateMeals(meals) {
  const byDate = new Map();
  for (const m of meals) {
    if (!byDate.has(m.date)) byDate.set(m.date, new Map());
    const slots = byDate.get(m.date);
    if (!slots.has(m.meal_type)) {
      slots.set(m.meal_type, { kcal: 0, carbs: 0, name: null, topKcal: -1, timeMs: null });
    }
    const s = slots.get(m.meal_type);
    const kcal = Number(m.kcal) || 0;
    s.kcal += kcal;
    s.carbs += Number(m.glucides) || 0;
    if (kcal > s.topKcal) { s.topKcal = kcal; s.name = m.name; }
    // Heure : logged_at si le jour correspond, sinon défaut par créneau.
    if (m.logged_at && String(m.logged_at).slice(0, 10) === m.date && s.timeMs === null) {
      s.timeMs = new Date(m.logged_at).getTime();
    }
  }
  return byDate;
}

/** Delta post-prandial : pic dans les 2 h après le repas − dernière lecture avant (45 min). */
function postprandial(mealMs, readings) {
  const pre = readings
    .filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t <= mealMs && t >= mealMs - 45 * 60000;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const after = readings.filter((r) => {
    const t = new Date(r.timestamp).getTime();
    return t > mealMs && t <= mealMs + 2 * 3600000;
  });
  if (!pre || after.length === 0) return null;
  const peak = Math.max(...after.map((r) => Number(r.glucose_mg_dl)));
  return { deltaMgDl: Math.round(peak - Number(pre.glucose_mg_dl)), peakMgDl: Math.round(peak) };
}

/** Timeline d'une journée : points glycémie + marqueurs repas + TIR. */
function buildDayTimeline(date, readings, mealsByDate, target) {
  const dayGlucose = readings
    .filter((r) => String(r.timestamp).slice(0, 10) === date)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const points = dayGlucose.map((r) => ({ minutes: minutesUTC(r.timestamp), valueMgDl: Number(r.glucose_mg_dl) }));

  const markers = [];
  const slots = mealsByDate.get(date) || new Map();
  for (const slot of SLOT_ORDER) {
    const s = slots.get(slot);
    if (!s) continue;
    const timeMs = s.timeMs !== null ? s.timeMs : new Date(`${date}T00:00:00Z`).getTime() + DEFAULT_SLOT_MIN[slot] * 60000;
    const pp = postprandial(timeMs, dayGlucose);
    markers.push({
      minutes: minutesUTC(new Date(timeMs).toISOString()),
      mealType: SLOT_MAP[slot] || slot,
      kcal: Math.round(s.kcal),
      carbs: Math.round(s.carbs),
      deltaMgDl: pp ? pp.deltaMgDl : null,
      peakMgDl: pp ? pp.peakMgDl : null,
      foodName: s.name || '',
    });
  }

  let tir = null;
  if (dayGlucose.length > 0) {
    const inRange = dayGlucose.filter((r) => Number(r.glucose_mg_dl) >= target.low && Number(r.glucose_mg_dl) <= target.high).length;
    tir = Math.round((inRange / dayGlucose.length) * 100);
  }
  const deltas = markers.map((m) => m.deltaMgDl).filter((d) => d !== null);
  const maxPeakDeltaMgDl = deltas.length ? Math.max(...deltas) : null;

  return { points, markers, tir, maxPeakDeltaMgDl };
}

/** Détection de pattern sur 14 j : déjeuners riches en glucides suivis d'un pic. */
function detectPattern(mealsByDate, readings) {
  const CARB = 80;
  const PEAK = 170; // mg/dL (~1,70 g/L)
  let total = 0;
  let count = 0;
  for (const [date, slots] of mealsByDate) {
    const lunch = slots.get('dej');
    if (!lunch || lunch.carbs < CARB) continue;
    total += 1;
    const lunchMs = lunch.timeMs !== null ? lunch.timeMs : new Date(`${date}T00:00:00Z`).getTime() + DEFAULT_SLOT_MIN.dej * 60000;
    const after = readings.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t > lunchMs && t <= lunchMs + 3 * 3600000;
    });
    if (after.some((r) => Number(r.glucose_mg_dl) >= PEAK)) count += 1;
  }
  if (total < 3 || count < 2) return null;
  return { count, total, carbThreshold: CARB, peakThresholdMgDl: PEAK };
}

module.exports = { aggregateMeals, buildDayTimeline, detectPattern, postprandial, SLOT_MAP };
