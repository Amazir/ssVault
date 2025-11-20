const openpgp = require('openpgp');
const fs = require('fs');

async function generateGpgKeyPair(userId = 'ssVault User') {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'Curve25519',
    userIDs: [{ name: userId, email: `${userId.replace(/\s+/g, '_')}@ssvault.local` }],
    passphrase: null,
    format: 'armored'
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

module.exports = { generateGpgKeyPair, readAndValidateArmoredKey };