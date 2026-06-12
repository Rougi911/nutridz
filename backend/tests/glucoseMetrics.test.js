/**
 * Tests unitaires — glucoseMetrics.js
 * Couvre : DEF-06 (garde < 12 mesures), DEF-08 (CV écart-type échantillon n-1),
 *          DEF-09 (TIR cibles personnalisées), cas 0 mesures.
 */

const {
  calculateCV,
  calculateTIR,
  calculatePeriodMetrics,
} = require('../services/glucoseMetrics');

// Helpers ----------------------------------------------------------------

/** Convertit un tableau de mg/dL en tableau d'objets attendus par glucoseMetrics */
function toReadings(values) {
  return values.map(v => ({ glucose_mg_dl: v }));
}

// ========================================================================
// Test set 1 — DEF-06 : garde < 12 mesures
// ========================================================================
describe('DEF-06 — garde < 12 mesures', () => {
  test('5 mesures → insufficient_data avec message et total_readings = 5', () => {
    const readings = toReadings([100, 120, 130, 140, 150]);
    const result = calculatePeriodMetrics(readings);

    expect(result.insufficient_data).toBe(true);
    expect(result.total_readings).toBe(5);
    expect(result.message).toBe('Données insuffisantes (5 mesures ponctuelles)');
  });

  test('5 mesures → pas de champ gmi/tir/cv dans la réponse', () => {
    const readings = toReadings([100, 120, 130, 140, 150]);
    const result = calculatePeriodMetrics(readings);

    expect(result.gmi).toBeUndefined();
    expect(result.tir).toBeUndefined();
    expect(result.cv).toBeUndefined();
  });

  test('12 mesures → insufficient_data absent, gmi/tir/cv présents et calculés', () => {
    const readings = toReadings([100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 150]);
    const result = calculatePeriodMetrics(readings);

    expect(result.insufficient_data).toBeFalsy();
    expect(typeof result.gmi).toBe('number');
    expect(typeof result.tir).toBe('number');
    expect(typeof result.cv).toBe('number');
    expect(result.total_readings).toBe(12);
  });
});

// ========================================================================
// Test set 2 — DEF-08 : CV avec écart-type d'échantillon (n-1)
// ========================================================================
describe('DEF-08 — CV utilise l\'écart-type échantillon (÷ n-1)', () => {
  /**
   * Jeu : [100, 120, 130, 150]
   * mean = 125
   * Variance échantillon (n-1=3) = ((−25)²+(−5)²+(5)²+(25)²) / 3
   *                               = (625 + 25 + 25 + 625) / 3
   *                               = 1300 / 3 ≈ 433.333
   * stdDev échantillon = sqrt(433.333) ≈ 20.8167
   *
   * Attends: CV = round((20.8167 / 125) * 1000) / 10
   *             = round(166.534) / 10
   *
   * Recalculons précisément :
   * values  = [100, 120, 130, 150], mean = 500/4 = 125
   * diffs²  = [625, 25, 25, 625]  → sum = 1300
   * variance échantillon = 1300 / 3 ≈ 433.3333
   * stdDev  = sqrt(433.3333) ≈ 20.8167
   * CV      = 20.8167 / 125 * 100 ≈ 16.653 %
   *         → arrondi Math.round(20.8167/125 * 1000) / 10
   *         = Math.round(166.534) / 10 = 1665/10 = 166.5 / 10
   *
   * Attention : le code fait `(stdDev / mean) * 1000` puis `/ 10` (= *100/10 = *10 ?)
   * Regardons l'implémentation réelle :
   *   return Math.round((stdDev / mean) * 1000) / 10;
   * = Math.round(20.8167 / 125 * 1000) / 10
   * = Math.round(166.534) / 10
   * = 167 / 10
   * = 16.7
   *
   * Valeur avec population (÷ n=4) :
   * variance population = 1300 / 4 = 325
   * stdDev  = sqrt(325) ≈ 18.028
   * CV      = Math.round(18.028 / 125 * 1000) / 10
   *         = Math.round(144.22) / 10
   *         = 144 / 10 = 14.4
   *
   * Donc on vérifie :
   *   résultat attendu (n-1) ≈ 16.7
   *   résultat non attendu (n)  ≈ 14.4
   */

  const readings = toReadings([100, 120, 130, 150]);

  test('CV vaut ~16.7 % (écart-type échantillon n-1)', () => {
    const cv = calculateCV(readings);
    // Tolérance 0.1 pour les arrondis flottants
    expect(cv).toBeCloseTo(16.7, 1);
  });

  test('CV ne vaut PAS ~14.4 % (ce serait le résultat avec population ÷ n)', () => {
    const cv = calculateCV(readings);
    expect(cv).not.toBeCloseTo(14.4, 0);
  });
});

// ========================================================================
// Test set 3 — DEF-09 : TIR avec cibles personnalisées
// ========================================================================
describe('DEF-09 — TIR avec cibles personnalisées', () => {
  /**
   * Jeu : [60, 75, 80, 85, 90, 100, 110, 165, 185, 200]
   *
   * TIR défaut (70-180) :
   *   Dans [70, 180] : 75, 80, 85, 90, 100, 110, 165, 185 ?
   *     60  → non (< 70)
   *     75  → oui
   *     80  → oui
   *     85  → oui
   *     90  → oui
   *    100  → oui
   *    110  → oui
   *    165  → oui
   *    185  → non (> 180)
   *    200  → non (> 180)
   *   → 7 sur 10 = 70.0 %
   *
   * TIR cibles 80-160 :
   *     60  → non
   *     75  → non (< 80)
   *     80  → oui
   *     85  → oui
   *     90  → oui
   *    100  → oui
   *    110  → oui
   *    165  → non (> 160)
   *    185  → non
   *    200  → non
   *   → 5 sur 10 = 50.0 %
   *
   * Note : l'énoncé dit "8 sur 10 pour 70-180" et "6 sur 10 pour 80-160".
   * Le calcul précis ci-dessus donne 7 et 5. On se base sur le code réel.
   */

  const readings = toReadings([60, 75, 80, 85, 90, 100, 110, 165, 185, 200]);

  test('TIR défaut (70-180) = 70.0 %', () => {
    const tir = calculateTIR(readings);
    expect(tir).toBe(70.0);
  });

  test('TIR cibles personnalisées (80-160) = 50.0 %', () => {
    const tir = calculateTIR(readings, 80, 160);
    expect(tir).toBe(50.0);
  });

  test('TIR défaut et TIR personnalisé donnent des valeurs différentes', () => {
    const tirDefault = calculateTIR(readings);
    const tirCustom  = calculateTIR(readings, 80, 160);
    expect(tirDefault).not.toBe(tirCustom);
  });

  test('TIR via calculatePeriodMetrics avec cibles 80-160 diffère du défaut', () => {
    // Besoin de ≥ 12 mesures pour contourner le garde DEF-06
    const r12 = toReadings([60, 75, 80, 85, 90, 100, 110, 165, 185, 200, 95, 120]);
    const resDefault = calculatePeriodMetrics(r12);
    const resCustom  = calculatePeriodMetrics(r12, 80, 160);
    expect(resDefault.tir).not.toBe(resCustom.tir);
    expect(resDefault.target_min).toBe(70);
    expect(resDefault.target_max).toBe(180);
    expect(resCustom.target_min).toBe(80);
    expect(resCustom.target_max).toBe(160);
  });
});

// ========================================================================
// Test set 4 — DEF-06 : 0 mesures
// ========================================================================
describe('DEF-06 — 0 mesures (tableau vide)', () => {
  test('calculatePeriodMetrics([]) → total_readings: 0, gmi/tir/cv/distribution null', () => {
    const result = calculatePeriodMetrics([]);

    expect(result.total_readings).toBe(0);
    expect(result.gmi).toBeNull();
    expect(result.tir).toBeNull();
    expect(result.cv).toBeNull();
    expect(result.distribution).toBeNull();
  });

  test('calculatePeriodMetrics([]) → insufficient_data absent', () => {
    const result = calculatePeriodMetrics([]);
    expect(result.insufficient_data).toBeUndefined();
  });

  test('calculateCV([]) → null', () => {
    expect(calculateCV([])).toBeNull();
  });

  test('calculateTIR([]) → null', () => {
    expect(calculateTIR([])).toBeNull();
  });
});
