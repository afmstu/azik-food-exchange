import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import Header from './components/Header';
import Login from './components/Login';
import Register from './components/Register';
import EmailVerification from './components/EmailVerification';
import { AuthProvider, useAuth } from './context/AuthContext';
import { logAnalyticsEvent } from './firebase';

// Lazy loaded components
const Home = lazy(() => import('./components/Home'));
const CreateListing = lazy(() => import('./components/CreateListing'));
const MyListings = lazy(() => import('./components/MyListings'));
const MyOffers = lazy(() => import('./components/MyOffers'));
const ListingOffers = lazy(() => import('./components/ListingOffers'));
const UpdateAddress = lazy(() => import('./components/UpdateAddress'));
const Admin = lazy(() => import('./components/Admin'));

// Configure axios
axios.defaults.baseURL = 'http://localhost:5000';

// Loading component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
  </div>
);

// Page tracking component
function PageTracker() {
  const location = useLocation();
  
  useEffect(() => {
    // Log page view
    logAnalyticsEvent('page_view', {
      page_title: document.title,
      page_location: location.pathname
    });
  }, [location]);
  
  return null;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <PageTracker />
        <div className="App">
          <Toaster position="top-right" />
          <Header />
          <main className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-email" element={<EmailVerification />} />
                <Route path="/" element={<Home />} />
                <Route path="/create-listing" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
                <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
                <Route path="/my-offers" element={<ProtectedRoute><MyOffers /></ProtectedRoute>} />
                <Route path="/listing-offers" element={<ProtectedRoute><ListingOffers /></ProtectedRoute>} />
                <Route path="/update-address" element={<ProtectedRoute><UpdateAddress /></ProtectedRoute>} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

export default App;
