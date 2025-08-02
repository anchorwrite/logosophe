/**
 * Derives a proper encryption key from a string using PBKDF2
 * @param input The input string to derive the key from
 * @returns A CryptoKey suitable for AES-GCM encryption
 */
async function deriveKey(input: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = encoder.encode('logosophe-salt'); // Fixed salt for consistent key derivation
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using AES-GCM with a key derived from the provided input
 * @param text The text to encrypt
 * @param key The input to derive the encryption key from
 * @returns The encrypted text as a base64 string
 */
export async function encrypt(text: string, key: string): Promise<string> {
  // Derive a proper encryption key
  const cryptoKey = await deriveKey(key);

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the text
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    new TextEncoder().encode(text)
  );

  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encryptedData.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedData), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypts a string that was encrypted using the encrypt function
 * @param encryptedText The encrypted text as a base64 string
 * @param key The input used to derive the decryption key
 * @returns The decrypted text
 */
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  // Derive the decryption key
  const cryptoKey = await deriveKey(key);

  // Convert from base64
  const encryptedData = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);

  // Decrypt
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    data
  );

  // Convert to string
  return new TextDecoder().decode(decryptedData);
} 