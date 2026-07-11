const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');

const STRAVA_BASE = 'https://www.strava.com/api/v3';

// E2 (ultrareview) — state OAuth signé anti-CSRF, partagé par les deux flux Strava
// (routes/strava.js ET l'ancien routes/activity.js ciblé par STRAVA_REDIRECT_URI).
// Un JWT court (10 min) lie le flux à l'utilisateur : un attaquant ne peut pas forger
// un state valide pour lier son compte Strava au profil d'un tiers.
const STATE_TYPE = 'strava_oauth';
const STATE_TTL = '10m';

function signState(userId) {
  return jwt.sign({ uid: userId, t: STATE_TYPE }, process.env.JWT_SECRET, { expiresIn: STATE_TTL });
}

function verifyState(state) {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.t !== STATE_TYPE) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

function getAuthUrl(state = '') {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: process.env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

async function exchangeCode(code) {
  const { data } = await axios.post('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });
  return data;
}

async function refreshStravaToken(refreshToken) {
  const { data } = await axios.post('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return data;
}

async function getValidToken(userId) {
  const db = getDB();
  const profile = await db.prepare(
    'SELECT strava_access_token, strava_refresh_token, strava_token_expires_at FROM profiles WHERE user_id = ?'
  ).get(userId);

  if (!profile?.strava_access_token) return null;

  const now = Math.floor(Date.now() / 1000);
  if (profile.strava_token_expires_at > now + 60) {
    return profile.strava_access_token;
  }

  const refreshed = await refreshStravaToken(profile.strava_refresh_token);
  await db.prepare(`
    UPDATE profiles SET
      strava_access_token = ?,
      strava_refresh_token = ?,
      strava_token_expires_at = ?
    WHERE user_id = ?
  `).run(refreshed.access_token, refreshed.refresh_token, refreshed.expires_at, userId);

  return refreshed.access_token;
}

async function getTodayActivities(userId) {
  const token = await getValidToken(userId);
  if (!token) return { connected: false, activities: [] };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const after = Math.floor(startOfDay.getTime() / 1000);

  const { data } = await axios.get(`${STRAVA_BASE}/athlete/activities`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { after, per_page: 20 },
  });

  return {
    connected: true,
    activities: data.map(a => ({
      strava_id: String(a.id),
      type: mapStravaType(a.sport_type || a.type),
      duration_min: Math.round((a.moving_time || 0) / 60),
      distance_km: a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : 0,
      calories_burned: a.kilojoules
        ? Math.round(a.kilojoules * 0.239)
        : (a.calories || 0),
      name: a.name,
      source: 'strava',
    })),
  };
}

function mapStravaType(type) {
  const map = {
    Run: 'course', Ride: 'velo', Swim: 'natation',
    Walk: 'marche', WeightTraining: 'muscu', Workout: 'muscu',
    Hike: 'marche', VirtualRide: 'velo', VirtualRun: 'course',
  };
  return map[type] || 'marche';
}

async function getActivityById(activityId, accessToken) {
  try {
    const { data } = await axios.get(`${STRAVA_BASE}/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });
    return data;
  } catch (err) {
    console.error(`[Strava] getActivityById(${activityId}) failed:`, err.message);
    return null;
  }
}

module.exports = { getAuthUrl, exchangeCode, getValidToken, getTodayActivities, mapStravaType, getActivityById, signState, verifyState };
