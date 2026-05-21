import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import { LanguageProvider } from './i18n';
import { ThemeProvider } from './contexts/ThemeContext';
import { SkeletonCard, SkeletonLine } from './components/Skeleton';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Layout from './components/Layout';
import JournalPage from './pages/JournalPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ProfilePage from './pages/ProfilePage';
import HistoryPage from './pages/HistoryPage';
import FoodVisionPage from './pages/FoodVisionPage';
import ScannerPage from './pages/ScannerPage';
import DishesPage from './pages/DishesPage';
import PrivacyPage from './pages/PrivacyPage';
import LegalPage from './pages/LegalPage';

const BilanPage          = lazy(() => import('./pages/BilanPage'));
const GlucoseTrackingPage = lazy(() => import('./pages/GlucoseTrackingPage'));
const DishDetailPage     = lazy(() => import('./pages/DishDetailPage'));

const PageLoader = () => (
  <div style={{ padding: '1rem' }}>
    <SkeletonCard>
      <SkeletonLine width="60%" height="2rem" style={{ marginBottom: '1rem' }} />
      <SkeletonLine />
      <SkeletonLine style={{ marginTop: '0.5rem' }} />
    </SkeletonCard>
  </div>
);

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const initAuth = useAuthStore(s => s.initAuth);

  useEffect(() => { initAuth(); }, [initAuth]);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/confidentialite" element={<PrivacyPage />} />
              <Route path="/mentions-legales" element={<LegalPage />} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Navigate to="/journal" replace />} />
                <Route path="journal" element={<JournalPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="products/:id" element={<ProductDetailPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="scanner" element={<ScannerPage />} />
                <Route path="vision" element={<FoodVisionPage />} />
                <Route path="dishes" element={<DishesPage />} />
                <Route path="dishes/:id" element={<DishDetailPage />} />
                <Route path="bilan" element={<BilanPage />} />
                <Route path="glucose" element={<GlucoseTrackingPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
