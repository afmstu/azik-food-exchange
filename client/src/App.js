import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

// Components
import Header from './components/Header';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import CreateListing from './components/CreateListing';
import MyListings from './components/MyListings';
import MyOffers from './components/MyOffers';
import ListingOffers from './components/ListingOffers';
import UpdateAddress from './components/UpdateAddress';
import EmailVerification from './components/EmailVerification';
import Admin from './components/Admin';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Configure axios
axios.defaults.baseURL = 'http://localhost:5000';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster position="top-right" />
          <Header />
          <main className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
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
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            </Routes>
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
