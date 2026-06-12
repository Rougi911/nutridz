// ADA guidelines defaults
const TARGET_RANGE_LOW  = 70;
const TARGET_RANGE_HIGH = 180;
const HYPO_LEVEL_1  = 70;
const HYPO_LEVEL_2  = 54;
const HYPER_LEVEL_1 = 180;
const HYPER_LEVEL_2 = 250;

// Minimum readings required for meaningful statistics (AL-05)
const MIN_READINGS_FOR_METRICS = 12;

// GMI (Glucose Management Indicator) — Bergenstal et al. 2018
function calculateGMI(readings) {
  if (!readings || readings.length === 0) return null;
  const avg = readings.reduce((sum, r) => sum + r.glucose_mg_dl, 0) / readings.length;
  const gmi = 3.31 + (0.02392 * avg);
  return Math.round(gmi * 10) / 10;
}

// TIR (Time In Range) — % of readings within target range
// DEF-09: accepts personalized targets (default ADA 70–180 mg/dL)
function calculateTIR(readings, targetMin = TARGET_RANGE_LOW, targetMax = TARGET_RANGE_HIGH) {
  if (!readings || readings.length === 0) return null;
  const inRange = readings.filter(r => r.glucose_mg_dl >= targetMin && r.glucose_mg_dl <= targetMax).length;
  return Math.round((inRange / readings.length) * 1000) / 10;
}

// CV (Coefficient of Variation) — DEF-08: sample std dev (n-1), <36% stable
function calculateCV(readings) {
  if (!readings || readings.length < 2) return null;
  const values = readings.map(r => r.glucose_mg_dl);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // Sample variance (÷ n-1), not population variance (÷ n)
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  return Math.round((stdDev / mean) * 1000) / 10;
}

function calculateGlucoseDistribution(readings) {
  if (!readings || readings.length === 0) return null;
  const total = readings.length;
  const veryLow = readings.filter(r => r.glucose_mg_dl < HYPO_LEVEL_2).length;
  const low     = readings.filter(r => r.glucose_mg_dl >= HYPO_LEVEL_2 && r.glucose_mg_dl < HYPO_LEVEL_1).length;
  const inRange = readings.filter(r => r.glucose_mg_dl >= TARGET_RANGE_LOW && r.glucose_mg_dl <= TARGET_RANGE_HIGH).length;
  const high    = readings.filter(r => r.glucose_mg_dl > HYPER_LEVEL_1 && r.glucose_mg_dl <= HYPER_LEVEL_2).length;
  const veryHigh = readings.filter(r => r.glucose_mg_dl > HYPER_LEVEL_2).length;
  return {
    very_low_pct:   Math.round((veryLow  / total) * 1000) / 10,
    low_pct:        Math.round((low      / total) * 1000) / 10,
    in_range_pct:   Math.round((inRange  / total) * 1000) / 10,
    high_pct:       Math.round((high     / total) * 1000) / 10,
    very_high_pct:  Math.round((veryHigh / total) * 1000) / 10,
    very_low_count: veryLow,
    low_count:      low,
    in_range_count: inRange,
    high_count:     high,
    very_high_count: veryHigh,
  };
}

// DEF-06: guard < 12 readings; DEF-09: personalized TIR targets
function calculatePeriodMetrics(readings, targetMin = TARGET_RANGE_LOW, targetMax = TARGET_RANGE_HIGH) {
  if (!readings || readings.length === 0) {
    return { total_readings: 0, avg_glucose: null, min_glucose: null, max_glucose: null, gmi: null, tir: null, cv: null, distribution: null };
  }
  // AL-05: guard — statistics on < 12 readings are not clinically meaningful
  if (readings.length < MIN_READINGS_FOR_METRICS) {
    return {
      insufficient_data: true,
      total_readings: readings.length,
      message: `Données insuffisantes (${readings.length} mesures ponctuelles)`,
    };
  }
  const values = readings.map(r => r.glucose_mg_dl);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    total_readings: readings.length,
    avg_glucose:    Math.round(avg * 10) / 10,
    min_glucose:    Math.min(...values),
    max_glucose:    Math.max(...values),
    gmi:            calculateGMI(readings),
    tir:            calculateTIR(readings, targetMin, targetMax),
    cv:             calculateCV(readings),
    distribution:   calculateGlucoseDistribution(readings),
    target_min:     targetMin,
    target_max:     targetMax,
  };
}

// Detect and normalise LibreView timestamp to ISO8601
function parseLibreViewTimestamp(timestampStr) {
  if (!timestampStr) return null;

  // EU: DD-MM-YYYY HH:MM
  const euMatch = timestampStr.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (euMatch) {
    const [, day, month, year, hour, minute] = euMatch;
    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }

  // US: MM-DD-YYYY HH:MM AM/PM
  const usMatch = timestampStr.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (usMatch) {
    const [, month, day, year, hour, minute, ampm] = usMatch;
    let h = parseInt(hour);
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    return `${year}-${month}-${day}T${h.toString().padStart(2, '0')}:${minute}:00`;
  }

  // Already ISO or unrecognised
  return timestampStr.includes('T') ? timestampStr : null;
}

// Parse LibreView CSV export (Freestyle Libre)
function parseLibreViewCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV vide ou invalide');

  const header = lines[0].toLowerCase();
  if (!header.includes('historic glucose') && !header.includes('scan glucose')) {
    throw new Error('CSV ne contient pas de colonnes glucose reconnues');
  }

  const readings = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map(c => c.trim());
    if (cols.length < 5) continue;

    const rawTs = cols[2];
    if (!rawTs || rawTs === 'Device Timestamp') continue;

    const historicGlucose = cols[4] ? parseFloat(cols[4]) : null;
    const scanGlucose     = cols[5] ? parseFloat(cols[5]) : null;
    const glucose = scanGlucose || historicGlucose;

    if (!glucose || isNaN(glucose) || glucose < 20 || glucose > 600) continue;

    const timestamp = parseLibreViewTimestamp(rawTs);
    if (!timestamp) continue;

    readings.push({ timestamp, glucose_mg_dl: glucose, reading_type: 'cgm', source: 'libreview_csv' });
  }
  return readings;
}

module.exports = {
  calculateGMI,
  calculateTIR,
  calculateCV,
  calculateGlucoseDistribution,
  calculatePeriodMetrics,
  parseLibreViewCSV,
};
