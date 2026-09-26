# Flashcards

A personal, offline flashcard app: sets and cards, spaced repetition, study modes and games, and CSV import/export. Everything is stored on your device (IndexedDB). There are no accounts and no server. It runs in the browser on a laptop and as an Android app.

## Run it on the laptop

```powershell
npm install
npm run dev       # development server at http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve the production build at http://localhost:4173
npm test          # unit tests
```

### Where your data lives

Cards are stored in the browser, separately for each site address. `localhost:5173` (dev) and `localhost:4173` (preview) keep **separate** data. On the phone, cards live inside the app, so uninstalling it deletes them. If you clear site data or uninstall, your cards are gone. Export your sets as CSV now and then (Export CSV on a set).

## Android APK

### One-time setup: the signing key

Android only installs an update over an existing app when both are signed with the same key. The repo therefore uses one fixed debug key, which is kept out of git.

1. The key is at `android\app\debug-signing.p12` (password `flashcards`). **Back it up** somewhere safe, for example your Google Drive. If you lose it, you have to uninstall the app (and lose its cards) before a new build will install.
2. On GitHub, open the repo, then **Settings → Secrets and variables → Actions → New repository secret**.
3. Name it `DEBUG_KEYSTORE_BASE64`. For the value, paste the whole content of `android\app\debug-signing.p12.base64.txt`.

### Get the APK (no Android tools needed on the laptop)

Every push to `main` runs the **Android APK** workflow on GitHub Actions. You can also run it by hand from the Actions tab (Run workflow).

1. Open the repo's **Actions** tab, then the latest green **Android APK** run.
2. Under **Artifacts**, download `flashcards-debug-apk` (a zip that contains `app-debug.apk`). You must be signed in to GitHub.
3. Unzip it and move `app-debug.apk` to the phone (Google Drive, Messenger, or USB).

### Install it on the phone

1. Open the APK on the phone (from Files or Drive).
2. Android asks to allow installs from that app (Files, Drive or Chrome). Turn on **Allow from this source**, go back, and tap **Install**.
3. If Play Protect warns that the app is unknown, choose **Install anyway**. This is expected for a personal app that isn't from the Play Store.
4. To update later, install a newer APK the same way. It replaces the old one and keeps your cards.

### Build locally instead (optional)

This needs JDK 21 and the Android command-line tools; full Android Studio isn't required.

1. Install a JDK 21, for example Eclipse Temurin 21, and set `JAVA_HOME`.
2. Download the Android "Command line tools only" package. Unzip it to `C:\Android\cmdline-tools\latest`, then set `ANDROID_HOME=C:\Android`.
3. Install the SDK packages:
   ```powershell
   C:\Android\cmdline-tools\latest\bin\sdkmanager.bat "platform-tools" "platforms;android-36" "build-tools;36.0.0"
   ```
4. Build the APK:
   ```powershell
   npm run build
   npx cap sync android
   cd android
   .\gradlew.bat assembleDebug
   ```
   The APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`.

## CSV format

This is the simple format: no header row. Column A is the front, column B is the back, and columns C to E are optional wrong answers for multiple choice. Comma, tab and semicolon files can all be imported. On Android, exporting opens the share sheet so you can save the file to Drive or Files, or send it.
