const KCAL_PER_KG_FAT = 7700;
const KCAL_PER_KG_LEAN = 1820;

function estimateBodyFatPct({ weight_kg, height_cm, age, sex }) {
  if (!weight_kg || !height_cm || !age) return null;
  const bmi = weight_kg / Math.pow(height_cm / 100, 2);
  const sexFactor = sex === 'male' ? 1 : sex === 'female' ? 0 : 0.5;
  const bf = (1.20 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4;
  return Math.max(3, Math.min(60, Math.round(bf * 10) / 10));
}

function estimateLeanMassKg(weight_kg, body_fat_pct) {
  if (!weight_kg) return 0;
  const bf = body_fat_pct ?? 20;
  return Math.round(weight_kg * (1 - bf / 100) * 10) / 10;
}

function dailyEnergyToBodyChange({ net_kcal, current_bf_pct = 20, resistance_days = 0 }) {
  let muscleRatio = current_bf_pct >= 30 ? 0.10 :
                    current_bf_pct >= 20 ? 0.20 : 0.30;

  muscleRatio += Math.min(resistance_days, 5) * 0.04;

  if (net_kcal > 0) {
    muscleRatio = Math.min(muscleRatio + 0.10, 0.50);
  } else {
    muscleRatio = Math.max(muscleRatio - 0.10, 0.05);
  }
  const fatRatio = 1 - muscleRatio;

  const delta_fat_kg  = (net_kcal * fatRatio)    / KCAL_PER_KG_FAT;
  const delta_lean_kg = (net_kcal * muscleRatio)  / KCAL_PER_KG_LEAN;

  return {
    delta_fat_kg:    Math.round(delta_fat_kg  * 1000) / 1000,
    delta_lean_kg:   Math.round(delta_lean_kg * 1000) / 1000,
    delta_weight_kg: Math.round((delta_fat_kg + delta_lean_kg) * 1000) / 1000,
  };
}

function periodEstimation({ nets, baseline_bf_pct = 20 }) {
  let cumulative_lean = 0;
  let cumulative_fat  = 0;
  const daily = [];

  for (let i = 0; i < nets.length; i++) {
    const windowStart    = Math.max(0, i - 6);
    const resistance_days = nets.slice(windowStart, i + 1).filter(n => n.resistance_today).length;
    const change = dailyEnergyToBodyChange({
      net_kcal: nets[i].net_kcal,
      current_bf_pct: baseline_bf_pct,
      resistance_days,
    });
    cumulative_lean += change.delta_lean_kg;
    cumulative_fat  += change.delta_fat_kg;
    daily.push({ date: nets[i].date, ...change });
  }

  return {
    total_delta_weight_kg: Math.round((cumulative_lean + cumulative_fat) * 100) / 100,
    total_delta_lean_kg:   Math.round(cumulative_lean * 100) / 100,
    total_delta_fat_kg:    Math.round(cumulative_fat  * 100) / 100,
    daily,
  };
}

module.exports = { estimateBodyFatPct, estimateLeanMassKg, dailyEnergyToBodyChange, periodEstimation };
