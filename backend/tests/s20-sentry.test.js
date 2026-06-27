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

const { scrubEvent, initSentry, isEnabled } = require('../observability/sentry');

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
