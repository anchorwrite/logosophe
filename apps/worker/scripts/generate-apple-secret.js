const jwt = require('jsonwebtoken');
const fs = require('fs');

// Configuration
const teamId = '42R9DPNTYR';
const clientId = 'com.logosophe.www.authjs';
const keyId = 'MVVB892PSQ';
const privateKeyPath = process.argv[2]; // Path to your .p8 file

if (!privateKeyPath) {
  console.error('Please provide the path to your private key file (.p8)');
  process.exit(1);
}

try {
  const privateKey = fs.readFileSync(privateKeyPath);
  
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: 'https://appleid.apple.com',
    issuer: teamId,
    subject: clientId,
    keyid: keyId
  });

  console.log('New Apple Client Secret:');
  console.log(token);
} catch (error) {
  console.error('Error generating token:', error);
} 