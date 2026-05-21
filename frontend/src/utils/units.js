// ─── Poids ───────────────────────────────────────────────────
export const kgToLbs = (kg) => +(kg * 2.20462).toFixed(1);
export const lbsToKg = (lbs) => +(lbs / 2.20462).toFixed(2);

export const displayWeight = (kg, unit) => {
  if (!kg && kg !== 0) return '—';
  if (unit === 'lbs') return `${kgToLbs(kg)} lbs`;
  return `${kg} kg`;
};

export const inputWeightToKg = (value, unit) => {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return unit === 'lbs' ? lbsToKg(n) : n;
};

export const weightPlaceholder = (unit) =>
  unit === 'lbs' ? 'Poids (lbs)' : 'Poids (kg)';

// ─── Taille ───────────────────────────────────────────────────
export const cmToFtIn = (cm) => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches, display: `${feet}' ${inches}"` };
};
export const ftInToCm = (feet, inches) =>
  Math.round(((feet * 12) + inches) * 2.54);

export const displayHeight = (cm, unit) => {
  if (!cm) return '—';
  if (unit === 'ft') return cmToFtIn(cm).display;
  return `${cm} cm`;
};

// ─── Glycémie ─────────────────────────────────────────────────
// Stockage DB TOUJOURS en mg/dL — conversion à l'affichage seulement
export const mgdlToMmol = (mgdl) => +(mgdl / 18.0182).toFixed(1);
export const mmolToMgdl = (mmol) => Math.round(mmol * 18.0182);

export const displayGlucose = (mgdl, unit) => {
  if (!mgdl && mgdl !== 0) return '—';
  if (unit === 'mmol/L') return `${mgdlToMmol(mgdl)} mmol/L`;
  return `${mgdl} mg/dL`;
};

export const inputGlucoseToMgdl = (value, unit) => {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return unit === 'mmol/L' ? mmolToMgdl(n) : Math.round(n);
};

export const glucosePlaceholder = (unit) =>
  unit === 'mmol/L' ? 'Glycémie (mmol/L)' : 'Glycémie (mg/dL)';

export const glucoseThresholds = (unit) => ({
  veryLow:    unit === 'mmol/L' ? 3.0  : 54,
  low:        unit === 'mmol/L' ? 3.9  : 70,
  targetLow:  unit === 'mmol/L' ? 3.9  : 70,
  targetHigh: unit === 'mmol/L' ? 10.0 : 180,
  high:       unit === 'mmol/L' ? 13.9 : 250,
});

// ─── Énergie ─────────────────────────────────────────────────
export const kcalToKj = (kcal) => +(kcal * 4.184).toFixed(0);

export const displayEnergy = (kcal, unit) => {
  if (!kcal && kcal !== 0) return '—';
  if (unit === 'kJ') return `${kcalToKj(kcal)} kJ`;
  return `${kcal} kcal`;
};
