import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { requestNotificationPermission, logAnalyticsEvent } from '../firebase';

// Axios base URL ayarı - Netlify functions için
const baseURL = process.env.NODE_ENV === 'production' 
  ? 'https://azik-food-exchange.onrender.com'
  : (window.REACT_APP_API_URL || 'http://localhost:5000');
axios.defaults.baseURL = baseURL;

// Axios timeout ayarları - mobil için daha uzun timeout
axios.defaults.timeout = 30000; // 30 saniye (mobil için)
axios.defaults.timeoutErrorMessage = 'İstek zaman aşımına uğradı';

// Axios interceptor for retry logic
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Retry logic for network errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout') || !error.response) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        console.log('Retrying request due to timeout or network error...');
        return axios(originalRequest);
      }
    }
    
    return Promise.reject(error);
  }
);

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/login', { email, password });
      const { token, user } = response.data;
      
      // Immediately set user and token for faster UI response
      setUser(user);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Log login event (non-blocking)
      logAnalyticsEvent('login', {
        method: 'email',
        user_id: user.id
      });
      
      // Request notification permission in background (non-blocking)
      requestNotificationPermission().then(fcmToken => {
        if (fcmToken) {
          axios.post('/api/user/fcm-token', { fcmToken }).catch(err => {
            console.log('FCM token save failed:', err);
          });
        }
      }).catch(err => {
        console.log('Notification permission failed:', err);
      });
      
      return { success: true };
    } catch (error) {
      // Check if email verification is required
      if (error.response?.data?.requiresVerification) {
        return { 
          requiresVerification: true,
          error: error.response.data.error
        };
      }
      
      return { 
        success: false, 
        error: error.response?.data?.error || 'Giriş yapılamadı' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/register', userData);
      
      // Check if email verification is required
      if (response.data.requiresVerification) {
        return { 
          requiresVerification: true,
          message: response.data.message,
          emailSent: response.data.emailSent
        };
      }
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      
      // Log register event
      logAnalyticsEvent('sign_up', {
        method: 'email',
        user_id: user.id
      });
      
      // Request notification permission and save FCM token
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) {
        await axios.post('/api/user/fcm-token', { fcmToken });
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Kayıt oluşturulamadı' 
      };
    }
  };

  const logout = () => {
    // Log logout event
    if (user) {
      logAnalyticsEvent('logout', {
        user_id: user.id
      });
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
