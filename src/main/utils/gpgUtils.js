const openpgp = require('openpgp');
const fs = require('fs');

openpgp.config.aeadProtect = false;
openpgp.config.preferredSymmetricAlgorithm = openpgp.enums.symmetric.aes256;
openpgp.config.preferredHashAlgorithm = openpgp.enums.hash.sha256;

async function generateGpgKeyPair(options = {}) {
  const { name = 'ssVault User', email } = options;
  
  const userIDs = [];
  if (email) {
    userIDs.push({ name, email });
  } else {
    userIDs.push({ name });
  }
  
  // Note: expirationDays removed - OpenPGP.js doesn't store expiration in a retrievable way
  // Keys are generated without expiration for vault use
  
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'rsa',
    rsaBits: 4096,
    userIDs,
    passphrase: '',
    format: 'armored',
    keyExpirationTime: 0 // No expiration
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

async function decryptText(encryptedText, privateKeyArmored) {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const message = await openpgp.readMessage({ armoredMessage: encryptedText });
  const { data: decrypted } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey
  });
  return decrypted;
}

async function encryptPrivateKey(privateKeyArmored, passphrase) {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const encryptedKey = await openpgp.encryptKey({
    privateKey,
    passphrase
  });
  return encryptedKey.armor();
}

async function decryptPrivateKey(encryptedPrivateKeyArmored, passphrase) {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: encryptedPrivateKeyArmored });
  const decryptedKey = await openpgp.decryptKey({
    privateKey,
    passphrase
  });
  return decryptedKey.armor();
}

module.exports = {
  generateGpgKeyPair,
  readAndValidateArmoredKey,
  encryptText,
  decryptText,
  encryptPrivateKey,
  decryptPrivateKey
};