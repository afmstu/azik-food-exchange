# Azık Güvenlik Dokümantasyonu

Bu dokümantasyon, Azık uygulamasında uygulanan güvenlik önlemlerini detaylandırır.

## 1. Kimlik Doğrulama (Authentication)

### JWT (JSON Web Tokens)
- Kullanıcı girişi için JWT token kullanılır
- Token'lar 24 saat geçerlidir
- Güvenli token oluşturma için güçlü JWT_SECRET kullanılır

### Şifre Güvenliği
- Şifreler bcryptjs ile hash'lenir (salt rounds: 10)
- **Şifre Gereksinimleri**: En az 8 karakter
- Şifre karmaşıklık kontrolü kaldırıldı (kullanıcı isteği)

### E-posta Doğrulama
- Kayıt sonrası e-posta doğrulama zorunludur
- Benzersiz doğrulama token'ları (24 saat geçerli)
- Doğrulanmamış hesaplar giriş yapamaz

## 2. Giriş Denemesi Koruması

### Hesap Kilitleme
- 5 başarısız giriş denemesinden sonra hesap 30 dakika kilitlenir
- Başarısız denemeler veritabanında takip edilir
- Kilit süresi sonrası otomatik açılır

### Rate Limiting
- API endpoint'leri için rate limiting uygulanır
- Aşırı istek gönderimi engellenir

## 3. Giriş Doğrulama (Input Validation)

### E-posta Doğrulama
- Geçerli e-posta formatı kontrolü
- Benzersiz e-posta adresi zorunluluğu

### Telefon Numarası
- Benzersiz telefon numarası zorunluluğu
- Format kontrolü

### İsim ve Adres
- Boş alan kontrolü
- Minimum/maksimum uzunluk kontrolü

### Yemek Detayları
- XSS koruması için özel karakter kontrolü
- Uzunluk sınırlamaları

## 4. Güvenlik Başlıkları (Security Headers)

### Helmet.js
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security

## 5. CORS (Cross-Origin Resource Sharing)

### Güvenli CORS Ayarları
- Sadece belirli origin'lere izin
- Credentials desteği
- Güvenli HTTP metodları

## 6. Veritabanı Güvenliği

### SQL Injection Koruması
- Parametreli sorgular kullanılır
- Prepared statements

### Veri Doğrulama
- Tüm giriş verileri doğrulanır
- Veritabanı seviyesinde kısıtlamalar

## 7. Environment Variables

### Hassas Bilgiler
- JWT_SECRET
- E-posta kimlik bilgileri
- Firebase servis hesabı
- Veritabanı bağlantı bilgileri

### Güvenli Saklama
- .env dosyaları git'e dahil edilmez
- Production'da environment variables kullanılır

## 8. API Güvenliği

### Endpoint Koruması
- Kimlik doğrulama gerektiren endpoint'ler
- Role-based access control
- Admin paneli koruması

### Veri Filtreleme
- Kullanıcılar sadece kendi verilerine erişebilir
- Admin'ler tüm verilere erişebilir

## 9. Firebase Güvenliği

### FCM Token Yönetimi
- Güvenli token saklama
- Token yenileme mekanizması

### Push Notification Güvenliği
- Sadece doğrulanmış kullanıcılara bildirim
- İçerik filtreleme

## 10. Genel Güvenlik Önlemleri

### Hata Yönetimi
- Hassas bilgiler hata mesajlarında gösterilmez
- Genel hata mesajları

### Logging
- Güvenlik olayları loglanır
- Başarısız giriş denemeleri takip edilir

### Session Yönetimi
- Güvenli session handling
- Otomatik logout mekanizması

## Güvenlik Uyarısı

Bu sistem temel güvenlik önlemlerini içerir ancak production ortamında ek güvenlik katmanları önerilir:

- HTTPS zorunluluğu
- Düzenli güvenlik güncellemeleri
- Penetrasyon testleri
- Güvenlik denetimleri
- Backup ve disaster recovery planları
