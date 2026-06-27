/**
 * Tests — S20 Observabilité (Sentry backend)
 *
 * Deux exigences vérifiées :
 *  1. `scrubEvent` (beforeSend) exclut TOUTE donnée sensible avant envoi :
 *     - valeurs de glycémie (données de santé Art. 9 RGPD)
 *     - PII : email, mots de passe, tokens, cookies, en-tête Authorization
 *  2. Sentry se désactive proprement si `SENTRY_DSN` est absent (aucun crash).
 *
 * `scrubEvent` est une fonction pure → testée sans le SDK ni appel réseau.
 */

const {
  scrubEvent,
  initSentry,
  isEnabled,
  redactText,
  sanitizeUrl,
} = require('../observability/sentry');

describe('S20b — redactText : caviardage du texte libre', () => {
  test('caviarde une valeur de glycémie avec unité mg/dl', () => {
    const out = redactText('Erreur insertion glucose 142 mg/dl pour user');
    expect(out).not.toContain('142');
    expect(out).toContain('[Filtered]');
  });

  test('caviarde une glycémie en g/l (décimale)', () => {
    const out = redactText('glycémie 1.42 g/l au réveil');
    expect(out).not.toContain('1.42');
  });

  test('caviarde une glycémie mmol/l', () => {
    const out = redactText('reading 7,8 mmol/l');
    expect(out).not.toContain('7,8');
  });

  test('caviarde un mot-clé glycémie suivi d\'un nombre sans unité', () => {
    const out = redactText('glucose value is 200 critical');
    expect(out).not.toContain('200');
  });

  test('caviarde un email', () => {
    const out = redactText('login failed for user@example.com');
    expect(out).not.toContain('user@example.com');
    expect(out).toContain('[Filtered]');
  });

  test('caviarde un JWT et un Bearer token', () => {
    const out = redactText('header Bearer eyJabc.eyJdef.sigGHI rejected');
    expect(out).not.toContain('eyJabc.eyJdef.sigGHI');
  });

  test('caviarde une affectation token=...', () => {
    const out = redactText('failed with access_token=secretXYZ123 invalid');
    expect(out).not.toContain('secretXYZ123');
  });

  test('préserve un texte non sensible (et un code HTTP)', () => {
    const out = redactText('Connexion à la base échouée, code 500');
    expect(out).toBe('Connexion à la base échouée, code 500');
  });

  test('renvoie les non-chaînes inchangées', () => {
    expect(redactText(null)).toBeNull();
    expect(redactText(undefined)).toBeUndefined();
    expect(redactText(42)).toBe(42);
  });
});

describe('S20b — sanitizeUrl : nettoyage des URL', () => {
  test('retire la query string contenant un token OAuth', () => {
    const url =
      'https://nutridz.onrender.com/api/activity/strava/callback?code=abc123&state=42&access_token=xyzTok';
    const out = sanitizeUrl(url);
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('xyzTok');
    expect(out).not.toContain('?');
    expect(out).toBe('https://nutridz.onrender.com/api/activity/strava/callback');
  });

  test('retire le fragment', () => {
    expect(sanitizeUrl('https://x.co/page#token=abc')).toBe('https://x.co/page');
  });

  test('laisse une URL sans query inchangée', () => {
    expect(sanitizeUrl('/api/glucose')).toBe('/api/glucose');
  });

  test('renvoie les non-chaînes inchangées', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });
});

describe('S20b — scrubEvent : caviardage du texte libre & des URL', () => {
  test('caviarde une glycémie dans event.message', () => {
    const out = scrubEvent({ message: 'POST /api/glucose failed value 142 mg/dl' });
    expect(out.message).not.toContain('142');
    expect(out.message).toContain('[Filtered]');
  });

  test('caviarde event.logentry.message et .formatted', () => {
    const out = scrubEvent({
      logentry: { message: 'glucose 99 mg/dl', formatted: 'glucose 99 mg/dl' },
    });
    expect(out.logentry.message).not.toContain('99');
    expect(out.logentry.formatted).not.toContain('99');
  });

  test('caviarde la value des exceptions', () => {
    const out = scrubEvent({
      exception: {
        values: [
          { type: 'Error', value: 'insert glycémie 1.55 g/l for user@example.com failed' },
        ],
      },
    });
    expect(out.exception.values[0].value).not.toContain('1.55');
    expect(out.exception.values[0].value).not.toContain('user@example.com');
  });

  test('caviarde les lignes de contexte des stacktraces', () => {
    const out = scrubEvent({
      exception: {
        values: [
          {
            type: 'Error',
            value: 'fail',
            stacktrace: {
              frames: [
                {
                  filename: 'glucose.js',
                  context_line: "  const value = 142; // mg/dl",
                  pre_context: ['const email = "a@b.co";'],
                  post_context: ['Bearer eyJa.eyJb.sigC'],
                },
              ],
            },
          },
        ],
      },
    });
    const f = out.exception.values[0].stacktrace.frames[0];
    expect(f.context_line).not.toContain('142');
    expect(f.pre_context[0]).not.toContain('a@b.co');
    expect(f.post_context[0]).not.toContain('eyJa.eyJb.sigC');
  });

  test('nettoie event.request.url (token OAuth)', () => {
    const out = scrubEvent({
      request: { url: 'https://x.co/cb?code=abc123&access_token=xyzTok' },
    });
    expect(out.request.url).not.toContain('abc123');
    expect(out.request.url).not.toContain('xyzTok');
    expect(out.request.url).toBe('https://x.co/cb');
  });

  test('non-régression : le scrubbing structuré existant reste actif', () => {
    const out = scrubEvent({
      message: 'ok',
      request: {
        url: '/api/glucose?value=142',
        headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
        data: { glucose: 99, email: 'user@example.com', note: 'ok' },
      },
      user: { id: 7, email: 'user@example.com' },
      extra: { password: 'x', safe: 1 },
    });
    expect(out.request.headers.authorization).toBe('[Filtered]');
    expect(out.request.headers['content-type']).toBe('application/json');
    expect(out.request.data.glucose).toBe('[Filtered]');
    expect(out.request.data.email).toBe('[Filtered]');
    expect(out.request.data.note).toBe('ok');
    expect(out.user.email).toBeUndefined();
    expect(out.user.id).toBe(7);
    expect(out.extra.password).toBe('[Filtered]');
    expect(out.extra.safe).toBe(1);
    // url nettoyée (query retirée)
    expect(out.request.url).toBe('/api/glucose');
  });
});

describe('S20 — scrubEvent (beforeSend) : exclusion des données sensibles', () => {
  test('redacte les valeurs de glycémie dans le corps de requête', () => {
    const event = {
      request: {
        method: 'POST',
        url: '/api/glucose',
        data: { value: 142, unit: 'mg/dl', mealType: 'fasting', timestamp: '2026-06-27' },
      },
    };
    const out = scrubEvent(event);
    expect(out.request.data.value).toBe('[Filtered]');
    expect(out.request.data.unit).toBe('mg/dl'); // l'unité n'est pas une donnée de santé
    // aucune valeur numérique de glycémie ne doit subsister
    expect(JSON.stringify(out)).not.toContain('142');
  });

  test('redacte les champs glucose/glycemie quel que soit leur nom', () => {
    const event = {
      request: {
        data: { glucose: 99, glycemie: 1.1, bloodSugar: 80, reading: 200 },
      },
    };
    const out = scrubEvent(event);
    expect(out.request.data.glucose).toBe('[Filtered]');
    expect(out.request.data.glycemie).toBe('[Filtered]');
    expect(out.request.data.bloodSugar).toBe('[Filtered]');
    expect(out.request.data.reading).toBe('[Filtered]');
  });

  test('redacte email / mot de passe / tokens (y compris imbriqués)', () => {
    const event = {
      request: {
        data: {
          email: 'user@example.com',
          password: 'hunter2',
          token: 'abc.def.ghi',
          nested: { refresh_token: 'r', access_token: 'a', csrfToken: 'c' },
        },
      },
    };
    const out = scrubEvent(event);
    expect(out.request.data.email).toBe('[Filtered]');
    expect(out.request.data.password).toBe('[Filtered]');
    expect(out.request.data.token).toBe('[Filtered]');
    expect(out.request.data.nested.refresh_token).toBe('[Filtered]');
    expect(out.request.data.nested.access_token).toBe('[Filtered]');
    expect(out.request.data.nested.csrfToken).toBe('[Filtered]');
    expect(JSON.stringify(out)).not.toContain('user@example.com');
    expect(JSON.stringify(out)).not.toContain('hunter2');
  });

  test('supprime les en-têtes Authorization / Cookie / X-CSRF-Token', () => {
    const event = {
      request: {
        headers: {
          authorization: 'Bearer secrettoken',
          Cookie: 'token=xyz; csrf=abc',
          'x-csrf-token': 'abc',
          'content-type': 'application/json',
        },
        cookies: { token: 'xyz' },
      },
    };
    const out = scrubEvent(event);
    expect(out.request.headers.authorization).toBe('[Filtered]');
    expect(out.request.headers.Cookie).toBe('[Filtered]');
    expect(out.request.headers['x-csrf-token']).toBe('[Filtered]');
    expect(out.request.headers['content-type']).toBe('application/json'); // non sensible
    expect(out.request.cookies).toBe('[Filtered]');
    expect(JSON.stringify(out)).not.toContain('secrettoken');
    expect(JSON.stringify(out)).not.toContain('xyz');
  });

  test('redacte la query string sensible', () => {
    const event = {
      request: { query_string: 'token=abc&q=cafe&email=a@b.co' },
    };
    const out = scrubEvent(event);
    expect(out.request.query_string).not.toContain('abc');
    expect(out.request.query_string).not.toContain('a@b.co');
    expect(out.request.query_string).toContain('q=cafe'); // non sensible conservé
  });

  test('retire les PII de event.user mais conserve l\'id interne', () => {
    const event = {
      user: { id: 42, email: 'user@example.com', username: 'jdoe', ip_address: '1.2.3.4' },
    };
    const out = scrubEvent(event);
    expect(out.user.id).toBe(42);
    expect(out.user.email).toBeUndefined();
    expect(out.user.username).toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();
  });

  test('scrub aussi event.extra et event.contexts', () => {
    const event = {
      extra: { password: 'x', glucoseValue: 130, note: 'ok' },
      contexts: { custom: { email: 'a@b.co', safe: 1 } },
    };
    const out = scrubEvent(event);
    expect(out.extra.password).toBe('[Filtered]');
    expect(out.extra.glucoseValue).toBe('[Filtered]');
    expect(out.extra.note).toBe('ok');
    expect(out.contexts.custom.email).toBe('[Filtered]');
    expect(out.contexts.custom.safe).toBe(1);
  });

  test('ne crashe pas sur un event vide ou partiel', () => {
    expect(() => scrubEvent({})).not.toThrow();
    expect(() => scrubEvent({ request: {} })).not.toThrow();
    expect(scrubEvent(null)).toBeNull();
  });

  test('gère les structures cycliques sans boucle infinie', () => {
    const event = { request: { data: {} } };
    event.request.data.self = event.request.data; // cycle
    event.request.data.password = 'x';
    const out = scrubEvent(event);
    expect(out.request.data.password).toBe('[Filtered]');
  });
});

describe('S20 — initSentry : désactivation propre sans DSN', () => {
  const ORIGINAL = process.env.SENTRY_DSN;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = ORIGINAL;
  });

  test('sans SENTRY_DSN : initSentry() renvoie false, aucun crash', () => {
    delete process.env.SENTRY_DSN;
    let result;
    expect(() => { result = initSentry(); }).not.toThrow();
    expect(result).toBe(false);
    expect(isEnabled()).toBe(false);
  });

  test('SENTRY_DSN vide : traité comme absent', () => {
    process.env.SENTRY_DSN = '';
    expect(initSentry()).toBe(false);
  });
});
