const sqlite3 = require('sqlite3').verbose();

// Open database
const db = new sqlite3.Database('./azik.db');

console.log('=== Database Inspection ===');

// Check users table
db.all('SELECT id, email, firstName, lastName, isEmailVerified, createdAt FROM users ORDER BY createdAt DESC', [], (err, users) => {
  if (err) {
    console.error('Error querying users:', err);
    return;
  }
  
  console.log(`\nTotal users in database: ${users.length}`);
  console.log('\nUsers:');
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName}) - Verified: ${user.isEmailVerified ? 'Yes' : 'No'} - Created: ${user.createdAt}`);
  });
  
  // Check email verifications table
  db.all('SELECT userId, email, verificationToken, expiresAt, createdAt FROM email_verifications ORDER BY createdAt DESC', [], (err, verifications) => {
    if (err) {
      console.error('Error querying verifications:', err);
      return;
    }
    
    console.log(`\nTotal email verifications: ${verifications.length}`);
    console.log('\nEmail verifications:');
    verifications.forEach((verification, index) => {
      const isExpired = new Date(verification.expiresAt) < new Date();
      console.log(`${index + 1}. ${verification.email} - Expired: ${isExpired ? 'Yes' : 'No'} - Created: ${verification.createdAt}`);
    });
    
    // Close database
    db.close();
  });
});
