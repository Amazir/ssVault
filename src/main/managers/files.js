async function addFile(filePath, vaultHandler) {
    const data = fs.readFileSync(filePath);
    const encrypted = await vaultHandler.encryptWithGPG(data);
    const targetPath = path.join(vaultHandler.tempDir, 'files', path.basename(filePath) + '.gpg');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, encrypted);
    // Dodaj metadane do DB (np. nazwa, hash)
}

module.exports = { addFile };