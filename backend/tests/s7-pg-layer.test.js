'use strict';
/**
 * S7 — Couche d'accès PostgreSQL (db.js).
 *
 * - traduction des paramètres `?` positionnels et `@clé` nommés → `$n` ;
 * - `RETURNING id` auto sur les INSERT → `lastInsertRowid` exposé ;
 * - `ON CONFLICT DO NOTHING` ne renvoie rien → `lastInsertRowid` undefined, `changes` 0 ;
 * - anti-fuite de connexions : 1000× `withClient` → le pool reste borné et tout est libéré.
 *
 * Nécessite une vraie base Postgres (DATABASE_URL) — fournie par le service CI.
 * Sauté proprement en l'absence de DATABASE_URL.
 */

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const { getDB, initDB } = require('../db');

d('S7 — couche pg (db.js)', () => {
  let db;

  beforeAll(async () => {
    await initDB();
    db = getDB();
  });

  afterAll(async () => {
    await db.close();
  });

  test('? positionnels + RETURNING id → lastInsertRowid number', async () => {
    const name = `PG positional ${Date.now()}-${Math.random()}`;
    const r = await db.prepare(
      'INSERT INTO products (name, brand, kcal_per100) VALUES (?, ?, ?)'
    ).run(name, 'TestBrand', 123);

    expect(r.changes).toBe(1);
    expect(typeof r.lastInsertRowid).toBe('number');

    const row = await db.prepare('SELECT name, kcal_per100 FROM products WHERE id = ?').get(r.lastInsertRowid);
    expect(row.name).toBe(name);
    expect(row.kcal_per100).toBe(123); // REAL → number (pas string)
  });

  test('@clé nommés → $n (insert et select)', async () => {
    const name = `PG named ${Date.now()}-${Math.random()}`;
    const r = await db.prepare(
      'INSERT INTO products (name, brand, kcal_per100) VALUES (@name, @brand, @kcal)'
    ).run({ name, brand: 'TestBrand', kcal: 50 });

    const row = await db.prepare('SELECT kcal_per100 FROM products WHERE id = @id').get({ id: r.lastInsertRowid });
    expect(row.kcal_per100).toBe(50);
  });

  test('ON CONFLICT DO NOTHING → lastInsertRowid undefined, changes 0', async () => {
    const barcode = `pgtest-${Date.now()}-${Math.random()}`;
    const sql = 'INSERT INTO products (barcode, name, brand, kcal_per100) VALUES (?, ?, ?, ?) ON CONFLICT (barcode) DO NOTHING';

    const first = await db.prepare(sql).run(barcode, 'First', 'B', 10);
    expect(first.changes).toBe(1);

    const dup = await db.prepare(sql).run(barcode, 'Dup', 'B', 99);
    expect(dup.changes).toBe(0);
    expect(dup.lastInsertRowid).toBeUndefined();
  });

  test('COUNT(*) renvoie un number (parser int8)', async () => {
    const row = await db.prepare('SELECT COUNT(*) AS cnt FROM dishes').get();
    expect(typeof row.cnt).toBe('number');
  });

  test('anti-fuite : 1000× withClient → pool borné et tout libéré', async () => {
    for (let i = 0; i < 1000; i++) {
      // eslint-disable-next-line no-await-in-loop
      await db.withClient((client) => client.query('SELECT 1'));
    }
    // Le pool ne dépasse jamais max (5) et aucune connexion ne reste en checkout.
    expect(db.pool.totalCount).toBeLessThanOrEqual(5);
    expect(db.pool.totalCount - db.pool.idleCount).toBe(0);
  }, 30000);
});
