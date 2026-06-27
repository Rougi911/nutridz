/**
 * S20 — Observabilité backend (Sentry / Express).
 *
 * Garde-fous (impératifs, voir threads/04-OBSERVABILITE.md) :
 *  - Région **UE** : la résidence des données Sentry est déterminée par le DSN
 *    (org région EU → DSN `*.ingest.de.sentry.io`). Le DSN fourni par le proprio
 *    doit être un DSN EU. Aucune donnée ne part vers les US.
 *  - **Jamais** de donnée de santé (glycémie) ni de PII brute (email, tokens,
 *    cookies, Authorization) envoyée à Sentry → `beforeSend = scrubEvent` filtre
 *    tout champ sensible AVANT envoi.
 *  - Activé **uniquement** si `SENTRY_DSN` est présent. Sinon : no-op total,
 *    aucun crash (init renvoie false, `setupErrorHandler` ne fait rien).
 *
 * `scrubEvent` est exporté séparément (fonction pure, testable sans réseau).
 */

let Sentry = null;
let enabled = false;

// Clés considérées sensibles (comparaison insensible à la casse, en sous-chaîne).
// On préfère sur-redacter (sécurité > confort de debug) : aucune valeur de
// glycémie ni PII ne doit jamais transiter par Sentry.
const SENSITIVE_KEY_PATTERNS = [
  // PII / secrets
  'password', 'passwd', 'pwd', 'secret', 'token', 'authorization', 'auth',
  'cookie', 'csrf', 'jwt', 'bearer', 'session', 'apikey', 'api_key', 'vapid',
  'email', 'mail', 'username', 'phone', 'ip_address',
  // Données de santé (glycémie) — Art. 9 RGPD
  'glucose', 'glycemi', 'glycaemi', 'bloodsugar', 'blood_sugar',
  'mgdl', 'mg/dl', 'mmol', 'reading', 'value',
];

const REDACTED = '[Filtered]';

function isSensitiveKey(key) {
  const k = String(key).toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((p) => k.includes(p));
}

// Redacte récursivement les valeurs des clés sensibles d'un objet/tableau.
// Gère les structures cycliques via un WeakSet.
function redactDeep(node, seen) {
  if (node === null || typeof node !== 'object') return node;
  if (seen.has(node)) return node;
  seen.add(node);

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = redactDeep(node[i], seen);
    }
    return node;
  }

  for (const key of Object.keys(node)) {
    if (isSensitiveKey(key)) {
      node[key] = REDACTED;
    } else {
      node[key] = redactDeep(node[key], seen);
    }
  }
  return node;
}

/**
 * Caviarde les valeurs sensibles dans du **texte libre** (message d'exception,
 * stacktrace, ligne de code…). Parité avec le frontend (B1/B2). Le scrubbing
 * structuré (clés) ne couvre PAS ces chaînes : une glycémie, un email ou un
 * token peuvent fuiter via un message d'erreur ou une stacktrace.
 *
 * On sur-redacte volontairement (sécurité > confort de debug). Renvoie les
 * non-chaînes inchangées.
 */
function redactText(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  // Emails
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED);
  // JWT (eyJ... . ... . ...)
  out = out.replace(/\beyJ[\w-]*\.[\w-]*\.[\w-]*/g, REDACTED);
  // Bearer tokens
  out = out.replace(/\bBearer\s+[\w.\-]+/gi, `Bearer ${REDACTED}`);
  // Affectations secret/token = valeur (password=..., access_token: ...)
  out = out.replace(
    /\b(password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|token|jwt)\b\s*[:=]\s*[^\s&"']+/gi,
    `$1=${REDACTED}`,
  );
  // Glycémie : nombre suivi d'une unité (142 mg/dl, 1.42 g/l, 7,8 mmol/l)
  out = out.replace(
    /\b\d+(?:[.,]\d+)?\s*(?:mg\s*\/?\s*dl|mmol(?:\/l)?|g\/l)\b/gi,
    REDACTED,
  );
  // Glycémie : mot-clé suivi (de près) d'un nombre, même sans unité.
  // `value`/`reading` inclus pour parité avec le scrubbing structuré (clés
  // sensibles) — on sur-redacte plutôt que de laisser fuir une glycémie.
  out = out.replace(
    /\b(?:glucose|glyc[eé]mie|glyca?emi[ae]|blood[\s_]*sugar|reading|value|valeur)\b[^\d\n]{0,12}\d+(?:[.,]\d+)?/gi,
    REDACTED,
  );
  return out;
}

/**
 * Nettoie une URL : retire la query string et le fragment (peuvent contenir
 * tokens OAuth, email, codes…), puis caviarde tout résidu sensible du chemin.
 * Renvoie les non-chaînes inchangées.
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return url;
  const stripped = url.replace(/[?#][\s\S]*$/, '');
  return redactText(stripped);
}

// Redacte les paramètres sensibles d'une query string `a=1&b=2`.
function redactQueryString(qs) {
  if (typeof qs !== 'string' || qs.length === 0) return qs;
  return qs
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      const name = eq === -1 ? pair : pair.slice(0, eq);
      if (isSensitiveKey(decodeURIComponent(name))) {
        return `${name}=${REDACTED}`;
      }
      return pair;
    })
    .join('&');
}

/**
 * beforeSend Sentry : retire toute donnée sensible de l'event avant envoi.
 * Mutation en place puis retour de l'event (signature beforeSend).
 */
function scrubEvent(event) {
  if (event === null || typeof event !== 'object') return event;
  const seen = new WeakSet();

  // --- Texte libre : message, logentry, exceptions, stacktraces ---
  if (typeof event.message === 'string') {
    event.message = redactText(event.message);
  } else if (event.message && typeof event.message === 'object') {
    if (typeof event.message.formatted === 'string') {
      event.message.formatted = redactText(event.message.formatted);
    }
    if (typeof event.message.message === 'string') {
      event.message.message = redactText(event.message.message);
    }
  }

  if (event.logentry && typeof event.logentry === 'object') {
    if (typeof event.logentry.message === 'string') {
      event.logentry.message = redactText(event.logentry.message);
    }
    if (typeof event.logentry.formatted === 'string') {
      event.logentry.formatted = redactText(event.logentry.formatted);
    }
  }

  if (event.exception && Array.isArray(event.exception.values)) {
    for (const exc of event.exception.values) {
      if (!exc || typeof exc !== 'object') continue;
      if (typeof exc.value === 'string') exc.value = redactText(exc.value);
      if (exc.stacktrace && Array.isArray(exc.stacktrace.frames)) {
        for (const frame of exc.stacktrace.frames) {
          if (!frame || typeof frame !== 'object') continue;
          if (typeof frame.context_line === 'string') {
            frame.context_line = redactText(frame.context_line);
          }
          if (Array.isArray(frame.pre_context)) {
            frame.pre_context = frame.pre_context.map((l) =>
              (typeof l === 'string' ? redactText(l) : l));
          }
          if (Array.isArray(frame.post_context)) {
            frame.post_context = frame.post_context.map((l) =>
              (typeof l === 'string' ? redactText(l) : l));
          }
        }
      }
    }
  }

  if (event.request && typeof event.request === 'object') {
    const req = event.request;
    if (typeof req.url === 'string') req.url = sanitizeUrl(req.url);
    if (req.headers && typeof req.headers === 'object') {
      for (const h of Object.keys(req.headers)) {
        if (isSensitiveKey(h)) req.headers[h] = REDACTED;
      }
    }
    if (req.cookies !== undefined) req.cookies = REDACTED;
    if (req.query_string !== undefined) {
      req.query_string = redactQueryString(req.query_string);
    }
    if (req.data !== undefined) req.data = redactDeep(req.data, seen);
  }

  if (event.user && typeof event.user === 'object') {
    // On conserve l'id interne (utile au debug, non-PII) ; on retire le reste.
    event.user = { id: event.user.id };
    if (event.user.id === undefined) delete event.user.id;
  }

  if (event.extra !== undefined) event.extra = redactDeep(event.extra, seen);
  if (event.contexts !== undefined) event.contexts = redactDeep(event.contexts, seen);

  return event;
}

/**
 * Initialise Sentry uniquement si SENTRY_DSN est défini. Renvoie true si activé.
 * Aucun crash si le DSN est absent ou si le SDK échoue à charger.
 */
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    enabled = false;
    return false;
  }
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn, // DSN EU (résidence des données UE) — fourni par le proprio
      environment: process.env.NODE_ENV || 'development',
      // Pas de tracing/profiling par défaut (coût + surface de données).
      tracesSampleRate: 0,
      // Ne pas capter les valeurs de variables locales (peuvent contenir glycémie/PII).
      includeLocalVariables: false,
      // Filtre final : retire toute donnée sensible avant envoi réseau.
      beforeSend: scrubEvent,
    });
    enabled = true;
    return true;
  } catch (err) {
    // Échec d'init (SDK absent, DSN invalide…) → on continue sans observabilité.
    console.error('[sentry] init échouée, observabilité désactivée:', err.message);
    enabled = false;
    return false;
  }
}

/**
 * Monte le handler d'erreurs Express de Sentry (capture des erreurs de routes).
 * No-op si Sentry n'est pas activé. À appeler APRÈS les routes, AVANT le handler
 * d'erreurs applicatif final.
 */
function setupErrorHandler(app) {
  if (!enabled || !Sentry) return;
  Sentry.setupExpressErrorHandler(app);
}

function isEnabled() {
  return enabled;
}

module.exports = {
  scrubEvent,
  redactText,
  sanitizeUrl,
  initSentry,
  setupErrorHandler,
  isEnabled,
};
