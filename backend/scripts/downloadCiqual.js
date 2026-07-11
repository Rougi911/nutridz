/**
 * Downloads CIQUAL 2020 XLS directly from ANSES and converts to ciqual.json.
 * Run once: node backend/scripts/downloadCiqual.js
 * Requires: npm install xlsx  (already in devDependencies)
 */
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const XLS_URL  = 'https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_FR_2020%2007%2007.xls';
const OUT_PATH = path.join(__dirname, '../data/ciqual.json');
const CACHE    = path.join(os.tmpdir(), 'ciqual_2020.xls');

// CIQUAL uses '-', 'traces', '<X' for missing/trace values → treat as 0
function parseVal(raw) {
  if (raw == null || raw === '-' || raw === '' || raw === 'traces') return 0;
  const s = String(raw).replace(',', '.').replace(/^<\s*/, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// CIQUAL 2020 column names (exact French headers from XLS)
const COL_KCAL      = 'Energie, Règlement UE N° 1169/2011 (kcal/100 g)';
const COL_PROT      = 'Protéines, N x facteur de Jones (g/100 g)';
const COL_GLUCIDES  = 'Glucides (g/100 g)';
const COL_LIPIDES   = 'Lipides (g/100 g)';
const COL_FIBRES    = 'Fibres alimentaires (g/100 g)';
const COL_SEL       = 'Sel chlorure de sodium (g/100 g)';
const COL_SUCRES    = 'Sucres (g/100 g)';      // G7 — composition radar
const COL_AGS       = 'AG saturés (g/100 g)';  // G7 — composition radar
// ⚠️ AVERTISSEMENT G7 : ce script NE produit PAS les micronutriments (vitamines/minéraux) déjà
// présents dans le ciqual.json déployé (ajoutés par un process séparé). NE PAS régénérer la prod
// avec ce seul script sans réintégrer l'enrichissement micronutriments (sinon régression radar S2).

async function main() {
  console.log('📥 Téléchargement CIQUAL 2020 depuis ANSES...');

  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.error('❌ Package xlsx manquant : npm install xlsx');
    process.exit(1);
  }
  const axios = require('axios');

  let buffer;
  if (fs.existsSync(CACHE)) {
    buffer = fs.readFileSync(CACHE);
    console.log(`✅ Fichier en cache : ${CACHE}`);
  } else {
    const response = await axios.get(XLS_URL, {
      responseType: 'arraybuffer',
      timeout: 90000,
      headers: { 'User-Agent': 'Mozilla/5.0 NutraLance/1.0' },
    });
    buffer = Buffer.from(response.data);
    fs.writeFileSync(CACHE, buffer);
    console.log(`✅ XLS téléchargé (${Math.round(buffer.length / 1024)} KB)`);
  }

  const wb = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  console.log(`✅ ${rows.length} lignes extraites`);

  let estimated = 0;
  const data = rows
    .map(r => {
      const proteines  = parseVal(r[COL_PROT]);
      const glucides   = parseVal(r[COL_GLUCIDES]);
      const lipides    = parseVal(r[COL_LIPIDES]);
      const fibres     = parseVal(r[COL_FIBRES]);
      let   kcal       = parseVal(r[COL_KCAL]);

      // Calculate from macros when CIQUAL value is missing (Atwater formula)
      if (kcal === 0 && (proteines + glucides + lipides) > 0) {
        kcal = Math.round(proteines * 4 + glucides * 4 + lipides * 9 + fibres * 2);
        estimated++;
      }

      return {
        alim_nom_fr: (r['alim_nom_fr'] || '').trim(),
        alim_nom_en: null,  // CIQUAL 2020 FR table has no English name column
        group:       (r['alim_grp_nom_fr'] || '').trim(),
        kcal:        Math.round(kcal),
        proteines:   Math.round(proteines * 10) / 10,
        glucides:    Math.round(glucides  * 10) / 10,
        lipides:     Math.round(lipides   * 10) / 10,
        fibres:      Math.round(fibres    * 10) / 10,
        sel:         Math.round(parseVal(r[COL_SEL]) * 100) / 100,
        sucres:      Math.round(parseVal(r[COL_SUCRES]) * 10) / 10,  // G7
        satures:     Math.round(parseVal(r[COL_AGS])    * 10) / 10,  // G7
      };
    })
    .filter(r => r.alim_nom_fr && r.alim_nom_fr.length > 1);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2), 'utf8');

  const withKcal = data.filter(r => r.kcal > 0).length;
  console.log(`\n🎉 CIQUAL sauvegardé : ${OUT_PATH}`);
  console.log(`   ${data.length} aliments total`);
  console.log(`   ${withKcal} avec kcal > 0 (dont ${estimated} estimés via macros)`);

  const samples = data.filter(r => r.kcal > 0).slice(0, 5);
  console.log('\n   Exemples :');
  samples.forEach(s =>
    console.log(`   • ${s.alim_nom_fr.substring(0, 45).padEnd(45)} ${s.kcal} kcal | P:${s.proteines}g G:${s.glucides}g L:${s.lipides}g`)
  );
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
