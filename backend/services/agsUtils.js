// AGS = Acides Gras Saturés
// Spec AL-09 : objectif mensuel AGS = TDEE × 10% ÷ 9 × 30 (dynamique)
// Fallback 2000 kcal si profil incomplet, marqué default_used: true

const DEFAULT_TDEE = 2000;

function calcMonthlyAGSTarget(profile) {
  const tdee = profile?.tdee;
  if (!tdee || typeof tdee !== 'number' || tdee < 800 || tdee > 8000) {
    const target_g = Math.round(DEFAULT_TDEE * 0.10 / 9 * 30);
    return { target_g, default_used: true, tdee_used: DEFAULT_TDEE };
  }
  const target_g = Math.round(tdee * 0.10 / 9 * 30);
  return { target_g, default_used: false, tdee_used: tdee };
}

module.exports = { calcMonthlyAGSTarget };
