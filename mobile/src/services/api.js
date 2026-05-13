import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Remplacez par l'URL de votre API en production
const BASE_URL = __DEV__
  ? 'http://192.168.1.X:3001/api'  // ← Remplacer par votre IP locale en dev
  : 'https://api.nutridz.dz/api';  // ← URL de production

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
