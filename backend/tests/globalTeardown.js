/**
 * M14 (ultrareview) — nettoyage des schémas de test Postgres en fin de run Jest.
 *
 * L'isolation par worker crée des schémas `test_wN` (CREATE SCHEMA IF NOT EXISTS) qui
 * n'étaient jamais supprimés : en local, les données s'accumulaient entre deux `npm test`
 * (contraintes UNIQUE email, assertions de comptage) → faux échecs au 2e run. On les
 * supprime ici pour que chaque exécution reparte propre. No-op sans DATABASE_URL.
 */
module.exports = async function globalTeardown() {
  if (!process.env.DATABASE_URL) return;
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'test_w%'"
    );
    for (const { nspname } of rows) {
      await client.query(`DROP SCHEMA IF EXISTS "${nspname}" CASCADE`);
    }
  } catch (err) {
    // best-effort — ne jamais faire échouer la suite à cause du nettoyage
    console.warn('[globalTeardown] nettoyage schémas de test ignoré:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
};
