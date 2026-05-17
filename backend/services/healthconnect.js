const axios = require('axios');

const GOOGLE_FIT_BASE = 'https://www.googleapis.com/fitness/v1/users/me';

function stepsToCalories(steps) {
  return Math.round(steps * 0.04);
}

function getGoogleFitAuthUrl(state = '') {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_FIT_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_FIT_REDIRECT_URI,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.body.read',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function getTodayStepsAndCalories(accessToken) {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const body = {
    aggregateBy: [
      { dataTypeName: 'com.google.step_count.delta' },
      { dataTypeName: 'com.google.calories.expended' },
    ],
    bucketByTime: { durationMillis: 86400000 },
    startTimeMillis: startOfDay.getTime(),
    endTimeMillis: now,
  };

  try {
    const { data } = await axios.post(`${GOOGLE_FIT_BASE}/dataset:aggregate`, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let steps = 0;
    let caloriesFit = 0;

    for (const bucket of data.bucket || []) {
      for (const ds of bucket.dataset || []) {
        for (const point of ds.point || []) {
          if (ds.dataSourceId.includes('step_count')) {
            steps += point.value?.[0]?.intVal || 0;
          } else if (ds.dataSourceId.includes('calories')) {
            caloriesFit += point.value?.[0]?.fpVal || 0;
          }
        }
      }
    }

    const caloriesFromSteps = stepsToCalories(steps);
    const caloriesFromFit = Math.round(caloriesFit);

    return {
      steps,
      calories_from_steps: caloriesFromSteps,
      calories_from_fit: caloriesFromFit,
      total_calories: caloriesFromFit || caloriesFromSteps,
    };
  } catch {
    return { steps: 0, calories_from_steps: 0, calories_from_fit: 0, total_calories: 0 };
  }
}

module.exports = { stepsToCalories, getGoogleFitAuthUrl, getTodayStepsAndCalories };
