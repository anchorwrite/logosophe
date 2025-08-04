const fs = require('fs');
const crypto = require('crypto');

// Apple OAuth configuration
const TEAM_ID = '42R9DPNTYR'; // Your Apple Team ID
const CLIENT_ID = 'com.logosophe.www.authjs'; // Your Services ID
const KEY_ID = 'MVVB892PSQ'; // Your Key ID
const PRIVATE_KEY_PATH = '/Users/plowden/Documents/Personal/Logosophe/Apple/AuthKey_MVVB892PSQ.p8';

// Read the private key
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

// Create JWT header
const header = {
  alg: 'ES256',
  kid: KEY_ID
};

// Create JWT payload
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + (6 * 30 * 24 * 60 * 60), // 6 months from now
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID
};

// Encode header and payload
const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

// Create the signing input
const signingInput = `${encodedHeader}.${encodedPayload}`;

// Sign with ES256
const sign = crypto.createSign('RSA-SHA256');
sign.update(signingInput);
const signature = sign.sign(privateKey, 'base64url');

// Create the JWT
const jwt = `${signingInput}.${signature}`;

console.log('Generated Apple Client Secret JWT:');
console.log(jwt);
console.log('\nDecoded payload:');
console.log(JSON.stringify(payload, null, 2)); 