# Firebase Cloud Messaging Kurulum Rehberi

## 1. Firebase Console'a Git
https://console.firebase.google.com/

## 2. Yeni Proje Oluştur
- "Create a project" tıkla
- Proje adı: "azik-food-exchange"
- Google Analytics'i etkinleştir
- "Create project" tıkla

## 3. Web Uygulaması Ekle
- "Add app" > "Web" seç
- App nickname: "azik-web"
- "Register app" tıkla

## 4. Firebase Config Bilgilerini Al
- Config objesini kopyala (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)

## 5. Cloud Messaging'i Etkinleştir
- Sol menüden "Messaging" seç
- "Get started" tıkla
- Server key'i kopyala

## 6. Service Worker Oluştur
- firebase-messaging-sw.js dosyası oluştur
- Firebase SDK'yı yükle

## 7. Backend'e FCM Entegrasyonu
- firebase-admin paketini yükle
- Server key ile initialize et
- Bildirim gönderme fonksiyonları ekle
