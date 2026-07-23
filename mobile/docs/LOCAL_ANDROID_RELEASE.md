# Local Android release

Hazi can produce Android release artifacts locally without consuming an Expo Application Services build quota.

## Signing environment

Keep the upload keystore and its password outside the repository. Before running Gradle, provide these environment variables:

- `HAZI_UPLOAD_STORE_FILE`: absolute path to the upload keystore
- `HAZI_UPLOAD_STORE_PASSWORD`: keystore password
- `HAZI_UPLOAD_KEY_ALIAS`: upload-key alias
- `HAZI_UPLOAD_KEY_PASSWORD`: key password
- `ANDROID_HOME`: Android SDK path
- `NODE_ENV=production`

The `withHaziAndroidSigning` config plugin injects the release signing configuration during Expo prebuild. It never contains or copies signing secrets.

## Build

From `mobile`, install the locked dependencies and regenerate Android:

```powershell
pnpm install --frozen-lockfile
pnpm exec expo prebuild --platform android --clean --no-install
Set-Location android
.\gradlew.bat clean assembleRelease bundleRelease --no-daemon
```

Artifacts are written to:

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Verify the APK with Android SDK `apksigner verify --verbose --print-certs` before installation or publication. Preserve the upload keystore permanently: future updates must use the same upload key.
