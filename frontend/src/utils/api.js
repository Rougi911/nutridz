import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('nutridz-auth');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`;
    } catch {}
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nutridz-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export function calcBMR(age, weight, height, sexe) {
  if (sexe === 'h') return Math.round(88.362 + 13.397*weight + 4.799*height - 5.677*age);
  return Math.round(447.593 + 9.247*weight + 3.098*height - 4.330*age);
}
export function calcTDEE(bmr, level) {
  const f = { sed:1.2, light:1.375, mod:1.55, actif:1.725 };
  return Math.round(bmr * (f[level] || 1.375));
}
export function calcTarget(tdee, goal, pace) {
  const d = { doux:250, modere:500, rapide:750 };
  const s = { doux:200, modere:350, rapide:500 };
  if (goal==='perte') return tdee-(d[pace]||500);
  if (goal==='prise') return tdee+(s[pace]||350);
  return tdee;
}
export function calcWalkTime(kcal, sport, weightKg) {
  const m = { marche:3.5, velo:6.0, course:9.0, natation:7.0 };
  return Math.round(kcal/((m[sport]||3.5)*weightKg*3.5/200));
}
export function calcIMC(weight, height) {
  return parseFloat((weight/(height/100)**2).toFixed(1));
}
export function imcStatus(imc) {
  if (imc<18.5) return { label:'Insuffisant', color:'#185FA5' };
  if (imc<25)   return { label:'Normal',      color:'#1A6B3C' };
  if (imc<30)   return { label:'Surpoids',    color:'#BA7517' };
  return              { label:'Obésité',     color:'#993C1D' };
}
export function todayMealType() {
  const h = new Date().getHours();
  return h<10?'pdej':h<14?'dej':h<17?'coll':'diner';
}
