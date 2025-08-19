# E-posta Doğrulama Sistemi Kurulum Rehberi

Bu rehber, Azık uygulamasında e-posta doğrulama sisteminin nasıl kurulacağını açıklar.

## 1. Gmail App Password Oluşturma

### Adım 1: Google Hesabınızda 2FA'yı Etkinleştirin
1. https://myaccount.google.com adresine gidin
2. "Güvenlik" sekmesine tıklayın
3. "2 Adımlı Doğrulama"yı etkinleştirin

### Adım 2: App Password Oluşturun
1. "Uygulama Şifreleri" bölümüne gidin
2. "Uygulama Seç" dropdown'undan "Diğer" seçin
3. Uygulama adı olarak "Azık" yazın
4. "Oluştur" butonuna tıklayın
5. 16 karakterlik şifreyi kopyalayın (örn: `btya obnt tupf cbrz`)

## 2. Environment Variables Ayarlama

### Local Development (.env dosyası)
`server/.env` dosyasına şu değişkenleri ekleyin:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret
```

### Production (Render)
Render Dashboard'da Environment Variables bölümüne ekleyin:

```
EMAIL_USER = your-email@gmail.com
EMAIL_PASS = your-app-password
FRONTEND_URL = https://azik-app.onrender.com
JWT_SECRET = your-jwt-secret
```

## 3. E-posta Şablonu

Sistem otomatik olarak HTML formatında e-posta gönderir:

```html
<h2>Azık - E-posta Doğrulama</h2>
<p>Merhaba {firstName},</p>
<p>Azık hesabınızı doğrulamak için aşağıdaki linke tıklayın:</p>
<a href="{verificationUrl}">E-posta Adresimi Doğrula</a>
<p>Bu link 24 saat geçerlidir.</p>
<p>Eğer bu e-postayı siz talep etmediyseniz, lütfen dikkate almayın.</p>
```

## 4. Doğrulama Süreci

### Kayıt Sonrası
1. Kullanıcı kayıt olur
2. Sistem doğrulama e-postası gönderir
3. Kullanıcıya "E-posta doğrulama gerekli" mesajı gösterilir

### E-posta Doğrulama
1. Kullanıcı e-postadaki linke tıklar
2. Sistem token'ı doğrular
3. Hesap doğrulanır ve otomatik giriş yapılır
4. Ana sayfaya yönlendirilir

### Yeniden Gönderme
1. Kullanıcı "E-postayı yeniden gönder" butonuna tıklar
2. Sistem yeni doğrulama e-postası gönderir
3. Eski token'lar geçersiz kılınır

## 5. Hata Durumları

### E-posta Gönderilemedi
- SMTP ayarlarını kontrol edin
- App password'ün doğru olduğundan emin olun
- Gmail'in "Daha az güvenli uygulama erişimi"ni kontrol edin

### Token Geçersiz
- Token 24 saat sonra geçersiz olur
- Yeni doğrulama e-postası isteyin

### Hesap Zaten Doğrulanmış
- Kullanıcı normal giriş yapabilir
- Doğrulama sayfasına erişim engellenir

## 6. Güvenlik Önlemleri

### Token Güvenliği
- Benzersiz UUID token'ları
- 24 saat geçerlilik süresi
- Tek kullanımlık token'lar

### Rate Limiting
- E-posta gönderme sıklığı sınırlandırılır
- Spam koruması

### Veri Koruması
- E-posta adresleri güvenli saklanır
- Token'lar hash'lenir

## 7. Test Etme

### Local Test
1. `npm run dev` ile uygulamayı başlatın
2. Yeni hesap oluşturun
3. E-posta kutusunu kontrol edin
4. Doğrulama linkine tıklayın

### Production Test
1. Render'da deploy edin
2. Gerçek e-posta ile test edin
3. Doğrulama sürecini kontrol edin

## 8. Sorun Giderme

### E-posta Gelmiyor
- Spam klasörünü kontrol edin
- App password'ü yeniden oluşturun
- SMTP ayarlarını kontrol edin

### Link Çalışmıyor
- Token'ın geçerlilik süresini kontrol edin
- URL'nin doğru olduğundan emin olun
- Yeni doğrulama e-postası isteyin

### Doğrulama Başarısız
- Console loglarını kontrol edin
- Veritabanı bağlantısını kontrol edin
- Environment variables'ları kontrol edin

## 9. Geliştirme Notları

### E-posta Şablonu Özelleştirme
`server/index.js` dosyasındaki `sendVerificationEmail` fonksiyonunu düzenleyin.

### Doğrulama Süresi Değiştirme
`email_verifications` tablosundaki `expiresAt` hesaplamasını güncelleyin.

### E-posta Servisi Değiştirme
Nodemailer transporter ayarlarını güncelleyin (Gmail yerine başka servis).
