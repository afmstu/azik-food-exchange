const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
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

// Firebase Admin SDK initialization
let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Firebase service account loaded successfully');
  } catch (error) {
    console.error('Error parsing Firebase service account:', error);
  }
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized with service account');
  } else {
    console.log('Firebase service account not found - using default credentials');
    admin.initializeApp();
  }
}

// Firestore database
const db = admin.firestore();
console.log('Firestore database initialized');

// Firestore initialization
const initializeDatabase = async () => {
  try {
    console.log('=== Firestore Database Initialization ===');
    console.log('Firestore collections will be created automatically');
    
    // Test connection by getting user count
    const usersSnapshot = await db.collection('users').get();
    console.log(`Database initialized with ${usersSnapshot.size} existing users`);
    
    console.log('Firestore database ready!');
  } catch (error) {
    console.error('Firestore initialization error:', error);
    throw error;
  }
};

// Initialize database
initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error);
  console.error('Error stack:', error.stack);
});

// Firestore helper functions
const dbQuery = async (collection, query = null) => {
  try {
    let ref = db.collection(collection);
    if (query) {
      Object.keys(query).forEach(key => {
        ref = ref.where(key, '==', query[key]);
      });
    }
    const snapshot = await ref.get();
    return { rows: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    throw error;
  }
};

const dbGet = async (collection, id = null, query = null) => {
  try {
    if (id) {
      const doc = await db.collection(collection).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } else if (query) {
      console.log(`🔍 dbGet query for ${collection}:`, query);
      let ref = db.collection(collection);
      Object.keys(query).forEach(key => {
        console.log(`🔍 Adding where clause: ${key} == ${query[key]}`);
        ref = ref.where(key, '==', query[key]);
      });
      const snapshot = await ref.limit(1).get();
      console.log(`🔍 Query result: ${snapshot.size} documents found`);
      
      // Debug: Let's see all documents in the collection to understand the data
      if (snapshot.empty) {
        console.log(`🔍 No documents found for query:`, query);
        const allDocs = await db.collection(collection).get();
        console.log(`🔍 Total documents in ${collection}: ${allDocs.size}`);
        allDocs.forEach(doc => {
          const data = doc.data();
          console.log(`🔍 Document ${doc.id}:`, { 
            id: doc.id, 
            email: data.email,
            emailType: typeof data.email,
            emailLength: data.email ? data.email.length : 'null'
          });
        });
        return null;
      } else {
        const result = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        console.log(`🔍 Found document:`, { id: result.id, email: result.email });
        return result;
      }
    }
    return null;
  } catch (error) {
    console.error('🔍 dbGet error:', error);
    throw error;
  }
};

const dbRun = async (collection, data, id = null) => {
  try {
    if (id) {
      await db.collection(collection).doc(id).set(data);
      return { lastID: id, changes: 1 };
    } else {
      const docRef = await db.collection(collection).add(data);
      return { lastID: docRef.id, changes: 1 };
    }
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

  const verificationUrl = `${process.env.FRONTEND_URL || 'https://azik-food-exchange.onrender.com'}/api/verify-email?token=${verificationToken}`;
  console.log('Verification URL:', verificationUrl);
  
  const mailOptions = {
    from: '"Azık Platformu" <noreply@azik.com>',
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

// Firebase Admin SDK already initialized above

// Helper function to create notifications
const createNotification = async (userId, type, title, message, relatedId = null) => {
  const notificationId = uuidv4();
  try {
    const notificationData = {
      id: notificationId,
      userId,
      type,
      title,
      message,
      relatedId,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    await dbRun('notifications', notificationData, notificationId);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
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
    const user = await dbGet('users', userId);
    if (!user || !user.fcmToken) {
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
    const existingUser = await dbGet('users', null, { email: email }) || await dbGet('users', null, { phone: phone });

      if (existingUser) {
        return res.status(400).json({ error: 'Bu e-posta adresi veya telefon numarası zaten kullanılıyor' });
      }

      // Insert user with email verification status
    const userData = {
      id: userId,
      role,
      firstName,
      lastName,
      email,
      phone,
      province,
      district,
      neighborhood,
      fullAddress,
      password: hashedPassword,
      isEmailVerified: false,
      createdAt: new Date().toISOString()
    };
    
    await dbRun('users', userData, userId);

          // Create verification token
          const verificationToken = uuidv4();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          // Insert verification record
    const verificationData = {
      id: uuidv4(),
      userId,
      email,
      verificationToken,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    };
    
    console.log('=== REGISTRATION DEBUG ===');
    console.log('Saving verification data:', verificationData);
    console.log('Verification token being saved:', verificationToken);
    console.log('Token type:', typeof verificationToken);
    console.log('Token length:', verificationToken.length);
    
    await dbRun('email_verifications', verificationData);
    console.log('✅ Verification data saved to database');

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
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
  const { email, password } = req.body;

    console.log('=== Login Attempt ===');
    console.log('Email:', email);
    console.log('Password provided:', !!password);

  if (!email || !password) {
      console.log('Login failed: Missing email or password');
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur' });
  }

  // Validate email format
  if (!validateEmail(email)) {
      console.log('Login failed: Invalid email format');
    return res.status(400).json({ error: 'Geçersiz e-posta formatı' });
  }

    console.log('Email format is valid, checking database...');
    console.log('🔍 Searching for user with email:', email);

    const user = await dbGet('users', null, { email: email });

    if (!user) {
      console.log('Login failed: User not found in database');
      console.log('Attempted email:', email);
      
      // Check if there are any users in the database
      const usersSnapshot = await db.collection('users').get();
      console.log(`Total users in database: ${usersSnapshot.size}`);
      
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Update user address
app.put('/api/user/address', authenticateToken, async (req, res) => {
  try {
  const { province, district, neighborhood, fullAddress } = req.body;
  const userId = req.user.id;

  if (!province || !district || !neighborhood || !fullAddress) {
    return res.status(400).json({ error: 'Tüm adres alanları zorunludur' });
  }

    await dbUpdate('users', userId, {
      province,
      district,
      neighborhood,
      fullAddress,
      updatedAt: new Date().toISOString()
    });

      res.json({ 
        message: 'Adres başarıyla güncellendi',
        user: {
          province,
          district,
          neighborhood,
          fullAddress
        }
      });
  } catch (error) {
    console.error('Address update error:', error);
    res.status(500).json({ error: 'Adres güncellenemedi' });
    }
});

// Email verification endpoint (POST and GET)
app.post('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Doğrulama token\'ı gerekli' });
    }

    // Find verification record
    const verification = await dbGet('email_verifications', null, { verificationToken: token });

      if (!verification) {
        return res.status(400).json({ error: 'Geçersiz doğrulama token\'ı' });
      }

      // Check if token is expired
      if (new Date() > new Date(verification.expiresAt)) {
        return res.status(400).json({ error: 'Doğrulama token\'ı süresi dolmuş' });
      }

      // Update user email verification status
    await dbUpdate('users', verification.userId, { isEmailVerified: true, updatedAt: new Date().toISOString() });

        // Delete the verification record
    await db.collection('email_verifications').doc(verification.id).delete();

          // Get user info for token
    const user = await dbGet('users', verification.userId);

    const jwtToken = jwt.sign({ id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET);
            
            res.json({ 
              success: true,
              message: 'E-posta başarıyla doğrulandı',
      token: jwtToken,
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
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Email verification endpoint (GET - for direct link access)
app.get('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    console.log('=== EMAIL VERIFICATION DEBUG ===');
    console.log('Received token:', token);
    console.log('Token type:', typeof token);
    console.log('Token length:', token ? token.length : 0);

    if (!token) {
      console.log('❌ No token provided');
      return res.status(400).json({ error: 'Doğrulama token\'ı gerekli' });
    }

    // Find verification record
    console.log('🔍 Searching for verification record with token:', token);
    const verification = await dbGet('email_verifications', null, { verificationToken: token });
    console.log('🔍 Verification record found:', verification);

    if (!verification) {
      console.log('❌ No verification record found for token:', token);
      return res.status(400).json({ error: 'Geçersiz doğrulama token\'ı' });
    }

    // Check if token is expired
    if (new Date() > new Date(verification.expiresAt)) {
      console.log('❌ Token expired');
      return res.status(400).json({ error: 'Doğrulama token\'ı süresi dolmuş' });
    }

    console.log('✅ Token is valid, proceeding with verification...');

    // Update user email verification status
    console.log('🔄 Updating user verification status...');
    await dbUpdate('users', verification.userId, { isEmailVerified: true, updatedAt: new Date().toISOString() });
    console.log('✅ User verification status updated');

    // Delete the verification record
    console.log('🗑️ Deleting verification record...');
    await db.collection('email_verifications').doc(verification.id).delete();
    console.log('✅ Verification record deleted');

    // Get user info for token
    console.log('👤 Getting user info...');
    const user = await dbGet('users', verification.userId);
    console.log('✅ User info retrieved:', user ? 'User found' : 'User not found');

    // Redirect to frontend with success message
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://azik-food-exchange.onrender.com'}/verify-email?success=true`;
    console.log('🔄 Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Email verification error:', error);
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://azik-food-exchange.onrender.com'}/verify-email?error=server_error`;
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
      from: '"Azık Platformu" <noreply@azik.com>',
      to: email,
      subject: 'Azık - Test E-postası v2',
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
    const user = await dbGet('users', null, { email: email });

      if (!user) {
        return res.status(404).json({ error: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı' });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten doğrulanmış' });
      }

      // Delete old verification records
      const oldVerificationsSnapshot = await db.collection('email_verifications')
        .where('userId', '==', user.id)
        .get();
      
      const deletePromises = oldVerificationsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);

      // Create new verification token
      const verificationToken = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Insert new verification record
      const verificationData = {
        userId: user.id,
        email,
        verificationToken,
        expiresAt: expiresAt.toISOString()
      };

      await dbRun('email_verifications', verificationData);

            // Send verification email
            const emailSent = await sendVerificationEmail(email, verificationToken);
            
            if (emailSent) {
              res.json({ message: 'Doğrulama e-postası tekrar gönderildi' });
            } else {
              res.status(500).json({ error: 'E-posta gönderilemedi' });
            }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get current user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('users', req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Kullanıcı bilgileri getirilemedi' });
  }
});

// Save FCM token
app.post('/api/user/fcm-token', authenticateToken, async (req, res) => {
  try {
  const { fcmToken } = req.body;
  
  if (!fcmToken) {
    return res.status(400).json({ error: 'FCM token zorunludur' });
  }

    await dbUpdate('users', req.user.id, { fcmToken });
    res.json({ message: 'FCM token başarıyla kaydedildi' });
  } catch (error) {
    console.error('FCM token save error:', error);
    res.status(500).json({ error: 'FCM token kaydedilemedi' });
  }
});

// Create food listing
app.post('/api/listings', authenticateToken, async (req, res) => {
  try {
    const { foodName, quantity, details, startTime, endTime } = req.body;
    const userId = req.user.id;

    if (!foodName || !quantity || !startTime || !endTime) {
      return res.status(400).json({ error: 'Yemek adı, adet ve saat bilgileri zorunludur' });
    }

    const listingData = {
      userId,
      foodName,
      quantity,
      details: details || '',
      startTime,
      endTime,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const result = await dbRun('food_listings', listingData);
    
    res.status(201).json({ message: 'İlan başarıyla oluşturuldu', listingId: result.lastID });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'İlan oluşturulamadı' });
  }
});

// Delete food listing
app.delete('/api/listings/:listingId', authenticateToken, async (req, res) => {
  try {
    const { listingId } = req.params;
    const userId = req.user.id;

    // Check if listing exists and belongs to user
    const listing = await dbGet('food_listings', listingId);

    if (!listing) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    if (listing.userId !== userId) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    // Delete related offers first
    const offersSnapshot = await db.collection('exchange_offers')
      .where('listingId', '==', listingId)
      .get();
    
    const deletePromises = offersSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    // Delete the listing
    await db.collection('food_listings').doc(listingId).delete();
    
    res.json({ message: 'İlan başarıyla silindi' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'İlan silinemedi' });
  }
});

// Get all active listings
app.get('/api/listings', async (req, res) => {
  try {
    const { province, district } = req.query;
    
    // Get all active listings with user information
    let listingsQuery = db.collection('food_listings')
      .where('status', '==', 'active');
    
    const listingsSnapshot = await listingsQuery.get();
    const listings = [];
    
    for (const listingDoc of listingsSnapshot.docs) {
      const listingData = listingDoc.data();
      
      // Get user information for this listing
      const userDoc = await db.collection('users').doc(listingData.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        
        // Apply filters if provided
        if (province && userData.province !== province) continue;
        if (district && userData.district !== district) continue;
        
        listings.push({
          id: listingDoc.id,
          ...listingData,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          province: userData.province,
          district: userData.district,
          neighborhood: userData.neighborhood
        });
      }
    }
    
    // Sort by createdAt descending
    listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(listings);
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'İlanlar getirilemedi' });
  }
});

// Create exchange offer
app.post('/api/offers', authenticateToken, async (req, res) => {
  try {
    const { listingId } = req.body;
    const offererId = req.user.id;

    if (!listingId) {
      return res.status(400).json({ error: 'İlan ID zorunludur' });
    }

    // Check if listing exists and is active
    const listing = await dbGet('food_listings', listingId);
    
    if (!listing || listing.status !== 'active') {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    if (listing.userId === offererId) {
      return res.status(400).json({ error: 'Kendi ilanınıza teklif veremezsiniz' });
    }

    // Check if user already made an offer
    const existingOffersSnapshot = await db.collection('exchange_offers')
      .where('listingId', '==', listingId)
      .where('offererId', '==', offererId)
      .get();

    if (!existingOffersSnapshot.empty) {
      return res.status(400).json({ error: 'Bu ilana zaten teklif verdiniz' });
    }

    const offerData = {
      listingId,
      offererId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const result = await dbRun('exchange_offers', offerData);
    const offerId = result.lastID;
          
    // Get offerer details for notification
    const offerer = await dbGet('users', offererId);
    
    if (offerer) {
      const notificationMessage = `${offerer.firstName} ${offerer.lastName} ilanınıza teklif verdi`;
      
      // Create notification for listing owner
      await createNotification(
        listing.userId,
        'new_offer',
        'Yeni Teklif',
        notificationMessage,
        offerId
      );
      
      // Send FCM notification
      await sendFCMNotification(
        listing.userId,
        'Yeni Teklif',
        notificationMessage,
        { type: 'new_offer', offerId: offerId }
      );
      
      // Get listing owner's email for email notification
      const owner = await dbGet('users', listing.userId);
      
      if (owner && owner.email) {
        // Send email notification
        await sendOfferNotificationEmail(
          owner.email,
          `${offerer.firstName} ${offerer.lastName}`,
          listing.foodName
        );
      }
    }
          
    res.status(201).json({ message: 'Teklif başarıyla gönderildi', offerId });
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ error: 'Teklif oluşturulamadı' });
  }
});

// Accept/Reject offer
app.put('/api/offers/:offerId', authenticateToken, async (req, res) => {
  try {
    const { offerId } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum' });
    }

    const offer = await dbGet('exchange_offers', offerId);
    
    if (!offer) {
      return res.status(404).json({ error: 'Teklif bulunamadı' });
    }

    // Get listing details
    const listing = await dbGet('food_listings', offer.listingId);
    
    if (!listing) {
      return res.status(404).json({ error: 'İlan bulunamadı' });
    }

    // Check if user owns the listing
    if (listing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    await dbUpdate('exchange_offers', offerId, { status });

    if (status === 'accepted') {
      // Mark listing as completed
      await dbUpdate('food_listings', offer.listingId, { status: 'completed' });
      
      // Get user details for notification
      const offerer = await dbGet('users', offer.offererId);
      
      if (offerer) {
        // Get listing owner's phone number
        const listingOwner = await dbGet('users', req.user.id);
        
        if (listingOwner) {
          // In a real app, you'd send SMS here
          console.log(`SMS to ${offerer.phone}: [${listing.foodName}] teklifiniz kabul edildi. İletişime geçin: ${listingOwner.phone}`);
          
          const notificationMessage = `[${listing.foodName}] teklifiniz kabul edildi. İletişime geçin: ${listingOwner.phone}`;
          
          // Create notification for offerer
          await createNotification(
            offer.offererId,
            'offer_accepted',
            'Teklif Kabul Edildi',
            notificationMessage,
            offerId
          );
          
          // Send FCM notification
          await sendFCMNotification(
            offer.offererId,
            'Teklif Kabul Edildi',
            notificationMessage,
            { type: 'offer_accepted', offerId: offerId }
          );
          
          // Send email notification
          if (offerer.email) {
            await sendOfferAcceptedEmail(
              offerer.email,
              `${offerer.firstName} ${offerer.lastName}`,
              listing.foodName,
              listingOwner.phone
            );
          }
        }
      }
    } else {
      const notificationMessage = `[${listing.foodName}] teklifiniz reddedildi`;
      
      // Create notification for rejected offer
      await createNotification(
        offer.offererId,
        'offer_rejected',
        'Teklif Reddedildi',
        notificationMessage,
        offerId
      );
      
      // Send FCM notification
      await sendFCMNotification(
        offer.offererId,
        'Teklif Reddedildi',
        notificationMessage,
        { type: 'offer_rejected', offerId: offerId }
      );
      
      // Get offerer details for email notification
      const offerer = await dbGet('users', offer.offererId);
      
      if (offerer && offerer.email) {
        // Send email notification
        await sendOfferRejectedEmail(
          offerer.email,
          `${offerer.firstName} ${offerer.lastName}`,
          listing.foodName
        );
      }
    }

    res.json({ message: `Teklif ${status === 'accepted' ? 'kabul edildi' : 'reddedildi'}` });
  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({ error: 'Teklif güncellenemedi' });
  }
});

// Get user's listings
app.get('/api/my-listings', authenticateToken, async (req, res) => {
  try {
    const listingsSnapshot = await db.collection('food_listings')
      .where('userId', '==', req.user.id)
      .get();
    
    const listings = [];
    
    for (const listingDoc of listingsSnapshot.docs) {
      const listingData = listingDoc.data();
      
      // Get user information for this listing
      const userDoc = await db.collection('users').doc(listingData.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        
        listings.push({
          id: listingDoc.id,
          ...listingData,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          province: userData.province,
          district: userData.district,
          neighborhood: userData.neighborhood
        });
      }
    }
    
    // Sort by createdAt descending in memory
    listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(listings);
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({ error: 'İlanlar getirilemedi' });
  }
});

// Get user's offers
app.get('/api/my-offers', authenticateToken, async (req, res) => {
  try {
    const offersSnapshot = await db.collection('exchange_offers')
      .where('offererId', '==', req.user.id)
      .get();
    
    const offers = [];
    
    for (const offerDoc of offersSnapshot.docs) {
      const offerData = offerDoc.data();
      
      // Get listing information
      const listingDoc = await db.collection('food_listings').doc(offerData.listingId).get();
      if (listingDoc.exists) {
        const listingData = listingDoc.data();
        
        // Get listing owner information
        const userDoc = await db.collection('users').doc(listingData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          
          offers.push({
            id: offerDoc.id,
            ...offerData,
            foodName: listingData.foodName,
            quantity: listingData.quantity,
            details: listingData.details,
            startTime: listingData.startTime,
            endTime: listingData.endTime,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            province: userData.province,
            district: userData.district
          });
        }
      }
    }
    
    // Sort by createdAt descending in memory
    offers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(offers);
  } catch (error) {
    console.error('Get my offers error:', error);
    res.status(500).json({ error: 'Teklifler getirilemedi' });
  }
});

// Get offers for user's listings
app.get('/api/listing-offers', authenticateToken, async (req, res) => {
  try {
    // First get all listings by this user
    const listingsSnapshot = await db.collection('food_listings')
      .where('userId', '==', req.user.id)
      .get();
    
    const offers = [];
    
    for (const listingDoc of listingsSnapshot.docs) {
      const listingData = listingDoc.data();
      
      // Get offers for this listing
      const listingOffersSnapshot = await db.collection('exchange_offers')
        .where('listingId', '==', listingDoc.id)
        .get();
      
      for (const offerDoc of listingOffersSnapshot.docs) {
        const offerData = offerDoc.data();
        
        // Get offerer information
        const offererDoc = await db.collection('users').doc(offerData.offererId).get();
        if (offererDoc.exists) {
          const offererData = offererDoc.data();
          
          offers.push({
            id: offerDoc.id,
            ...offerData,
            foodName: listingData.foodName,
            quantity: listingData.quantity,
            details: listingData.details,
            startTime: listingData.startTime,
            endTime: listingData.endTime,
            firstName: offererData.firstName,
            lastName: offererData.lastName,
            phone: offererData.phone,
            province: offererData.province,
            district: offererData.district
          });
        }
      }
    }
    
    // Sort by createdAt descending
    offers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(offers);
  } catch (error) {
    console.error('Get listing offers error:', error);
    res.status(500).json({ error: 'Teklifler getirilemedi' });
  }
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
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', req.user.id)
      .limit(50)
      .get();
    
    const notifications = notificationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by createdAt descending in memory
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Bildirimler yüklenemedi' });
  }
});

// Mark notification as read
app.put('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
  const { notificationId } = req.params;
  
    await dbUpdate('notifications', notificationId, { isRead: true });
      res.json({ message: 'Bildirim okundu olarak işaretlendi' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Bildirim güncellenemedi' });
    }
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    // Get notifications for the user that are unread
    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', req.user.id)
      .where('isRead', '==', false)
      .get();
    
    const count = notificationsSnapshot.size;
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Bildirim sayısı alınamadı' });
  }
});

// Admin endpoints
// Get all users (admin only)
app.get('/api/admin/users', async (req, res) => {
  try {
  // Check for admin credentials in URL parameters
  const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
  const email = urlParams.get('email');
  const password = urlParams.get('password');
  
  const ADMIN_EMAIL = 'mustafaozkoca1@gmail.com';
  const ADMIN_PASSWORD = 'mF3z4Vsf.';
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Admin yetkisi gerekli' });
  }

    const usersSnapshot = await db.collection('users')
      .get();
    
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by createdAt descending in memory
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(users);
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Kullanıcılar getirilemedi' });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
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
    const listingsSnapshot = await db.collection('food_listings')
      .where('userId', '==', userId)
      .get();
    
    const listingDeletePromises = listingsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(listingDeletePromises);

    // Delete user's offers
    const offersSnapshot = await db.collection('exchange_offers')
      .where('offererId', '==', userId)
      .get();
    
    const offerDeletePromises = offersSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(offerDeletePromises);

    // Delete user's notifications
    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .get();
    
    const notificationDeletePromises = notificationsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(notificationDeletePromises);

    // Delete user's email verifications
    const verificationsSnapshot = await db.collection('email_verifications')
      .where('userId', '==', userId)
      .get();
    
    const verificationDeletePromises = verificationsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(verificationDeletePromises);

    // Finally delete the user
    await db.collection('users').doc(userId).delete();
    
            res.json({ message: 'Kullanıcı başarıyla silindi' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
  }
});

// Debug token endpoint (for troubleshooting)
app.get('/api/debug-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Token gerekli' });
    }

    const verificationsSnapshot = await db.collection('email_verifications')
      .where('verificationToken', '==', token)
      .get();
    
    const verification = verificationsSnapshot.empty ? null : {
      id: verificationsSnapshot.docs[0].id,
      ...verificationsSnapshot.docs[0].data()
    };

    if (!verification) {
      return res.json({ 
        found: false, 
        message: 'Token bulunamadı - muhtemelen süresi dolmuş veya zaten kullanılmış' 
      });
    }

    const now = new Date();
    const expiresAt = new Date(verification.expiresAt);
    const isExpired = now > expiresAt;

    return res.json({
      found: true,
      token: verification.verificationToken,
      userId: verification.userId,
      email: verification.email,
      createdAt: verification.createdAt,
      expiresAt: verification.expiresAt,
      isExpired: isExpired,
      timeLeft: isExpired ? 'Süresi dolmuş' : `${Math.floor((expiresAt - now) / (1000 * 60 * 60))} saat kaldı`
    });
  } catch (error) {
    console.error('Debug token error:', error);
    res.status(500).json({ error: 'Veritabanı hatası', details: error.message });
  }
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Debug endpoint to list all users
app.get('/api/debug-users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        ...data
      });
    });
    
    return res.json({
      totalUsers: users.length,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        emailType: typeof user.email,
        emailLength: user.email ? user.email.length : 'null',
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        verificationToken: user.verificationToken ? 'exists' : 'null'
      }))
    });
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({ error: 'Debug error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Send offer notification email
const sendOfferNotificationEmail = async (recipientEmail, offererName, foodName) => {
  console.log('=== OFFER NOTIFICATION EMAIL ===');
  console.log('Recipient:', recipientEmail);
  console.log('Offerer:', offererName);
  console.log('Food:', foodName);
  
  if (!transporter) {
    console.log('❌ Email transporter not available');
    return false;
  }

  const mailOptions = {
    from: '"Azık Platformu" <noreply@azik.com>',
    to: recipientEmail,
    subject: 'Azık - Yeni Teklif Geldi!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff9a56 0%, #ffd93d 50%, #ff6b35 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Azık</h1>
          <p style="color: white; margin: 10px 0 0 0;">Yemek Takası Platformu</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">🎉 Yeni Teklif Geldi!</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            <strong>${offererName}</strong> ilanınıza teklif verdi!
          </p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin: 0 0 10px 0;">İlan Detayları:</h3>
            <p style="color: #666; margin: 0;"><strong>Yemek:</strong> ${foodName}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://azik-food-exchange.onrender.com'}/my-listings" style="background: linear-gradient(135deg, #ff6b35, #ff9a56); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Teklifi Görüntüle
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 25px;">
            Bu e-posta, ilanınıza teklif geldiğinde otomatik olarak gönderilmiştir.
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
    console.log('📧 Sending offer notification email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Offer notification email sent successfully');
    console.log('Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending offer notification email:', error);
    return false;
  }
};

// Send offer accepted notification email
const sendOfferAcceptedEmail = async (recipientEmail, offererName, foodName, ownerPhone) => {
  console.log('=== OFFER ACCEPTED EMAIL ===');
  console.log('Recipient:', recipientEmail);
  console.log('Offerer:', offererName);
  console.log('Food:', foodName);
  console.log('Owner Phone:', ownerPhone);
  
  if (!transporter) {
    console.log('❌ Email transporter not available');
    return false;
  }

  const mailOptions = {
    from: '"Azık Platformu" <noreply@azik.com>',
    to: recipientEmail,
    subject: 'Azık - Teklifiniz Kabul Edildi! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 50%, #17a2b8 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Azık</h1>
          <p style="color: white; margin: 10px 0 0 0;">Yemek Takası Platformu</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">🎉 Teklifiniz Kabul Edildi!</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            Tebrikler! <strong>${foodName}</strong> ilanına verdiğiniz teklif kabul edildi!
          </p>
          <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #155724; margin: 0 0 10px 0;">📞 İletişim Bilgileri:</h3>
            <p style="color: #155724; margin: 0;"><strong>Telefon:</strong> ${ownerPhone}</p>
            <p style="color: #155724; margin: 5px 0 0 0;"><strong>İlan:</strong> ${foodName}</p>
          </div>
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>💡 Öneri:</strong> Yukarıdaki telefon numarasını arayarak detayları konuşabilir ve buluşma yerini belirleyebilirsiniz.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://azik-food-exchange.onrender.com'}/my-offers" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Tekliflerimi Görüntüle
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 25px;">
            Bu e-posta, teklifiniz kabul edildiğinde otomatik olarak gönderilmiştir.
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
    console.log('📧 Sending offer accepted email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Offer accepted email sent successfully');
    console.log('Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending offer accepted email:', error);
    return false;
  }
};

// Send offer rejected notification email
const sendOfferRejectedEmail = async (recipientEmail, offererName, foodName) => {
  console.log('=== OFFER REJECTED EMAIL ===');
  console.log('Recipient:', recipientEmail);
  console.log('Offerer:', offererName);
  console.log('Food:', foodName);
  
  if (!transporter) {
    console.log('❌ Email transporter not available');
    return false;
  }

  const mailOptions = {
    from: '"Azık Platformu" <noreply@azik.com>',
    to: recipientEmail,
    subject: 'Azık - Teklif Durumu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6c757d 0%, #495057 50%, #343a40 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Azık</h1>
          <p style="color: white; margin: 10px 0 0 0;">Yemek Takası Platformu</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Teklif Durumu</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            <strong>${foodName}</strong> ilanına verdiğiniz teklif reddedildi.
          </p>
          <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin: 0 0 10px 0;">📋 İlan Bilgileri:</h3>
            <p style="color: #6c757d; margin: 0;"><strong>Yemek:</strong> ${foodName}</p>
            <p style="color: #6c757d; margin: 5px 0 0 0;"><strong>Durum:</strong> Teklif Reddedildi</p>
          </div>
          <div style="background: #e2e3e5; border: 1px solid #d6d8db; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #495057; margin: 0; font-size: 14px;">
              <strong>💡 Öneri:</strong> Başka ilanlara teklif verebilir veya kendi ilanınızı oluşturabilirsiniz.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://azik-food-exchange.onrender.com'}/" style="background: linear-gradient(135deg, #6c757d, #495057); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Diğer İlanları Görüntüle
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 25px;">
            Bu e-posta, teklifiniz reddedildiğinde otomatik olarak gönderilmiştir.
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
    console.log('📧 Sending offer rejected email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Offer rejected email sent successfully');
    console.log('Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending offer rejected email:', error);
    return false;
  }
};
