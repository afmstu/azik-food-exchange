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
    'Fenerbahçe', 'Göztepe', 'Eğitim', 'Fikirtepe', 'Hasanpaşa', '19 Mayıs', 'Yenisahra',
    'Acıbadem', 'Koşuyolu', 'Merdivenköy', 'Bostancı', 'Suadiye', 'Caddebostan', 'Fenerbahçe',
    'Göztepe', 'Eğitim', 'Fikirtepe', 'Hasanpaşa', '19 Mayıs', 'Yenisahra', 'Acıbadem',
    'Koşuyolu', 'Merdivenköy', 'Bostancı', 'Suadiye', 'Caddebostan'
  ],
  'İstanbul-Beşiktaş': [
    'Levent', 'Etiler', 'Gayrettepe', 'Yıldız', 'Ortaköy', 'Bebek', 'Arnavutköy',
    'Kuruçeşme', 'Rumelihisarı', 'Sarıyer', 'Tarabya', 'Yeniköy', 'İstinye', 'Emirgan',
    'Baltalimanı', 'Aşiyan', 'Bebek', 'Arnavutköy', 'Kuruçeşme', 'Rumelihisarı'
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
      status: 'active'
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
    const listingsSnapshot = await db.collection('food_listings')
      .where('userId', '==', req.user.id)
      .get();

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

    // Send notification to offerer
    try {
      await createNotification(
        offer.offererId,
        'Teklifiniz Kabul Edildi',
        `${listing.title} ilanınıza verdiğiniz teklif kabul edildi!`,
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

module.exports.handler = serverless(app);
