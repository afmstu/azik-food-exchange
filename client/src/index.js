import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

// Set axios base URL for production
if (process.env.NODE_ENV === 'production') {
  axios.defaults.baseURL = 'https://azik-food-exchange.onrender.com';
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
