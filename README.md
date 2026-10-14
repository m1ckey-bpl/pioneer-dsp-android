# Pioneer DSP for Android 🎵
**Audiophile Audio Effects Engine, 10-Band Graphic Equalizer, Spotify Integration & Local Music Player**

[![Build Android APK](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml/badge.svg)](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml)
[![Release](https://img.shields.io/github/v/release/m1ckey-bpl/pioneer-dsp-android?color=orange)](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases)

---

## 📱 Overview

**Pioneer DSP for Android** (v4.4.0) is a comprehensive restoration and upgrade of the Android music and audio-effects application. It combines a 32-bit floating point WebAudio DSP engine with Android's native `android.media.audiofx` framework, Spotify Web API PKCE integration, MediaStore auto-scanning, and an authentic 6-tab Cockpit Bottom Navigation Bar.

> [!NOTE]
> **Pure Dark Titanium Audio Theme**: 100% removal of all anime character artwork, manga girl portraits, and face wallpapers. Built with iOS `PioneerTheme` titanium surfaces, deep charcoal gradients, neon cyan (`#00E5FF`), magenta (`#FE0979`), and signature Pioneer amber-orange (`#FF6B00`).

### 🎛️ Key Restorations & Features:
* **Seeking & Playback Glitch Permanent Fix**: Detaches `onended` before stopping `AudioBufferSourceNode` to eliminate unintended track skips or restarts, with an `isUserSeeking` state lock on progress sliders.
* **Automatic Local Music Scanning**: Android MediaStore indexed audio scanning with dynamic permission checks (`READ_MEDIA_AUDIO` on Android 13/14, `READ_EXTERNAL_STORAGE` on older versions), extracting real album art, titles, artists, and durations.
* **Spotify Web API & PKCE OAuth**: Complete PKCE authorization flow (`loginPKCE()`), Android deep-link handling (`pioneerdsp://callback`), track/album search, user playlists explorer, Spotify Connect device discovery, and hardware `AudioEffect` synchronization.
* **Unified Online Music Discovery**: Instant search across YouTube Music (Data API v3 + public gateways) and over 40,000 public international live radio stations, streamed through the native proxy directly into the 32-bit floating point WebAudio DSP pipeline.
* **Legitimate Media Downloader**: Dedicated download manager for direct user audio URLs, podcasts, and Creative Commons open audio, with progress feedback and automatic IndexedDB & device library integration.
* **10-Band Graphic Equalizer**: ISO standard frequency faders (31Hz – 16kHz, $\pm12\text{ dB}$) with dynamic cubic bezier curve preview canvas.
* **Todoroki Super Bass**: Dual-stage bass architecture (80Hz low-shelf + 60Hz punch peaking filter) up to $+14\text{ dB}$.
* **Concert Hall 3D Reverb**: Synthetic impulse convolution reverb (Concert Hall, Large Arena, Cathedral, Live Studio, Plate Reverb) with equal-power trigonometric wet/dry mixing.
* **Car Cabin Listening Position Alignment**: Interactive 4-seat visualizer (`FL`, `FR`, `RL`, `RR`) driving channel delay and stereo panning wavefront alignment.
* **Audiophile Safety & Background Operation**: 100% zero demo sounds or test tones; `AudioBecomingNoisy` receiver to pause on headphone disconnect; W3C MediaSession API for lock-screen controls.

---

## 🛠️ Building from Source

### Prerequisites:
* Android Studio Iguana / Jellyfish (or command-line Gradle 8.5+)
* JDK 17
* Android SDK 34 (Android 14)

### Command-Line Build:
```bash
# Clone the repository
git clone https://github.com/m1ckey-bpl/pioneer-dsp-android.git
cd pioneer-dsp-android

# Build the release APK
./gradlew assembleRelease
```
The compiled APK will be located at:
`app/build/outputs/apk/release/app-release-unsigned.apk` (or `Pioneer_DSP.apk`).

---

## 📦 Download
Download the latest installable APK from the [Releases](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases) tab.
