# Pioneer DSP for Android 🎵
**Audiophile Audio Effects Engine, 10-Band Graphic Equalizer, Spotify Integration & Local Music Player**

[![Build Android APK](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml/badge.svg)](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml)
[![Release](https://img.shields.io/github/v/release/m1ckey-bpl/pioneer-dsp-android?color=orange)](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases)

---

## 📱 Overview

**Pioneer DSP for Android** (v4.3.0) is a faithful re-creation of the original iOS Pioneer DSP cockpit music and audio-effects application. It combines a 32-bit floating point WebAudio DSP engine with Android's native `android.media.audiofx` framework, Spotify Web API integration, and an authentic 6-tab Cockpit Bottom Navigation Bar.

> [!NOTE]
> **Pure Dark Titanium Audio Theme**: 100% removal of all anime character artwork, manga girl portraits, and face wallpapers. Built with iOS `PioneerTheme` titanium surfaces, deep charcoal gradients, neon cyan (`#00E5FF`), magenta (`#FE0979`), and signature Pioneer amber-orange (`#FF6B00`).

### 🎛️ Authentic 6-Tab Cockpit Architecture:
* **`TUNER` (Main DSP Cockpit)**: Now Playing banner, Master Concert Hall toggle, Rotary Master Volume Dial (with smooth touch-angle tracking and dynamic SVG progress arc), Todoroki Super Bass quick-switch, Presets selector, and live 20-band Spectrum Analyser.
* **`LIBRARY` (Local Music Repository)**: Android Storage Access Framework (SAF) folder/file import, automatic MediaStore scanner, track list, and instant search.
* **`SPOTIFY` (Spotify Player & DSP)**: Spotify Web API Player & hardware AudioEffect integration, Curated Quick Stations, and floating DSP Quick Tuning Bar.
* **`EQ` (10-Band Graphic Equalizer)**: ISO standard frequency faders (31Hz, 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) with $\pm12\text{ dB}$ range, real-time frequency curve preview canvas, and Reset Flat button.
* **`HALL` (Acoustic Reverb Environment)**: Selectable reverb spaces (Concert Hall, Large Arena, Cathedral, Live Studio, Plate Reverb) with synthetic impulse response convolution and 0–100% Wet/Dry mix slider.
* **`CABIN` (Listening Position Alignment)**: Car Cabin Visualizer with 4 interactive speaker seats (FL, FR, RL, RR) and listening modes (`ALL SEATS`, `DRIVER FOCUS`, `PASSENGER FOCUS`) driving WebAudio ChannelDelay and StereoPanner wavefront correction.

### ✨ Additional Features:
* **Real-Time Online Music Streaming & Live DSP**: Stream remote audio directly through the 32-bit floating point WebAudio DSP pipeline.
* **Native Android Streaming Proxy**: Android WebView proxy in `MainActivity.java` injecting CORS headers (`Access-Control-Allow-Origin: *`) and Range 206 support.
* **Device Layout Optimization**: Optimized for modern Android devices including OnePlus Nord CE5 (safe area insets, zero control clipping, minimum 44px touch targets).
* **Dual DSP Architecture**: High-resolution WebAudio processing for local files & streams + native hardware `AudioEffect` routing for external Spotify sessions.

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
