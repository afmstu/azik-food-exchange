const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const validator = require('validator');
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

// Create tables and clear all data
db.serialize(() => {
  // Drop existing tables
  db.run('DROP TABLE IF EXISTS notifications');
  db.run('DROP TABLE IF EXISTS exchange_offers');
  db.run('DROP TABLE IF EXISTS food_listings');
  db.run('DROP TABLE IF EXISTS email_verifications');
  db.run('DROP TABLE IF EXISTS users');
  
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    province TEXT NOT NULL,
    district TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    fullAddress TEXT NOT NULL,
    password TEXT NOT NULL,
    fcmToken TEXT,
    isEmailVerified BOOLEAN DEFAULT 0,
    isLocked BOOLEAN DEFAULT 0,
    failedLoginAttempts INTEGER DEFAULT 0,
    lastFailedLogin DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Email verifications table
  db.run(`CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    email TEXT NOT NULL,
    verificationToken TEXT NOT NULL UNIQUE,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
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
  
  console.log('Database reset complete - all data cleared!');
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'azik-secret-key';

// Email validation function
const validateEmail = (email) => {
  return validator.isEmail(email);
};

// Password validation function
const validatePassword = (password) => {
  // Sadece minimum 8 karakter kontrolü
  return password.length >= 8;
};

// Email configuration
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  console.log('Email credentials found, initializing transporter...');
  console.log('Email user:', process.env.EMAIL_USER);
  console.log('Email pass length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);
  
  // Try multiple Gmail configurations
  const configs = [
    {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    },
    {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    },
    {
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    }
  ];

  let configIndex = 0;
  
  const tryConfig = () => {
    if (configIndex >= configs.length) {
      console.log('All email configurations failed');
      return;
    }
    
    const config = configs[configIndex];
    console.log(`Trying email config ${configIndex + 1}:`, {
      host: config.host || config.service,
      port: config.port,
      secure: config.secure
    });
    
    transporter = nodemailer.createTransport(config);
    
    transporter.verify(function(error, success) {
      if (error) {
        console.log(`Config ${configIndex + 1} failed:`, error.message);
        configIndex++;
        tryConfig();
      } else {
        console.log(`Email config ${configIndex + 1} successful!`);
      }
    });
  };
  
  tryConfig();
} else {
  console.log('Email credentials not found - email verification disabled');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
}

// Send verification email function
const sendVerificationEmail = async (email, verificationToken) => {
  console.log('=== EMAIL SENDING DEBUG ===');
  console.log('Transporter available:', !!transporter);
  console.log('Email to send to:', email);
  console.log('Verification token:', verificationToken);
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
  
  if (!transporter) {
    console.log('❌ Email transporter not available');
    return false;
  }

  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
  console.log('Verification URL:', verificationUrl);
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Azık Platformu" <noreply@azik.com>',
    to: email,
    subject: 'Azık - E-posta Doğrulama',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff9a56 0%, #ffd93d 50%, #ff6b35 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Azık</h1>
          <p style="color: white; margin: 10px 0 0 0;">Yemek Takası Platformu</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">E-posta Adresinizi Doğrulayın</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            Azık platformuna hoş geldiniz! Hesabınızı aktifleştirmek için aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(135deg, #ff6b35, #ff9a56); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              E-posta Adresimi Doğrula
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 25px;">
            Bu e-posta 24 saat geçerlidir. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Bu girişim, Boğaziçi Üniversitesi Ekonomi öğrencisi Mustafa Özkoca tarafından gönüllü olarak geliştirilmiştir.
          </p>
        </div>
      </div>
    `
  };

  try {
    console.log('📧 Attempting to send verification email...');
    console.log('From:', process.env.EMAIL_USER);
    console.log('To:', email);
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent successfully to', email);
    console.log('Message ID:', result.messageId);
    console.log('=== EMAIL SENDING SUCCESS ===');
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      message: error.message
    });
    console.log('=== EMAIL SENDING FAILED ===');
    return false;
  }
};

// Initialize Firebase Admin SDK
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  console.log('Firebase service account not found in environment variables');
  // For now, skip Firebase initialization in development
  serviceAccount = null;
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully');
} else {
  console.log('Firebase Admin SDK not initialized - service account not available');
}

// Helper function to create notifications
const createNotification = (userId, type, title, message, relatedId = null) => {
  const notificationId = uuidv4();
  db.run(
    'INSERT INTO notifications (id, userId, type, title, message, relatedId) VALUES (?, ?, ?, ?, ?, ?)',
    [notificationId, userId, type, title, message, relatedId]
  );
};

// Helper function to send FCM notification
const sendFCMNotification = async (userId, title, body, data = {}) => {
  try {
    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      console.log('Firebase Admin not initialized, skipping FCM notification');
      return;
    }

    // Get user's FCM token
    db.get('SELECT fcmToken FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err || !user || !user.fcmToken) {
        console.log('FCM token not found for user:', userId);
        return;
      }

      const message = {
        notification: {
          title: title,
          body: body
        },
        data: data,
        token: user.fcmToken
      };

      try {
        const response = await admin.messaging().send(message);
        console.log('FCM notification sent successfully:', response);
      } catch (error) {
        console.error('Error sending FCM notification:', error);
      }
    });
  } catch (error) {
    console.error('Error in sendFCMNotification:', error);
  }
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
    const { role, firstName, lastName, email, phone, province, district, neighborhood, fullAddress, password } = req.body;
    
    if (!role || !firstName || !lastName || !email || !phone || !province || !district || !neighborhood || !fullAddress || !password) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur' });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
    }

    // Validate password
    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Check if email or phone already exists
    db.get('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Sunucu hatası' });
      }

      if (existingUser) {
        return res.status(400).json({ error: 'Bu e-posta adresi veya telefon numarası zaten kullanılıyor' });
      }

      // Insert user with email verification status
      db.run(
        'INSERT INTO users (id, role, firstName, lastName, email, phone, province, district, neighborhood, fullAddress, password, isEmailVerified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, role, firstName, lastName, email, phone, province, district, neighborhood, fullAddress, hashedPassword, 0],
        async function(err) {
          if (err) {
            return res.status(500).json({ error: 'Kayıt oluşturulamadı' });
          }

          // Create verification token
          const verificationToken = uuidv4();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          // Insert verification record
          db.run(
            'INSERT INTO email_verifications (id, userId, email, verificationToken, expiresAt) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), userId, email, verificationToken, expiresAt.toISOString()],
            async function(err) {
              if (err) {
                console.error('Error creating verification record:', err);
              }

              // Send verification email
              const emailSent = await sendVerificationEmail(email, verificationToken);
              
              if (emailSent) {
                res.status(201).json({ 
                  message: 'Kayıt başarılı! E-posta adresinizi doğrulayın.',
                  requiresVerification: true,
                  user: { id: userId, role, firstName, lastName, email, phone, province, district, neighborhood, fullAddress }
                });
              } else {
                res.status(201).json({ 
                  message: 'Kayıt başarılı! E-posta gönderilemedi, lütfen daha sonra tekrar deneyin.',
                  requiresVerification: true,
                  emailSent: false,
                  user: { id: userId, role, firstName, lastName, email, phone, province, district, neighborhood, fullAddress }
                });
              }
            }
          );
        }
      );
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur' });
  }

  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Sunucu hatası' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({ 
        error: 'E-posta adresiniz henüz doğrulanmamış',
        requiresVerification: true 
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
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
        email: user.email,
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

// Email verification endpoint (POST)
app.post('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Doğrulama token\'ı gerekli' });
    }

    // Find verification record
    db.get('SELECT * FROM email_verifications WHERE verificationToken = ?', [token], async (err, verification) => {
      if (err) {
        return res.status(500).json({ error: 'Sunucu hatası' });
      }

      if (!verification) {
        return res.status(400).json({ error: 'Geçersiz doğrulama token\'ı' });
      }

      // Check if token is expired
      if (new Date() > new Date(verification.expiresAt)) {
        return res.status(400).json({ error: 'Doğrulama token\'ı süresi dolmuş' });
      }

      // Update user email verification status
      db.run('UPDATE users SET isEmailVerified = 1 WHERE id = ?', [verification.userId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'E-posta doğrulanamadı' });
        }

        // Delete the verification record
        db.run('DELETE FROM email_verifications WHERE id = ?', [verification.id], function(err) {
          if (err) {
            console.error('Error deleting verification record:', err);
          }

          // Get user info for token
          db.get('SELECT * FROM users WHERE id = ?', [verification.userId], (err, user) => {
            if (err) {
              return res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
            }

            const token = jwt.sign({ id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET);
            
            res.json({ 
              success: true,
              message: 'E-posta başarıyla doğrulandı',
              token,
              user: { 
                id: user.id, 
                role: user.role, 
                firstName: user.firstName, 
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                province: user.province,
                district: user.district,
                neighborhood: user.neighborhood,
                fullAddress: user.fullAddress
              }
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Email verification endpoint (GET - for direct link access)
app.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Doğrulama token\'ı gerekli' });
    }

    // Find verification record
    db.get('SELECT * FROM email_verifications WHERE verificationToken = ?', [token], async (err, verification) => {
      if (err) {
        return res.status(500).json({ error: 'Sunucu hatası' });
      }

      if (!verification) {
        return res.status(400).json({ error: 'Geçersiz doğrulama token\'ı' });
      }

      // Check if token is expired
      if (new Date() > new Date(verification.expiresAt)) {
        return res.status(400).json({ error: 'Doğrulama token\'ı süresi dolmuş' });
      }

      // Update user email verification status
      db.run('UPDATE users SET isEmailVerified = 1 WHERE id = ?', [verification.userId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'E-posta doğrulanamadı' });
        }

        // Delete the verification record
        db.run('DELETE FROM email_verifications WHERE id = ?', [verification.id], function(err) {
          if (err) {
            console.error('Error deleting verification record:', err);
          }

          // Get user info for token
          db.get('SELECT * FROM users WHERE id = ?', [verification.userId], (err, user) => {
            if (err) {
              return res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
            }

            const token = jwt.sign({ id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET);
            
            // Redirect to frontend with success message
            const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}&success=true`;
            res.redirect(redirectUrl);
          });
        });
      });
    });
  } catch (error) {
    console.error('Email verification error:', error);
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?error=server_error`;
    res.redirect(redirectUrl);
  }
});

// Test email endpoint (for debugging)
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Geçerli bir e-posta adresi gerekli' });
    }

    if (!transporter) {
      return res.status(500).json({ error: 'E-posta servisi yapılandırılmamış' });
    }

    const testMailOptions = {
      from: process.env.EMAIL_FROM || '"Azık Platformu" <noreply@azik.com>',
      to: email,
      subject: 'Azık - Test E-postası',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Test E-postası</h2>
          <p>Bu bir test e-postasıdır. E-posta servisi çalışıyor.</p>
          <p>Alıcı: ${email}</p>
          <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
        </div>
      `
    };

    const result = await transporter.sendMail(testMailOptions);
    res.json({ 
      success: true, 
      message: 'Test e-postası başarıyla gönderildi',
      messageId: result.messageId 
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      error: 'Test e-postası gönderilemedi',
      details: {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      }
    });
  }
});

// Resend verification email endpoint
app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Geçerli bir e-posta adresi gerekli' });
    }

    // Find user
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Sunucu hatası' });
      }

      if (!user) {
        return res.status(404).json({ error: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı' });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten doğrulanmış' });
      }

      // Delete old verification records
      db.run('DELETE FROM email_verifications WHERE userId = ?', [user.id], function(err) {
        if (err) {
          console.error('Error deleting old verification records:', err);
        }

        // Create new verification token
        const verificationToken = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Insert new verification record
        db.run(
          'INSERT INTO email_verifications (id, userId, email, verificationToken, expiresAt) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), user.id, email, verificationToken, expiresAt.toISOString()],
          async function(err) {
            if (err) {
              console.error('Error creating verification record:', err);
              return res.status(500).json({ error: 'Doğrulama e-postası gönderilemedi' });
            }

            // Send verification email
            const emailSent = await sendVerificationEmail(email, verificationToken);
            
            if (emailSent) {
              res.json({ message: 'Doğrulama e-postası tekrar gönderildi' });
            } else {
              res.status(500).json({ error: 'E-posta gönderilemedi' });
            }
          }
        );
      });
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get current user profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, role, firstName, lastName, email, phone, province, district, neighborhood, fullAddress, createdAt FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Kullanıcı bilgileri getirilemedi' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json(user);
  });
});

// Save FCM token
app.post('/api/user/fcm-token', authenticateToken, (req, res) => {
  const { fcmToken } = req.body;
  
  if (!fcmToken) {
    return res.status(400).json({ error: 'FCM token zorunludur' });
  }

  db.run('UPDATE users SET fcmToken = ? WHERE id = ?', [fcmToken, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'FCM token kaydedilemedi' });
    }
    res.json({ message: 'FCM token başarıyla kaydedildi' });
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
    'INSERT INTO food_listings (id, userId, foodName, quantity, details, startTime, endTime, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [listingId, userId, foodName, quantity, details, startTime, endTime, 'active'],
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
app.get('/api/listings', (req, res) => {
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
          
          // Get offerer details for notification
          db.get('SELECT firstName, lastName FROM users WHERE id = ?', [offererId], (err, offerer) => {
            if (!err && offerer) {
              const notificationMessage = `${offerer.firstName} ${offerer.lastName} ilanınıza teklif verdi`;
              
              // Create notification for listing owner
              createNotification(
                listing.userId,
                'new_offer',
                'Yeni Teklif',
                notificationMessage,
                offerId
              );
              
              // Send FCM notification
              sendFCMNotification(
                listing.userId,
                'Yeni Teklif',
                notificationMessage,
                { type: 'new_offer', offerId: offerId }
              );
            }
          });
          
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
              // Get listing owner's phone number
              db.get('SELECT phone FROM users WHERE id = ?', [req.user.id], (err, listingOwner) => {
                if (!err && listingOwner) {
                  // In a real app, you'd send SMS here
                  console.log(`SMS to ${offerer.phone}: [${listing.foodName}] teklifiniz kabul edildi. İletişime geçin: ${listingOwner.phone}`);
                  
                  const notificationMessage = `[${listing.foodName}] teklifiniz kabul edildi. İletişime geçin: ${listingOwner.phone}`;
                  
                  // Create notification for offerer
                  createNotification(
                    offer.offererId,
                    'offer_accepted',
                    'Teklif Kabul Edildi',
                    notificationMessage,
                    offerId
                  );
                  
                  // Send FCM notification
                  sendFCMNotification(
                    offer.offererId,
                    'Teklif Kabul Edildi',
                    notificationMessage,
                    { type: 'offer_accepted', offerId: offerId }
                  );
                }
              });
            }
          });
        } else {
          const notificationMessage = `[${listing.foodName}] teklifiniz reddedildi`;
          
          // Create notification for rejected offer
          createNotification(
            offer.offererId,
            'offer_rejected',
            'Teklif Reddedildi',
            notificationMessage,
            offerId
          );
          
          // Send FCM notification
          sendFCMNotification(
            offer.offererId,
            'Teklif Reddedildi',
            notificationMessage,
            { type: 'offer_rejected', offerId: offerId }
          );
        }

        res.json({ message: `Teklif ${status === 'accepted' ? 'kabul edildi' : 'reddedildi'}` });
      });
    });
  });
});

// Get user's listings
app.get('/api/my-listings', authenticateToken, (req, res) => {
  const query = `
    SELECT fl.*, u.firstName, u.lastName, u.phone, u.province, u.district, u.neighborhood
    FROM food_listings fl
    JOIN users u ON fl.userId = u.id
    WHERE fl.userId = ?
    ORDER BY fl.createdAt DESC
  `;
  
  db.all(query, [req.user.id], (err, listings) => {
    if (err) {
      return res.status(500).json({ error: 'İlanlar getirilemedi' });
    }
    res.json(listings);
  });
});

// Get user's offers
app.get('/api/my-offers', authenticateToken, (req, res) => {
  const query = `
    SELECT eo.*, fl.foodName, fl.quantity, fl.details, fl.startTime, fl.endTime, u.firstName, u.lastName, u.phone, u.province, u.district
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
    SELECT eo.*, fl.foodName, fl.quantity, fl.details, fl.startTime, fl.endTime, u.firstName, u.lastName, u.phone, u.province, u.district
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
         // İstanbul Mahalleleri - Kadıköy
     'İstanbul-Kadıköy': ['Fenerbahçe', 'Caddebostan', 'Suadiye', 'Bağdat Caddesi', 'Göztepe', 'Erenköy', 'Bostancı', 'Hasanpaşa', 'Osmanağa', 'Rasimpaşa', '19 Mayıs', 'Zühtüpaşa', 'Merdivenköy', 'Koşuyolu', 'Sahrayıcedit', 'Fikirtepe', 'Hasanpaşa', 'Kayışdağı', 'Uzunçayır', 'Yenisahra', 'Ataşehir', 'İçerenköy', 'Küçükbakkalköy', 'Bostancı', 'Eğitim', 'Fenerbahçe', 'Fikirtepe', 'Hasanpaşa', 'Kayışdağı', 'Merdivenköy', 'Osmanağa', 'Rasimpaşa', 'Sahrayıcedit', 'Suadiye', 'Zühtüpaşa'],
     
     // İstanbul Mahalleleri - Beşiktaş
     'İstanbul-Beşiktaş': ['Levent', 'Etiler', 'Bebek', 'Ortaköy', 'Arnavutköy', 'Gayrettepe', 'Yıldız', 'Vişnezade', 'Sinanpaşa', 'Muradiye', 'Nispetiye', 'Türkali', 'Dikilitaş', 'Abbasağa', 'Mecidiye', 'Akat', 'Balmumcu', 'Bebek', 'Etiler', 'Gayrettepe', 'Levent', 'Mecidiye', 'Muradiye', 'Nispetiye', 'Ortaköy', 'Sinanpaşa', 'Türkali', 'Vişnezade', 'Yıldız'],
     
     // İstanbul Mahalleleri - Şişli
     'İstanbul-Şişli': ['Nişantaşı', 'Teşvikiye', 'Maçka', 'Mecidiyeköy', 'Gültepe', 'Esentepe', 'Feriköy', 'Kurtuluş', 'Bomonti', 'Pangaltı', 'Harbiye', 'Halaskargazi', 'Meşrutiyet', 'Halide Edip Adıvar', '19 Mayıs', 'Ayazağa', 'Bozkurt', 'Cumhuriyet', 'Duatepe', 'Ergenekon', 'Esentepe', 'Feriköy', 'Fulya', 'Gülbağ', 'Gültepe', 'Halaskargazi', 'Harbiye', 'İnönü', 'Kaptanpaşa', 'Kuştepe', 'Mahmutşevketpaşa', 'Maslak', 'Mecidiyeköy', 'Meşrutiyet', 'Nişantaşı', 'Okmeydanı', 'Pangaltı', 'Poligon', 'Teşvikiye', 'Yayla'],
     
     // İstanbul Mahalleleri - Beyoğlu
     'İstanbul-Beyoğlu': ['Taksim', 'Galata', 'Karaköy', 'Cihangir', 'Beyoğlu', 'Kuledibi', 'Kemankeş', 'Kılıçali Paşa', 'Tomtom', 'Asmalımescit', 'Kalyoncukulluk', 'Pürtelaş', 'Hacıahmet', 'Kemankeş Karamustafapaşa', 'Arap Cami', 'Asmalımescit', 'Bedrettin', 'Bereketzade', 'Bostan', 'Bülbül', 'Camiikebir', 'Cihangir', 'Çatma Mescit', 'Çukur', 'Emekyemez', 'Evliya Çelebi', 'Fetihtepe', 'Firuzağa', 'Gümüşsuyu', 'Hacıahmet', 'Hacımimi', 'Halıcıoğlu', 'Hüseyinağa', 'İstiklal', 'Kadımehmet Efendi', 'Kalyoncukulluk', 'Kamerhatun', 'Karaköy', 'Kemankeş', 'Kılıçali Paşa', 'Kocatepe', 'Kulaksız', 'Kuloğlu', 'Küçük Piyale', 'Müeyyetzade', 'Ömeravni', 'Örnektepe', 'Piripaşa', 'Piyalepaşa', 'Pürtelaş', 'Şahkulu', 'Şehit Muhtar', 'Şişhane', 'Sütlüce', 'Taksim', 'Tarlabaşı', 'Tophane', 'Yenişehir'],
     
     // İstanbul Mahalleleri - Fatih
     'İstanbul-Fatih': ['Sultanahmet', 'Eminönü', 'Beyazıt', 'Aksaray', 'Vefa', 'Süleymaniye', 'Balat', 'Fener', 'Ayvansaray', 'Yavuz Sultan Selim', 'Hırka-i Şerif', 'Muhsine Hatun', 'Karagümrük', 'Kocamustafapaşa', 'Aksaray', 'Akşemsettin', 'Alemdar', 'Ali Kuşçu', 'Atikali', 'Ayvansaray', 'Balabanağa', 'Balat', 'Beyazıt', 'Binbirdirek', 'Cankurtaran', 'Cerrahpaşa', 'Cibali', 'Demirtaş', 'Derviş Ali', 'Emin Sinan', 'Eminönü', 'Eski İmaret', 'Evkaf', 'Fener', 'Hacı Kadın', 'Haseki Sultan', 'Hırka-i Şerif', 'Hobyar', 'Hoca Gıyasettin', 'Hocapaşa', 'İskenderpaşa', 'Kalenderhane', 'Karagümrük', 'Katip Kasım', 'Kemalpaşa', 'Küçük Ayasofya', 'Küçük Mustafapaşa', 'Mercan', 'Mesihpaşa', 'Mevlanakapı', 'Mihrimah Sultan', 'Molla Fenari', 'Molla Gürani', 'Molla Hüsrev', 'Muhsine Hatun', 'Nişanca', 'Rüstempaşa', 'Saraç İshak', 'Sar Demirci', 'Seyyid Ömer', 'Silivrikapı', 'Sultanahmet', 'Sururi', 'Süleymaniye', 'Şehremini', 'Şehsuvar Bey', 'Tahtakale', 'Tayahatun', 'Topkapı', 'Yavuz Sinan', 'Yavuz Sultan Selim', 'Yedikule', 'Zeyrek'],
     
     // İstanbul Mahalleleri - Üsküdar
     'İstanbul-Üsküdar': ['Acıbadem', 'Altunizade', 'Bağlarbaşı', 'Kuzguncuk', 'Çengelköy', 'Beylerbeyi', 'Küçüksu', 'Kandilli', 'Vaniköy', 'Büyükçamlıca', 'Küçükçamlıca', 'Fethi Paşa', 'Mihrimah Sultan', 'Ahmediye', 'İcadiye', 'Ahmediye', 'Altunizade', 'Aziz Mahmut Hüdayi', 'Bahçelievler', 'Barbaros', 'Beylerbeyi', 'Bulgurlu', 'Burhaniye', 'Cumhuriyet', 'Çengelköy', 'Ferah', 'Güzeltepe', 'Havuzbaşı', 'İcadiye', 'İhsaniye', 'Kandilli', 'Kirazlıtepe', 'Kısıklı', 'Küçükçamlıca', 'Küçüksu', 'Kuzguncuk', 'Mimar Sinan', 'Murat Reis', 'Örnek', 'Paşalimanı', 'Rum Mehmet Paşa', 'Selamiali', 'Selimiye', 'Sultantepe', 'Şemsipaşa', 'Tavusantepe', 'Ünalan', 'Valide-i Atik', 'Yavuztürk', 'Zeynep Kamil'],
     
     // İstanbul Mahalleleri - Sarıyer
     'İstanbul-Sarıyer': ['Sarıyer', 'Tarabya', 'Yeniköy', 'Büyükdere', 'Rumeli Hisarı', 'Emirgan', 'İstinye', 'Reşitpaşa', 'Darüşşafaka', 'Pınar', 'Kireçburnu', 'Kumköy', 'Baltalimanı', 'Maslak', 'Ayazağa', 'Ayazağa', 'Baltalimanı', 'Büyükdere', 'Cumhuriyet', 'Çayırbaşı', 'Darüşşafaka', 'Demirtaş', 'Emirgan', 'Ferahevler', 'Gümüşdere', 'İstinye', 'Kireçburnu', 'Kumköy', 'Kuzguncuk', 'Maslak', 'Pınar', 'Poligon', 'Reşitpaşa', 'Rumeli Hisarı', 'Rumeli Kavağı', 'Sarıyer', 'Tarabya', 'Yeniköy'],
     
     // İstanbul Mahalleleri - Bakırköy
     'İstanbul-Bakırköy': ['Bakırköy', 'Yeşilköy', 'Florya', 'Ataköy', 'Zeytinburnu', 'Kartaltepe', 'Osmaniye', 'Cevizlik', 'Kartaltepe', 'Şenlikköy', 'Basınköy', 'Fenerbahçe', 'Merter', 'Güngören', 'Ataköy', 'Basınköy', 'Cevizlik', 'Fenerbahçe', 'Florya', 'İncirli', 'Kartaltepe', 'Osmaniye', 'Örnek', 'Sakızağacı', 'Şenlikköy', 'Yenimahalle', 'Yeşilköy', 'Yeşilyurt', 'Zeytinlik'],
     
     // İstanbul Mahalleleri - Kartal
     'İstanbul-Kartal': ['Kartal', 'Pendik', 'Maltepe', 'Ataşehir', 'Kadıköy', 'Soğanlık', 'Uğur Mumcu', 'Yalı', 'Orhantepe', 'Dragos', 'Fenerbahçe', 'Yenişehir', 'Gülsuyu', 'Esentepe', 'Atalar', 'Cevizli', 'Dragos', 'Esentepe', 'Gülsuyu', 'Hürriyet', 'Karlık', 'Kartal', 'Orhantepe', 'Soğanlık', 'Topselvi', 'Uğur Mumcu', 'Yalı', 'Yenişehir'],
     
     // İstanbul Mahalleleri - Maltepe
     'İstanbul-Maltepe': ['Maltepe', 'Kartal', 'Pendik', 'Ataşehir', 'Kadıköy', 'Feyzullah', 'Başıbüyük', 'Büyükbakkalköy', 'Cevizli', 'Esenkent', 'Fındıklı', 'Gülensu', 'İdealtepe', 'Küçükyalı', 'Altayçeşme', 'Bağdat Caddesi', 'Başıbüyük', 'Büyükbakkalköy', 'Cevizli', 'Esenkent', 'Feyzullah', 'Fındıklı', 'Girne', 'Gülensu', 'Gülsuyu', 'İdealtepe', 'Küçükyalı', 'Yalı'],
     
     // İstanbul Mahalleleri - Ataşehir
     'İstanbul-Ataşehir': ['Ataşehir', 'Kadıköy', 'Maltepe', 'Kartal', 'Pendik', 'Atatürk', 'Barbaros', 'Esatpaşa', 'Ferhatpaşa', 'Fetih', 'İçerenköy', 'İnönü', 'Kayışdağı', 'Küçükbakkalköy', 'Mevlana', 'Atatürk', 'Barbaros', 'Esatpaşa', 'Ferhatpaşa', 'Fetih', 'İçerenköy', 'İnönü', 'Kayışdağı', 'Küçükbakkalköy', 'Mevlana', 'Mimarsinan', 'Mustafa Kemal', 'Yenişehir'],
     
     // İstanbul Mahalleleri - Ümraniye
     'İstanbul-Ümraniye': ['Ümraniye', 'Kadıköy', 'Ataşehir', 'Maltepe', 'Kartal', 'Atakent', 'Çakmak', 'Esenşehir', 'Esenevler', 'Ihlamurkuyu', 'İnkılap', 'Madenler', 'Mustafa Kemal', 'Namık Kemal', 'Tantavi', 'Adem Yavuz', 'Atakent', 'Atatürk', 'Çakmak', 'Esenkent', 'Esenşehir', 'Esenevler', 'Ihlamurkuyu', 'İnkılap', 'Madenler', 'Mustafa Kemal', 'Namık Kemal', 'Necip Fazıl', 'Parseller', 'Tantavi', 'Yenişehir'],
     
     // İstanbul Mahalleleri - Başakşehir
     'İstanbul-Başakşehir': ['Başakşehir', 'Esenyurt', 'Avcılar', 'Küçükçekmece', 'Sultangazi', 'Başak', 'Kayabaşı', 'Şahintepe', 'Altınşehir', 'Bahçeşehir', 'Güvercintepe', 'Ziya Gökalp', 'Mehmet Akif Ersoy', 'Orhan Gazi', 'Altınşehir', 'Bahçeşehir', 'Başak', 'Güvercintepe', 'Kayabaşı', 'Mehmet Akif Ersoy', 'Orhan Gazi', 'Şahintepe', 'Ziya Gökalp'],
     
     // İstanbul Mahalleleri - Esenyurt
     'İstanbul-Esenyurt': ['Esenyurt', 'Avcılar', 'Küçükçekmece', 'Başakşehir', 'Beylikdüzü', 'Ardıçlı', 'Aşık Veysel', 'Atatürk', 'Cumhuriyet', 'Fatih', 'Gökevler', 'İnönü', 'İnşaat', 'Kıraç', 'Mehterçeşme', 'Ardıçlı', 'Aşık Veysel', 'Atatürk', 'Cumhuriyet', 'Fatih', 'Gökevler', 'İnönü', 'İnşaat', 'Kıraç', 'Mehterçeşme', 'Namık Kemal', 'Örnek', 'Pınar', 'Saadetdere', 'Sanayi', 'Şehirlerarası', 'Yenikent'],
     
     // İstanbul Mahalleleri - Beylikdüzü
     'İstanbul-Beylikdüzü': ['Beylikdüzü', 'Esenyurt', 'Avcılar', 'Küçükçekmece', 'Büyükçekmece', 'Adnan Kahveci', 'Barış', 'Büyükşehir', 'Cumhuriyet', 'Dereağzı', 'Gürpınar', 'Marmara', 'Sahil', 'Yakuplu', 'Adnan Kahveci', 'Barış', 'Büyükşehir', 'Cumhuriyet', 'Dereağzı', 'Gürpınar', 'Marmara', 'Sahil', 'Yakuplu'],
     
     // İstanbul Mahalleleri - Diğer İlçeler
     'İstanbul-Avcılar': ['Ambarlı', 'Denizköşkler', 'Firuzköy', 'Gümüşpala', 'Merkez', 'Mustafa Kemal Paşa', 'Tahtakale', 'Üniversite', 'Yeşilkent'],
     'İstanbul-Küçükçekmece': ['Atakent', 'Beşyol', 'Cennet', 'Cumhuriyet', 'Fatih', 'Fevzi Çakmak', 'Gültepe', 'Halkalı', 'İkitelli', 'İnönü', 'Kanarya', 'Kartaltepe', 'Söğütlüçeşme', 'Sultanmurat', 'Tepeüstü', 'Yarımburgaz', 'Yenişehir'],
     'İstanbul-Sultangazi': ['50. Yıl', '75. Yıl', 'Cebeci', 'Cumhuriyet', 'Esentepe', 'Eskişehir', 'Gazi', 'Habibler', 'İsmetpaşa', 'Malkoçoğlu', 'Necip Fazıl', 'Sultançiftliği', 'Uğur Mumcu', 'Yayla', 'Yenişehir'],
     'İstanbul-Büyükçekmece': ['Ahmediye', 'Alkent', 'Atatürk', 'Bahçelievler', 'Beylikdüzü', 'Cumhuriyet', 'Çakmaklı', 'Dizdariye', 'Esenyurt', 'Fatih', 'Gürpınar', 'Kale', 'Kıraç', 'Marmara', 'Mimaroba', 'Sultaniye', 'Yakuplu'],
     'İstanbul-Çatalca': ['Binkılıç', 'Çanakça', 'Çatalca', 'Elbasan', 'Ferhatpaşa', 'Gökçeali', 'Gümüşpınar', 'Hallaçlı', 'İhsaniye', 'İnceğiz', 'Kaleiçi', 'Kestanelik', 'Kızılcaali', 'Muhacir', 'Örcünlü', 'Örencik', 'Subaşı', 'Yalıköy', 'Yaylacık'],
     'İstanbul-Çekmeköy': ['Alemdağ', 'Ataşehir', 'Çekmeköy', 'Ekşioğlu', 'Göktürk', 'Hamidiye', 'Hüseyinli', 'Kirazlıdere', 'Mehmet Akif', 'Merkez', 'Mihrimah Sultan', 'Nişantepe', 'Ömerli', 'Soğukpınar', 'Sultançiftliği', 'Taşdelen', 'Ümraniye'],
     'İstanbul-Esenler': ['Atışalanı', 'Birlik', 'Davutpaşa', 'Esenler', 'Fatih', 'Havaalanı', 'Kazım Karabekir', 'Menderes', 'Namık Kemal', 'Nine Hatun', 'Oruçreis', 'Turgutreis', 'Yavuz Selim'],
     'İstanbul-Esenyurt': ['Ardıçlı', 'Aşık Veysel', 'Atatürk', 'Cumhuriyet', 'Fatih', 'Gökevler', 'İnönü', 'İnşaat', 'Kıraç', 'Mehterçeşme', 'Namık Kemal', 'Örnek', 'Pınar', 'Saadetdere', 'Sanayi', 'Şehirlerarası', 'Yenikent'],
     'İstanbul-Eyüpsultan': ['Ağaçlı', 'Akpınar', 'Alibeyköy', 'Arnavutköy', 'Aşağı', 'Başak', 'Boyacı', 'Çırçır', 'Düğmeciler', 'Emniyettepe', 'Esentepe', 'Eyüp', 'Feshane', 'Göktürk', 'Güzeltepe', 'İslambey', 'Karadolap', 'Kemerburgaz', 'Mimar Sinan', 'Nişanca', 'Odayeri', 'Pirinççi', 'Rami Cuma', 'Rami Yeni', 'Sakarya', 'Silahtarağa', 'Topçular', 'Yenidoğan', 'Yenimahalle'],
     'İstanbul-Fatih': ['Aksaray', 'Akşemsettin', 'Alemdar', 'Ali Kuşçu', 'Atikali', 'Ayvansaray', 'Balabanağa', 'Balat', 'Beyazıt', 'Binbirdirek', 'Cankurtaran', 'Cerrahpaşa', 'Cibali', 'Demirtaş', 'Derviş Ali', 'Emin Sinan', 'Eminönü', 'Eski İmaret', 'Evkaf', 'Fener', 'Hacı Kadın', 'Haseki Sultan', 'Hırka-i Şerif', 'Hobyar', 'Hoca Gıyasettin', 'Hocapaşa', 'İskenderpaşa', 'Kalenderhane', 'Karagümrük', 'Katip Kasım', 'Kemalpaşa', 'Küçük Ayasofya', 'Küçük Mustafapaşa', 'Mercan', 'Mesihpaşa', 'Mevlanakapı', 'Mihrimah Sultan', 'Molla Fenari', 'Molla Gürani', 'Molla Hüsrev', 'Muhsine Hatun', 'Nişanca', 'Rüstempaşa', 'Saraç İshak', 'Sar Demirci', 'Seyyid Ömer', 'Silivrikapı', 'Sultanahmet', 'Sururi', 'Süleymaniye', 'Şehremini', 'Şehsuvar Bey', 'Tahtakale', 'Tayahatun', 'Topkapı', 'Yavuz Sinan', 'Yavuz Sultan Selim', 'Yedikule', 'Zeyrek'],
     'İstanbul-Gaziosmanpaşa': ['Adnan Menderes', 'Arnavutköy', 'Bağlarbaşı', 'Barbaros Hayrettin Paşa', 'Fevzi Çakmak', 'Hürriyet', 'İsmetpaşa', 'Kale', 'Karagümrük', 'Karlıtepe', 'Kazım Karabekir', 'Mevlana', 'Pazariçi', 'Sarıgöl', 'Şemsipaşa', 'Yenidoğan', 'Yenimahalle', 'Yıldıztabya'],
     'İstanbul-Güngören': ['Akıncılar', 'Gençosman', 'Güneştepe', 'Güven', 'Haznedar', 'Mareşal Çakmak', 'Sanayi', 'Tozkoparan'],
     'İstanbul-Kağıthane': ['Çağlayan', 'Çeliktepe', 'Emniyetevleri', 'Gültepe', 'Gürsel', 'Hamidiye', 'Harmantepe', 'Hürriyet', 'Mehmet Akif Ersoy', 'Merkez', 'Nurtepe', 'Ortabayır', 'Seyrantepe', 'Şirintepe', 'Talatpaşa', 'Telsizler', 'Yahya Kemal', 'Yeşilce'],
     'İstanbul-Pendik': ['Ahmet Yesevi', 'Bahçelievler', 'Batı', 'Çamçeşme', 'Çınardere', 'Doğu', 'Dumlupınar', 'Ertuğrul Gazi', 'Esenler', 'Fevzi Çakmak', 'Güllübağlar', 'Güzelyalı', 'Harmandere', 'İstiklal', 'Kurtköy', 'Orhangazi', 'Orta', 'Ramazanoğlu', 'Sanayi', 'Sapanbağları', 'Sülüntepe', 'Şeyhli', 'Velibaba', 'Yayalar', 'Yenişehir'],
     'İstanbul-Sancaktepe': ['Abdurrahmangazi', 'Akpınar', 'Atatürk', 'Emek', 'Eyüp Sultan', 'Fatih', 'Hilal', 'İnönü', 'Kemal Türkler', 'Meclis', 'Merve', 'Mevlana', 'Osmangazi', 'Paşaköy', 'Safa', 'Sarıgazi', 'Veysel Karani', 'Yenidoğan'],
     'İstanbul-Sarıyer': ['Ayazağa', 'Baltalimanı', 'Büyükdere', 'Cumhuriyet', 'Çayırbaşı', 'Darüşşafaka', 'Demirtaş', 'Emirgan', 'Ferahevler', 'Gümüşdere', 'İstinye', 'Kireçburnu', 'Kumköy', 'Kuzguncuk', 'Maslak', 'Pınar', 'Poligon', 'Reşitpaşa', 'Rumeli Hisarı', 'Rumeli Kavağı', 'Sarıyer', 'Tarabya', 'Yeniköy'],
     'İstanbul-Silivri': ['Alibey', 'Alipaşa', 'Balıklıoğlu', 'Büyükçavuşlu', 'Cumhuriyet', 'Değirmenköy', 'Fatih', 'Fenerköy', 'Gümüşyaka', 'Kadıköy', 'Kavaklı', 'Küçükçavuşlu', 'Mimar Sinan', 'Ortaköy', 'Piri Mehmet Paşa', 'Selimpaşa', 'Seymen', 'Yeni', 'Yolçatı'],
     'İstanbul-Sultanbeyli': ['Abdurrahmangazi', 'Adil', 'Ahmet Yesevi', 'Akşemsettin', 'Battalgazi', 'Fatih', 'Hasanpaşa', 'Mecidiye', 'Mehmet Akif', 'Mimar Sinan', 'Necip Fazıl', 'Orhangazi', 'Turgut Reis', 'Yavuz Selim'],
     'İstanbul-Sultangazi': ['50. Yıl', '75. Yıl', 'Cebeci', 'Cumhuriyet', 'Esentepe', 'Eskişehir', 'Gazi', 'Habibler', 'İsmetpaşa', 'Malkoçoğlu', 'Necip Fazıl', 'Sultançiftliği', 'Uğur Mumcu', 'Yayla', 'Yenişehir'],
     'İstanbul-Şile': ['Ağva', 'Balibey', 'Çavuş', 'Hacıllı', 'Kumbaba', 'Şile'],
     'İstanbul-Şişli': ['19 Mayıs', 'Ayazağa', 'Bozkurt', 'Cumhuriyet', 'Duatepe', 'Ergenekon', 'Esentepe', 'Feriköy', 'Fulya', 'Gülbağ', 'Gültepe', 'Halaskargazi', 'Harbiye', 'İnönü', 'Kaptanpaşa', 'Kuştepe', 'Mahmutşevketpaşa', 'Maslak', 'Mecidiyeköy', 'Meşrutiyet', 'Nişantaşı', 'Okmeydanı', 'Pangaltı', 'Poligon', 'Teşvikiye', 'Yayla'],
     'İstanbul-Tuzla': ['Akfırat', 'Anadolu', 'Aydınlı', 'Çayırova', 'Denizli', 'Deri', 'Fatih', 'İçmeler', 'Mescit', 'Orhanlı', 'Postane', 'Şifa', 'Yayla'],
     'İstanbul-Ümraniye': ['Adem Yavuz', 'Atakent', 'Atatürk', 'Çakmak', 'Esenkent', 'Esenşehir', 'Esenevler', 'Ihlamurkuyu', 'İnkılap', 'Madenler', 'Mustafa Kemal', 'Namık Kemal', 'Necip Fazıl', 'Parseller', 'Tantavi', 'Yenişehir'],
     'İstanbul-Üsküdar': ['Acıbadem', 'Altunizade', 'Aziz Mahmut Hüdayi', 'Bahçelievler', 'Barbaros', 'Beylerbeyi', 'Bulgurlu', 'Burhaniye', 'Cumhuriyet', 'Çengelköy', 'Ferah', 'Güzeltepe', 'Havuzbaşı', 'İcadiye', 'İhsaniye', 'Kandilli', 'Kirazlıtepe', 'Kısıklı', 'Küçükçamlıca', 'Küçüksu', 'Kuzguncuk', 'Mimar Sinan', 'Murat Reis', 'Örnek', 'Paşalimanı', 'Rum Mehmet Paşa', 'Selamiali', 'Selimiye', 'Sultantepe', 'Şemsipaşa', 'Tavusantepe', 'Ünalan', 'Valide-i Atik', 'Yavuztürk', 'Zeynep Kamil'],
     'İstanbul-Zeytinburnu': ['Beştelsiz', 'Çırpıcı', 'Gökalp', 'Kazlıçeşme', 'Maltepe', 'Merkezefendi', 'Nuripaşa', 'Seyitnizam', 'Telsiz', 'Veliefendi', 'Yenidoğan', 'Yeşiltepe'],
    
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

// Admin endpoints
// Get all users (admin only)
app.get('/api/admin/users', (req, res) => {
  // Check for admin credentials in URL parameters
  const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
  const email = urlParams.get('email');
  const password = urlParams.get('password');
  
  const ADMIN_EMAIL = 'mustafaozkoca1@gmail.com';
  const ADMIN_PASSWORD = 'mF3z4Vsf.';
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Admin yetkisi gerekli' });
  }

  db.all(
    'SELECT id, firstName, lastName, email, phone, role, province, district, neighborhood, isEmailVerified, createdAt FROM users ORDER BY createdAt DESC',
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Kullanıcılar getirilemedi' });
      }
      res.json(users);
    }
  );
});

// Delete user (admin only)
app.delete('/api/admin/users/:userId', (req, res) => {
  const { userId } = req.params;
  
  // Check for admin credentials in URL parameters
  const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
  const email = urlParams.get('email');
  const password = urlParams.get('password');
  
  const ADMIN_EMAIL = 'mustafaozkoca1@gmail.com';
  const ADMIN_PASSWORD = 'mF3z4Vsf.';
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Admin yetkisi gerekli' });
  }

  // Delete user's listings first
  db.run('DELETE FROM food_listings WHERE userId = ?', [userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Kullanıcı ilanları silinemedi' });
    }

    // Delete user's offers
    db.run('DELETE FROM exchange_offers WHERE offererId = ?', [userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Kullanıcı teklifleri silinemedi' });
      }

      // Delete user's notifications
      db.run('DELETE FROM notifications WHERE userId = ?', [userId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Kullanıcı bildirimleri silinemedi' });
        }

        // Delete user's email verifications
        db.run('DELETE FROM email_verifications WHERE userId = ?', [userId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Kullanıcı e-posta doğrulamaları silinemedi' });
          }

          // Finally delete the user
          db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
              return res.status(500).json({ error: 'Kullanıcı silinemedi' });
            }
            res.json({ message: 'Kullanıcı başarıyla silindi' });
          });
        });
      });
    });
  });
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
