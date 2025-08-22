import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAnalytics, logEvent } from 'firebase/analytics';

// Firebase config - azik-food-exchange projesi için
const firebaseConfig = {
  apiKey: "AIzaSyBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "azik-food-exchange.firebaseapp.com",
  projectId: "azik-food-exchange",
  storageBucket: "azik-food-exchange.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnop"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Initialize Analytics
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.log('Analytics not available:', error);
}

// Request permission and get token
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
             const token = await getToken(messaging, {
         vapidKey: 'BMfRXZJe2VQuf5mEhjsv9fwdw_VgpVJjXIPjLQ7IlLkNBOTNKevo3FcM_vYRqrX4Wg2lhzU2uZ510tCWald3EZE'
       });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Notification permission error:', error);
    return null;
  }
};

// Handle foreground messages
export const onMessageListener = () => {
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};

// Analytics helper functions
export const logAnalyticsEvent = (eventName, parameters = {}) => {
  if (analytics) {
    try {
      logEvent(analytics, eventName, parameters);
    } catch (error) {
      console.log('Analytics event logging failed:', error);
    }
  }
};

export { messaging, analytics };
