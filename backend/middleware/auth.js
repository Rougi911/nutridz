const jwt = require('jsonwebtoken');
const { parseCookies, TOKEN_COOKIE, CSRF_COOKIE } = require('../utils/authCookie');

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function authMiddleware(req, res, next) {
  // 1. Source du token : header Bearer (prioritaire) puis cookie httpOnly (P0-2)
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  let viaCookie = false;
  let cookies = null;

  if (!token) {
    cookies = parseCookies(req);
    if (cookies[TOKEN_COOKIE]) {
      token = cookies[TOKEN_COOKIE];
      viaCookie = true;
    }
  }

  if (!token) return res.status(401).json({ error: 'Token manquant' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Token invalide' });
  }

  // 2. CSRF (double-submit) — uniquement si authentifié PAR COOKIE et méthode mutante.
  //    Les requêtes Bearer sont immunisées (un attaquant ne peut pas forger l'en-tête
  //    Authorization en cross-site) → aucune régression pour le frontend actuel.
  if (viaCookie && UNSAFE_METHODS.has(req.method)) {
    if (!cookies) cookies = parseCookies(req);
    const headerToken = req.headers['x-csrf-token'];
    if (!headerToken || !cookies[CSRF_COOKIE] || headerToken !== cookies[CSRF_COOKIE]) {
      return res.status(403).json({ error: 'CSRF token invalide' });
    }
  }

  req.userId = decoded.userId;
  next();
}

module.exports = authMiddleware;
