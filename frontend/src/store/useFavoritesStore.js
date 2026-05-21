import { create } from 'zustand';
import api from '../utils/api';

const useFavoritesStore = create((set, get) => ({
  favorites: [],
  loading: false,

  fetchFavorites: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/favorites');
      set({ favorites: res.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addFavorite: async (dishId) => {
    try {
      await api.post('/favorites', { dish_id: dishId });
      get().fetchFavorites();
    } catch (err) {
      console.error('Add favorite error:', err);
    }
  },

  removeFavorite: async (dishId) => {
    try {
      await api.delete(`/favorites/${dishId}`);
      get().fetchFavorites();
    } catch (err) {
      console.error('Remove favorite error:', err);
    }
  },

  isFavorite: (dishId) => get().favorites.some(f => f.dish_id === dishId),
}));

export default useFavoritesStore;
