# Capacitor Setup Guide for Android

This guide will help you convert the loot tracker into a native Android app using Capacitor.

## What is Capacitor?

Capacitor is a cross-platform native runtime that makes it easy to build web apps that run natively on iOS, Android, and the web. It provides:

- Native app wrappers for your web code
- Access to native device features (camera, storage, etc.)
- Simple build and deployment process
- No need to rewrite your React code

## Prerequisites

- Node.js 18+ installed
- Android Studio installed
- Java JDK 11+ installed
- The loot tracker working locally

## Installation Steps

### 1. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

### 2. Initialize Capacitor

```bash
npx cap init
```

When prompted:
- **App name**: Besmara's Loot Tracker
- **App package ID**: com.besmaras.loottracker (or your preference)
- **Web asset directory**: dist

### 3. Build Your Web App

```bash
npm run build
```

### 4. Add Android Platform

```bash
npx cap add android
```

This creates an `android` folder with a native Android project.

### 5. Configure Capacitor

Edit `capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.besmaras.loottracker',
  appName: 'Besmaras Loot Tracker',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Optional: For development, point to your local server
    // url: 'http://192.168.1.100:5173',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false
    }
  }
};

export default config;
```

### 6. Update Android Configuration

Edit `android/app/src/main/AndroidManifest.xml`:

Add internet permission (if not already present):

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### 7. Sync and Build

```bash
# Sync web assets to native project
npx cap sync

# Open in Android Studio
npx cap open android
```

### 8. Build in Android Studio

1. Android Studio will open
2. Wait for Gradle sync to complete
3. Select a device/emulator
4. Click **Run** (green play button)

## App Icons and Splash Screen

### Generate Icons

1. Create a 1024x1024 icon image
2. Use a tool like [Icon Kitchen](https://icon.kitchen/) to generate all sizes
3. Replace files in `android/app/src/main/res/`:
   - `mipmap-hdpi`
   - `mipmap-mdpi`
   - `mipmap-xhdpi`
   - `mipmap-xxhdpi`
   - `mipmap-xxxhdpi`

### Splash Screen

1. Create splash screen assets (1080x1920 recommended)
2. Place in `android/app/src/main/res/drawable/`
3. Update `android/app/src/main/res/values/styles.xml`

## Development Workflow

### Hot Reload Development

For faster development with hot reload:

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Update `capacitor.config.ts`:
   ```typescript
   server: {
     url: 'http://YOUR-LOCAL-IP:5173',
     cleartext: true
   }
   ```

3. Sync and run:
   ```bash
   npx cap sync
   npx cap run android
   ```

### Production Build

When ready to build for production:

1. Build web assets:
   ```bash
   npm run build
   ```

2. Remove dev server URL from config:
   ```typescript
   server: {
     androidScheme: 'https'
   }
   ```

3. Sync and build:
   ```bash
   npx cap sync
   npx cap open android
   ```

4. In Android Studio:
   - Build → Generate Signed Bundle/APK
   - Follow prompts to create keystore and sign your app

## Publishing to Google Play Store

### 1. Prepare Your App

- Create app icon (512x512 for Play Store)
- Create feature graphic (1024x500)
- Write app description
- Take screenshots (phone and tablet)
- Set up privacy policy URL

### 2. Create Keystore

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

### 3. Build Signed APK/Bundle

In Android Studio:
1. Build → Generate Signed Bundle / APK
2. Select "Android App Bundle"
3. Choose your keystore
4. Build release bundle

### 4. Upload to Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Fill in app details
4. Upload your AAB file
5. Complete store listing
6. Submit for review

## Native Features (Optional Enhancements)

Capacitor provides plugins for native features:

### Camera Access
```bash
npm install @capacitor/camera
```

Use for: Taking photos of loot items

### File System
```bash
npm install @capacitor/filesystem
```

Use for: Exporting campaign data

### Share Plugin
```bash
npm install @capacitor/share
```

Use for: Sharing loot lists with party

### Local Notifications
```bash
npm install @capacitor/local-notifications
```

Use for: Reminders for crew wages

## Troubleshooting

### Build Errors

**Gradle sync failed:**
- Check Java JDK version (need 11+)
- Update Gradle in `android/build.gradle`
- Sync project in Android Studio

**App won't connect to Supabase:**
- Check internet permission in AndroidManifest.xml
- Verify `androidScheme` is set to `https`
- Clear app data and reinstall

**White screen on launch:**
- Check `webDir` in capacitor.config.ts
- Ensure `npm run build` completed successfully
- Verify all assets copied with `npx cap sync`

### Performance Issues

- Enable hardware acceleration in AndroidManifest.xml
- Optimize images and assets
- Use React.memo() for expensive components
- Consider implementing virtualization for long lists

## Updating the App

When you make changes to your web code:

```bash
# Rebuild web assets
npm run build

# Sync to native project
npx cap sync

# Run on device
npx cap run android
```

## App Size Optimization

To reduce app size:

1. Remove unused dependencies
2. Optimize images
3. Enable ProGuard/R8 in Android Studio
4. Use Android App Bundle instead of APK

## Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Capacitor Community Plugins](https://capacitorjs.com/docs/plugins/community)

## Cost Estimate

- **Google Play Developer Account**: $25 (one-time fee)
- **Development**: Free
- **Hosting**: Free (using Vercel/Netlify for web version)
- **Backend**: Free tier of Supabase

## Next Steps

1. Complete and test all app features on web
2. Install Capacitor following steps above
3. Test thoroughly on physical Android device
4. Create app store assets (icons, screenshots, description)
5. Set up Google Play Developer account
6. Build signed release bundle
7. Submit to Google Play Store

Good luck with your Android deployment! 🏴‍☠️📱
