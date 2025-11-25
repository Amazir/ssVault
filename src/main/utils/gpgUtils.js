const openpgp = require('openpgp');
const fs = require('fs');

// Configure OpenPGP to use pure JS implementations instead of Web Crypto API
// This fixes compatibility issues with Electron's Node.js
openpgp.config.aeadProtect = false;
openpgp.config.preferredSymmetricAlgorithm = openpgp.enums.symmetric.aes256;
openpgp.config.preferredHashAlgorithm = openpgp.enums.hash.sha256;

/**
 * Generate a GPG key pair using OpenPGP.js
 * @param {Object} options - Key generation options
 * @param {string} options.name - User's name (required)
 * @param {string} [options.email] - User's email (optional)
 * @param {number} [options.expirationDays] - Days until key expires (0 = never)
 * @returns {Promise<{privateKeyArmored: string, publicKeyArmored: string}>}
 */
async function generateGpgKeyPair(options = {}) {
  const { name = 'ssVault User', email, expirationDays = 0 } = options;
  
  // Build userIDs array
  const userIDs = [];
  if (email) {
    userIDs.push({ name, email });
  } else {
    userIDs.push({ name });
  }
  
  // Calculate expiration time in seconds (0 = never expires)
  const keyExpirationTime = expirationDays > 0 ? expirationDays * 24 * 60 * 60 : 0;
  
  // Use RSA 4096 for better compatibility with Node.js crypto API
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'rsa',
    rsaBits: 4096,
    userIDs,
    passphrase: '',
    format: 'armored',
    keyExpirationTime
  });
  
  return {
    privateKeyArmored: privateKey,
    publicKeyArmored: publicKey
  };
}

async function readAndValidateArmoredKey(armoredContent) {
  try {
    const key = await openpgp.readKey({ armoredKey: armoredContent });
    return {
      type: key.isPrivate() ? 'private' : 'public',
      content: armoredContent,
      fingerprint: key.getFingerprint().toHex().toUpperCase(),
      userIds: key.getUserIDs().join(', ')
    };
  } catch (err) {
    throw new Error(`Invalid GPG key: ${err.message}`);
  }
}

/**
 * Encrypt text using a public GPG key
 * @param {string} text - Text to encrypt
 * @param {string} publicKeyArmored - Armored public key
 * @returns {Promise<string>} - Encrypted armored message
 */
async function encryptText(text, publicKeyArmored) {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
  const encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ text }),
    encryptionKeys: publicKey,
    format: 'armored',
    config: {
      aeadProtect: false,
      preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256
    }
  });
  return encrypted;
}

/**
 * Decrypt text using a private GPG key
 * @param {string} encryptedText - Armored encrypted message
 * @param {string} privateKeyArmored - Armored private key
 * @returns {Promise<string>} - Decrypted text
 */
async function decryptText(encryptedText, privateKeyArmored) {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const message = await openpgp.readMessage({ armoredMessage: encryptedText });
  const { data: decrypted } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey
  });
  return decrypted;
}

module.exports = { generateGpgKeyPair, readAndValidateArmoredKey, encryptText, decryptText };