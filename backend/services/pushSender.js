'use strict';
// S26 — Envoi des rappels Web Push. Gardé : no-op si les clés VAPID ne sont pas configurées
// (le serveur démarre normalement sans). Payload NEUTRE (titre/corps/url) — aucune donnée de
// santé (REG-05). `web-push` est requis paresseusement pour ne pas casser le boot si absent.

function isPushEnabled() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let _wp = null;
let _wpTried = false;
function getWebPush() {
  if (_wpTried) return _wp;
  _wpTried = true;
  try {
    const webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:contact@nutrivita.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    _wp = webpush;
  } catch (e) {
    console.error('[pushSender] web-push indisponible:', e.message);
    _wp = null;
  }
  return _wp;
}

// Messages neutres par type (FR). Heures : journal/glycémie configurables par l'utilisateur ;
// hydratation 14:00 et carences 19:00 (fixes en v1 — modulation météo/horaire = évolution).
const FIXED = { hydration: '14:00', deficiency: '19:00' };

// PURE — pour un lot de préférences et une heure "HH:MM", renvoie les rappels à envoyer.
function buildReminderMessages(prefsRows, hhmm) {
  const out = [];
  for (const p of prefsRows || []) {
    if (p.journal_enabled && p.journal_time === hhmm) {
      out.push({ user_id: p.user_id, type: 'journal', title: 'NutriVita', body: 'Prends 5 min pour remplir ton journal du jour.', url: '/journal' });
    }
    if (p.glucose_enabled && p.glucose_time === hhmm) {
      out.push({ user_id: p.user_id, type: 'glucose', title: 'NutriVita', body: "C'est le moment de noter ta glycémie.", url: '/' });
    }
    if (p.hydration_enabled && hhmm === FIXED.hydration) {
      out.push({ user_id: p.user_id, type: 'hydration', title: 'NutriVita', body: "Pense à t'hydrater.", url: '/' });
    }
    if (p.deficiency_enabled && hhmm === FIXED.deficiency) {
      out.push({ user_id: p.user_id, type: 'deficiency', title: 'NutriVita', body: 'Des aliments de saison pour varier tes apports.', url: '/bilan' });
    }
  }
  return out;
}

// Envoie les rappels dus à l'instant `now`. No-op sans VAPID / sans web-push.
async function sendDueReminders(db, now = new Date()) {
  if (!isPushEnabled()) return { sent: 0, skipped: 'no-vapid' };
  const wp = getWebPush();
  if (!wp) return { sent: 0, skipped: 'no-web-push' };

  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const prefs = await db.prepare(
    'SELECT * FROM notification_prefs WHERE journal_enabled OR glucose_enabled OR hydration_enabled OR deficiency_enabled'
  ).all();

  const messages = buildReminderMessages(prefs, hhmm);
  let sent = 0;
  for (const m of messages) {
    const subs = await db.prepare('SELECT subscription_json FROM push_subscriptions WHERE user_id = ?').all(m.user_id);
    for (const s of subs) {
      try {
        await wp.sendNotification(
          JSON.parse(s.subscription_json),
          JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.type })
        );
        sent++;
      } catch (err) {
        // 404/410 = abonnement expiré → on le purge.
        if (err && (err.statusCode === 410 || err.statusCode === 404)) {
          try { await db.prepare('DELETE FROM push_subscriptions WHERE subscription_json = ?').run(s.subscription_json); } catch (_) {}
        } else {
          console.error('[pushSender] envoi échoué:', err && err.message);
        }
      }
    }
  }
  return { sent };
}

module.exports = { isPushEnabled, buildReminderMessages, sendDueReminders, FIXED };
