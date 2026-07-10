import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// L (ultrareview) : URL de prod réelle (le backend Render). En dev, surchargez via la
// variable d'env Expo EXPO_PUBLIC_API_URL (ex: http://192.168.1.42:3001/api) pour pointer
// vers votre IP locale — l'ancien placeholder '192.168.1.X'/'api.nutridz.dz' était injoignable.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? 'http://localhost:3001/api' : 'https://nutridz-api.onrender.com/api');

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// Injecter le token JWT automatiquement
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('nutridz_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gérer l'expiration du token
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('nutridz_token');
      // Rediriger vers login (à implémenter selon la navigation)
    }
    return Promise.reject(err);
  }
);

export default api;
