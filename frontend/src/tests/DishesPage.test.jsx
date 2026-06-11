import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import DishesPage from '../pages/DishesPage';
import api from '../utils/api';

const MOCK_DISHES = [
  { id: 1, name: 'Couscous',      emoji: '🫕', cuisine: 'Maghreb',   kcal_per_portion: 450 },
  { id: 2, name: 'Pizza',         emoji: '🍕', cuisine: 'Italienne', kcal_per_portion: 280 },
  { id: 3, name: 'Tarte flambée', emoji: '🥘', cuisine: 'Française', kcal_per_portion: 320 },
];

const MOCK_PRODUCTS = [
  { id: 10, name: 'Lait entier',   calories_per_100g: 61,  brand: 'Candia'    },
  { id: 11, name: 'Yaourt nature', calories_per_100g: 59,  brand: 'Danone'    },
  { id: 12, name: 'Beurre doux',   calories_per_100g: 745, brand: 'Président' },
];

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:  jest.fn(),
    post: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    defaults: { headers: { common: {} } },
  },
}));

jest.mock('../store/useFavoritesStore', () => () => ({
  favorites: [],
  fetchFavorites: jest.fn(),
  isFavorite: () => false,
}));

beforeEach(() => {
  api.get.mockImplementation((url) => {
    if (url.includes('cuisines')) return Promise.resolve({ data: [] });
    if (url.includes('products')) return Promise.resolve({ data: MOCK_PRODUCTS });
    if (url.includes('favorites')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: MOCK_DISHES });
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('DishesPage (REG-06b)', () => {
  test('dishes load and display on initial render', async () => {
    renderWithProviders(<DishesPage />);
    await waitFor(() => {
      expect(screen.getByText('Couscous')).toBeInTheDocument();
    });
    expect(screen.getByText('Pizza')).toBeInTheDocument();
  });

  test('Produits filter tab loads and displays products', async () => {
    renderWithProviders(<DishesPage />);
    await waitFor(() => screen.getByText('Couscous'));

    const produitsBtn = screen.getByRole('button', { name: /produits/i });
    userEvent.click(produitsBtn);

    await waitFor(() => {
      expect(screen.getByText('Lait entier')).toBeInTheDocument();
    });
    expect(screen.getByText('Yaourt nature')).toBeInTheDocument();
    expect(screen.getByText('Beurre doux')).toBeInTheDocument();
  });

  test('search filters the displayed items', async () => {
    renderWithProviders(<DishesPage />);
    await waitFor(() => screen.getByText('Couscous'));

    const searchInput = screen.getByPlaceholderText(/recherch/i);
    await userEvent.type(searchInput, 'cous');

    await waitFor(() => {
      expect(screen.getByText('Couscous')).toBeInTheDocument();
      expect(screen.queryByText('Pizza')).not.toBeInTheDocument();
    });
  });
});
