# Android Deployment Guide — Smart Reply AI

Complete guide to building and publishing Smart Reply AI as an Android app using Capacitor.

---

## Prerequisites

- **Node.js 18+** and **npm** installed
- **Android Studio** (latest stable) with:
  - Android SDK (API 33+ recommended)
  - Android SDK Build-Tools
  - Android Emulator or a physical device
- **Java JDK 17+** (bundled with Android Studio)
- A **Google Play Console** account ($25 one-time fee)

---

## Step-by-Step Build Process

### 1. Export and Clone the Project

1. Click **"Export to GitHub"** in Lovable
2. Clone the repository locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/smart-reply-ai.git
   cd smart-reply-ai
   ```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 4. Build the Web App

```bash
npm run build
```

This creates the `dist/` folder that Capacitor will wrap.

### 5. Add Android Platform

```bash
npx cap add android
npx cap sync android
```

### 6. Open in Android Studio

```bash
npx cap open android
```

### 7. Configure the App

In Android Studio, verify:
- **Package name**: `app.lovable.smartreplyai` (or change to your own, e.g., `com.yourcompany.smartreplyai`, before first Play Store upload)
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 34 (Android 14)

### 8. Test on Emulator/Device

```bash
npx cap run android
```

Or use Android Studio's Run button.

### 9. Generate Signed AAB for Play Store

1. In Android Studio: **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle (AAB)**
3. Create or select a keystore:
   - **Key store path**: Save your `.jks` file securely
   - **Key alias**: e.g., `smartreply-key`
   - **Password**: Use a strong password
4. Build the **release** variant
5. The AAB file will be in `android/app/build/outputs/bundle/release/`

⚠️ **CRITICAL**: Back up your keystore file and passwords. You cannot update the app without them.

---

## Google Play Console Setup

### 1. Create a New App

1. Go to [play.google.com/console](https://play.google.com/console)
2. Click **"Create app"**
3. Fill in:
   - **App name**: Smart Reply AI
   - **Default language**: English (or Arabic)
   - **App type**: App
   - **Free or Paid**: Choose based on your model

### 2. Store Listing

Required fields:
- **Short description** (80 chars): "AI-powered customer reply generator for businesses"
- **Full description** (4000 chars): Describe features, supported platforms, etc.
- **Screenshots**: At least 2 phone screenshots (see Asset Sizes below)
- **Feature graphic**: 1024×500px
- **App icon**: 512×512px (already provided by Capacitor build)

### 3. Content Rating

Complete the questionnaire — the app is typically rated "Everyone" since it's a business productivity tool.

### 4. Privacy Policy (Required)

You **must** host a privacy policy at a public URL. Include:
- What data you collect (email, business info, generated replies)
- How data is stored and secured
- Third-party services (AI providers, analytics)
- User rights and data deletion

### 5. Data Safety Form

Required declarations:
- **Data collected**: Email address, business information
- **Data shared**: None (if you don't share with third parties)
- **Data encrypted**: Yes (use HTTPS)
- **Data deletion**: Users can request account deletion

### 6. Upload AAB

1. Go to **Release → Production**
2. Click **"Create new release"**
3. Upload your signed `.aab` file
4. Add release notes
5. Review and roll out

---

## Package Name Guidance

- Default: `app.lovable.smartreplyai`
- Recommended: Use your own domain-based ID, e.g., `com.smartreplyai.app`
- **Cannot be changed** after first Play Store upload
- Change in `capacitor.config.ts` (`appId`) and sync before first release

---

## Versioning

In `android/app/build.gradle`:
```groovy
versionCode 1    // Increment for every upload (integer)
versionName "1.0.0"  // User-visible version string
```

Play Store requires `versionCode` to increase with each upload.

---

## Asset Sizes for Google Play

| Asset | Size | Format |
|-------|------|--------|
| App icon | 512×512px | PNG (32-bit, no alpha for Play Store icon) |
| Feature graphic | 1024×500px | PNG or JPEG |
| Phone screenshots | 16:9 or 9:16, min 320px, max 3840px | PNG or JPEG |
| 7-inch tablet screenshots | Optional, min 320px | PNG or JPEG |
| 10-inch tablet screenshots | Optional, min 320px | PNG or JPEG |
| Splash screen | 2732×2732px (center logo) | PNG |
| Adaptive icon foreground | 432×432px (safe zone: 264×264px center) | PNG |
| Adaptive icon background | 432×432px | PNG or solid color |

### Recommended Screenshot Dimensions
- **Phone**: 1080×1920px (portrait) or 1920×1080px (landscape)
- Take screenshots on a Pixel 6 or similar emulator for consistency

---

## Pre-Release Checklist

- [ ] App builds and runs on emulator without crashes
- [ ] All navigation works (bottom nav, sidebar, page routing)
- [ ] Reply generation works (once API is connected)
- [ ] Copy and share actions work
- [ ] Arabic/RTL layout displays correctly
- [ ] Forms are usable on small screens (no zoom issues)
- [ ] External links open in system browser
- [ ] Auth flow works in WebView context
- [ ] Offline fallback shows appropriate message
- [ ] Back button behavior is correct (Android hardware back)
- [ ] Splash screen displays correctly
- [ ] App icon appears correctly in launcher
- [ ] No console errors in production build
- [ ] Privacy policy URL is live and accessible
- [ ] Data safety form is completed in Play Console

---

## Auth Considerations for Android WebView

- **Email/password sign-in**: Works reliably in WebView
- **Google Sign-In**: May need additional configuration:
  - Add your Android app's SHA-1 fingerprint to Google Cloud Console
  - Use Capacitor's `@capacitor/google-auth` plugin for native Google Sign-In
  - Or use redirect-based OAuth flow instead of popup
- **Session persistence**: Capacitor WebView preserves cookies; localStorage persists across app restarts

---

## Native Plugin Support (Future)

When ready to add native features, install Capacitor plugins:

```bash
# Push Notifications
npm install @capacitor/push-notifications

# Camera
npm install @capacitor/camera

# Haptic Feedback
npm install @capacitor/haptics

# App (lifecycle, URLs)
npm install @capacitor/app

# Keyboard
npm install @capacitor/keyboard

# Status Bar
npm install @capacitor/status-bar
```

After installing, run `npx cap sync android` to update the native project.

---

## Updating the App

After making changes in Lovable:

1. Git pull latest changes
2. `npm install`
3. `npm run build`
4. `npx cap sync android`
5. Open Android Studio: `npx cap open android`
6. Increment `versionCode` in `build.gradle`
7. Generate new signed AAB
8. Upload to Play Console

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| White screen on launch | Check `webDir` in `capacitor.config.ts` matches your build output folder (`dist`) |
| API calls fail | Ensure API URLs use HTTPS, not localhost |
| Google Sign-In fails | Add SHA-1 to Google Cloud Console, or use redirect flow |
| Back button closes app | Handle back navigation in your router |
| Keyboard covers input | Use `@capacitor/keyboard` plugin to adjust viewport |
