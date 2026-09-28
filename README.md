# FocusFlow OS

**Master Your Time • Eliminate Distraction • Achieve Greatness**

By **ZeeU Creative Studio** · Package `com.zeeucreativestudio.focusflowos` · v1.0.0 (code 1)
Portal: https://zeeu-creative-studio-e-book-vault.ai.studio
© 2026 ZeeU Creative Studio. All Rights Reserved.

---

## Store Listing Metadata

### Short Description
Minimalist offline deep work timer, brown noise audio sanctuary & task vault.

### 5 Feature Bullets
• 100% Offline Sanctuary: Zero login, zero cloud tracking, and complete privacy.
• Procedural Ambient Audio: Built-in soothing Brown Noise, Rain, and Midnight Drone.
• Minimalist Deep Work Dial: Customizable intervals (25m, 50m, 90m) with ambient glows.
• Daily Task & Streak Vault: Lightweight priority checklist saved locally via AsyncStorage.
• 100% Free Forever: Zero paywalls, zero subscriptions, and zero in-app purchases.

### Full Long Description

# FocusFlow OS — Minimalist Deep Work, Audio Sanctuary & Task Vault

Reclaim your attention span and enter an undisturbed state of deep cognitive flow. **FocusFlow OS** is an ultra-minimalist, distraction-free productivity utility crafted by **ZeeU Creative Studio** for coders, writers, researchers, students, and creators who demand absolute focus.

### 🌟 KEY PILLARS & FEATURES:
1. **Precision Deep Work Engine:**
   - Circular visual countdown dial designed to minimize distraction while keeping time perception sharp.
   - Presets for 25-minute Pomodoro sprints, 50-minute deep cycles, and 90-minute ultradian flow sessions.

2. **Offline Procedural Audio Generator:**
   - Soothing acoustic soundscapes designed to drown out ambient office and household noise.
   - Built-in Brown Noise, Calming Rain, and Midnight Ambient Drone.
   - Operates 100% procedurally and offline without requiring massive audio downloads or draining mobile data.

3. **Minimalist Daily Task Vault:**
   - Focus exclusively on your top 3 to 5 daily non-negotiable tasks.
   - Track focus streaks and completed intervals locally with zero lag.

4. **100% Private, Secure & Offline:**
   - No sign-ups, no account creation, and zero external analytics servers.
   - All streaks, tasks, and settings are saved securely on your device sandbox via local storage.

5. **No Paywalls — 100% Free:**
   - Built with pride by ZeeU Creative Studio. Every feature is completely unlocked with zero in-app purchases.

### 📋 DEVELOPER & LEGAL CREDITS:
- **Developer:** ZeeU Creative Studio
- **Official Web Portal:** https://zeeu-creative-studio-e-book-vault.ai.studio
- **Copyright:** © 2026 ZeeU Creative Studio. All Rights Reserved.
- **Privacy Policy:** https://zeeu-creative-studio-e-book-vault.ai.studio (100% Offline, Zero PII Tracking, COPPA & GDPR Compliant).

---

## App Suite

| Tab | Feature |
|---|---|
| **Focus Timer** | 25/50/90-minute presets plus custom intervals, Zen Break, glowing circular ring, tick + bell |
| **Sound Sanctuary** | Procedurally synthesized offline audio: Alpha Calm 10Hz, Deep Brown Noise, White Focus, Calming Rain, Midnight Drone, and bonus Binaural Gamma 40Hz (free via rewarded video) |
| **Priority Vault** | Top 3–5 daily tasks, streak tracker, completed history (AsyncStorage) |
| **Deep Work Stats** | Today/weekly minutes, 7-day chart, badges, About (studio, package, portal, copyright), Privacy Policy & Terms modal |

A low-opacity brand watermark sits above the banner on every tab. The banner itself is hidden while a focus session is running.

## Architecture

- Single `App.tsx`. All tabs stay mounted, so the timer and soundscapes keep running while you switch tabs.
- No bundled audio: every soundscape and UI tone is generated as 16-bit PCM WAV, written via `expo-file-system`, played via `expo-av`, and cached after first play.
- AdMob is the only monetization. Every ad call is wrapped in try/catch with error listeners.
- Ads are configured conservatively to match the in-app disclosures: non-personalized, max content rating G, child-directed and under-age-of-consent tagging, and the `AD_ID` permission blocked in `app.json`. Adjust in `safeInitializeAds()` and `app.json` if your Play Console Families/Data Safety answers differ.
- In `__DEV__` builds Google's test ad units are used (to avoid invalid traffic on your live units). Release builds use your real IDs:
  - App: `ca-app-pub-5206710479803910~6573330902`
  - Banner: `ca-app-pub-5206710479803910/8395705158`
  - Interstitial: `ca-app-pub-5206710479803910/4451309452`
  - Rewarded: `ca-app-pub-5206710479803910/1321004221`
- No in-app purchases or paywalls anywhere.

## Setup & Build

```bash
npm install
eas init                      # links/creates the EAS project and writes the projectId
```

1. Copy your existing `zeeu-keystore.jks` into the project root (not included here).
2. Edit `credentials.json`: replace `YOUR_KEYSTORE_PASSWORD` and `YOUR_KEY_PASSWORD` (alias is `zeeu`).
3. Build:

```bash
eas build --platform android --profile production-apk-local
```

`app.json` pins `compileSdkVersion 34`, `targetSdkVersion 34`, and `kotlinVersion 1.9.24` via `expo-build-properties`.

> `react-native-google-mobile-ads` is native and does not run in Expo Go; the app still runs there with ads safely disabled. Use `npx expo run:android` or an EAS build to test ads.

## Files

`App.tsx`, `app.json`, `package.json`, `package-lock.json`, `eas.json`, `credentials.json`, `tsconfig.json`, `babel.config.js`, `.gitignore`, `assets/` (icon, splash, adaptive-icon, favicon), `README.md` — plus your own `zeeu-keystore.jks` added locally.
