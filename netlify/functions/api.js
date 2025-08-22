const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const admin = require('firebase-admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Admin SDK initialization
let serviceAccount;
try {
  console.log('FIREBASE_SERVICE_ACCOUNT length:', process.env.FIREBASE_SERVICE_ACCOUNT?.length);
  console.log('FIREBASE_SERVICE_ACCOUNT preview:', process.env.FIREBASE_SERVICE_ACCOUNT?.substring(0, 100));
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('Firebase service account loaded successfully');
} catch (error) {
  console.error('Firebase service account parsing error:', error);
  console.error('FIREBASE_SERVICE_ACCOUNT content:', process.env.FIREBASE_SERVICE_ACCOUNT);
  serviceAccount = null;
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized with service account');
  } else {
    // Fallback: Initialize without service account (for development)
    admin.initializeApp();
    console.log('Firebase Admin SDK initialized without service account');
  }
} else {
  console.log('Firebase Admin SDK already initialized');
}

// Debug environment variables
console.log('Environment variables check:');
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

const db = admin.firestore();

// Database helper functions
const dbQuery = async (collection, query) => {
  try {
    let ref = db.collection(collection);
    
    if (query) {
      Object.keys(query).forEach(key => {
        ref = ref.where(key, '==', query[key]);
      });
    }
    
    const snapshot = await ref.get();
    const results = [];
    snapshot.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() });
    });
    return results;
  } catch (error) {
    throw error;
  }
};

const dbGet = async (collection, id) => {
  try {
    const doc = await db.collection(collection).doc(id).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

const dbRun = async (collection, data) => {
  try {
    const docRef = await db.collection(collection).add(data);
    return { lastID: docRef.id, changes: 1 };
  } catch (error) {
    throw error;
  }
};

const dbUpdate = async (collection, id, data) => {
  try {
    await db.collection(collection).doc(id).update(data);
    return { lastID: id, changes: 1 };
  } catch (error) {
    throw error;
  }
};

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send verification email
const sendVerificationEmail = async (email, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/api/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@azik.com',
    to: email,
    subject: 'E-posta Doğrulama - Azık',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">Azık - E-posta Doğrulama</h2>
        <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
        <a href="${verificationUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 16px 0;">E-posta Adresimi Doğrula</a>
        <p>Bu bağlantı 24 saat geçerlidir.</p>
        <p>Eğer bu e-postayı siz talep etmediyseniz, lütfen dikkate almayın.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Create notification
const createNotification = async (userId, title, message, type = 'info') => {
  const notification = {
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString()
  };

  await dbRun('notifications', notification);
};

// Mock data
const provinces = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep',
  'Mersin', 'Diyarbakır', 'Samsun', 'Denizli', 'Eskişehir', 'Urfa', 'Malatya', 'Erzurum',
  'Van', 'Batman', 'Elazığ', 'İçel', 'Tokat', 'Sivas', 'Kayseri', 'Aydın', 'Afyon',
  'Trabzon', 'Ordu', 'Giresun', 'Rize', 'Artvin', 'Gümüşhane', 'Bayburt', 'Erzincan',
  'Tunceli', 'Bingöl', 'Muş', 'Bitlis', 'Hakkari', 'Kars', 'Iğdır', 'Ardahan', 'Ağrı'
];

const districts = {
  'İstanbul': [
    'Kadıköy', 'Beşiktaş', 'Şişli', 'Beyoğlu', 'Fatih', 'Üsküdar', 'Maltepe', 'Kartal',
    'Pendik', 'Tuzla', 'Çekmeköy', 'Ümraniye', 'Ataşehir', 'Sancaktepe', 'Sultanbeyli',
    'Başakşehir', 'Esenyurt', 'Beylikdüzü', 'Avcılar', 'Küçükçekmece', 'Sultangazi',
    'Büyükçekmece', 'Çatalca', 'Esenler', 'Adalar', 'Arnavutköy', 'Bağcılar', 'Bahçelievler',
    'Bayrampaşa', 'Beykoz', 'Eyüp', 'Gaziosmanpaşa', 'Kağıthane', 'Sarıyer', 'Silivri',
    'Şile', 'Zeytinburnu'
  ]
};

const neighborhoods = {
  'İstanbul-Kadıköy': [
    '19 Mayıs', 'Acıbadem', 'Bostancı', 'Caddebostan', 'Caferağa', 'Eğitim', 'Fenerbahçe',
    'Fikirtepe', 'Göztepe', 'Hasanpaşa', 'Koşuyolu', 'Merdivenköy', 'Moda', 'Osmanağa',
    'Rasimpaşa', 'Suadiye', 'Yenisahra'
  ],
  'İstanbul-Beşiktaş': [
    'Abbasağa', 'Akat', 'Arnavutköy', 'Aşiyan', 'Bebek', 'Etiler', 'Gayrettepe',
    'Levent', 'Muradiye', 'Nispetiye', 'Ortaköy', 'Sinanpaşa', 'Türkali', 'Vişnezade',
    'Yıldız'
  ],
  'İstanbul-Şişli': [
    '19 Mayıs', 'Ayazağa', 'Bomonti', 'Cumhuriyet', 'Duatepe', 'Ergenekon', 'Esentepe',
    'Feriköy', 'Fulya', 'Gülbağ', 'Halaskargazi', 'Halide Edip Adıvar', 'Harbiye',
    'İnönü', 'Kaptanpaşa', 'Kuştepe', 'Mahmut Şevket Paşa', 'Mecidiyeköy', 'Merkez',
    'Meşrutiyet', 'Nişantaşı', 'Pangaltı', 'Teşvikiye', 'Yayla'
  ],
  'İstanbul-Beyoğlu': [
    'Arap Cami', 'Asmalı Mescit', 'Bedrettin', 'Bereketzade', 'Bostan', 'Bülbül',
    'Camiikebir', 'Çatma Mescit', 'Çukur', 'Emekyemez', 'Evliya Çelebi', 'Fetihtepe',
    'Firuzağa', 'Gümüşsuyu', 'Hacıahmet', 'Hacımimi', 'Halıcıoğlu', 'Hasköy',
    'İstiklal', 'Kadımehmet Efendi', 'Kalyoncukulluk', 'Kamerhatun', 'Karaköy',
    'Kulaksız', 'Kuloğlu', 'Küçük Piyale', 'Müeyyetzade', 'Örnektepe', 'Örnektepe',
    'Piyalepaşa', 'Pürtelaş', 'Sütlüce', 'Şahkulu', 'Şehit Muhtar', 'Tomtom',
    'Tophane', 'Tünel', 'Yenişehir'
  ],
  'İstanbul-Fatih': [
    'Aksaray', 'Akşemsettin', 'Alemdar', 'Ali Kuşçu', 'Atikali', 'Ayvansaray', 'Balabanağa',
    'Balat', 'Beyazıt', 'Binbirdirek', 'Cankurtaran', 'Cerrahpaşa', 'Cibali', 'Demirtaş',
    'Dervişali', 'Eminönü', 'Eski İmaret', 'Fatih', 'Fener', 'Gedikpaşa', 'Hacı Kadın',
    'Haseki Sultan', 'Hırka-i Şerif', 'Hobyar', 'Hoca Gıyasettin', 'Hocapaşa', 'İskenderpaşa',
    'Kalenderhane', 'Karagümrük', 'Katip Kasım', 'Kemalpaşa', 'Küçük Ayasofya', 'Küçük Mustafapaşa',
    'Küçükkaraman', 'Kumkapı', 'Laleli', 'Mercan', 'Mesihpaşa', 'Mevlanakapı', 'Mimar Hayrettin',
    'Mimar Kemalettin', 'Molla Fenari', 'Molla Gürani', 'Molla Hüsrev', 'Muhsine Hatun',
    'Nişanca', 'Rüstempaşa', 'Saraç İshak', 'Saraçhane', 'Sarıdemir', 'Sarıgüzel', 'Sarmaşık',
    'Seyyid Ömer', 'Silivrikapı', 'Sultan Ahmet', 'Sultan Selim', 'Süleymaniye', 'Şehremini',
    'Şehsuvar Bey', 'Şehzadebaşı', 'Tahtakale', 'Tayahatun', 'Topkapı', 'Yavuz Sinan',
    'Yavuz Sultan Selim', 'Yedikule', 'Zeyrek'
  ],
  'İstanbul-Üsküdar': [
    'Acıbadem', 'Ahmediye', 'Altunizade', 'Aziz Mahmut Hüdayi', 'Bahçelievler', 'Barbaros',
    'Beylerbeyi', 'Bulgurlu', 'Burhaniye', 'Cumhuriyet', 'Çengelköy', 'Ferah', 'Fetih',
    'Güzeltepe', 'Hakimiyet-i Milliye', 'Havuzbaşı', 'İcadiye', 'İnkılap', 'Kandilli',
    'Kirazlıtepe', 'Kısıklı', 'Küçük Çamlıca', 'Küçüksu', 'Küplüce', 'Mekteb-i Osmaniye',
    'Mimarsinan', 'Muratreis', 'Ortaköy', 'Örnek', 'Paşalimanı', 'Rum Mehmet Paşa',
    'Salacak', 'Selamiali', 'Selimiye', 'Sultantepe', 'Tavusantepe', 'Ünalan',
    'Validei Atik', 'Yavuztürk', 'Zeynep Kamil'
  ],
  'İstanbul-Maltepe': [
    'Altayçeşme', 'Altıntepe', 'Aydınevler', 'Bağdat Caddesi', 'Başıbüyük', 'Büyükbakkalköy',
    'Cevizli', 'Çınar', 'Esenkent', 'Feyzullah', 'Fındıklı', 'Girne', 'Gülensu',
    'Gülsuyu', 'İdealtepe', 'Küçükyalı', 'Yalı', 'Zümrütevler'
  ],
  'İstanbul-Kartal': [
    'Atalar', 'Cevizli', 'Çavuşoğlu', 'Esentepe', 'Gümüşpınar', 'Hürriyet', 'Karlık',
    'Kordonboyu', 'Orhantepe', 'Ortamahalle', 'Petrol-İş', 'Soğanlık', 'Topselvi',
    'Uğur Mumcu', 'Yakacık', 'Yalı', 'Yukarı'
  ],
  'İstanbul-Pendik': [
    'Ahmet Yesevi', 'Bahçelievler', 'Batı', 'Çamçeşme', 'Çınardere', 'Doğu', 'Dumlupınar',
    'Ertuğrulgazi', 'Esenler', 'Fatih', 'Fevzi Çakmak', 'Güllübağlar', 'Güzelyalı',
    'Harmandere', 'Kavakpınar', 'Kaynarca', 'Kurtköy', 'Orhangazi', 'Orta', 'Ramazanoğlu',
    'Sanayi', 'Sapanbağları', 'Sülüntepe', 'Şeyhli', 'Velibaba', 'Yayalar', 'Yenişehir',
    'Yeşilbağlar'
  ],
  'İstanbul-Tuzla': [
    'Aktepe', 'Anadolu', 'Aydınlı', 'Aydıntepe', 'Cami', 'Evliya Çelebi', 'Fatih',
    'İçmeler', 'İstasyon', 'Mescit', 'Mimar Sinan', 'Orta', 'Postane', 'Şifa',
    'Tepeören', 'Yayla'
  ],
  'İstanbul-Çekmeköy': [
    'Alemdağ', 'Ataşehir', 'Cumhuriyet', 'Ekşioğlu', 'Göktürk', 'Hamidiye', 'Huzur',
    'Kirazlıdere', 'Mehmet Akif', 'Merkez', 'Mimar Sinan', 'Nişantepe', 'Ömerli',
    'Reşadiye', 'Sarıgazi', 'Soğukpınar', 'Sultançiftliği', 'Taşdelen', 'Yeni',
    'Yeni Doğan'
  ],
  'İstanbul-Ümraniye': [
    'Adem Yavuz', 'Atakent', 'Atatürk', 'Cemil Meriç', 'Çakmak', 'Çamlık', 'Eğlence',
    'Esenevler', 'Fatih', 'Hekimbaşı', 'Huzur', 'İnkılap', 'Kazım Karabekir',
    'Madenler', 'Mehmet Akif', 'Namık Kemal', 'Necip Fazıl', 'Parseller', 'Şakirin',
    'Tantavi', 'Tevfik İleri', 'Yamanevler', 'Yenişehir'
  ],
  'İstanbul-Ataşehir': [
    'Aşık Veysel', 'Atatürk', 'Barbaros', 'Esatpaşa', 'Ferhatpaşa', 'Fetih', 'Hasanpaşa',
    'İçerenköy', 'İnönü', 'Kazım Karabekir', 'Küçükbakkalköy', 'Mevlana', 'Mimar Sinan',
    'Mustafa Kemal', 'Örnek', 'Yeniçamlıca', 'Yenişehir'
  ],
  'İstanbul-Sancaktepe': [
    'Abdurrahmangazi', 'Akpınar', 'Atatürk', 'Emek', 'Eyüp Sultan', 'Fatih', 'Hilal',
    'İnönü', 'Kemal Türkler', 'Meclis', 'Merve', 'Mevlana', 'Oruç Reis', 'Osman Gazi',
    'Paşaköy', 'Safa', 'Sarıgazi', 'Veysel Karani', 'Yenidoğan'
  ],
  'İstanbul-Sultanbeyli': [
    'Abdurrahmangazi', 'Adil', 'Ahmet Yesevi', 'Akşemsettin', 'Battalgazi', 'Fatih',
    'Hamidiye', 'Hasanpaşa', 'Mecidiye', 'Mehmet Akif', 'Mimar Sinan', 'Necip Fazıl',
    'Orhangazi', 'Turgut Reis', 'Yavuz Selim'
  ],
  'İstanbul-Başakşehir': [
    'Altınşehir', 'Bahçeşehir 1. Kısım', 'Bahçeşehir 2. Kısım', 'Başak', 'Başakşehir',
    'Güvercintepe', 'Kayabaşı', 'Şahintepe', 'Ziya Gökalp'
  ],
  'İstanbul-Esenyurt': [
    'Akçaburgaz', 'Ardıçlı', 'Aşık Veysel', 'Atatürk', 'Cumhuriyet', 'Fatih', 'Gökevler',
    'Güzelyurt', 'Harami', 'İnönü', 'İnşaat', 'Kıraç', 'Mehterçeşme', 'Namık Kemal',
    'Orhan Gazi', 'Örnek', 'Pınar', 'Saadetdere', 'Selahaddin Eyyubi', 'Senlik',
    'Talatpaşa', 'Yenikent', 'Yeşilkent'
  ],
  'İstanbul-Beylikdüzü': [
    'Adnan Kahveci', 'Barış', 'Büyükşehir', 'Cumhuriyet', 'Dereağzı', 'Gürpınar',
    'Kavaklı', 'Marmara', 'Sahil', 'Yakuplu'
  ],
  'İstanbul-Avcılar': [
    'Ambarlı', 'Cihangir', 'Denizköşkler', 'Firuzköy', 'Gümüşpala', 'Merkez',
    'Mustafa Kemal Paşa', 'Tahtakale', 'Üniversite', 'Yeşilkent'
  ],
  'İstanbul-Küçükçekmece': [
    'Atakent', 'Atatürk', 'Beşyol', 'Cennet', 'Cumhuriyet', 'Fatih', 'Fevzi Çakmak',
    'Gültepe', 'Halkalı', 'İkitelli', 'İnönü', 'Kanarya', 'Kartaltepe', 'Söğütlüçeşme',
    'Sultanmurat', 'Tepeüstü', 'Yarımburgaz', 'Yeşilova'
  ],
  'İstanbul-Sultangazi': [
    'Cebeci', 'Cumhuriyet', 'Esentepe', 'Eski Habipler', 'Gazi', 'Habibler',
    'İsmetpaşa', 'Malkoçoğlu', 'Necip Fazıl', 'Sultançiftliği', 'Uğur Mumcu',
    'Yayla', 'Yeni Habipler'
  ],
  'İstanbul-Büyükçekmece': [
    'Ahmediye', 'Alkent 2000', 'Atatürk', 'Bahçelievler', 'Beylikdüzü', 'Cumhuriyet',
    'Çakmaklı', 'Dizdariye', 'Esenyurt', 'Fatih', 'Gürpınar', 'Kıraç', 'Marmara',
    'Mimaroba', 'Sahil', 'Sinanoba', 'Yakuplu'
  ],
  'İstanbul-Çatalca': [
    'Binkılıç', 'Çanakça', 'Elbasan', 'Ferhatpaşa', 'Gökçeali', 'Gümüşpınar',
    'Hallaçlı', 'İhsaniye', 'İnceğiz', 'Kaleiçi', 'Kestanelik', 'Kızılcaali',
    'Köklükaya', 'Köşklü', 'Kubuzcu', 'Muhacirler', 'Örcünlü', 'Örencik',
    'Subaşı', 'Yalıköy', 'Yaylacık'
  ],
  'İstanbul-Esenler': [
    'Atışalanı', 'Birlik', 'Çiftehavuzlar', 'Davutpaşa', 'Fatih', 'Fevzi Çakmak',
    'Havaalanı', 'Kazım Karabekir', 'Menderes', 'Namık Kemal', 'Nenehatun',
    'Oruç Reis', 'Turgut Reis', 'Yavuz Selim'
  ],
  'İstanbul-Adalar': [
    'Büyükada', 'Heybeliada', 'Burgazada', 'Kınalıada', 'Sedefadası', 'Tavşanadası',
    'Yassıada', 'Sivriada'
  ],
  'İstanbul-Arnavutköy': [
    'Adnan Menderes', 'Anadolu', 'Arnavutköy Merkez', 'Atatürk', 'Baklalı',
    'Balaban', 'Boğazköy', 'Bolluca', 'Çilingir', 'Deliklikaya', 'Dursunköy',
    'Durusu', 'Fatih', 'Hacımaşlı', 'Hadımköy', 'Haraççı', 'Hastane',
    'Karlıbayır', 'Mareşal Fevzi Çakmak', 'Mavigöl', 'Taşoluk', 'Terkos',
    'Yassıören', 'Yavuz Selim'
  ],
  'İstanbul-Bağcılar': [
    '15 Temmuz', 'Bağlar', 'Barbaros', 'Çınar', 'Demirkapı', 'Evren', 'Fatih',
    'Fevzi Çakmak', 'Göztepe', 'Güneşli', 'Halkalı', 'İnönü', 'Kazım Karabekir',
    'Kemalpaşa', 'Kirazlı', 'Mahmutbey', 'Sancaktepe', 'Yavuz Selim', 'Yeni',
    'Yıldıztepe'
  ],
  'İstanbul-Bahçelievler': [
    'Adnan Kahveci', 'Atatürk', 'Çobançeşme', 'Cumhuriyet', 'Fevzi Çakmak',
    'Hürriyet', 'İnönü', 'Kocasinan', 'Mevlana', 'Sıracevizler', 'Soğanlı',
    'Şirinevler', 'Yenibosna', 'Zafer'
  ],
  'İstanbul-Bayrampaşa': [
    'Altıntepsi', 'Cevatpaşa', 'İsmetpaşa', 'Kartaltepe', 'Kocatepe', 'Muratpaşa',
    'Ortamahalle', 'Vatan', 'Yenidoğan', 'Yıldırım'
  ],
  'İstanbul-Beykoz': [
    'Acarlar', 'Anadolufeneri', 'Anadoluhisarı', 'Anadolukavağı', 'Baklacı',
    'Bozhane', 'Cumhuriyet', 'Çamlıbahçe', 'Çayır', 'Çubuklu', 'Fatih',
    'Göksu', 'Göztepe', 'Gümüşsuyu', 'İncirköy', 'Kanlıca', 'Kavacık',
    'Küçüksu', 'Mahmutşevketpaşa', 'Merkez', 'Ortaçeşme', 'Paşabahçe',
    'Poyrazköy', 'Riva', 'Sultaniye', 'Tokatköy', 'Yalıköy', 'Yavuz Selim'
  ],
  'İstanbul-Eyüp': [
    'Ağaçlı', 'Akpınar', 'Alibeyköy', 'Arnavutköy', 'Aşağı', 'Ayvansaray',
    'Başakşehir', 'Büyükşehir', 'Cumhuriyet', 'Çırçır', 'Defterdar', 'Düğmeciler',
    'Emniyettepe', 'Esentepe', 'Eyüp Merkez', 'Feshane', 'Göktürk', 'Güzeltepe',
    'İslambey', 'İsmetpaşa', 'Kemerburgaz', 'Mithatpaşa', 'Nişanca', 'Odayeri',
    'Piyer Loti', 'Rami Cuma', 'Rami Yeni', 'Sakarya', 'Silahtarağa', 'Topçular',
    'Yenidoğan', 'Yenimahalle'
  ],
  'İstanbul-Gaziosmanpaşa': [
    'Adnan Menderes', 'Arnavutköy', 'Atatürk', 'Bağlarbaşı', 'Barbaros Hayrettin Paşa',
    'Bekirpaşa', 'Bostancı', 'Cumhuriyet', 'Çobançeşme', 'Emniyet', 'Esentepe',
    'Fevzi Çakmak', 'Hürriyet', 'İnönü', 'Kazım Karabekir', 'Küçükköy',
    'Mevlana', 'Mithatpaşa', 'Moda', 'Orta', 'Sarıgazi', 'Şemsipaşa',
    'Yenidoğan', 'Yenimahalle', 'Yıldıztabya'
  ],
  'İstanbul-Kağıthane': [
    'Çağlayan', 'Çeliktepe', 'Emniyetevleri', 'Gültepe', 'Gürsel', 'Hamidiye',
    'Harmantepe', 'Hürriyet', 'Mehmet Akif Ersoy', 'Merkez', 'Nurtepe',
    'Ortabayır', 'Seyrantepe', 'Şirintepe', 'Talatpaşa', 'Telsizler',
    'Yahya Kemal', 'Yeşilce'
  ],
  'İstanbul-Sarıyer': [
    'Ayazağa', 'Baltalimanı', 'Bahçeköy', 'Büyükdere', 'Cumhuriyet', 'Çayırbaşı',
    'Darüşşafaka', 'Emirgan', 'Ferahevler', 'İstinye', 'Kireçburnu', 'Kumköy',
    'Maden', 'Maslak', 'Pınar', 'Poligon', 'Reşitpaşa', 'Rumelikavağı',
    'Rumelihisarı', 'Sarıyer Merkez', 'Tarabya', 'Yeniköy', 'Yenimahalle'
  ],
  'İstanbul-Silivri': [
    'Alibey', 'Alipaşa', 'Balıklı', 'Büyükçavuşlu', 'Cumhuriyet', 'Çanta',
    'Değirmenköy', 'Fatih', 'Fenerköy', 'Gümüşyaka', 'Kadıköy', 'Kavaklı',
    'Küçükçavuşlu', 'Küçükkılıçlı', 'Mimar Sinan', 'Ortaköy', 'Piri Mehmet Paşa',
    'Selimpaşa', 'Seymen', 'Yeni', 'Yolçatı'
  ],
  'İstanbul-Şile': [
    'Ağva', 'Balibey', 'Bucaklı', 'Çavuş', 'Gökmaslı', 'Hacıllı', 'Kervansaray',
    'Kumbaba', 'Oruçoğlu', 'Sahilköy', 'Şile Merkez', 'Sofular', 'Teke',
    'Yeniköy'
  ],
  'İstanbul-Zeytinburnu': [
    'Beştelsiz', 'Çırpıcı', 'Gökalp', 'Kazlıçeşme', 'Maltepe', 'Merkezefendi',
    'Nuripaşa', 'Seyitnizam', 'Telsiz', 'Veliefendi', 'Yenidoğan'
  ]
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, province, district, neighborhood, fullAddress } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ error: 'Tüm alanlar gereklidir' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
    }

    // Check if user exists
    const existingUsers = await dbQuery('users', { email });
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    // Create user
    const user = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone: phone || null,
      role,
      province: province || null,
      district: district || null,
      neighborhood: neighborhood || null,
      fullAddress: fullAddress || null,
      emailVerified: false,
      verificationToken,
      createdAt: new Date().toISOString()
    };

    const result = await dbRun('users', user);

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    res.status(201).json({ 
      message: 'Kullanıcı başarıyla oluşturuldu. E-posta doğrulama linki gönderildi.',
      userId: result.lastID 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Login failed: missing email or password');
      return res.status(400).json({ error: 'E-posta ve şifre gereklidir' });
    }

    // Find user
    const users = await dbQuery('users', { email });
    if (users.length === 0) {
      return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    }

    // Check email verification
    if (!user.emailVerified) {
      return res.status(401).json({ error: 'E-posta adresinizi doğrulamanız gerekiyor' });
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        province: user.province,
        district: user.district,
        neighborhood: user.neighborhood,
        fullAddress: user.fullAddress
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
  }
});

app.get('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Doğrulama token\'ı gerekli' });
    }

    // Find user with token
    const users = await dbQuery('users', { verificationToken: token });
    if (users.length === 0) {
      return res.status(400).json({ error: 'Geçersiz doğrulama token\'ı' });
    }

    const user = users[0];

    // Update user
    await dbUpdate('users', user.id, {
      emailVerified: true,
      verificationToken: null
    });

    // Redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL}/verify-email?success=true`);

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'E-posta doğrulama sırasında hata oluştu' });
  }
});

app.get('/api/provinces', (req, res) => {
  res.json(provinces);
});

app.get('/api/districts/:province', (req, res) => {
  const { province } = req.params;
  const provinceDistricts = districts[province] || [];
  res.json(provinceDistricts);
});

app.get('/api/neighborhoods/:province/:district', (req, res) => {
  const { province, district } = req.params;
  const key = `${province}-${district}`;
  const districtNeighborhoods = neighborhoods[key] || [];
  res.json(districtNeighborhoods);
});

// Protected routes middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz token' });
    }
    req.user = user;
    next();
  });
};

app.put('/api/user/address', authenticateToken, async (req, res) => {
  try {
    const { province, district, neighborhood, fullAddress } = req.body;

    await dbUpdate('users', req.user.id, {
      province: province || null,
      district: district || null,
      neighborhood: neighborhood || null,
      fullAddress: fullAddress || null
    });

    res.json({ message: 'Adres başarıyla güncellendi' });

  } catch (error) {
    console.error('Address update error:', error);
    res.status(500).json({ error: 'Adres güncellenirken hata oluştu' });
  }
});

// Food listings
app.post('/api/listings', authenticateToken, async (req, res) => {
  try {
    const { title, description, price, category, province, district, neighborhood, fullAddress } = req.body;

    if (!title || !description || !price || !category) {
      return res.status(400).json({ error: 'Tüm alanlar gereklidir' });
    }

    const listing = {
      userId: req.user.id,
      title,
      description,
      price: parseFloat(price),
      category,
      province: province || null,
      district: district || null,
      neighborhood: neighborhood || null,
      fullAddress: fullAddress || null,
      createdAt: new Date().toISOString(),
      status: 'active',
      completedAt: null,
      acceptedOfferId: null
    };

    const result = await dbRun('food_listings', listing);
    res.status(201).json({ message: 'İlan başarıyla oluşturuldu', listingId: result.lastID });

  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'İlan oluşturulurken hata oluştu' });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const listingsSnapshot = await db.collection('food_listings').get();
    const listings = [];
    listingsSnapshot.forEach(doc => {
      listings.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date
    listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(listings);

  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'İlanlar yüklenirken hata oluştu' });
  }
});

app.get('/api/my-listings', authenticateToken, async (req, res) => {
  try {
    const { status = 'active' } = req.query; // 'active', 'completed', 'all'
    
    let query = db.collection('food_listings').where('userId', '==', req.user.id);
    
    // Status filtresi ekle
    if (status === 'active') {
      query = query.where('status', '==', 'active');
    } else if (status === 'completed') {
      query = query.where('status', '==', 'completed');
    }
    // 'all' durumunda filtre ekleme

    const listingsSnapshot = await query.get();

    const listings = [];
    listingsSnapshot.forEach(doc => {
      listings.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date
    listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(listings);

  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({ error: 'İlanlarınız yüklenirken hata oluştu' });
  }
});

app.delete('/api/listings/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if listing belongs to user
    const listing = await dbGet('food_listings', id);
    if (!listing || listing.userId !== req.user.id) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    await db.collection('food_listings').doc(id).delete();
    res.json({ message: 'İlan başarıyla silindi' });

  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'İlan silinirken hata oluştu' });
  }
});

// Completed listings endpoint
app.get('/api/my-completed-listings', authenticateToken, async (req, res) => {
  try {
    const listingsSnapshot = await db.collection('food_listings')
      .where('userId', '==', req.user.id)
      .where('status', '==', 'completed')
      .get();

    const listings = [];
    listingsSnapshot.forEach(doc => {
      listings.push({ id: doc.id, ...doc.data() });
    });

    // Sort by completion date
    listings.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    res.json(listings);

  } catch (error) {
    console.error('Get completed listings error:', error);
    res.status(500).json({ error: 'Tamamlanan ilanlar yüklenirken hata oluştu' });
  }
});

// Offers
app.post('/api/offers', authenticateToken, async (req, res) => {
  try {
    const { listingId, message, price } = req.body;

    if (!listingId || !message) {
      return res.status(400).json({ error: 'İlan ID ve mesaj gereklidir' });
    }

    // Check if listing exists
    const listing = await dbGet('food_listings', listingId);
    if (!listing) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    // Check if user is not offering on their own listing
    if (listing.userId === req.user.id) {
      return res.status(400).json({ error: 'Kendi ilanınıza teklif veremezsiniz' });
    }

    const offer = {
      listingId,
      offererId: req.user.id,
      offererName: `${req.user.firstName} ${req.user.lastName}`,
      message,
      price: price ? parseFloat(price) : null,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const result = await dbRun('exchange_offers', offer);

    // Send notification to listing owner
    try {
      await createNotification(
        listing.userId,
        'Yeni Teklif',
        `${req.user.firstName} ${req.user.lastName} ilanınıza teklif verdi`,
        'offer'
      );

      // Send email notification
      const listingOwner = await dbGet('users', listing.userId);
      if (listingOwner && listingOwner.email) {
        const emailOptions = {
          from: process.env.EMAIL_FROM || 'noreply@azik.com',
          to: listingOwner.email,
          subject: 'Yeni Teklif - Azık',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f97316;">Yeni Teklif Aldınız!</h2>
              <p><strong>${req.user.firstName} ${req.user.lastName}</strong> "${listing.title}" ilanınıza teklif verdi.</p>
              <p><strong>Mesaj:</strong> ${message}</p>
              ${price ? `<p><strong>Teklif Fiyatı:</strong> ${price} TL</p>` : ''}
              <p>Teklifi değerlendirmek için sitenizi ziyaret edin.</p>
            </div>
          `
        };
        await transporter.sendMail(emailOptions);
      }
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.status(201).json({ message: 'Teklif başarıyla gönderildi', offerId: result.lastID });

  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ error: 'Teklif gönderilirken hata oluştu' });
  }
});

app.get('/api/listing-offers/:listingId', authenticateToken, async (req, res) => {
  try {
    const { listingId } = req.params;

    // Check if listing belongs to user
    const listing = await dbGet('food_listings', listingId);
    if (!listing || listing.userId !== req.user.id) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    const offersSnapshot = await db.collection('exchange_offers')
      .where('listingId', '==', listingId)
      .get();

    const offers = [];
    offersSnapshot.forEach(doc => {
      offers.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date
    offers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(offers);

  } catch (error) {
    console.error('Get listing offers error:', error);
    res.status(500).json({ error: 'Teklifler yüklenirken hata oluştu' });
  }
});

app.get('/api/my-offers', authenticateToken, async (req, res) => {
  try {
    const offersSnapshot = await db.collection('exchange_offers')
      .where('offererId', '==', req.user.id)
      .get();

    const offers = [];
    offersSnapshot.forEach(doc => {
      offers.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date
    offers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(offers);

  } catch (error) {
    console.error('Get my offers error:', error);
    res.status(500).json({ error: 'Teklifleriniz yüklenirken hata oluştu' });
  }
});

app.put('/api/offers/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await dbGet('exchange_offers', id);
    if (!offer) {
      return res.status(404).json({ error: 'Teklif bulunamadı' });
    }

    // Check if user owns the listing
    const listing = await dbGet('food_listings', offer.listingId);
    if (!listing || listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    // Update offer status
    await dbUpdate('exchange_offers', id, { status: 'accepted' });

    // Update listing status to 'completed' and set completedAt
    await dbUpdate('food_listings', offer.listingId, { 
      status: 'completed',
      completedAt: new Date().toISOString(),
      acceptedOfferId: id
    });

    // Send notification to offerer
    try {
      await createNotification(
        offer.offererId,
        'Teklifiniz Kabul Edildi',
        `${listing.title} ilanına verdiğiniz teklif kabul edildi!`,
        'success'
      );

      // Send email notification
      const offerer = await dbGet('users', offer.offererId);
      if (offerer && offerer.email) {
        const emailOptions = {
          from: process.env.EMAIL_FROM || 'noreply@azik.com',
          to: offerer.email,
          subject: 'Teklifiniz Kabul Edildi - Azık',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10b981;">Teklifiniz Kabul Edildi!</h2>
              <p>"${listing.title}" ilanına verdiğiniz teklif kabul edildi.</p>
              <p>İletişime geçmek için sitenizi ziyaret edin.</p>
            </div>
          `
        };
        await transporter.sendMail(emailOptions);
      }
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.json({ message: 'Teklif kabul edildi' });

  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({ error: 'Teklif kabul edilirken hata oluştu' });
  }
});

app.put('/api/offers/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await dbGet('exchange_offers', id);
    if (!offer) {
      return res.status(404).json({ error: 'Teklif bulunamadı' });
    }

    // Check if user owns the listing
    const listing = await dbGet('food_listings', offer.listingId);
    if (!listing || listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    // Update offer status
    await dbUpdate('exchange_offers', id, { status: 'rejected' });

    // Send notification to offerer
    try {
      await createNotification(
        offer.offererId,
        'Teklifiniz Reddedildi',
        `${listing.title} ilanına verdiğiniz teklif reddedildi.`,
        'warning'
      );

      // Send email notification
      const offerer = await dbGet('users', offer.offererId);
      if (offerer && offerer.email) {
        const emailOptions = {
          from: process.env.EMAIL_FROM || 'noreply@azik.com',
          to: offerer.email,
          subject: 'Teklifiniz Reddedildi - Azık',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ef4444;">Teklifiniz Reddedildi</h2>
              <p>"${listing.title}" ilanına verdiğiniz teklif reddedildi.</p>
              <p>Başka ilanlara teklif vermeyi deneyebilirsiniz.</p>
            </div>
          `
        };
        await transporter.sendMail(emailOptions);
      }
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.json({ message: 'Teklif reddedildi' });

  } catch (error) {
    console.error('Reject offer error:', error);
    res.status(500).json({ error: 'Teklif reddedilirken hata oluştu' });
  }
});

// Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', req.user.id)
      .get();

    const notifications = [];
    notificationsSnapshot.forEach(doc => {
      notifications.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(notifications);

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Bildirimler yüklenirken hata oluştu' });
  }
});

app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', req.user.id)
      .where('read', '==', false)
      .get();

    res.json({ count: notificationsSnapshot.size });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Okunmamış bildirim sayısı alınamadı' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await dbGet('notifications', id);
    if (!notification || notification.userId !== req.user.id) {
      return res.status(404).json({ error: 'Bildirim bulunamadı' });
    }

    await dbUpdate('notifications', id, { read: true });
    res.json({ message: 'Bildirim okundu olarak işaretlendi' });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Bildirim işaretlenirken hata oluştu' });
  }
});

// Admin routes
app.get('/api/admin/users', async (req, res) => {
  try {
    const { email, password } = req.query;

    // Admin authentication
    if (email !== 'mustafaozkoca1@gmail.com' || password !== 'mF3z4Vsf.') {
      return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    }

    const usersSnapshot = await db.collection('users').get();
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(users);

  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Kullanıcılar yüklenirken hata oluştu' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.query;

    // Admin authentication
    if (email !== 'mustafaozkoca1@gmail.com' || password !== 'mF3z4Vsf.') {
      return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    }

    await db.collection('users').doc(id).delete();
    res.json({ message: 'Kullanıcı başarıyla silindi' });

  } catch (error) {
    console.error('Delete admin user error:', error);
    res.status(500).json({ error: 'Kullanıcı silinirken hata oluştu' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manual notification cleanup endpoint (for testing)
app.post('/api/admin/cleanup-notifications', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Admin authentication
    if (email !== 'mustafaozkoca1@gmail.com' || password !== 'mF3z4Vsf.') {
      return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    }
    
    // 1 gün öncesinin tarihini hesapla
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    console.log('Manual cleanup: Deleting notifications older than:', oneDayAgo.toISOString());
    
    // 1 günden eski bildirimleri bul
    const notificationsRef = db.collection('notifications');
    const snapshot = await notificationsRef
      .where('createdAt', '<', oneDayAgo.toISOString())
      .get();
    
    if (snapshot.empty) {
      return res.json({ 
        message: 'Silinecek eski bildirim bulunamadı',
        deletedCount: 0 
      });
    }
    
    // Batch delete işlemi
    const batch = db.batch();
    let deletedCount = 0;
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    // Batch'i commit et
    await batch.commit();
    
    res.json({ 
      message: `${deletedCount} adet eski bildirim başarıyla silindi`,
      deletedCount: deletedCount,
      cutoffDate: oneDayAgo.toISOString()
    });
    
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ error: 'Bildirim temizleme sırasında hata oluştu' });
  }
});

module.exports.handler = serverless(app);
