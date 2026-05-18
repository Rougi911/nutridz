/**
 * Script to download and convert CIQUAL 2020 data to JSON.
 * Run once: node backend/scripts/downloadCiqual.js
 * Requires: npm install adm-zip xlsx --save-dev  (in backend/ directory)
 */
const path = require('path');
const fs   = require('fs');

const OUT_PATH = path.join(__dirname, '../data/ciqual_full.json');
const URL = 'https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_FR_2020%2007%2007.xls.zip';

async function main() {
  console.log('📥 Téléchargement CIQUAL 2020 depuis ANSES...');

  let AdmZip, XLSX;
  try {
    AdmZip = require('adm-zip');
    XLSX   = require('xlsx');
  } catch {
    console.error('❌ Packages manquants. Installez-les dans backend/ :');
    console.error('   npm install adm-zip xlsx');
    process.exit(1);
  }

  const axios = require('axios');
  const response = await axios.get(URL, { responseType: 'arraybuffer', timeout: 60000 });
  console.log('✅ ZIP téléchargé');

  const zip = new AdmZip(Buffer.from(response.data));
  const entries = zip.getEntries();
  const xlsEntry = entries.find(e => e.entryName.endsWith('.xls') || e.entryName.endsWith('.xlsx'));
  if (!xlsEntry) { console.error('❌ XLS introuvable dans le ZIP'); process.exit(1); }

  const xlsBuffer = xlsEntry.getData();
  const wb = XLSX.read(xlsBuffer, { type: 'buffer', codepage: 65001 });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { defval: null });
  console.log(`✅ ${rows.length} lignes extraites`);

  const data = rows.map(r => ({
    alim_nom_fr: r['alim_nom_fr'] || r['Aliment'] || '',
    group:       r['alim_grp_nom_fr'] || r['Groupe'] || '',
    kcal:        parseFloat(r['Energie, Règlement UE N° 1169/2011 (kcal/100 g)'] || r['kcal'] || 0) || 0,
    proteines:   parseFloat(r['Protéines, N x facteur de Jones (g/100 g)'] || r['proteines'] || 0) || 0,
    glucides:    parseFloat(r['Glucides (g/100 g)'] || r['glucides'] || 0) || 0,
    lipides:     parseFloat(r['Lipides (g/100 g)'] || r['lipides'] || 0) || 0,
    fibres:      parseFloat(r['Fibres alimentaires (g/100 g)'] || r['fibres'] || 0) || 0,
    sel:         parseFloat(r['Sel chlorure de sodium (g/100 g)'] || r['sel'] || 0) || 0,
  })).filter(r => r.alim_nom_fr && r.kcal > 0);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`🎉 CIQUAL complet sauvegardé : ${OUT_PATH} (${data.length} aliments)`);
  console.log('   Remplacez backend/data/ciqual.json par ciqual_full.json pour la couverture maximale.');
}

main().catch(e => { console.error(e); process.exit(1); });
