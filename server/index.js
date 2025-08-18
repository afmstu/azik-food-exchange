const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Database setup
const db = new sqlite3.Database('./azik.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    phone TEXT NOT NULL,
    province TEXT NOT NULL,
    district TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    fullAddress TEXT NOT NULL,
    password TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Food listings table
  db.run(`CREATE TABLE IF NOT EXISTS food_listings (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    foodName TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    details TEXT,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id)
  )`);

  // Exchange offers table
  db.run(`CREATE TABLE IF NOT EXISTS exchange_offers (
    id TEXT PRIMARY KEY,
    listingId TEXT NOT NULL,
    offererId TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listingId) REFERENCES food_listings (id),
    FOREIGN KEY (offererId) REFERENCES users (id)
  )`);

  // Notifications table
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    isRead BOOLEAN DEFAULT 0,
    relatedId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id)
  )`);
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'azik-secret-key';

// Helper function to create notifications
const createNotification = (userId, type, title, message, relatedId = null) => {
  const notificationId = uuidv4();
  db.run(
    'INSERT INTO notifications (id, userId, type, title, message, relatedId) VALUES (?, ?, ?, ?, ?, ?)',
    [notificationId, userId, type, title, message, relatedId]
  );
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { role, firstName, lastName, phone, province, district, neighborhood, fullAddress, password } = req.body;
    
    if (!role || !firstName || !lastName || !phone || !province || !district || !neighborhood || !fullAddress || !password) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.run(
      'INSERT INTO users (id, role, firstName, lastName, phone, province, district, neighborhood, fullAddress, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, role, firstName, lastName, phone, province, district, neighborhood, fullAddress, hashedPassword],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Kayıt oluşturulamadı' });
        }
        
        const token = jwt.sign({ id: userId, role, firstName, lastName }, JWT_SECRET);
        res.status(201).json({ 
          message: 'Kayıt başarılı',
          token,
          user: { id: userId, role, firstName, lastName, phone, province, district, neighborhood, fullAddress }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Telefon ve şifre zorunludur' });
  }

  db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Sunucu hatası' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz telefon numarası veya şifre' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Geçersiz telefon numarası veya şifre' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET);
    res.json({ 
      message: 'Giriş başarılı',
      token,
      user: { 
        id: user.id, 
        role: user.role, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        phone: user.phone,
        province: user.province,
        district: user.district,
        neighborhood: user.neighborhood,
        fullAddress: user.fullAddress
      }
    });
  });
});

// Update user address
app.put('/api/user/address', authenticateToken, (req, res) => {
  const { province, district, neighborhood, fullAddress } = req.body;
  const userId = req.user.id;

  if (!province || !district || !neighborhood || !fullAddress) {
    return res.status(400).json({ error: 'Tüm adres alanları zorunludur' });
  }

  db.run(
    'UPDATE users SET province = ?, district = ?, neighborhood = ?, fullAddress = ? WHERE id = ?',
    [province, district, neighborhood, fullAddress, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Adres güncellenemedi' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      res.json({ 
        message: 'Adres başarıyla güncellendi',
        user: {
          province,
          district,
          neighborhood,
          fullAddress
        }
      });
    }
  );
});

// Get current user profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, role, firstName, lastName, phone, province, district, neighborhood, fullAddress, createdAt FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Kullanıcı bilgileri getirilemedi' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json(user);
  });
});

// Create food listing
app.post('/api/listings', authenticateToken, (req, res) => {
  const { foodName, quantity, details, startTime, endTime } = req.body;
  const userId = req.user.id;

  if (!foodName || !quantity || !startTime || !endTime) {
    return res.status(400).json({ error: 'Yemek adı, adet ve saat bilgileri zorunludur' });
  }

  const listingId = uuidv4();

  db.run(
    'INSERT INTO food_listings (id, userId, foodName, quantity, details, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [listingId, userId, foodName, quantity, details, startTime, endTime],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'İlan oluşturulamadı' });
      }
      res.status(201).json({ message: 'İlan başarıyla oluşturuldu', listingId });
    }
  );
});

// Delete food listing
app.delete('/api/listings/:listingId', authenticateToken, (req, res) => {
  const { listingId } = req.params;
  const userId = req.user.id;

  // Check if listing exists and belongs to user
  db.get('SELECT * FROM food_listings WHERE id = ?', [listingId], (err, listing) => {
    if (err) {
      return res.status(500).json({ error: 'Sunucu hatası' });
    }

    if (!listing) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    if (listing.userId !== userId) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    // Delete related offers first
    db.run('DELETE FROM exchange_offers WHERE listingId = ?', [listingId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Teklifler silinemedi' });
      }

      // Delete the listing
      db.run('DELETE FROM food_listings WHERE id = ?', [listingId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'İlan silinemedi' });
        }
        res.json({ message: 'İlan başarıyla silindi' });
      });
    });
  });
});

// Get all active listings
app.get('/api/listings', authenticateToken, (req, res) => {
  const { province, district } = req.query;
  let query = `
    SELECT fl.*, u.firstName, u.lastName, u.phone, u.province, u.district, u.neighborhood
    FROM food_listings fl
    JOIN users u ON fl.userId = u.id
    WHERE fl.status = 'active'
  `;
  let params = [];

  if (province) {
    query += ' AND u.province = ?';
    params.push(province);
  }
  if (district) {
    query += ' AND u.district = ?';
    params.push(district);
  }

  query += ' ORDER BY fl.createdAt DESC';

  db.all(query, params, (err, listings) => {
    if (err) {
      return res.status(500).json({ error: 'İlanlar getirilemedi' });
    }
    res.json(listings);
  });
});

// Create exchange offer
app.post('/api/offers', authenticateToken, (req, res) => {
  const { listingId } = req.body;
  const offererId = req.user.id;

  if (!listingId) {
    return res.status(400).json({ error: 'İlan ID zorunludur' });
  }

  // Check if listing exists and is active
  db.get('SELECT * FROM food_listings WHERE id = ? AND status = "active"', [listingId], (err, listing) => {
    if (err || !listing) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    if (listing.userId === offererId) {
      return res.status(400).json({ error: 'Kendi ilanınıza teklif veremezsiniz' });
    }

    // Check if user already made an offer
    db.get('SELECT * FROM exchange_offers WHERE listingId = ? AND offererId = ?', [listingId, offererId], (err, existingOffer) => {
      if (err) {
        return res.status(500).json({ error: 'Sunucu hatası' });
      }

      if (existingOffer) {
        return res.status(400).json({ error: 'Bu ilana zaten teklif verdiniz' });
      }

      const offerId = uuidv4();

      db.run(
        'INSERT INTO exchange_offers (id, listingId, offererId) VALUES (?, ?, ?)',
        [offerId, listingId, offererId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Teklif oluşturulamadı' });
          }
          
          // Create notification for listing owner
          createNotification(
            listing.userId,
            'new_offer',
            'Yeni Teklif',
            `${req.user.firstName} ${req.user.lastName} ilanınıza teklif verdi`,
            offerId
          );
          
          res.status(201).json({ message: 'Teklif başarıyla gönderildi', offerId });
        }
      );
    });
  });
});

// Accept/Reject offer
app.put('/api/offers/:offerId', authenticateToken, (req, res) => {
  const { offerId } = req.params;
  const { status } = req.body; // 'accepted' or 'rejected'

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Geçersiz durum' });
  }

  db.get('SELECT * FROM exchange_offers WHERE id = ?', [offerId], (err, offer) => {
    if (err || !offer) {
      return res.status(404).json({ error: 'Teklif bulunamadı' });
    }

    // Get listing details
    db.get('SELECT * FROM food_listings WHERE id = ?', [offer.listingId], (err, listing) => {
      if (err || !listing) {
        return res.status(404).json({ error: 'İlan bulunamadı' });
      }

      // Check if user owns the listing
      if (listing.userId !== req.user.id) {
        return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
      }

      db.run('UPDATE exchange_offers SET status = ? WHERE id = ?', [status, offerId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Teklif güncellenemedi' });
        }

        if (status === 'accepted') {
          // Mark listing as completed
          db.run('UPDATE food_listings SET status = "completed" WHERE id = ?', [offer.listingId]);
          
          // Get user details for notification
          db.get('SELECT phone, firstName, lastName FROM users WHERE id = ?', [offer.offererId], (err, offerer) => {
            if (!err && offerer) {
              // In a real app, you'd send SMS here
              console.log(`SMS to ${offerer.phone}: [${listing.foodName}] teklifiniz kabul edildi. İletişime geçin: ${req.user.phone}`);
              
              // Create notification for offerer
              createNotification(
                offer.offererId,
                'offer_accepted',
                'Teklif Kabul Edildi',
                `[${listing.foodName}] teklifiniz kabul edildi. İletişime geçin: ${req.user.phone}`,
                offerId
              );
            }
          });
        } else {
          // Create notification for rejected offer
          createNotification(
            offer.offererId,
            'offer_rejected',
            'Teklif Reddedildi',
            `[${listing.foodName}] teklifiniz reddedildi`,
            offerId
          );
        }

        res.json({ message: `Teklif ${status === 'accepted' ? 'kabul edildi' : 'reddedildi'}` });
      });
    });
  });
});

// Get user's listings
app.get('/api/my-listings', authenticateToken, (req, res) => {
  db.all('SELECT * FROM food_listings WHERE userId = ? ORDER BY createdAt DESC', [req.user.id], (err, listings) => {
    if (err) {
      return res.status(500).json({ error: 'İlanlar getirilemedi' });
    }
    res.json(listings);
  });
});

// Get user's offers
app.get('/api/my-offers', authenticateToken, (req, res) => {
  const query = `
    SELECT eo.*, fl.foodName, fl.quantity, u.firstName, u.lastName, u.phone
    FROM exchange_offers eo
    JOIN food_listings fl ON eo.listingId = fl.id
    JOIN users u ON fl.userId = u.id
    WHERE eo.offererId = ?
    ORDER BY eo.createdAt DESC
  `;
  
  db.all(query, [req.user.id], (err, offers) => {
    if (err) {
      return res.status(500).json({ error: 'Teklifler getirilemedi' });
    }
    res.json(offers);
  });
});

// Get offers for user's listings
app.get('/api/listing-offers', authenticateToken, (req, res) => {
  const query = `
    SELECT eo.*, fl.foodName, fl.quantity, u.firstName, u.lastName, u.phone
    FROM exchange_offers eo
    JOIN food_listings fl ON eo.listingId = fl.id
    JOIN users u ON eo.offererId = u.id
    WHERE fl.userId = ?
    ORDER BY eo.createdAt DESC
  `;
  
  db.all(query, [req.user.id], (err, offers) => {
    if (err) {
      return res.status(500).json({ error: 'Teklifler getirilemedi' });
    }
    res.json(offers);
  });
});

// Get provinces (mock data)
app.get('/api/provinces', (req, res) => {
  const provinces = [
    'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep',
    'Kayseri', 'Mersin', 'Diyarbakır', 'Samsun', 'Denizli', 'Eskişehir', 'Urfa',
    'Malatya', 'Erzurum', 'Van', 'Batman', 'Elazığ', 'Tokat', 'Sivas', 'Trabzon'
  ];
  res.json(provinces);
});

// Get districts by province (mock data)
app.get('/api/districts/:province', (req, res) => {
  const { province } = req.params;
  // Mock districts - in real app, this would come from a database
  const districts = {
    'İstanbul': [
      'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler', 'Bakırköy', 'Başakşehir', 
      'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü', 'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 
      'Esenler', 'Esenyurt', 'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane', 
      'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer', 'Silivri', 'Sultanbeyli', 
      'Sultangazi', 'Şile', 'Şişli', 'Tuzla', 'Ümraniye', 'Üsküdar', 'Zeytinburnu'
    ],
    'Ankara': [
      'Akyurt', 'Altındağ', 'Ayaş', 'Bala', 'Beypazarı', 'Çamlıdere', 'Çankaya', 'Çubuk', 'Elmadağ', 
      'Etimesgut', 'Evren', 'Gölbaşı', 'Güdül', 'Haymana', 'Kalecik', 'Kazan', 'Keçiören', 'Kızılcahamam', 
      'Mamak', 'Nallıhan', 'Polatlı', 'Pursaklar', 'Sincan', 'Şereflikoçhisar', 'Yenimahalle'
    ],
    'İzmir': [
      'Aliağa', 'Balçova', 'Bayındır', 'Bayraklı', 'Bergama', 'Beydağ', 'Bornova', 'Buca', 'Çeşme', 
      'Çiğli', 'Dikili', 'Foça', 'Gaziemir', 'Güzelbahçe', 'Karabağlar', 'Karaburun', 'Karşıyaka', 
      'Kemalpaşa', 'Kınık', 'Kiraz', 'Konak', 'Menderes', 'Menemen', 'Narlıdere', 'Ödemiş', 'Seferihisar', 
      'Selçuk', 'Tire', 'Torbalı', 'Urla'
    ],
    'Bursa': [
      'Büyükorhan', 'Gemlik', 'Gürsu', 'Harmancık', 'İnegöl', 'İznik', 'Karacabey', 'Keles', 'Kestel', 
      'Mudanya', 'Mustafakemalpaşa', 'Nilüfer', 'Orhaneli', 'Orhangazi', 'Osmangazi', 'Yenişehir', 'Yıldırım'
    ],
    'Antalya': [
      'Akseki', 'Aksu', 'Alanya', 'Demre', 'Döşemealtı', 'Elmalı', 'Finike', 'Gazipaşa', 'Gündoğmuş', 
      'İbradı', 'Kaş', 'Kemer', 'Kepez', 'Konyaaltı', 'Korkuteli', 'Kumluca', 'Manavgat', 'Muratpaşa', 
      'Serik'
    ],
    'Adana': [
      'Aladağ', 'Ceyhan', 'Çukurova', 'Feke', 'İmamoğlu', 'Karaisalı', 'Karataş', 'Kozan', 'Pozantı', 
      'Saimbeyli', 'Sarıçam', 'Seyhan', 'Tufanbeyli', 'Yumurtalık', 'Yüreğir'
    ],
    'Konya': [
      'Ahırlı', 'Akören', 'Akşehir', 'Altınekin', 'Beyşehir', 'Bozkır', 'Cihanbeyli', 'Çeltik', 'Çumra', 
      'Derbent', 'Derebucak', 'Doğanhisar', 'Emirgazi', 'Ereğli', 'Güneysınır', 'Hadim', 'Halkapınar', 
      'Hüyük', 'Ilgın', 'Kadınhanı', 'Karapınar', 'Karatay', 'Kulu', 'Meram', 'Sarayönü', 'Selçuklu', 
      'Seydişehir', 'Taşkent', 'Tuzlukçu', 'Yalıhüyük', 'Yunak'
    ],
    'Gaziantep': [
      'Araban', 'İslahiye', 'Karkamış', 'Nizip', 'Nurdağı', 'Oğuzeli', 'Şahinbey', 'Şehitkamil', 'Yavuzeli'
    ],
    'Kayseri': [
      'Akkışla', 'Bünyan', 'Develi', 'Felahiye', 'Hacılar', 'İncesu', 'Kocasinan', 'Melikgazi', 'Özvatan', 
      'Pınarbaşı', 'Sarıoğlan', 'Sarız', 'Talas', 'Tomarza', 'Yahyalı', 'Yeşilhisar'
    ],
    'Mersin': [
      'Akdeniz', 'Anamur', 'Aydıncık', 'Bozyazı', 'Çamlıyayla', 'Erdemli', 'Gülnar', 'Mezitli', 'Mut', 
      'Silifke', 'Tarsus', 'Toroslar', 'Yenişehir'
    ],
    'Diyarbakır': [
      'Bağlar', 'Bismil', 'Çermik', 'Çınar', 'Çüngüş', 'Dicle', 'Eğil', 'Ergani', 'Hani', 'Hazro', 
      'Kayapınar', 'Kocaköy', 'Kulp', 'Lice', 'Silvan', 'Sur', 'Yenişehir'
    ],
    'Samsun': [
      '19 Mayıs', 'Alaçam', 'Asarcık', 'Atakum', 'Ayvacık', 'Bafra', 'Canik', 'Çarşamba', 'Havza', 
      'İlkadım', 'Kavak', 'Ladik', 'Salıpazarı', 'Tekkeköy', 'Terme', 'Vezirköprü', 'Yakakent'
    ],
    'Denizli': [
      'Acıpayam', 'Babadağ', 'Baklan', 'Bekilli', 'Beyağaç', 'Bozkurt', 'Buldan', 'Çal', 'Çameli', 
      'Çardak', 'Çivril', 'Güney', 'Honaz', 'Kale', 'Merkezefendi', 'Pamukkale', 'Sarayköy', 'Serinhisar', 'Tavas'
    ],
    'Eskişehir': [
      'Alpu', 'Beylikova', 'Çifteler', 'Günyüzü', 'Han', 'İnönü', 'Mahmudiye', 'Mihalgazi', 'Mihalıççık', 
      'Odunpazarı', 'Sarıcakaya', 'Seyitgazi', 'Sivrihisar', 'Tepebaşı'
    ],
    'Urfa': [
      'Akçakale', 'Birecik', 'Bozova', 'Ceylanpınar', 'Eyyübiye', 'Halfeti', 'Haliliye', 'Harran', 
      'Hilvan', 'Karaköprü', 'Siverek', 'Suruç', 'Viranşehir'
    ],
    'Malatya': [
      'Akçadağ', 'Arapgir', 'Arguvan', 'Battalgazi', 'Darende', 'Doğanşehir', 'Doğanyol', 'Hekimhan', 
      'Kale', 'Kuluncak', 'Pütürge', 'Yazıhan', 'Yeşilyurt'
    ],
    'Erzurum': [
      'Aşkale', 'Aziziye', 'Çat', 'Hınıs', 'Horasan', 'İspir', 'Karaçoban', 'Karayazı', 'Köprüköy', 
      'Narman', 'Oltu', 'Olur', 'Palandöken', 'Pasinler', 'Pazaryolu', 'Şenkaya', 'Tekman', 'Tortum', 'Uzundere', 'Yakutiye'
    ],
    'Van': [
      'Bahçesaray', 'Başkale', 'Çaldıran', 'Çatak', 'Edremit', 'Erciş', 'Gevaş', 'Gürpınar', 'İpekyolu', 
      'Muradiye', 'Özalp', 'Saray', 'Tuşba'
    ],
    'Batman': [
      'Beşiri', 'Gercüş', 'Hasankeyf', 'Kozluk', 'Merkez', 'Sason'
    ],
    'Elazığ': [
      'Ağın', 'Alacakaya', 'Arıcak', 'Baskil', 'Karakoçan', 'Keban', 'Kovancılar', 'Maden', 'Merkez', 'Palu', 'Sivrice'
    ],
    'Tokat': [
      'Almus', 'Artova', 'Başçiftlik', 'Erbaa', 'Merkez', 'Niksar', 'Pazar', 'Reşadiye', 'Sulusaray', 'Turhal', 'Yeşilyurt', 'Zile'
    ],
    'Sivas': [
      'Akıncılar', 'Altınyayla', 'Divriği', 'Doğanşar', 'Gemerek', 'Gölova', 'Hafik', 'İmranlı', 'Kangal', 'Koyulhisar', 'Merkez', 'Şarkışla', 'Suşehri', 'Ulaş', 'Yıldızeli', 'Zara'
    ],
    'Trabzon': [
      'Akçaabat', 'Araklı', 'Arsin', 'Beşikdüzü', 'Çarşıbaşı', 'Çaykara', 'Dernekpazarı', 'Düzköy', 'Hayrat', 'Köprübaşı', 'Maçka', 'Of', 'Ortahisar', 'Sürmene', 'Şalpazarı', 'Tonya', 'Vakfıkebir', 'Yomra'
    ]
  };
  
  res.json(districts[province] || []);
});

// Get neighborhoods by district (mock data)
app.get('/api/neighborhoods/:province/:district', (req, res) => {
  const { province, district } = req.params;
  // Mock neighborhoods - in real app, this would come from a database
  const neighborhoods = {
    // İstanbul Mahalleleri
    'İstanbul-Kadıköy': ['Fenerbahçe', 'Caddebostan', 'Suadiye', 'Bağdat Caddesi', 'Göztepe', 'Erenköy', 'Bostancı', 'Hasanpaşa', 'Osmanağa', 'Rasimpaşa', '19 Mayıs', 'Zühtüpaşa', 'Merdivenköy', 'Koşuyolu', 'Sahrayıcedit'],
    'İstanbul-Beşiktaş': ['Levent', 'Etiler', 'Bebek', 'Ortaköy', 'Arnavutköy', 'Gayrettepe', 'Yıldız', 'Vişnezade', 'Sinanpaşa', 'Muradiye', 'Nispetiye', 'Türkali', 'Dikilitaş', 'Abbasağa', 'Mecidiye'],
    'İstanbul-Şişli': ['Nişantaşı', 'Teşvikiye', 'Maçka', 'Mecidiyeköy', 'Gültepe', 'Esentepe', 'Feriköy', 'Kurtuluş', 'Bomonti', 'Pangaltı', 'Harbiye', 'Halaskargazi', 'Meşrutiyet', 'Halide Edip Adıvar'],
    'İstanbul-Beyoğlu': ['Taksim', 'Galata', 'Karaköy', 'Cihangir', 'Beyoğlu', 'Kuledibi', 'Kemankeş', 'Kılıçali Paşa', 'Tomtom', 'Asmalımescit', 'Kalyoncukulluk', 'Pürtelaş', 'Hacıahmet', 'Kemankeş Karamustafapaşa'],
    'İstanbul-Fatih': ['Sultanahmet', 'Eminönü', 'Beyazıt', 'Aksaray', 'Vefa', 'Süleymaniye', 'Balat', 'Fener', 'Ayvansaray', 'Yavuz Sultan Selim', 'Hırka-i Şerif', 'Muhsine Hatun', 'Karagümrük', 'Kocamustafapaşa'],
    'İstanbul-Üsküdar': ['Acıbadem', 'Altunizade', 'Bağlarbaşı', 'Kuzguncuk', 'Çengelköy', 'Beylerbeyi', 'Küçüksu', 'Kandilli', 'Vaniköy', 'Büyükçamlıca', 'Küçükçamlıca', 'Fethi Paşa', 'Mihrimah Sultan', 'Ahmediye', 'İcadiye'],
    'İstanbul-Sarıyer': ['Sarıyer', 'Tarabya', 'Yeniköy', 'Büyükdere', 'Rumeli Hisarı', 'Emirgan', 'İstinye', 'Reşitpaşa', 'Darüşşafaka', 'Pınar', 'Kireçburnu', 'Kumköy', 'Baltalimanı', 'Maslak', 'Ayazağa'],
    'İstanbul-Bakırköy': ['Bakırköy', 'Yeşilköy', 'Florya', 'Ataköy', 'Zeytinburnu', 'Kartaltepe', 'Osmaniye', 'Cevizlik', 'Kartaltepe', 'Şenlikköy', 'Basınköy', 'Fenerbahçe', 'Merter', 'Güngören'],
    'İstanbul-Kartal': ['Kartal', 'Pendik', 'Maltepe', 'Ataşehir', 'Kadıköy', 'Soğanlık', 'Uğur Mumcu', 'Yalı', 'Orhantepe', 'Dragos', 'Fenerbahçe', 'Yenişehir', 'Gülsuyu', 'Esentepe'],
    'İstanbul-Maltepe': ['Maltepe', 'Kartal', 'Pendik', 'Ataşehir', 'Kadıköy', 'Feyzullah', 'Başıbüyük', 'Büyükbakkalköy', 'Cevizli', 'Esenkent', 'Fındıklı', 'Gülensu', 'İdealtepe', 'Küçükyalı'],
    'İstanbul-Ataşehir': ['Ataşehir', 'Kadıköy', 'Maltepe', 'Kartal', 'Pendik', 'Atatürk', 'Barbaros', 'Esatpaşa', 'Ferhatpaşa', 'Fetih', 'İçerenköy', 'İnönü', 'Kayışdağı', 'Küçükbakkalköy', 'Mevlana'],
    'İstanbul-Ümraniye': ['Ümraniye', 'Kadıköy', 'Ataşehir', 'Maltepe', 'Kartal', 'Atakent', 'Çakmak', 'Esenşehir', 'Esenevler', 'Ihlamurkuyu', 'İnkılap', 'Madenler', 'Mustafa Kemal', 'Namık Kemal', 'Tantavi'],
    'İstanbul-Başakşehir': ['Başakşehir', 'Esenyurt', 'Avcılar', 'Küçükçekmece', 'Sultangazi', 'Başak', 'Kayabaşı', 'Şahintepe', 'Altınşehir', 'Bahçeşehir', 'Güvercintepe', 'Ziya Gökalp', 'Mehmet Akif Ersoy', 'Orhan Gazi'],
    'İstanbul-Esenyurt': ['Esenyurt', 'Avcılar', 'Küçükçekmece', 'Başakşehir', 'Beylikdüzü', 'Ardıçlı', 'Aşık Veysel', 'Atatürk', 'Cumhuriyet', 'Fatih', 'Gökevler', 'İnönü', 'İnşaat', 'Kıraç', 'Mehterçeşme'],
    'İstanbul-Beylikdüzü': ['Beylikdüzü', 'Esenyurt', 'Avcılar', 'Küçükçekmece', 'Büyükçekmece', 'Adnan Kahveci', 'Barış', 'Büyükşehir', 'Cumhuriyet', 'Dereağzı', 'Gürpınar', 'Marmara', 'Sahil', 'Yakuplu'],
    
    // Ankara Mahalleleri
    'Ankara-Çankaya': ['Kızılay', 'Bahçelievler', 'Emek', 'Çayyolu', 'Ümitköy', 'Yıldız', 'Çankaya', 'Kurtuluş', 'Kurtuluş', 'Kurtuluş', 'Kurtuluş', 'Kurtuluş', 'Kurtuluş', 'Kurtuluş', 'Kurtuluş'],
    'Ankara-Keçiören': ['Keçiören', 'Etlik', 'Sanatoryum', 'Bağlum', 'Uyanış', 'Aktaş', 'Aşağı Eğlence', 'Bademlik', 'Bağlarbaşı', 'Basınevleri', 'Cumhuriyet', 'Emrah', 'Ertuğrulgazi', 'Güçlükaya', 'Gümüşoluk'],
    'Ankara-Mamak': ['Mamak', 'Kutludüğün', 'Gülveren', 'Tuzluçayır', 'Hürel', 'Abidinpaşa', 'Akdere', 'Akşemsettin', 'Altıağaç', 'Altınevler', 'Aşağı İmrahor', 'Bayındır', 'Boğaziçi', 'Bostancık', 'Cengizhan'],
    'Ankara-Yenimahalle': ['Yenimahalle', 'Demetevler', 'Karşıyaka', 'Batıkent', 'Şentepe', 'Aşağı Yahşihan', 'Barış', 'Barış', 'Barış', 'Barış', 'Barış', 'Barış', 'Barış', 'Barış', 'Barış'],
    'Ankara-Etimesgut': ['Etimesgut', 'Elvankent', 'Güzelkent', 'Erler', 'Yurtçu', 'Ahi Mesut', 'Alsancak', 'Altay', 'Aşağıyurtçu', 'Atakent', 'Atayurt', 'Ayyıldız', 'Bağlıca', 'Bahçekapı', 'Balgat'],
    'Ankara-Sincan': ['Sincan', 'Temelli', 'Yenikent', 'Osmanlı', 'Akören', 'Akçaören', 'Alagöz', 'Alcı', 'Alcı', 'Alcı', 'Alcı', 'Alcı', 'Alcı', 'Alcı', 'Alcı'],
    
    // İzmir Mahalleleri
    'İzmir-Konak': ['Alsancak', 'Konak', 'Güzelyalı', 'Bostanlı', 'Karşıyaka', 'Bornova', 'Bahçelerarası', 'Bahriye Üçok', 'Basmane', 'Bayraklı', 'Cennetçeşme', 'Çankaya', 'Çimentepe', 'Eşrefpaşa', 'Gazi'],
    'İzmir-Bornova': ['Bornova', 'Çiğli', 'Karşıyaka', 'Buca', 'Gaziemir', 'Altındağ', 'Atatürk', 'Barbaros', 'Çamdibi', 'Erzene', 'Evka 3', 'Evka 4', 'Evka 5', 'Evka 6', 'Evka 7'],
    'İzmir-Karşıyaka': ['Karşıyaka', 'Bostanlı', 'Alaybey', 'Tersane', 'Atakent', 'Alaybey', 'Atakent', 'Bostanlı', 'Çiğli', 'Çiğli', 'Çiğli', 'Çiğli', 'Çiğli', 'Çiğli', 'Çiğli'],
    'İzmir-Buca': ['Buca', 'Bornova', 'Gaziemir', 'Konak', 'Karşıyaka', 'Adatepe', 'Atatürk', 'Barış', 'Belediye Evleri', 'Buca Koop', 'Cumhuriyet', 'Çağdaş', 'Çaldıran', 'Çamlıkule', 'Çamlıkule'],
    'İzmir-Çiğli': ['Çiğli', 'Karşıyaka', 'Bornova', 'Konak', 'Buca', 'Ataşehir', 'Balatçık', 'Egekent', 'Evka 2', 'Evka 5', 'Evka 6', 'Gazi', 'Gazi', 'Gazi', 'Gazi'],
    'İzmir-Gaziemir': ['Gaziemir', 'Konak', 'Buca', 'Bornova', 'Karşıyaka', 'Aktepe', 'Atatürk', 'Emrez', 'Menderes', 'Sevgi', 'Yeşil', 'Yeşil', 'Yeşil', 'Yeşil', 'Yeşil'],
    'İzmir-Bayraklı': ['Bayraklı', 'Bornova', 'Karşıyaka', 'Konak', 'Buca', 'Adalet', 'Bayraklı', 'Fuat Edip Baksı', 'Gümüşpala', 'Manavkuyu', 'Osmangazi', 'Postacılar', 'Salhane', 'Soğukkuyu', 'Yamanlar'],
    
    // Bursa Mahalleleri
    'Bursa-Nilüfer': ['Nilüfer', 'Görükle', 'Üçevler', 'Fethiye', 'Beşevler', 'Akçalar', 'Alaaddinbey', 'Balat', 'Bursa', 'Çalı', 'Dağyenice', 'Gökçe', 'Görükle', 'Görükle', 'Görükle'],
    'Bursa-Osmangazi': ['Osmangazi', 'Tophane', 'Muradiye', 'Yıldırım', 'Hamitler', 'Adalet', 'Ahmetbey', 'Akpınar', 'Aktarhüseyin', 'Alaaddin', 'Alacahırka', 'Alacamescit', 'Alemdar', 'Alipaşa'],
    'Bursa-Yıldırım': ['Yıldırım', 'Osmangazi', 'Nilüfer', 'Mudanya', 'Gürsu', '152 Evler', '75. Yıl', 'Akçağlayan', 'Anadolu', 'Arabayatağı', 'Aşağıkızlık', 'Avdan', 'Baruthane', 'Beyazıt', 'Büyükbalıklı'],
    'Bursa-Mudanya': ['Mudanya', 'Nilüfer', 'Osmangazi', 'Yıldırım', 'Gürsu', 'Bademli', 'Bostanlı', 'Çağrışan', 'Dereköy', 'Eğerce', 'Esence', 'Fenerbahçe', 'Göynüklü', 'Güzelyalı', 'Hançerli'],
    
    // Antalya Mahalleleri
    'Antalya-Muratpaşa': ['Muratpaşa', 'Konyaaltı', 'Döşemealtı', 'Aksu', 'Kepez', 'Altındağ', 'Bahçelievler', 'Balbey', 'Barbaros', 'Bayındır', 'Cumhuriyet', 'Çağlayan', 'Çaybaşı', 'Demircikara', 'Deniz'],
    'Antalya-Kepez': ['Kepez', 'Döşemealtı', 'Aksu', 'Muratpaşa', 'Konyaaltı', 'Ahatlı', 'Aktoprak', 'Altıayak', 'Altınova Düden', 'Altınova Orta', 'Altınova Sinan', 'Atatürk', 'Avni Tolunay', 'Ayanoğlu', 'Aydoğmuş'],
    'Antalya-Konyaaltı': ['Konyaaltı', 'Muratpaşa', 'Kepez', 'Döşemealtı', 'Aksu', 'Akkuyu', 'Aksu', 'Altınkum', 'Arapsuyu', 'Aşağıkaraman', 'Aşağıkayacık', 'Ata', 'Bahçelievler', 'Çağdaş', 'Çakırlar'],
    
    // Adana Mahalleleri
    'Adana-Seyhan': ['Seyhan', 'Çukurova', 'Sarıçam', 'Yüreğir', 'Karaisalı', 'Akıncılar', 'Aladağlı', 'Atakent', 'Aydınlar', 'Bahçelievler', 'Barış', 'Belediye Evleri', 'Bey', 'Büyükçıldırım', 'Cemalpaşa'],
    'Adana-Çukurova': ['Çukurova', 'Seyhan', 'Sarıçam', 'Yüreğir', 'Karaisalı', 'Belediye Evleri', 'Beyazevler', 'Bozcalar', 'Cumhuriyet', 'Çatalan', 'Çatalan', 'Çatalan', 'Çatalan', 'Çatalan', 'Çatalan'],
    
    // Konya Mahalleleri
    'Konya-Selçuklu': ['Selçuklu', 'Meram', 'Karatay', 'Cihanbeyli', 'Ereğli', 'Akademi', 'Akşehir', 'Alaaddin', 'Alparslan', 'Altınova', 'Aşağıpınarbaşı', 'Aşkan', 'Atakent', 'Ayanbey', 'Başarakavak'],
    'Konya-Meram': ['Meram', 'Selçuklu', 'Karatay', 'Cihanbeyli', 'Ereğli', 'Alakova', 'Alavardı', 'Ali Ulvi Kurucu', 'Aşkan', 'Ateşbaz Veli', 'Aşkan', 'Aşkan', 'Aşkan', 'Aşkan', 'Aşkan'],
    
    // Gaziantep Mahalleleri
    'Gaziantep-Şahinbey': ['Şahinbey', 'Şehitkamil', 'Oğuzeli', 'Nizip', 'İslahiye', 'Aktoprak', 'Arıl', 'Atatürk', 'Aydınlar', 'Bağlarbaşı', 'Bahçelievler', 'Barış', 'Battal', 'Beyazlar', 'Beyazlar'],
    'Gaziantep-Şehitkamil': ['Şehitkamil', 'Şahinbey', 'Oğuzeli', 'Nizip', 'İslahiye', 'Aktoprak', 'Arıl', 'Atatürk', 'Aydınlar', 'Bağlarbaşı', 'Bahçelievler', 'Barış', 'Battal', 'Beyazlar', 'Beyazlar'],
    
    // Kayseri Mahalleleri
    'Kayseri-Melikgazi': ['Melikgazi', 'Kocasinan', 'Talas', 'Develi', 'Yahyalı', 'Ağırnas', 'Alpaslan', 'Argıncık', 'Aşık Seyrani', 'Atatürk', 'Battalgazi', 'Beyazşehir', 'Büyükbürüngüz', 'Cumhuriyet', 'Cumhuriyet'],
    'Kayseri-Kocasinan': ['Kocasinan', 'Melikgazi', 'Talas', 'Develi', 'Yahyalı', 'Ağırnas', 'Alpaslan', 'Argıncık', 'Aşık Seyrani', 'Atatürk', 'Battalgazi', 'Beyazşehir', 'Büyükbürüngüz', 'Cumhuriyet', 'Cumhuriyet'],
    
    // Mersin Mahalleleri
    'Mersin-Yenişehir': ['Yenişehir', 'Toroslar', 'Akdeniz', 'Tarsus', 'Erdemli', 'Akdeniz', 'Aladağ', 'Anamur', 'Aydıncık', 'Bozyazı', 'Çamlıyayla', 'Erdemli', 'Gülnar', 'Mezitli', 'Mut'],
    'Mersin-Toroslar': ['Toroslar', 'Yenişehir', 'Akdeniz', 'Tarsus', 'Erdemli', 'Akdeniz', 'Aladağ', 'Anamur', 'Aydıncık', 'Bozyazı', 'Çamlıyayla', 'Erdemli', 'Gülnar', 'Mezitli', 'Mut']
  };
  
  const key = `${province}-${district}`;
  res.json(neighborhoods[key] || []);
});

// Get user notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50',
    [req.user.id],
    (err, notifications) => {
      if (err) {
        return res.status(500).json({ error: 'Bildirimler yüklenemedi' });
      }
      res.json(notifications);
    }
  );
});

// Mark notification as read
app.put('/api/notifications/:notificationId/read', authenticateToken, (req, res) => {
  const { notificationId } = req.params;
  
  db.run(
    'UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?',
    [notificationId, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Bildirim güncellenemedi' });
      }
      res.json({ message: 'Bildirim okundu olarak işaretlendi' });
    }
  );
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, (req, res) => {
  db.get(
    'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0',
    [req.user.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Bildirim sayısı alınamadı' });
      }
      res.json({ count: result.count });
    }
  );
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
