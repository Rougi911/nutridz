'use strict';
/**
 * P1-2 — Régression : pas de décalage de jour selon le fuseau horaire.
 *
 * Risque visé : un timestamp naïf « 2025-01-15T23:30:00 » converti via `new Date()`
 * sous un fuseau non-UTC glisse au 16 (07:30Z). On verrouille donc :
 *  - parseLibreViewCSV : parsing 100% par chaîne, AUCUNE conversion Date
 *    (prouvé en sabotant `new Date()` pendant l'appel) → jour préservé quel que soit le TZ ;
 *  - journal : date explicite préservée telle quelle ; date par défaut = jour UTC (toISOString).
 */

process.env.JWT_SECRET = 'test-secret-p1-2';

let mockDb;
jest.mock('../db', () => ({ getDB: () => mockDb }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { parseLibreViewCSV } = require('../services/glucoseMetrics');
const journalRoutes = require('../routes/journal');

const csvRow = (deviceTs, historic) =>
  [
    'Device,Serial,Device Timestamp,Record Type,Historic Glucose mg/dL,Scan Glucose mg/dL',
    `FreeStyle,123,${deviceTs},0,${historic},`,
  ].join('\n');

// ─── Glycémie : import LibreView ne décale pas le jour ────────────────────────
describe('parseLibreViewCSV — jour préservé, parsing sans Date (P1-2)', () => {
  test('ligne EU à 23:30 reste au 15 janvier', () => {
    const readings = parseLibreViewCSV(csvRow('15-01-2025 23:30', 120));
    expect(readings).toHaveLength(1);
    expect(readings[0].timestamp).toBe('2025-01-15T23:30:00');
    expect(readings[0].timestamp.slice(0, 10)).toBe('2025-01-15'); // pas de glissement au 16
  });

  test('ligne US à 11:30 PM reste au 15 janvier', () => {
    const readings = parseLibreViewCSV(csvRow('01-15-2025 11:30 PM', 140));
    expect(readings[0].timestamp).toBe('2025-01-15T23:30:00');
  });

  test('le parsing n\'utilise aucune conversion Date (donc indépendant du fuseau)', () => {
    const RealDate = global.Date;
    // Si quelqu'un réécrit le parser avec `new Date(...)`, cet appel lèvera → test rouge.
    global.Date = class {
      constructor() { throw new Error('new Date() interdit dans le parsing CSV (décalage de fuseau)'); }
    };
    try {
      const readings = parseLibreViewCSV(csvRow('15-01-2025 23:30', 120));
      expect(readings[0].timestamp).toBe('2025-01-15T23:30:00');
    } finally {
      global.Date = RealDate;
    }
  });
});

// ─── Journal : date explicite préservée, défaut = jour UTC ────────────────────
describe('POST /api/journal — date sans décalage de fuseau (P1-2)', () => {
  function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/journal', journalRoutes);
    return a;
  }
  const bearer = `Bearer ${jwt.sign({ userId: 'u1' }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

  beforeEach(() => {
    mockDb = {
      prepare: jest.fn((sql) => {
        if (/SELECT \* FROM products/i.test(sql)) {
          return { get: jest.fn().mockResolvedValue({ id: 1, kcal_per100: 100, glucides: 10, proteines: 5, lipides: 2, fibres: 1 }) };
        }
        return { run: jest.fn().mockResolvedValue({ changes: 1 }) };
      }),
    };
  });

  test('date explicite « 2025-01-15 » stockée telle quelle (pas de glissement)', async () => {
    const res = await request(app())
      .post('/api/journal')
      .set('Authorization', bearer)
      .send({ product_id: 1, grams: 100, meal_type: 'breakfast', date: '2025-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.date).toBe('2025-01-15');
  });

  test('date absente → jour UTC (toISOString), pas l\'heure locale', async () => {
    const expectedUtcDay = new Date().toISOString().split('T')[0];
    const res = await request(app())
      .post('/api/journal')
      .set('Authorization', bearer)
      .send({ product_id: 1, grams: 100, meal_type: 'breakfast' });
    expect(res.status).toBe(201);
    expect(res.body.date).toBe(expectedUtcDay);
  });
});
