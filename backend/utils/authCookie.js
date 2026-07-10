'use strict';
/**
 * P0-2 — Helpers cookie d'authentification (httpOnly + double-submit CSRF).
 *
 * Pas de dépendance cookie-parser : `res.cookie`/`res.clearCookie` sont fournis par
 * Express, et la lecture des cookies est faite par `parseCookies` (parser minimal).
 *
 * Cross-site (frontend et backend sur des domaines Render distincts) → en production
 * les cookies sont SameSite=None; Secure. En dev/test (http), SameSite=Lax; non-Secure.
 */
const crypto = require('crypto');

const TOKEN_COOKIE = 'token';
const CSRF_COOKIE = 'csrf';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 j — aligné sur l'expiration JWT (E5 ultrareview)

const isProd = () => process.env.NODE_ENV === 'production';

function baseCookieOptions() {
  return {
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  };
}

// Pose le cookie httpOnly `token` + le cookie lisible `csrf`. Retourne le token CSRF.
function setAuthCookies(res, token) {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie(TOKEN_COOKIE, token, { ...baseCookieOptions(), httpOnly: true });
  res.cookie(CSRF_COOKIE, csrfToken, { ...baseCookieOptions(), httpOnly: false });
  return csrfToken;
}

function clearAuthCookies(res) {
  res.clearCookie(TOKEN_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

// Parser minimal de l'en-tête Cookie → { name: value }
function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

module.exports = {
  TOKEN_COOKIE,
  CSRF_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  parseCookies,
};
