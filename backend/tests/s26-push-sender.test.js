'use strict';
/**
 * S26 — buildReminderMessages (fonction pure : qui notifier à une heure donnée).
 * L'envoi réel (web-push + VAPID) n'est pas couvert ici.
 */
const { buildReminderMessages } = require('../services/pushSender');

const base = {
  user_id: 'u1',
  journal_enabled: false, journal_time: '20:00',
  glucose_enabled: false, glucose_time: '08:00',
  hydration_enabled: false, deficiency_enabled: false,
};

describe('S26 — buildReminderMessages', () => {
  test('journal : envoyé à l\'heure configurée, pas avant', () => {
    const rows = [{ ...base, journal_enabled: true, journal_time: '20:00' }];
    expect(buildReminderMessages(rows, '20:00').map(m => m.type)).toEqual(['journal']);
    expect(buildReminderMessages(rows, '19:59')).toEqual([]);
  });

  test('glycémie : à son heure propre', () => {
    const rows = [{ ...base, glucose_enabled: true, glucose_time: '07:30' }];
    const m = buildReminderMessages(rows, '07:30');
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe('glucose');
    expect(m[0].title).toBe('NutriVita'); // payload neutre
  });

  test('hydratation : heure fixe 14:00', () => {
    const rows = [{ ...base, hydration_enabled: true }];
    expect(buildReminderMessages(rows, '14:00').map(m => m.type)).toEqual(['hydration']);
    expect(buildReminderMessages(rows, '09:00')).toEqual([]);
  });

  test('carences : heure fixe 19:00', () => {
    const rows = [{ ...base, deficiency_enabled: true }];
    expect(buildReminderMessages(rows, '19:00').map(m => m.type)).toEqual(['deficiency']);
  });

  test('désactivé → aucun message', () => {
    expect(buildReminderMessages([base], '20:00')).toEqual([]);
    expect(buildReminderMessages([], '20:00')).toEqual([]);
  });

  test('plusieurs utilisateurs + cumul à la même minute', () => {
    const rows = [
      { ...base, user_id: 'u1', journal_enabled: true, journal_time: '20:00' },
      { ...base, user_id: 'u2', journal_enabled: true, journal_time: '20:00', glucose_enabled: true, glucose_time: '20:00' },
    ];
    const m = buildReminderMessages(rows, '20:00');
    expect(m).toHaveLength(3); // u1 journal + u2 journal + u2 glucose
    expect(m.filter(x => x.user_id === 'u2')).toHaveLength(2);
  });
});
