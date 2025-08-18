# 🍽️ Azık - Yemek Takası Platformu

Gıda çalışanları arasında yemek takası yapabilmek için geliştirilmiş web uygulaması.

## 🚀 Deployment (Yayınlama) Talimatları

### Vercel ile Deployment (Önerilen)

1. **Vercel Hesabı Oluşturun:**
   - [vercel.com](https://vercel.com) adresine gidin
   - GitHub hesabınızla giriş yapın

2. **Projeyi GitHub'a Yükleyin:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/kullaniciadi/azik.git
   git push -u origin main
   ```

3. **Vercel'de Deploy Edin:**
   - Vercel Dashboard'da "New Project" tıklayın
   - GitHub reponuzu seçin
   - Framework Preset: "Other" seçin
   - Build Command: `npm run build` (client için)
   - Output Directory: `client/build`
   - Deploy butonuna tıklayın

4. **Environment Variables Ekleme:**
   - Vercel Dashboard > Project Settings > Environment Variables
   - `JWT_SECRET` ekleyin (güvenli bir değer)

### Railway ile Deployment

1. **Railway Hesabı Oluşturun:**
   - [railway.app](https://railway.app) adresine gidin
   - GitHub hesabınızla giriş yapın

2. **Projeyi Deploy Edin:**
   - "New Project" > "Deploy from GitHub repo"
   - Reponuzu seçin
   - Environment Variables ekleyin

### Heroku ile Deployment

1. **Heroku CLI Kurulumu:**
   ```bash
   npm install -g heroku
   ```

2. **Heroku App Oluşturun:**
   ```bash
   heroku create azik-app
   ```

3. **Deploy Edin:**
   ```bash
   git push heroku main
   ```

## 🔧 Yerel Geliştirme

```bash
# Bağımlılıkları yükleyin
npm run install-all

# Geliştirme sunucusunu başlatın
npm run dev
```

## 📁 Proje Yapısı

```
azık.com/
├── client/          # React frontend
├── server/          # Node.js backend
├── package.json     # Root package.json
└── vercel.json      # Vercel konfigürasyonu
```

## 🌐 Canlı Demo

Deployment tamamlandıktan sonra uygulamanız şu adreste erişilebilir olacak:
- Vercel: `https://azik-app.vercel.app`
- Railway: `https://azik-app.railway.app`
- Heroku: `https://azik-app.herokuapp.com`

## 🔒 Güvenlik Notları

- JWT_SECRET environment variable'ını güvenli bir değerle değiştirin
- Production'da HTTPS kullanın
- Database güvenliğini sağlayın

## 📞 Destek

Herhangi bir sorun yaşarsanız GitHub Issues bölümünden bildirebilirsiniz.
