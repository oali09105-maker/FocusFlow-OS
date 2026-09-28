/**
 * FocusFlow OS
 * "Master Your Time • Eliminate Distraction • Achieve Greatness"
 *
 * ZeeU Creative Studio
 * 100% Offline • 100% Private • 100% Free Forever
 *
 * A single, unfragmented Expo / React Native application implementing:
 *   Tab 1: Focus Timer      - Pomodoro / Zen Break with animated circular ring
 *   Tab 2: Sound Sanctuary  - Locally synthesized offline soundscapes (PCM WAV)
 *   Tab 3: Priority Vault   - "Rule of 3" daily micro-tasks + streak tracker
 *   Tab 4: Deep Work Stats  - Focus minutes, streak badges, privacy policy
 *
 * Monetization: Google AdMob only (Banner / Interstitial / Rewarded),
 * every call wrapped in try/catch with error listeners so a failed or
 * unfilled ad NEVER crashes the app. There are NO in-app purchases and
 * NO paywalls anywhere in this codebase.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  Timer,
  Waves,
  ListChecks,
  BarChart3,
  Play,
  Pause,
  RotateCcw,
  Flame,
  CheckCircle2,
  Circle as CircleIcon,
  Trash2,
  Plus,
  X,
  ShieldCheck,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Award,
  TrendingUp,
  Clock,
  Moon,
  Sun,
  Wind,
  Brain,
  Sparkles,
  CloudRain,
  Radio,
  Globe,
} from 'lucide-react-native';

// =============================================================================
// SECTION 1: CONSTANTS, THEME & AD UNIT CONFIGURATION
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  background: '#0B0E14',
  backgroundElevated: '#141824',
  surface: '#1B2030',
  surfaceLight: '#232940',
  border: '#2A3145',
  primary: '#6C63FF',
  primaryLight: '#8B84FF',
  accent: '#00E5C7',
  accentSoft: 'rgba(0, 229, 199, 0.15)',
  danger: '#FF5C7C',
  warning: '#FFB648',
  success: '#4ADE80',
  textPrimary: '#F4F6FB',
  textSecondary: '#9AA3B8',
  textMuted: '#5C6478',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(6, 8, 14, 0.85)',
};

const GRADIENT_RING = {
  focus: COLORS.primary,
  break: COLORS.accent,
};

// AdMob unit identifiers. In a bare / production build these come from
// app.json's react-native-google-mobile-ads plugin config, referenced here
// so the JS side always matches the native manifest values exactly.
const ADMOB_CONFIG = {
  appId: 'ca-app-pub-5206710479803910~6573330902',
  bannerId: 'ca-app-pub-5206710479803910/8395705158',
  interstitialId: 'ca-app-pub-5206710479803910/4451309452',
  rewardedId: 'ca-app-pub-5206710479803910/1321004221',
};

const BRAND = {
  studio: 'ZeeU Creative Studio',
  appTitle: 'FocusFlow OS',
  packageName: 'com.zeeucreativestudio.focusflowos',
  portal: 'https://zeeu-creative-studio-e-book-vault.ai.studio',
  copyright: '© 2026 ZeeU Creative Studio. All Rights Reserved.',
  watermark: 'POWERED BY ZEEU CREATIVE STUDIO • 100% OFFLINE SANCTUARY',
};

const STORAGE_KEYS = {
  TASKS: '@focusflow/tasks_v1',
  TASK_HISTORY: '@focusflow/task_history_v1',
  STREAK: '@focusflow/streak_v1',
  STATS: '@focusflow/stats_v1',
  SETTINGS: '@focusflow/settings_v1',
  UNLOCKED_GAMMA: '@focusflow/unlocked_gamma_v1',
};

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

// =============================================================================
// SECTION 2: PROCEDURAL PCM / WAV AUDIO SYNTHESIS ENGINE
// -----------------------------------------------------------------------------
// Every soundscape in FocusFlow OS is generated on-device as a real 16-bit
// PCM WAV file. Nothing is bundled, nothing is downloaded. This keeps the
// app 100% offline and dependency-free for audio assets.
// =============================================================================

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 2; // stereo, required for binaural beats

/**
 * Builds a standard 44-byte canonical WAV header for PCM audio.
 */
function buildWavHeader(dataLength: number): number[] {
  const header: number[] = [];
  const byteRate = (SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (NUM_CHANNELS * BITS_PER_SAMPLE) / 8;

  const writeString = (arr: number[], s: string) => {
    for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i));
  };
  const writeUint32 = (arr: number[], v: number) => {
    arr.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  };
  const writeUint16 = (arr: number[], v: number) => {
    arr.push(v & 0xff, (v >> 8) & 0xff);
  };

  writeString(header, 'RIFF');
  writeUint32(header, 36 + dataLength);
  writeString(header, 'WAVE');
  writeString(header, 'fmt ');
  writeUint32(header, 16); // Subchunk1Size for PCM
  writeUint16(header, 1); // AudioFormat = PCM
  writeUint16(header, NUM_CHANNELS);
  writeUint32(header, SAMPLE_RATE);
  writeUint32(header, byteRate);
  writeUint16(header, blockAlign);
  writeUint16(header, BITS_PER_SAMPLE);
  writeString(header, 'data');
  writeUint32(header, dataLength);

  return header;
}

/**
 * Encodes an array of raw byte values into a base64 string without relying
 * on Buffer (unavailable in the RN JS runtime by default).
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += CHARS[(chunk >> 18) & 63];
    result += CHARS[(chunk >> 12) & 63];
    result += CHARS[(chunk >> 6) & 63];
    result += CHARS[chunk & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    result += CHARS[(chunk >> 18) & 63];
    result += CHARS[(chunk >> 12) & 63];
    result += '==';
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result += CHARS[(chunk >> 18) & 63];
    result += CHARS[(chunk >> 12) & 63];
    result += CHARS[(chunk >> 6) & 63];
    result += '=';
  }
  return result;
}

type ToneGenerator = (tSeconds: number, sampleIndex: number) => [number, number];

/**
 * Renders `durationSeconds` of stereo audio using the given per-sample
 * generator function, returning interleaved 16-bit PCM bytes.
 */
function renderPcmBuffer(
  durationSeconds: number,
  generator: ToneGenerator
): Uint8Array {
  const totalFrames = Math.floor(SAMPLE_RATE * durationSeconds);
  const dataLength = totalFrames * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const buffer = new Uint8Array(dataLength);
  let offset = 0;

  for (let n = 0; n < totalFrames; n++) {
    const t = n / SAMPLE_RATE;
    const [left, right] = generator(t, n);

    const l16 = Math.max(-32768, Math.min(32767, Math.round(left * 32767)));
    const r16 = Math.max(-32768, Math.min(32767, Math.round(right * 32767)));

    buffer[offset++] = l16 & 0xff;
    buffer[offset++] = (l16 >> 8) & 0xff;
    buffer[offset++] = r16 & 0xff;
    buffer[offset++] = (r16 >> 8) & 0xff;
  }

  return buffer;
}

/** Simple deterministic pseudo-random generator (mulberry32) so noise is reproducible. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Brown (red) noise via leaky integration of white noise, normalized into
 * [-1, 1]. A gentle low-pass character makes this ideal as a "deep, warm"
 * ambient masking sound.
 */
function makeBrownNoiseGenerator(): ToneGenerator {
  const rand = mulberry32(20240601);
  let lastLeft = 0;
  let lastRight = 0;
  const leak = 0.985;
  const gain = 3.5;
  return (_t, _n) => {
    const whiteL = rand() * 2 - 1;
    const whiteR = rand() * 2 - 1;
    lastLeft = (lastLeft + 0.02 * whiteL) * leak;
    lastRight = (lastRight + 0.02 * whiteR) * leak;
    return [
      Math.max(-1, Math.min(1, lastLeft * gain)),
      Math.max(-1, Math.min(1, lastRight * gain)),
    ];
  };
}

/** Pure white noise, flat spectrum — used for the "White Focus" soundscape. */
function makeWhiteNoiseGenerator(): ToneGenerator {
  const rand = mulberry32(19870714);
  const gain = 0.35;
  return (_t, _n) => {
    return [(rand() * 2 - 1) * gain, (rand() * 2 - 1) * gain];
  };
}

/**
 * Binaural-style tone: identical carrier tone in both ears but amplitude
 * modulated at `beatHz` to create a perceived "pulsing" entrainment tone.
 * This is the technique used for the Alpha (10Hz) soundscape.
 */
function makeAmplitudeModulatedToneGenerator(
  carrierHz: number,
  beatHz: number
): ToneGenerator {
  const gain = 0.22;
  return (t, _n) => {
    const carrier = Math.sin(2 * Math.PI * carrierHz * t);
    const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * beatHz * t);
    const sample = carrier * envelope * gain;
    return [sample, sample];
  };
}

/**
 * True binaural beat: a slightly different carrier frequency is played in
 * each ear so the brain perceives the *difference* between them as a beat
 * frequency (here targeting 40Hz "Gamma" focus entrainment). Requires
 * stereo headphones to perceive correctly, which is noted in the UI.
 */
function makeBinauralBeatGenerator(
  baseHz: number,
  beatHz: number
): ToneGenerator {
  const gain = 0.2;
  const leftHz = baseHz;
  const rightHz = baseHz + beatHz;
  return (t, _n) => {
    const left = Math.sin(2 * Math.PI * leftHz * t) * gain;
    const right = Math.sin(2 * Math.PI * rightHz * t) * gain;
    return [left, right];
  };
}

/**
 * Calming rain: low-passed noise bed (steady patter) plus randomly timed,
 * exponentially decaying droplet ticks for a natural texture.
 */
function makeRainGenerator(): ToneGenerator {
  const rand = mulberry32(31415926);
  let bedL = 0;
  let bedR = 0;
  let dropL = 0;
  let dropR = 0;
  return (_t, _n) => {
    const wL = rand() * 2 - 1;
    const wR = rand() * 2 - 1;
    bedL += 0.18 * (wL - bedL);
    bedR += 0.18 * (wR - bedR);
    if (rand() < 0.0009) dropL = 0.5 + rand() * 0.4;
    if (rand() < 0.0009) dropR = 0.5 + rand() * 0.4;
    dropL *= 0.9965;
    dropR *= 0.9965;
    const hissL = (wL - bedL) * 0.16;
    const hissR = (wR - bedR) * 0.16;
    return [
      bedL * 0.42 + hissL + dropL * (rand() * 2 - 1) * 0.25,
      bedR * 0.42 + hissR + dropR * (rand() * 2 - 1) * 0.25,
    ];
  };
}

/**
 * Midnight drone: stacked low sines with slow, loop-aligned swells
 * (all frequencies are whole cycles over the 30s clip, so it loops cleanly).
 */
function makeMidnightDroneGenerator(): ToneGenerator {
  const gain = 0.13;
  return (t, _n) => {
    const swell = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.1 * t);
    const swell2 = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.2 * t + 1.3);
    const base = Math.sin(2 * Math.PI * 55 * t) * swell;
    const fifth = Math.sin(2 * Math.PI * 82.5 * t) * 0.6 * swell2;
    const octave = Math.sin(2 * Math.PI * 110 * t) * 0.45 * swell;
    const shimmerL = Math.sin(2 * Math.PI * 165.1 * t) * 0.12 * swell2;
    const shimmerR = Math.sin(2 * Math.PI * 164.9 * t) * 0.12 * swell2;
    const core = base + fifth + octave;
    return [(core + shimmerL) * gain, (core + shimmerR) * gain];
  };
}

interface SoundscapeDefinition {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: any;
  color: string;
  locked: boolean;
  buildGenerator: () => ToneGenerator;
}

const SOUNDSCAPES: SoundscapeDefinition[] = [
  {
    id: 'alpha_10hz',
    name: 'Alpha Calm',
    subtitle: 'Synthesized 10Hz Alpha Wave',
    description:
      'A gentle 10Hz amplitude-modulated tone associated with relaxed alertness — ideal for reading and light creative work.',
    icon: Sun,
    color: COLORS.warning,
    locked: false,
    buildGenerator: () => makeAmplitudeModulatedToneGenerator(180, 10),
  },
  {
    id: 'brown_noise',
    name: 'Deep Brown Noise',
    subtitle: 'Procedural Brown Noise',
    description:
      'Deep, warm, rumbling noise generated with a leaky integrator. Masks distracting background sound for deep work.',
    icon: Wind,
    color: '#B08968',
    locked: false,
    buildGenerator: () => makeBrownNoiseGenerator(),
  },
  {
    id: 'white_focus',
    name: 'White Focus',
    subtitle: 'Procedural White Noise',
    description:
      'A flat, static-like wash of sound covering the full audible spectrum evenly — great for blocking chatter and noise.',
    icon: Moon,
    color: COLORS.textSecondary,
    locked: false,
    buildGenerator: () => makeWhiteNoiseGenerator(),
  },
  {
    id: 'calming_rain',
    name: 'Calming Rain',
    subtitle: 'Procedural Rainfall',
    description:
      'A soft, steady rain texture with gentle droplets — synthesized on-device to drown out office and household noise.',
    icon: CloudRain,
    color: '#5EA8FF',
    locked: false,
    buildGenerator: () => makeRainGenerator(),
  },
  {
    id: 'midnight_drone',
    name: 'Midnight Drone',
    subtitle: 'Ambient Low Drone',
    description:
      'A slow, swelling low-frequency ambient drone for late-night writing, coding and study sessions.',
    icon: Radio,
    color: '#B58CFF',
    locked: false,
    buildGenerator: () => makeMidnightDroneGenerator(),
  },
  {
    id: 'binaural_gamma_40hz',
    name: 'Binaural Gamma 40Hz',
    subtitle: 'Exclusive Binaural Beat',
    description:
      'A true binaural beat pairing two close carrier tones to produce a perceived 40Hz Gamma pulse, linked to heightened focus. Headphones required. Unlock free with a quick rewarded video.',
    icon: Brain,
    color: COLORS.accent,
    locked: true,
    buildGenerator: () => makeBinauralBeatGenerator(220, 40),
  },
];

const SOUNDSCAPE_CLIP_SECONDS = 30; // rendered once, then looped seamlessly

/**
 * Renders (or reuses a cached) WAV file for a soundscape and returns its
 * local file:// URI. Files are cached in FileSystem's document directory
 * so repeated plays don't re-synthesize audio.
 */
async function getOrCreateSoundscapeFile(
  def: SoundscapeDefinition
): Promise<string> {
  const dir = `${FileSystem.documentDirectory}focusflow_audio/`;
  const path = `${dir}${def.id}.wav`;

  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const fileInfo = await FileSystem.getInfoAsync(path);
  if (fileInfo.exists) {
    return path;
  }

  const generator = def.buildGenerator();
  const pcmBytes = renderPcmBuffer(SOUNDSCAPE_CLIP_SECONDS, generator);
  const header = buildWavHeader(pcmBytes.length);

  const fullBuffer = new Uint8Array(header.length + pcmBytes.length);
  fullBuffer.set(header, 0);
  fullBuffer.set(pcmBytes, header.length);

  const base64Data = bytesToBase64(fullBuffer);

  await FileSystem.writeAsStringAsync(path, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return path;
}

/**
 * Synthesizes a short bell/chime tone (exponentially decaying sine) used
 * for the Pomodoro completion sound and the timer tick.
 */
async function getOrCreateUiToneFile(
  id: 'bell' | 'tick',
  freqHz: number,
  durationSeconds: number
): Promise<string> {
  const dir = `${FileSystem.documentDirectory}focusflow_audio/`;
  const path = `${dir}ui_${id}.wav`;

  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const fileInfo = await FileSystem.getInfoAsync(path);
  if (fileInfo.exists) {
    return path;
  }

  const decay = id === 'bell' ? 3.2 : 18;
  const generator: ToneGenerator = (t) => {
    const envelope = Math.exp(-decay * t);
    const sample = Math.sin(2 * Math.PI * freqHz * t) * envelope * 0.6;
    return [sample, sample];
  };

  const pcmBytes = renderPcmBuffer(durationSeconds, generator);
  const header = buildWavHeader(pcmBytes.length);
  const fullBuffer = new Uint8Array(header.length + pcmBytes.length);
  fullBuffer.set(header, 0);
  fullBuffer.set(pcmBytes, header.length);
  const base64Data = bytesToBase64(fullBuffer);

  await FileSystem.writeAsStringAsync(path, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return path;
}

// =============================================================================
// SECTION 3: SAFE ADMOB WRAPPER
// -----------------------------------------------------------------------------
// AdMob is the EXCLUSIVE monetization path. Every native call is guarded so
// that a missing module, a failed fill, or a network error never crashes
// the app or blocks any feature. There is NO IAP anywhere in this file.
// =============================================================================

// The google-mobile-ads native module only exists in a real dev/prod build
// (it is a native SDK, not available inside Expo Go). We require() it
// defensively so the app still runs everywhere, degrading ads to silent
// no-ops if the module can't be loaded.
let MobileAds: any = null;
let BannerAd: any = null;
let BannerAdSize: any = null;
let InterstitialAd: any = null;
let RewardedAd: any = null;
let AdEventType: any = null;
let RewardedAdEventType: any = null;
let TestIds: any = null;
let AdsConsent: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const googleMobileAds = require('react-native-google-mobile-ads');
  MobileAds = googleMobileAds.default;
  BannerAd = googleMobileAds.BannerAd;
  BannerAdSize = googleMobileAds.BannerAdSize;
  InterstitialAd = googleMobileAds.InterstitialAd;
  RewardedAd = googleMobileAds.RewardedAd;
  AdEventType = googleMobileAds.AdEventType;
  RewardedAdEventType = googleMobileAds.RewardedAdEventType;
  TestIds = googleMobileAds.TestIds;
  AdsConsent = googleMobileAds.AdsConsent;
} catch (err) {
  console.warn(
    '[FocusFlow][AdMob] Native module unavailable in this runtime — ads disabled safely.',
    err
  );
}

let mobileAdsInitialized = false;

/** Initializes the Google Mobile Ads SDK exactly once, never throwing. */
async function safeInitializeAds(): Promise<void> {
  if (mobileAdsInitialized || !MobileAds) return;
  try {
    // Conservative, family-friendly ad configuration (matches the in-app
    // privacy disclosures): G-rated, non-personalized, child-directed tagging.
    try {
      await MobileAds().setRequestConfiguration({
        maxAdContentRating: 'G',
        tagForChildDirectedTreatment: true,
        tagForUnderAgeOfConsent: true,
      });
    } catch (err) {
      console.warn('[FocusFlow][AdMob] setRequestConfiguration failed safely:', err);
    }
    try {
      if (AdsConsent && typeof AdsConsent.gatherConsent === 'function') {
        await AdsConsent.gatherConsent();
      }
    } catch (err) {
      console.warn('[FocusFlow][AdMob] Consent gathering failed safely:', err);
    }
    await MobileAds().initialize();
    mobileAdsInitialized = true;
  } catch (err) {
    console.warn('[FocusFlow][AdMob] initialize() failed safely:', err);
  }
}

/**
 * Hook that preloads and exposes an Interstitial ad, shown after a full
 * Pomodoro focus session completes. All native interaction wrapped safely.
 */
function useSafeInterstitialAd() {
  const adRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!InterstitialAd) return;
    try {
      const unitId = __DEV__ && TestIds ? TestIds.INTERSTITIAL : ADMOB_CONFIG.interstitialId;
      const ad = InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        setLoaded(true);
      });
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (e: any) => {
        console.warn('[FocusFlow][AdMob] Interstitial error (safe):', e);
        setLoaded(false);
      });
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        setLoaded(false);
        try {
          ad.load();
        } catch (e) {
          console.warn('[FocusFlow][AdMob] Interstitial reload failed safely:', e);
        }
      });

      adRef.current = { ad, unsubLoaded, unsubError, unsubClosed };
      ad.load();
    } catch (err) {
      console.warn('[FocusFlow][AdMob] Interstitial setup failed safely:', err);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      try {
        adRef.current?.unsubLoaded?.();
        adRef.current?.unsubError?.();
        adRef.current?.unsubClosed?.();
      } catch (err) {
        // Swallow — teardown must never throw.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = useCallback(() => {
    try {
      if (loaded && adRef.current?.ad) {
        adRef.current.ad.show();
      }
    } catch (err) {
      console.warn('[FocusFlow][AdMob] Interstitial show() failed safely:', err);
    }
  }, [loaded]);

  return { show, loaded };
}

/**
 * Hook that preloads and exposes a Rewarded ad used ONLY to unlock the
 * bonus "Binaural Gamma 40Hz" soundscape — never gates any core feature,
 * never charges money. Declining the ad simply leaves that one bonus
 * soundscape locked; everything else in the app remains fully free.
 */
function useSafeRewardedAd(onReward: () => void) {
  const adRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!RewardedAd) return;
    try {
      const unitId = __DEV__ && TestIds ? TestIds.REWARDED : ADMOB_CONFIG.rewardedId;
      const ad = RewardedAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setLoaded(true);
      });
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (e: any) => {
        console.warn('[FocusFlow][AdMob] Rewarded error (safe):', e);
        setLoaded(false);
      });
      const unsubEarned = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          try {
            onReward();
          } catch (err) {
            console.warn('[FocusFlow][AdMob] onReward callback failed safely:', err);
          }
        }
      );
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        setLoaded(false);
        try {
          ad.load();
        } catch (e) {
          console.warn('[FocusFlow][AdMob] Rewarded reload failed safely:', e);
        }
      });

      adRef.current = { ad, unsubLoaded, unsubError, unsubEarned, unsubClosed };
      ad.load();
    } catch (err) {
      console.warn('[FocusFlow][AdMob] Rewarded setup failed safely:', err);
    }
  }, [onReward]);

  useEffect(() => {
    load();
    return () => {
      try {
        adRef.current?.unsubLoaded?.();
        adRef.current?.unsubError?.();
        adRef.current?.unsubEarned?.();
        adRef.current?.unsubClosed?.();
      } catch (err) {
        // Swallow — teardown must never throw.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = useCallback(() => {
    try {
      if (loaded && adRef.current?.ad) {
        adRef.current.ad.show();
      } else {
        Alert.alert(
          'Almost there',
          'The bonus video is still warming up. Please try again in a moment — no cost, no purchase required.'
        );
      }
    } catch (err) {
      console.warn('[FocusFlow][AdMob] Rewarded show() failed safely:', err);
    }
  }, [loaded]);

  return { show, loaded };
}

/**
 * Safe banner ad component. Renders nothing (rather than crashing) if the
 * native module is unavailable or the ad fails to load.
 */
const SafeBannerAd: React.FC = () => {
  const [failed, setFailed] = useState(false);

  if (!BannerAd || failed) {
    return null;
  }

  const unitId = __DEV__ && TestIds ? TestIds.BANNER : ADMOB_CONFIG.bannerId;

  try {
    return (
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={unitId}
          size={BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? 'BANNER'}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(err: any) => {
            console.warn('[FocusFlow][AdMob] Banner failed to load (safe):', err);
            setFailed(true);
          }}
        />
      </View>
    );
  } catch (err) {
    console.warn('[FocusFlow][AdMob] Banner render failed safely:', err);
    return null;
  }
};

// =============================================================================
// SECTION 4: APP-WIDE DATA TYPES
// =============================================================================

interface DailyTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string; // ISO date (YYYY-MM-DD)
}

interface TaskHistoryEntry {
  date: string; // YYYY-MM-DD
  completedCount: number;
  totalCount: number;
}

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
}

interface DailyFocusStat {
  date: string; // YYYY-MM-DD
  minutes: number;
  sessionsCompleted: number;
}

interface StatsData {
  daily: DailyFocusStat[]; // rolling log, most recent last
  totalMinutesAllTime: number;
  totalSessionsAllTime: number;
}

type TabId = 'timer' | 'sounds' | 'vault' | 'stats';

// =============================================================================
// SECTION 5: UTILITY HELPERS
// =============================================================================

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return dateStr === `${y}-${m}-${day}`;
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return `${hrs}h ${mins}m`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

async function safeGetJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[FocusFlow][Storage] Failed to read ${key} safely:`, err);
    return fallback;
  }
}

async function safeSetJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[FocusFlow][Storage] Failed to write ${key} safely:`, err);
  }
}

// =============================================================================
// SECTION 6: APP CONTEXT (shared persisted state across tabs)
// =============================================================================

interface AppContextValue {
  tasks: DailyTask[];
  setTasks: React.Dispatch<React.SetStateAction<DailyTask[]>>;
  taskHistory: TaskHistoryEntry[];
  streak: StreakData;
  setStreak: React.Dispatch<React.SetStateAction<StreakData>>;
  stats: StatsData;
  recordFocusSession: (minutes: number) => void;
  gammaUnlocked: boolean;
  unlockGamma: () => void;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return ctx;
}

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntry[]>([]);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
  });
  const [stats, setStats] = useState<StatsData>({
    daily: [],
    totalMinutesAllTime: 0,
    totalSessionsAllTime: 0,
  });
  const [gammaUnlocked, setGammaUnlocked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load all persisted state on mount.
  useEffect(() => {
    (async () => {
      try {
        const today = todayISO();

        const storedTasksRaw = await safeGetJSON<DailyTask[]>(STORAGE_KEYS.TASKS, []);
        // Reset the Rule-of-3 list if it belongs to a previous day.
        const tasksForToday = storedTasksRaw.filter((t) => t.createdAt === today);
        setTasks(tasksForToday);

        const history = await safeGetJSON<TaskHistoryEntry[]>(
          STORAGE_KEYS.TASK_HISTORY,
          []
        );
        setTaskHistory(history);

        const storedStreak = await safeGetJSON<StreakData>(STORAGE_KEYS.STREAK, {
          currentStreak: 0,
          bestStreak: 0,
          lastCompletedDate: null,
        });
        const streakStale =
          storedStreak.lastCompletedDate !== null &&
          storedStreak.lastCompletedDate !== today &&
          !isYesterday(storedStreak.lastCompletedDate);
        setStreak(streakStale ? { ...storedStreak, currentStreak: 0 } : storedStreak);

        const storedStats = await safeGetJSON<StatsData>(STORAGE_KEYS.STATS, {
          daily: [],
          totalMinutesAllTime: 0,
          totalSessionsAllTime: 0,
        });
        setStats(storedStats);

        const storedGamma = await safeGetJSON<boolean>(
          STORAGE_KEYS.UNLOCKED_GAMMA,
          false
        );
        setGammaUnlocked(storedGamma);

        const settings = await safeGetJSON<{ soundEnabled: boolean }>(
          STORAGE_KEYS.SETTINGS,
          { soundEnabled: true }
        );
        setSoundEnabled(settings.soundEnabled);
      } catch (err) {
        console.warn('[FocusFlow] Failed to load persisted state safely:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Persist tasks whenever they change.
  useEffect(() => {
    if (isLoading) return;
    safeSetJSON(STORAGE_KEYS.TASKS, tasks);
  }, [tasks, isLoading]);

  // Keep today's entry in the completed-task history in sync with the list.
  useEffect(() => {
    if (isLoading || tasks.length === 0) return;
    const today = todayISO();
    const completed = tasks.filter((t) => t.completed).length;
    setTaskHistory((prev) => {
      const others = prev.filter((e) => e.date !== today);
      return [...others, { date: today, completedCount: completed, totalCount: tasks.length }].slice(-60);
    });
  }, [tasks, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    safeSetJSON(STORAGE_KEYS.TASK_HISTORY, taskHistory);
  }, [taskHistory, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    safeSetJSON(STORAGE_KEYS.STREAK, streak);
  }, [streak, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    safeSetJSON(STORAGE_KEYS.STATS, stats);
  }, [stats, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    safeSetJSON(STORAGE_KEYS.SETTINGS, { soundEnabled });
  }, [soundEnabled, isLoading]);

  const recordFocusSession = useCallback((minutes: number) => {
    const today = todayISO();
    setStats((prev) => {
      const dailyCopy = [...prev.daily];
      const idx = dailyCopy.findIndex((d) => d.date === today);
      if (idx >= 0) {
        dailyCopy[idx] = {
          ...dailyCopy[idx],
          minutes: dailyCopy[idx].minutes + minutes,
          sessionsCompleted: dailyCopy[idx].sessionsCompleted + 1,
        };
      } else {
        dailyCopy.push({ date: today, minutes, sessionsCompleted: 1 });
      }
      // Keep a rolling 60-day window so storage never grows unbounded.
      const trimmed = dailyCopy.slice(-60);
      return {
        daily: trimmed,
        totalMinutesAllTime: prev.totalMinutesAllTime + minutes,
        totalSessionsAllTime: prev.totalSessionsAllTime + 1,
      };
    });
  }, []);

  const unlockGamma = useCallback(() => {
    setGammaUnlocked(true);
    safeSetJSON(STORAGE_KEYS.UNLOCKED_GAMMA, true);
  }, []);

  const value: AppContextValue = {
    tasks,
    setTasks,
    taskHistory,
    streak,
    setStreak,
    stats,
    recordFocusSession,
    gammaUnlocked,
    unlockGamma,
    soundEnabled,
    setSoundEnabled,
    isLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// =============================================================================
// SECTION 7: CIRCULAR PROGRESS RING (glowing, animated)
// =============================================================================

const RING_SIZE = Math.min(SCREEN_WIDTH * 0.68, 300);
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressRingProps {
  progress: Animated.Value; // 0..1
  color: string;
  children: React.ReactNode;
}

const CircularProgressRing: React.FC<CircularProgressRingProps> = ({
  progress,
  color,
  children,
}) => {
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  const glowOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.9,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.4,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowOpacity]);

  return (
    <View style={styles.ringWrapper}>
      <Animated.View
        style={[
          styles.ringGlow,
          {
            shadowColor: color,
            opacity: glowOpacity,
            width: RING_SIZE + 30,
            height: RING_SIZE + 30,
            borderRadius: (RING_SIZE + 30) / 2,
          },
        ]}
      />
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={COLORS.surfaceLight}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={color}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE}, ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
};

// =============================================================================
// SECTION 8: TAB 1 — FOCUS TIMER
// =============================================================================

type SessionMode = 'focus' | 'break';

const FOCUS_PRESETS = [
  { label: '25m', focus: 25, brk: 5 },
  { label: '50m', focus: 50, brk: 10 },
  { label: '90m', focus: 90, brk: 15 },
];

const FocusTimerTab: React.FC<{
  interstitial: { show: () => void; loaded: boolean };
  onRunningChange: (running: boolean) => void;
}> = ({ interstitial, onRunningChange }) => {
  const { recordFocusSession, soundEnabled } = useAppContext();

  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [mode, setMode] = useState<SessionMode>('focus');
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [customFocusInput, setCustomFocusInput] = useState(String(DEFAULT_FOCUS_MINUTES));
  const [customBreakInput, setCustomBreakInput] = useState(String(DEFAULT_BREAK_MINUTES));

  const progress = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bellSoundRef = useRef<Audio.Sound | null>(null);
  const tickSoundRef = useRef<Audio.Sound | null>(null);
  const lastTickSecondRef = useRef<number>(-1);

  // Let the shell know when a session is live so the banner can hide.
  useEffect(() => {
    onRunningChange(isRunning);
  }, [isRunning, onRunningChange]);

  const totalSecondsForMode = useMemo(
    () => (mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60),
    [mode, focusMinutes, breakMinutes]
  );

  // Preload UI tones once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const bellPath = await getOrCreateUiToneFile('bell', 523.25, 1.6);
        const tickPath = await getOrCreateUiToneFile('tick', 1046.5, 0.08);
        if (cancelled) return;
        const { sound: bell } = await Audio.Sound.createAsync({ uri: bellPath });
        const { sound: tick } = await Audio.Sound.createAsync({ uri: tickPath });
        if (cancelled) {
          bell.unloadAsync().catch(() => {});
          tick.unloadAsync().catch(() => {});
          return;
        }
        bellSoundRef.current = bell;
        tickSoundRef.current = tick;
      } catch (err) {
        console.warn('[FocusFlow][Audio] Failed to preload UI tones safely:', err);
      }
    })();
    return () => {
      cancelled = true;
      bellSoundRef.current?.unloadAsync().catch(() => {});
      tickSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playBell = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      await bellSoundRef.current?.replayAsync();
    } catch (err) {
      console.warn('[FocusFlow][Audio] Bell playback failed safely:', err);
    }
  }, [soundEnabled]);

  const playTick = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      await tickSoundRef.current?.replayAsync();
    } catch (err) {
      console.warn('[FocusFlow][Audio] Tick playback failed safely:', err);
    }
  }, [soundEnabled]);

  // Keep the ring progress animated smoothly toward the current fraction.
  useEffect(() => {
    const fraction = 1 - secondsLeft / totalSecondsForMode;
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(1, fraction)),
      duration: 280,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [secondsLeft, totalSecondsForMode, progress]);

  const handleSessionComplete = useCallback(() => {
    setIsRunning(false);
    playBell();

    if (mode === 'focus') {
      recordFocusSession(focusMinutes);
      // Interstitial shown ONLY after a full Pomodoro focus session, per spec.
      try {
        interstitial.show();
      } catch (err) {
        console.warn('[FocusFlow][AdMob] Post-session interstitial failed safely:', err);
      }
      setMode('break');
      setSecondsLeft(breakMinutes * 60);
    } else {
      setMode('focus');
      setSecondsLeft(focusMinutes * 60);
    }
  }, [mode, focusMinutes, breakMinutes, recordFocusSession, interstitial, playBell]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        const next = prev - 1;
        if (next <= 5 && next !== lastTickSecondRef.current) {
          lastTickSecondRef.current = next;
          playTick();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, playTick]);

  // Completion is handled outside the state updater so side effects run once.
  useEffect(() => {
    if (isRunning && secondsLeft === 0) {
      handleSessionComplete();
    }
  }, [isRunning, secondsLeft, handleSessionComplete]);

  const applyPreset = (f: number, b: number) => {
    setFocusMinutes(f);
    setBreakMinutes(b);
    setCustomFocusInput(String(f));
    setCustomBreakInput(String(b));
    setIsRunning(false);
    setSecondsLeft((mode === 'focus' ? f : b) * 60);
  };

  const toggleRunning = () => setIsRunning((r) => !r);

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(totalSecondsForMode);
  };

  const switchMode = (nextMode: SessionMode) => {
    setIsRunning(false);
    setMode(nextMode);
    setSecondsLeft(nextMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
  };

  const applyCustomIntervals = () => {
    const f = Math.max(1, Math.min(180, parseInt(customFocusInput, 10) || DEFAULT_FOCUS_MINUTES));
    const b = Math.max(1, Math.min(60, parseInt(customBreakInput, 10) || DEFAULT_BREAK_MINUTES));
    setFocusMinutes(f);
    setBreakMinutes(b);
    setIsRunning(false);
    if (mode === 'focus') {
      setSecondsLeft(f * 60);
    } else {
      setSecondsLeft(b * 60);
    }
    setCustomizeVisible(false);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const ringColor = mode === 'focus' ? GRADIENT_RING.focus : GRADIENT_RING.break;

  return (
    <View style={styles.tabContainer}>
      <ScrollView
        contentContainerStyle={styles.timerScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.timerHeader}>
          <Text style={styles.screenTitle}>Focus Timer</Text>
          <Text style={styles.screenSubtitle}>
            {mode === 'focus' ? 'Deep work session' : 'Zen recovery break'}
          </Text>
        </View>

        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[
              styles.modeSwitchButton,
              mode === 'focus' && styles.modeSwitchButtonActive,
            ]}
            onPress={() => switchMode('focus')}
            activeOpacity={0.8}
          >
            <Timer
              size={16}
              color={mode === 'focus' ? COLORS.background : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeSwitchText,
                mode === 'focus' && styles.modeSwitchTextActive,
              ]}
            >
              Pomodoro
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeSwitchButton,
              mode === 'break' && styles.modeSwitchButtonActiveBreak,
            ]}
            onPress={() => switchMode('break')}
            activeOpacity={0.8}
          >
            <Sparkles
              size={16}
              color={mode === 'break' ? COLORS.background : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeSwitchText,
                mode === 'break' && styles.modeSwitchTextActive,
              ]}
            >
              Zen Break
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.presetRow}>
          {FOCUS_PRESETS.map((p) => {
            const active = focusMinutes === p.focus && breakMinutes === p.brk;
            return (
              <TouchableOpacity
                key={p.label}
                style={[styles.presetChip, active && styles.presetChipActive]}
                onPress={() => applyPreset(p.focus, p.brk)}
                activeOpacity={0.8}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <CircularProgressRing progress={progress} color={ringColor}>
          <Text style={styles.timerText}>
            {pad2(mins)}:{pad2(secs)}
          </Text>
          <Text style={styles.timerModeLabel}>
            {mode === 'focus' ? `${focusMinutes} min focus` : `${breakMinutes} min break`}
          </Text>
        </CircularProgressRing>

        <View style={styles.timerControlsRow}>
          <TouchableOpacity
            style={styles.secondaryControlButton}
            onPress={resetTimer}
            activeOpacity={0.8}
          >
            <RotateCcw size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: ringColor }]}
            onPress={toggleRunning}
            activeOpacity={0.85}
          >
            {isRunning ? (
              <Pause size={30} color={COLORS.background} fill={COLORS.background} />
            ) : (
              <Play size={30} color={COLORS.background} fill={COLORS.background} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryControlButton}
            onPress={() => setCustomizeVisible(true)}
            activeOpacity={0.8}
          >
            <Clock size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.presetHintCard}>
          <ShieldCheck size={16} color={COLORS.accent} />
          <Text style={styles.presetHintText}>
            Banner ads are hidden automatically while your session is running, so nothing
            interrupts your focus.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={customizeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomizeVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Customize Intervals</Text>
              <TouchableOpacity onPress={() => setCustomizeVisible(false)}>
                <X size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Focus minutes (1–180)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="number-pad"
              value={customFocusInput}
              onChangeText={setCustomFocusInput}
              placeholder="25"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.inputLabel}>Break minutes (1–60)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="number-pad"
              value={customBreakInput}
              onChangeText={setCustomBreakInput}
              placeholder="5"
              placeholderTextColor={COLORS.textMuted}
            />

            <TouchableOpacity style={styles.primaryModalButton} onPress={applyCustomIntervals}>
              <Text style={styles.primaryModalButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// =============================================================================
// SECTION 9: TAB 2 — SOUND SANCTUARY
// =============================================================================

const SoundSanctuaryTab: React.FC<{
  rewarded: { show: () => void; loaded: boolean };
}> = ({ rewarded }) => {
  const { gammaUnlocked, unlockGamma } = useAppContext();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stopCurrent = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (err) {
      console.warn('[FocusFlow][Audio] Stop failed safely:', err);
    }
    setPlayingId(null);
  }, []);

  const playSoundscape = useCallback(
    async (def: SoundscapeDefinition) => {
      if (def.locked && !gammaUnlocked) {
        Alert.alert(
          'Unlock Binaural Gamma 40Hz',
          'Watch a short rewarded video to unlock this bonus frequency for free — forever. No purchase, no subscription.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Watch & Unlock',
              onPress: () => {
                try {
                  rewarded.show();
                } catch (err) {
                  console.warn('[FocusFlow][AdMob] Rewarded show failed safely:', err);
                }
              },
            },
          ]
        );
        return;
      }

      if (playingId === def.id) {
        await stopCurrent();
        return;
      }

      try {
        setLoadingId(def.id);
        await stopCurrent();

        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
        });

        const uri = await getOrCreateSoundscapeFile(def);
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { isLooping: true, volume: 0.9 }
        );
        soundRef.current = sound;
        await sound.playAsync();
        setPlayingId(def.id);
      } catch (err) {
        console.warn('[FocusFlow][Audio] Soundscape playback failed safely:', err);
        Alert.alert(
          'Playback issue',
          'This soundscape could not be played right now. Please try again.'
        );
      } finally {
        setLoadingId(null);
      }
    },
    [gammaUnlocked, playingId, rewarded, stopCurrent]
  );

  return (
    <View style={styles.tabContainer}>
      <ScrollView contentContainerStyle={styles.screenScrollContent}>
        <Text style={styles.screenTitle}>Sound Sanctuary</Text>
        <Text style={styles.screenSubtitle}>
          Offline, procedurally synthesized soundscapes — no downloads, ever.
        </Text>

        {SOUNDSCAPES.map((def) => {
          const Icon = def.icon;
          const isPlaying = playingId === def.id;
          const isLoadingThis = loadingId === def.id;
          const locked = def.locked && !gammaUnlocked;

          return (
            <TouchableOpacity
              key={def.id}
              style={[
                styles.soundCard,
                isPlaying && { borderColor: def.color, borderWidth: 1.5 },
              ]}
              activeOpacity={0.85}
              onPress={() => playSoundscape(def)}
            >
              <View
                style={[
                  styles.soundIconWrap,
                  { backgroundColor: `${def.color}22` },
                ]}
              >
                <Icon size={26} color={def.color} />
              </View>

              <View style={styles.soundCardBody}>
                <View style={styles.soundCardTitleRow}>
                  <Text style={styles.soundCardTitle}>{def.name}</Text>
                  {locked && <Lock size={14} color={COLORS.warning} />}
                  {!locked && def.locked && <Unlock size={14} color={COLORS.success} />}
                </View>
                <Text style={styles.soundCardSubtitle}>{def.subtitle}</Text>
                <Text style={styles.soundCardDescription} numberOfLines={2}>
                  {def.description}
                </Text>
              </View>

              <View style={styles.soundCardAction}>
                {isLoadingThis ? (
                  <ActivityIndicator size="small" color={def.color} />
                ) : isPlaying ? (
                  <View style={[styles.playingIndicator, { backgroundColor: def.color }]}>
                    <Pause size={16} color={COLORS.background} fill={COLORS.background} />
                  </View>
                ) : (
                  <View style={styles.playIndicatorIdle}>
                    <Play size={16} color={COLORS.textSecondary} fill={COLORS.textSecondary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.presetHintCard}>
          <Volume2 size={16} color={COLORS.accent} />
          <Text style={styles.presetHintText}>
            All soundscapes are generated locally as real WAV audio the first time you play
            them, then cached on-device for instant offline playback.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// =============================================================================
// SECTION 10: TAB 3 — PRIORITY VAULT ("Rule of 3")
// =============================================================================

const MAX_DAILY_TASKS = 5;

const PriorityVaultTab: React.FC = () => {
  const { tasks, setTasks, taskHistory, streak, setStreak } = useAppContext();
  const [newTaskText, setNewTaskText] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);

  const today = todayISO();
  const completedCount = tasks.filter((t) => t.completed).length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;

  const addTask = () => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    if (tasks.length >= MAX_DAILY_TASKS) {
      Alert.alert(
        'Daily limit',
        'FocusFlow keeps you to 5 priorities per day, by design — pick what truly matters.'
      );
      return;
    }
    const task: DailyTask = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      completed: false,
      createdAt: today,
    };
    setTasks((prev) => [...prev, task]);
    setNewTaskText('');
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));

      const nowAllComplete =
        updated.length > 0 && updated.every((t) => t.completed);
      const wasAllComplete = prev.length > 0 && prev.every((t) => t.completed);

      if (nowAllComplete && !wasAllComplete) {
        // Update the streak the moment all of today's tasks are done.
        setStreak((prevStreak) => {
          if (prevStreak.lastCompletedDate === today) return prevStreak;
          const continuesStreak =
            prevStreak.lastCompletedDate !== null &&
            isYesterday(prevStreak.lastCompletedDate);
          const newCurrent = continuesStreak ? prevStreak.currentStreak + 1 : 1;
          return {
            currentStreak: newCurrent,
            bestStreak: Math.max(prevStreak.bestStreak, newCurrent),
            lastCompletedDate: today,
          };
        });
      }

      return updated;
    });
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <View style={styles.tabContainer}>
      <ScrollView contentContainerStyle={styles.screenScrollContent}>
        <Text style={styles.screenTitle}>Priority Vault</Text>
        <Text style={styles.screenSubtitle}>
          Your top 3 to 5 daily non-negotiables, done with intention.
        </Text>

        <View style={styles.streakCard}>
          <View style={styles.streakIconWrap}>
            <Flame size={28} color={COLORS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakCount}>{streak.currentStreak} day streak</Text>
            <Text style={styles.streakBest}>Best: {streak.bestStreak} days</Text>
          </View>
          <TouchableOpacity onPress={() => setHistoryVisible(true)}>
            <Text style={styles.historyLink}>History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.taskProgressRow}>
          {Array.from({ length: MAX_DAILY_TASKS }, (_, i) => i).map((i) => (
            <View
              key={i}
              style={[
                styles.taskProgressDot,
                i < completedCount && styles.taskProgressDotFilled,
              ]}
            />
          ))}
          <Text style={styles.taskProgressLabel}>
            {completedCount}/{tasks.length || MAX_DAILY_TASKS} complete today
          </Text>
        </View>

        {allComplete && (
          <View style={styles.allDoneBanner}>
            <Award size={18} color={COLORS.success} />
            <Text style={styles.allDoneBannerText}>
              All priorities complete — greatness achieved today.
            </Text>
          </View>
        )}

        <View style={styles.taskListWrap}>
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <TouchableOpacity
                style={styles.taskCheckArea}
                onPress={() => toggleTask(task.id)}
                activeOpacity={0.7}
              >
                {task.completed ? (
                  <CheckCircle2 size={22} color={COLORS.success} />
                ) : (
                  <CircleIcon size={22} color={COLORS.textMuted} />
                )}
                <Text
                  style={[
                    styles.taskText,
                    task.completed && styles.taskTextCompleted,
                  ]}
                >
                  {task.text}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeTask(task.id)} hitSlop={10}>
                <Trash2 size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          {tasks.length === 0 && (
            <Text style={styles.emptyStateText}>
              Add your top 3 to 5 priorities for today. Small list, real focus.
            </Text>
          )}
        </View>

        {tasks.length < MAX_DAILY_TASKS && (
          <View style={styles.addTaskRow}>
            <TextInput
              style={styles.addTaskInput}
              placeholder="Add a priority..."
              placeholderTextColor={COLORS.textMuted}
              value={newTaskText}
              onChangeText={setNewTaskText}
              onSubmitEditing={addTask}
              returnKeyType="done"
              maxLength={80}
            />
            <TouchableOpacity style={styles.addTaskButton} onPress={addTask} activeOpacity={0.8}>
              <Plus size={20} color={COLORS.background} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={historyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '70%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Completed History</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <X size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {taskHistory.length === 0 ? (
                <Text style={styles.emptyStateText}>
                  Your daily completion history will appear here.
                </Text>
              ) : (
                [...taskHistory].reverse().map((entry) => (
                  <View key={entry.date} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{entry.date}</Text>
                    <Text style={styles.historyValue}>
                      {entry.completedCount}/{entry.totalCount} done
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// =============================================================================
// SECTION 11: TAB 4 — DEEP WORK STATS
// =============================================================================

const DeepWorkStatsTab: React.FC = () => {
  const { stats, streak } = useAppContext();
  const [privacyVisible, setPrivacyVisible] = useState(false);

  const today = todayISO();
  const todayStat = stats.daily.find((d) => d.date === today);
  const todayMinutes = todayStat?.minutes ?? 0;

  const last7 = useMemo(() => {
    const map = new Map(stats.daily.map((d) => [d.date, d]));
    const days: { date: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      days.push({ date: key, minutes: map.get(key)?.minutes ?? 0 });
    }
    return days;
  }, [stats.daily]);

  const weeklyTotal = last7.reduce((sum, d) => sum + d.minutes, 0);
  const maxDay = Math.max(1, ...last7.map((d) => d.minutes));

  const badges = [
    { id: 'starter', label: 'First Session', achieved: stats.totalSessionsAllTime >= 1 },
    { id: 'streak3', label: '3-Day Streak', achieved: streak.bestStreak >= 3 },
    { id: 'streak7', label: '7-Day Streak', achieved: streak.bestStreak >= 7 },
    { id: 'hours10', label: '10 Hours Focused', achieved: stats.totalMinutesAllTime >= 600 },
    { id: 'hours50', label: '50 Hours Focused', achieved: stats.totalMinutesAllTime >= 3000 },
    { id: 'sessions25', label: '25 Sessions', achieved: stats.totalSessionsAllTime >= 25 },
  ];

  return (
    <View style={styles.tabContainer}>
      <ScrollView contentContainerStyle={styles.screenScrollContent}>
        <Text style={styles.screenTitle}>Deep Work Stats</Text>
        <Text style={styles.screenSubtitle}>Your focus, measured and celebrated.</Text>

        <View style={styles.statCardsRow}>
          <View style={styles.statCard}>
            <Clock size={20} color={COLORS.primary} />
            <Text style={styles.statCardValue}>{formatMinutes(todayMinutes)}</Text>
            <Text style={styles.statCardLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={20} color={COLORS.accent} />
            <Text style={styles.statCardValue}>{formatMinutes(weeklyTotal)}</Text>
            <Text style={styles.statCardLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Flame size={20} color={COLORS.warning} />
            <Text style={styles.statCardValue}>{streak.currentStreak}</Text>
            <Text style={styles.statCardLabel}>Day Streak</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Last 7 Days</Text>
        <View style={styles.barChartRow}>
          {last7.map((d) => {
            const heightFraction = d.minutes / maxDay;
            const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'narrow',
            });
            return (
              <View key={d.date} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(4, heightFraction * 100)}%`,
                        backgroundColor:
                          d.date === today ? COLORS.primary : COLORS.surfaceLight,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{dayLabel}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionHeading}>Badges</Text>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <View
              key={badge.id}
              style={[styles.badgeCard, !badge.achieved && styles.badgeCardLocked]}
            >
              <Award
                size={22}
                color={badge.achieved ? COLORS.accent : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.badgeLabel,
                  !badge.achieved && styles.badgeLabelLocked,
                ]}
              >
                {badge.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.allTimeCard}>
          <Text style={styles.allTimeTitle}>All-Time Totals</Text>
          <View style={styles.allTimeRow}>
            <Text style={styles.allTimeLabel}>Total focus time</Text>
            <Text style={styles.allTimeValue}>
              {formatMinutes(stats.totalMinutesAllTime)}
            </Text>
          </View>
          <View style={styles.allTimeRow}>
            <Text style={styles.allTimeLabel}>Sessions completed</Text>
            <Text style={styles.allTimeValue}>{stats.totalSessionsAllTime}</Text>
          </View>
          <View style={styles.allTimeRow}>
            <Text style={styles.allTimeLabel}>Best streak</Text>
            <Text style={styles.allTimeValue}>{streak.bestStreak} days</Text>
          </View>
        </View>

        <View style={styles.aboutCard}>
          <Text style={styles.allTimeTitle}>About</Text>
          <Text style={styles.aboutLine}>{BRAND.appTitle} • v1.0.0</Text>
          <Text style={styles.aboutLine}>{BRAND.studio}</Text>
          <Text style={styles.aboutLine}>{BRAND.packageName}</Text>
          <TouchableOpacity
            style={styles.aboutLinkRow}
            onPress={() => Linking.openURL(BRAND.portal).catch(() => {})}
            activeOpacity={0.7}
          >
            <Globe size={14} color={COLORS.primaryLight} />
            <Text style={styles.aboutLink}>Official Web Portal</Text>
          </TouchableOpacity>
          <Text style={styles.aboutCopyright}>{BRAND.copyright}</Text>
        </View>

        <TouchableOpacity
          style={styles.privacyLinkRow}
          onPress={() => setPrivacyVisible(true)}
          activeOpacity={0.7}
        >
          <ShieldCheck size={16} color={COLORS.textSecondary} />
          <Text style={styles.privacyLinkText}>Privacy Policy & Terms</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={privacyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Privacy Policy & Terms</Text>
              <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
                <X size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.privacyParagraph}>
                Brand: {BRAND.studio}{'\n'}
                App: {BRAND.appTitle} ({BRAND.packageName}){'\n'}
                Portal: {BRAND.portal}{'\n'}
                {BRAND.copyright}
              </Text>
              <Text style={styles.privacyParagraph}>
                1. Google Mobile Ads (AdMob) SDK Disclosure: Contextual ads are served via
                react-native-google-mobile-ads, adhering to Google Play policies. Ads are
                requested as non-personalized and G-rated. Google may process standard device
                identifiers under Google's own privacy policy to deliver and measure ads.
              </Text>
              <Text style={styles.privacyParagraph}>
                2. Zero PII Collection: No names, emails, contacts, location, or telemetry are
                gathered by this app.
              </Text>
              <Text style={styles.privacyParagraph}>
                3. 100% Offline Storage: User tasks, focus logs, and preferences stay on your
                device via AsyncStorage. Uninstalling the app removes them permanently.
              </Text>
              <Text style={styles.privacyParagraph}>
                4. Zero In-App Purchases: 100% Free Forever with zero paywalls. The optional
                rewarded video only unlocks one bonus soundscape at no cost.
              </Text>
              <Text style={styles.privacyParagraph}>
                5. Families & COPPA/GDPR Compliance: A child-safe, distraction-free
                environment with no accounts and no personal data collection.
              </Text>
              <Text style={styles.privacyParagraph}>
                Terms: FocusFlow OS is provided as-is, free of charge, for personal use.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// =============================================================================
// SECTION 12: BOTTOM TAB BAR
// =============================================================================

interface TabDef {
  id: TabId;
  label: string;
  icon: any;
}

const TABS: TabDef[] = [
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'sounds', label: 'Sounds', icon: Waves },
  { id: 'vault', label: 'Vault', icon: ListChecks },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

const BottomTabBar: React.FC<{
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}> = ({ activeTab, onChange }) => {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabBarItem}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.7}
          >
            <Icon size={22} color={active ? COLORS.primary : COLORS.textMuted} />
            <Text
              style={[
                styles.tabBarLabel,
                active && styles.tabBarLabelActive,
              ]}
            >
              {tab.label}
            </Text>
            {active && <View style={styles.tabBarIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// =============================================================================
// SECTION 13: ROOT APP
// =============================================================================

const AppShell: React.FC = () => {
  const { isLoading, gammaUnlocked, unlockGamma } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabId>('timer');
  const [isFocusRunning, setIsFocusRunning] = useState(false);

  useEffect(() => {
    safeInitializeAds();
  }, []);

  const interstitial = useSafeInterstitialAd();
  const rewarded = useSafeRewardedAd(() => {
    if (!gammaUnlocked) unlockGamma();
  });

  // Track AppState so we could pause audio/timers gracefully if needed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (_state: AppStateStatus) => {
      // Reserved for future background-safety hooks; currently a no-op that
      // exists so the audio session and timers remain crash-safe across
      // backgrounding, per the "safe fallback" architecture pillar.
    });
    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Preparing your focus space…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <Text style={styles.brandTitle}>FocusFlow OS</Text>
        <Text style={styles.brandMotto}>Master Your Time • Eliminate Distraction</Text>
      </View>

      <View style={styles.content}>
        {/* Tabs stay mounted so the timer and audio keep running while you switch. */}
        <View style={[styles.tabHost, activeTab !== 'timer' && styles.tabHidden]}>
          <FocusTimerTab interstitial={interstitial} onRunningChange={setIsFocusRunning} />
        </View>
        <View style={[styles.tabHost, activeTab !== 'sounds' && styles.tabHidden]}>
          <SoundSanctuaryTab rewarded={rewarded} />
        </View>
        <View style={[styles.tabHost, activeTab !== 'vault' && styles.tabHidden]}>
          <PriorityVaultTab />
        </View>
        <View style={[styles.tabHost, activeTab !== 'stats' && styles.tabHidden]}>
          <DeepWorkStatsTab />
        </View>
      </View>

      {/* Banner is hidden during an active focus session to prevent accidental clicks. */}
      <Text style={styles.watermark}>{BRAND.watermark}</Text>
      {!isFocusRunning && <SafeBannerAd />}

      <BottomTabBar activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

// =============================================================================
// SECTION 14: STYLES
// =============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: COLORS.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  brandMotto: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
  },
  tabContainer: {
    flex: 1,
  },
  screenScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  timerScrollContent: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  timerHeader: {
    width: '100%',
    marginBottom: 18,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 18,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
    width: '100%',
  },
  modeSwitchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeSwitchButtonActive: {
    backgroundColor: GRADIENT_RING.focus,
  },
  modeSwitchButtonActiveBreak: {
    backgroundColor: GRADIENT_RING.break,
  },
  modeSwitchText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modeSwitchTextActive: {
    color: COLORS.background,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  ringGlow: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timerModeLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 32,
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryControlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetHintCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    marginTop: 36,
    width: '100%',
    alignItems: 'flex-start',
  },
  presetHintText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.backgroundElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 36,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryModalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryModalButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  soundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 12,
  },
  soundIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundCardBody: {
    flex: 1,
  },
  soundCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soundCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  soundCardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  soundCardDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  soundCardAction: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIndicatorIdle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    gap: 14,
  },
  streakIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 182, 72, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCount: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  streakBest: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  historyLink: {
    color: COLORS.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  taskProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  taskProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.surfaceLight,
  },
  taskProgressDotFilled: {
    backgroundColor: COLORS.success,
  },
  taskProgressLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 6,
  },
  allDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  allDoneBannerText: {
    color: COLORS.success,
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },
  taskListWrap: {
    gap: 10,
    marginBottom: 18,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  taskCheckArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  taskText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    flexShrink: 1,
  },
  taskTextCompleted: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  emptyStateText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  addTaskRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  addTaskInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addTaskButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyDate: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  historyValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  statCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 26,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
    gap: 8,
  },
  statCardValue: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  statCardLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  sectionHeading: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 30,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 8,
  },
  barTrack: {
    width: 10,
    height: '80%',
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: 10,
    borderRadius: 5,
    minHeight: 4,
  },
  barLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 26,
  },
  badgeCard: {
    width: '31%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  badgeCardLocked: {
    opacity: 0.45,
  },
  badgeLabel: {
    color: COLORS.textPrimary,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  badgeLabelLocked: {
    color: COLORS.textMuted,
  },
  allTimeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  allTimeTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  allTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  allTimeLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  allTimeValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  privacyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  privacyLinkText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  privacyParagraph: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  watermark: {
    fontSize: 10,
    letterSpacing: 1.5,
    opacity: 0.35,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: '#A3A3A3',
    marginVertical: 4,
  },
  tabHost: {
    flex: 1,
  },
  tabHidden: {
    display: 'none',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.18)',
  },
  presetChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: COLORS.textPrimary,
  },
  aboutCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 6,
  },
  aboutLine: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  aboutLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  aboutLink: {
    color: COLORS.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  aboutCopyright: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  bannerContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundElevated,
    paddingVertical: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  tabBarLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tabBarLabelActive: {
    color: COLORS.primary,
  },
  tabBarIndicator: {
    position: 'absolute',
    top: -10,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});
