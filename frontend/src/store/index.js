import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

// ─── Auth Store ───────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ token: data.token, user: data.user, isAuthenticated: true });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data;
      },

      register: async (name, email, password) => {
        const { data } = await api.post('/auth/register', { name, email, password });
        set({ token: data.token, user: data.user, isAuthenticated: true });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data;
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
        delete api.defaults.headers.common['Authorization'];
      },

      initAuth: () => {
        const { token } = get();
        if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    }),
    { name: 'nutridz-auth', partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);

// ─── Profile Store ────────────────────────────────────────────────────────────
export const useProfileStore = create(
  persist(
    (set) => ({
      profile: {
        age: 30, weight: 70, height: 170, sexe: 'h',
        activity_level: 'light', sport: 'marche',
        goal: 'maintien', pace: 'modere',
        bmr: 1680, tdee: 2310, target_kcal: 2310, imc: 24.2
      },

      fetchProfile: async () => {
        try {
          const { data } = await api.get('/profile');
          set({ profile: data });
        } catch (e) { console.error(e); }
      },

      updateProfile: async (updates) => {
        const { data } = await api.put('/profile', updates);
        set({ profile: data });
        return data;
      },

      setProfileLocal: (updates) => set(s => ({ profile: { ...s.profile, ...updates } }))
    }),
    { name: 'nutridz-profile' }
  )
);

// ─── Journal Store ────────────────────────────────────────────────────────────
export const useJournalStore = create((set, get) => ({
  date: new Date().toISOString().split('T')[0],
  meals: { pdej: [], dej: [], coll: [], diner: [] },
  totals: { kcal: 0, glucides: 0, proteines: 0, lipides: 0, fibres: 0 },
  loading: false,
  history: [],

  setDate: (date) => { set({ date }); get().fetchJournal(date); },

  fetchJournal: async (date) => {
    set({ loading: true });
    try {
      const d = date || get().date;
      const { data } = await api.get(`/journal?date=${d}`);
      set({ meals: data.meals, totals: data.totals, loading: false });
    } catch { set({ loading: false }); }
  },

  addEntry: async (productId, grams, mealType, date) => {
    const { data } = await api.post('/journal', {
      product_id: productId, grams, meal_type: mealType,
      date: date || get().date
    });
    await get().fetchJournal();
    return data;
  },

  removeEntry: async (entryId) => {
    await api.delete(`/journal/${entryId}`);
    await get().fetchJournal();
  },

  fetchHistory: async (days = 7) => {
    const { data } = await api.get(`/journal/history?days=${days}`);
    set({ history: data });
  }
}));

// ─── Activity Store ───────────────────────────────────────────────────────────
export const useActivityStore = create((set, get) => ({
  bilan: null,
  weeklyStats: null,
  monthlyStats: null,
  loading: false,
  stravaConnected: false,

  fetchBilan: async (date) => {
    set({ loading: true });
    try {
      const d = date || new Date().toISOString().split('T')[0];
      const { data } = await api.get(`/activity/bilan/${d}`);
      set({ bilan: data, loading: false });
    } catch { set({ loading: false }); }
  },

  addActivity: async (activity) => {
    const { data } = await api.post('/activity/manual', activity);
    const d = activity.date || new Date().toISOString().split('T')[0];
    await get().fetchBilan(d);
    return data;
  },

  fetchStravaToday: async () => {
    try {
      const { data } = await api.get('/activity/strava/today');
      set({ stravaConnected: data.connected });
      if (data.connected) {
        const d = new Date().toISOString().split('T')[0];
        await get().fetchBilan(d);
      }
      return data;
    } catch { return { connected: false, activities: [] }; }
  },

  getStravaAuthUrl: async () => {
    const { data } = await api.get('/activity/strava/auth');
    return data.url;
  },

  fetchWeeklyStats: async () => {
    try {
      const { data } = await api.get('/activity/stats/weekly');
      set({ weeklyStats: data });
    } catch { /* silent fail — stats are non-critical */ }
  },

  fetchMonthlyStats: async (year, month) => {
    try {
      const { data } = await api.get(`/activity/stats/monthly?year=${year}&month=${month}`);
      set({ monthlyStats: data });
    } catch { /* silent */ }
  },
}));

// ─── Products Store ───────────────────────────────────────────────────────────
export const useProductsStore = create((set) => ({
  products: [],
  total: 0,
  loading: false,
  selectedProduct: null,

  fetchProducts: async (q = '', category = '', page = 1) => {
    set({ loading: true });
    try {
      const { data } = await api.get(`/products?q=${q}&category=${category}&page=${page}`);
      set({ products: data.products, total: data.total, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchProduct: async (id) => {
    const { data } = await api.get(`/products/${id}`);
    set({ selectedProduct: data });
    return data;
  },

  setSelected: (product) => set({ selectedProduct: product }),
  clearSelected: () => set({ selectedProduct: null })
}));
