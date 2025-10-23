# ssVault

## Sekcja Polska

### Opis
ssVault to aplikacja desktopowa do bezpiecznego przechowywania i zarządzania hasłami, plikami oraz kluczami kryptograficznymi GPG. Zapewnia wysoki poziom bezpieczeństwa dzięki szyfrowaniu bazy danych za pomocą kluczy GPG, prosty interfejs użytkownika oraz możliwość interakcji z zewnętrznymi aplikacjami. Aplikacja jest cross-platformowa i działa na systemach Windows, Linux oraz macOS.

Projekt powstał w ramach pracy dyplomowej na kierunku Informatyka, z zakresu programowania obiektowego. Motywacją było stworzenie hybrydowego narzędzia, które łączy funkcje menedżerów haseł, szyfrowania plików i zarządzania kluczami GPG w prosty, dostępny dla wszystkich użytkowników sposób, z naciskiem na lokalne przechowywanie danych dla maksymalnego bezpieczeństwa.

### Funkcje
- Bezpieczne przechowywanie haseł z automatycznym generowaniem silnych haseł.
- Szyfrowanie i deszyfrowanie plików za pomocą GPG.
- Zarządzanie kluczami kryptograficznymi GPG (generowanie, import, eksport).
- Profilowanie użytkowników z indywidualnymi bazami danych.
- Prosty, minimalistyczny interfejs graficzny oparty na Bootstrap.
- Integracja z systemem plików i zewnętrznymi narzędziami.
- Asynchroniczne operacje dla wysokiej wydajności.

### Wymagania
- Node.js (wersja LTS lub nowsza).
- Electron.
- GPG (GNU Privacy Guard) zainstalowane na systemie.

### Instalacja
1. Sklonuj repozytorium: `git clone https://github.com/Amazir/ssVault.git`
2. Przejdź do katalogu projektu: `cd ssVault`
3. Zainstaluj zależności: `npm install`

### Uruchomienie
- Uruchom aplikację w trybie deweloperskim: `npm start`
- Zbuduj aplikację dla konkretnej platformy: `npm run build` (wymaga konfiguracji w `package.json`).

### Struktura kodu
- `main.js`: Główny proces Electron, obsługa okien i integracji z Node.js.
- `renderer/`: Pliki frontendowe (HTML, CSS, JS) dla interfejsu użytkownika.
- `utils/`: Moduły narzędziowe do szyfrowania, zarządzania kluczami GPG i bazą danych.
- `database/`: Logika przechowywania danych (lokalna baza szyfrowana).
- `package.json`: Konfiguracja zależności i skryptów.

### Jak przyczynić się do projektu
- Forkuj repozytorium i twórz pull requesty z poprawkami lub nowymi funkcjami.
- Zgłaszaj issues w przypadku błędów lub sugestii.
- Utrzymuj kod w stylu zgodnym z ESLint (jeśli skonfigurowany).

### FAQ
#### Co to jest ssVault?
ssVault to hybrydowa aplikacja desktopowa do zarządzania hasłami, plikami i kluczami GPG. Została zaprojektowana, aby zapewnić wysoki poziom bezpieczeństwa poprzez lokalne szyfrowanie danych, bez zależności od chmury.

#### Dlaczego wybrano Node.js i Electron?
Node.js zapewnia asynchroniczność, wysoką wydajność i bogaty ekosystem NPM, co ułatwia integrację z GPG. Electron pozwala na tworzenie cross-platformowych aplikacji desktopowych z użyciem technologii webowych (HTML, CSS, JS), co upraszcza rozwój GUI.

#### Jak zapewnić bezpieczeństwo danych?
Aplikacja przechowuje dane lokalnie w zaszyfrowanej bazie za pomocą kluczy GPG (asymetryczne szyfrowanie). Nie używa chmury, co minimalizuje ryzyko wycieków. Zalecane jest używanie silnych haseł głównych i regularne backupy kluczy prywatnych.

#### Czy aplikacja wspiera synchronizację między urządzeniami?
Obecnie nie, ze względu na fokus na bezpieczeństwie lokalnym. Synchronizacja mogłaby wymagać chmury, co zwiększa ryzyko. W przyszłości można rozważyć bezpieczne metody, jak ręczne transfery plików.

#### Jak zarządzać kluczami GPG w aplikacji?
Aplikacja umożliwia generowanie nowych kluczy, import/eksport istniejących oraz ich użycie do szyfrowania/deszyfrowania plików i haseł. Wymaga zainstalowanego GPG na systemie.

#### Co zrobić, jeśli napotkam błąd podczas instalacji?
Sprawdź, czy masz zainstalowanego Node.js i GPG. Uruchom `npm install` ponownie i sprawdź logi błędów. Jeśli problem persists, zgłoś issue na GitHub z opisem błędu i wersjami oprogramowania.

#### Czy ssVault jest open-source?
Tak, projekt jest open-source pod licencją MIT. Możesz swobodnie modyfikować i dystrybuować kod.

### Licencja
MIT License. Szczegóły w pliku LICENSE.

## English Section

### Description
ssVault is a desktop application for secure storage and management of passwords, files, and GPG cryptographic keys. It provides a high level of security through database encryption using GPG keys, a simple user interface, and integration with external applications. The app is cross-platform and runs on Windows, Linux, and macOS.

The project was developed as part of a diploma thesis in Computer Science, focusing on object-oriented programming. The motivation was to create a hybrid tool that combines password manager features, file encryption, and GPG key management in an easy-to-use manner accessible to all users, emphasizing local data storage for maximum security.

### Features
- Secure password storage with automatic strong password generation.
- File encryption and decryption using GPG.
- Management of GPG cryptographic keys (generation, import, export).
- User profiling with individual databases.
- Simple, minimalist graphical interface based on Bootstrap.
- Integration with the file system and external tools.
- Asynchronous operations for high performance.

### Requirements
- Node.js (LTS version or newer).
- Electron.
- GPG (GNU Privacy Guard) installed on the system.

### Installation
1. Clone the repository: `git clone https://github.com/Amazir/ssVault.git`
2. Navigate to the project directory: `cd ssVault`
3. Install dependencies: `npm install`

### Usage
- Run the app in development mode: `npm start`
- Build the app for a specific platform: `npm run build` (requires configuration in `package.json`).

### Code Structure
- `main.js`: Main Electron process, handling windows and Node.js integration.
- `renderer/`: Frontend files (HTML, CSS, JS) for the user interface.
- `utils/`: Utility modules for encryption, GPG key management, and database handling.
- `database/`: Logic for data storage (local encrypted database).
- `package.json`: Dependency configuration and scripts.

### Contributing
- Fork the repository and create pull requests with fixes or new features.
- Report issues for bugs or suggestions.
- Maintain code style consistent with ESLint (if configured).

### FAQ
#### What is ssVault?
ssVault is a hybrid desktop application for managing passwords, files, and GPG keys. It is designed to provide high security through local data encryption, without relying on cloud services.

#### Why Node.js and Electron?
Node.js offers asynchronicity, high performance, and a rich NPM ecosystem, facilitating GPG integration. Electron enables cross-platform desktop apps using web technologies (HTML, CSS, JS), simplifying GUI development.

#### How is data security ensured?
The app stores data locally in an encrypted database using GPG keys (asymmetric encryption). It avoids cloud storage to minimize leak risks. Use strong master passwords and back up private keys regularly.

#### Does the app support synchronization across devices?
Currently no, due to the focus on local security. Syncing might require cloud, increasing risks. Future considerations could include secure manual file transfers.

#### How to manage GPG keys in the app?
The app allows generating new keys, importing/exporting existing ones, and using them for file/password encryption/decryption. Requires GPG installed on the system.

#### What if I encounter an error during installation?
Verify Node.js and GPG are installed. Rerun `npm install` and check error logs. If the issue persists, open an issue on GitHub with error details and software versions.

#### Is ssVault open-source?
Yes, the project is open-source under the MIT License. You can freely modify and distribute the code.

### License
MIT License. See the LICENSE file for details.