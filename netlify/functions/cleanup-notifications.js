const admin = require('firebase-admin');

// Firebase Admin SDK initialization
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (error) {
  console.error('Firebase service account parsing error:', error);
  serviceAccount = null;
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  try {
    console.log('Starting notification cleanup...');
    
    // 1 gün öncesinin tarihini hesapla
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    console.log('Deleting notifications older than:', oneDayAgo.toISOString());
    
    // 1 günden eski bildirimleri bul
    const notificationsRef = db.collection('notifications');
    const snapshot = await notificationsRef
      .where('createdAt', '<', oneDayAgo.toISOString())
      .get();
    
    if (snapshot.empty) {
      console.log('No old notifications found to delete');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'No old notifications found',
          deletedCount: 0 
        })
      };
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
    
    console.log(`Successfully deleted ${deletedCount} old notifications`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Successfully deleted ${deletedCount} old notifications`,
        deletedCount: deletedCount,
        cutoffDate: oneDayAgo.toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error during notification cleanup:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to cleanup notifications',
        details: error.message 
      })
    };
  }
};
