const validator = require('validator');

// Test email validation function
const validateEmail = (email) => {
  return validator.isEmail(email);
};

// Test emails
const testEmails = [
  'test@example.com',
  'user@gmail.com',
  'mustafaozkoca1@gmail.com',
  'invalid-email',
  'test@',
  '@example.com',
  'test..test@example.com',
  'test@example..com'
];

console.log('=== Email Validation Test ===');
console.log('Validator version:', require('validator/package.json').version);

testEmails.forEach(email => {
  const isValid = validateEmail(email);
  console.log(`${email}: ${isValid ? 'VALID' : 'INVALID'}`);
});

// Test specific email that might be causing issues
const specificEmail = 'mustafaozkoca1@gmail.com';
console.log(`\nSpecific test for: ${specificEmail}`);
console.log('Result:', validateEmail(specificEmail));
console.log('Validator.isEmail result:', validator.isEmail(specificEmail));
