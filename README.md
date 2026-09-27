# FocusFlow OS

**Master Your Time • Eliminate Distraction • Achieve Greatness**

A 100% offline, 100% free productivity utility built with Expo / React Native.
No accounts, no cloud sync, no in-app purchases — ever. Monetized exclusively
through Google AdMob (Banner, Interstitial, Rewarded).

Built by **ZeeU Creative Studio**.

---

## App Suite

| Tab | Feature |
|---|---|
| **Focus Timer** | Pomodoro (25m) / Zen Break (5m), fully customizable, glowing animated circular progress ring, audible tick + completion bell |
| **Sound Sanctuary** | 4 offline soundscapes, every one synthesized on-device as real 16-bit PCM WAV audio: Alpha Calm (10Hz), Deep Brown Noise, White Focus, and the bonus Binaural Gamma 40Hz (unlocked via a free rewarded video) |
| **Priority Vault** | The "Rule of 3" daily micro-task list, streak tracker, and completion history — all in AsyncStorage |
| **Deep Work Stats** | Daily/weekly focus minutes, a 7-day bar chart, streak badges, all-time totals, and the in-app Privacy Policy |

## Architecture Notes

- **Single-file core:** all app logic lives in `App.tsx` for a compact, easy-to-audit codebase.
- **Zero bundled audio assets:** every soundscape and UI tone (tick, bell) is generated
  at runtime from raw sine/noise math, packaged into a valid WAV header, base64-encoded,
  and written to disk via `expo-file-system`. Nothing is downloaded and nothing ships
  as a static asset — the *first* play synthesizes the file, every play after that is
  instant from the on-device cache.
- **AdMob only, always safe:** every native ad call (`MobileAds().initialize()`, banner
  render, interstitial load/show, rewarded load/show) is wrapped in `try/catch` with
  dedicated `AdEventType` / `RewardedAdEventType` error listeners, and the native module
  itself is `require()`'d defensively — so a missing module, an unfilled ad, or a network
  failure never crashes the app or blocks a feature.
- **Zero IAP:** there is no purchase flow, paywall, or "Pro" tier anywhere in this
  codebase. Every timer, soundscape, and stat is unlocked for every user by default.
  The Rewarded ad only ever unlocks one bonus soundscape — it is not a checkout flow.

## Requirements

- Node.js ≥ 18
- npm ≥ 9 (or Yarn)
- An [Expo](https://expo.dev) account for EAS builds
- Java 17 + Android SDK if you plan to run a local Gradle build instead of `eas build`

## Setup

```bash
npm install
```

## Running in development

```bash
npx expo start
```

> **Note:** `react-native-google-mobile-ads` is a native module and will not
> function inside Expo Go. Use a development build (`npx expo run:android`)
> or an EAS build to test real ad behavior. Inside Expo Go the app still runs
> fully — ads simply no-op safely, exactly as designed for the "safe fallback"
> architecture pillar.

## Before your first production build

This project ships with `credentials.json` **pre-wired to your existing
keystore, with the passwords left as placeholders** — this repo intentionally
does not include a keystore binary:

1. Copy your existing `zeeu-keystore.jks` into the project root (next to `app.json`).
2. Open `credentials.json` and replace the two placeholder values:
   ```json
   {
     "android": {
       "keystore": {
         "keystorePath": "zeeu-keystore.jks",
         "keystorePassword": "YOUR_KEYSTORE_PASSWORD",
         "keyAlias": "zeeu",
         "keyPassword": "YOUR_KEY_PASSWORD"
       }
     }
   }
   ```
3. Never commit the filled-in `credentials.json` or the `.jks` file to a public
   repository — both are already listed in `.gitignore`.

## Building the signed APK

```bash
eas build --platform android --profile production-apk-local
```

This profile (`eas.json` → `production-apk-local`) is configured for
`buildType: "apk"` and `credentialsSource: "local"`, so EAS will read your
keystore directly from `credentials.json` instead of managing it remotely.

## AdMob configuration

All four AdMob unit IDs are wired into `app.json` (native plugin config) and
mirrored as constants in `App.tsx` so the JS layer always matches the native
manifest:

- **App ID:** `ca-app-pub-5206710479803910~6573330902`
- **Banner:** `ca-app-pub-5206710479803910/8395705158` — pinned to the bottom, auto-hidden during an active focus session
- **Interstitial:** `ca-app-pub-5206710479803910/4451309452` — shown once, after a completed Pomodoro focus session
- **Rewarded:** `ca-app-pub-5206710479803910/1321004221` — unlocks the bonus Binaural Gamma 40Hz soundscape, free, forever

## Privacy & compliance

- No login, no analytics SDK, no Firebase, no network calls made by this
  app's own code — everything (tasks, streaks, stats, settings) is stored
  locally via `@react-native-async-storage/async-storage`.
- The in-app Privacy Policy (Deep Work Stats tab) discloses AdMob's own data
  collection, since that is Google's SDK operating under Google's policy,
  not data this app transmits itself.
- Zero IAP and zero paywalls — built to satisfy both Play Store and Amazon
  Appstore review requirements for a "100% free" listing.

## Project structure

```
focusflow-os/
├── App.tsx              # Entire application (4 tabs, audio engine, AdMob, storage)
├── app.json             # Expo config: identity, icons, AdMob plugin
├── package.json         # Locked dependencies
├── package-lock.json    # Resolved dependency tree
├── eas.json             # EAS build profiles (production-apk-local, preview, dev)
├── credentials.json     # Keystore path/alias wiring (passwords left as placeholders)
├── tsconfig.json        # Expo TypeScript config
├── babel.config.js      # Expo Babel preset
├── .gitignore
├── assets/
│   ├── icon.png
│   ├── adaptive-icon.png
│   ├── splash.png
│   └── favicon.png
└── README.md
```

## Support

ZeeU Creative Studio · https://zeeu-creative-studio-e-book-vault.ai.studio
