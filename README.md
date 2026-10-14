# Pioneer DSP for Android 🎵
**Audiophile Audio Effects Engine, 10-Band Graphic Equalizer, Spotify Integration & Local Music Player**

[![Build Android APK](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml/badge.svg)](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml)
[![Release](https://img.shields.io/github/v/release/m1ckey-bpl/pioneer-dsp-android?color=orange)](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases)

---

## 📱 Overview

**Pioneer DSP for Android** is an open-source, high-fidelity music player and real-time audio effects processing application. It combines a 32-bit floating point WebAudio DSP pipeline for local media with Android's native `android.media.audiofx` framework and Spotify Web API integration.

### ✨ Key Features:
* **Real-Time Online Music Streaming & Live DSP**: Stream music online and apply all active DSP effects (10-Band EQ, Todoroki Super Bass, Concert Hall Reverb, Presets) to the decoded PCM stream in real time.
* **Native Android Streaming Proxy**: High-performance HTTP/HTTPS proxy in `MainActivity.java` that handles redirects, Range headers (HTTP 206), and injects CORS headers (`Access-Control-Allow-Origin: *`) to eliminate WebAudio silent muting in Android WebView.
* **Curated 24/7 Hi-Fi Live Stations**: Built-in 24/7 HD streams specifically calibrated for testing DSP acoustics (Philharmonic Concert Hall, 808 Bass Lab, Tokyo Synthwave, Lo-Fi Chillout, Rock Antenne, Secret Agent Jazz).
* **Direct Custom Stream URL Player**: Stream and modulate any user-provided live MP3/AAC audio URL.
* **Radio Browser Open API**: Search and tune into over 40,000 international live radio stations without API keys.
* **YouTube Data API v3 & High-Speed Music Gateways**: Music search, rich metadata, and synchronized LRCLIB lyrics.
* **10-Band Graphic Equalizer**: ISO standard frequency bands (31Hz, 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) with $\pm12\text{ dB}$ range.
* **Todoroki Super Bass**: Dual-stage bass architecture (80Hz low-shelf + 60Hz punch peaking filter) up to $+14\text{ dB}$.
* **Sub-Bass Depth**: 35Hz foundation low-shelf filter up to $+12\text{ dB}$.
* **Concert Hall 3D Reverb**: Synthetic impulse convolution reverb with equal-power trigonometric wet/dry mixing.
* **Complete 5-Tab Dark UI**: `Home`, `Search`, `Library`, `Equalizer`, and `Settings`.
* **Persistent Mini-Player Dock**: Floats above the bottom navigation bar across all views with live progress feedback.
* **Full-Screen Now Playing Screen**: Large album art, smooth seek scrubber with `MM:SS` timer, transport controls, and instant DSP toggles.
* **Spotify Integration**: Live search (tracks, artists, albums, playlists), playback control on active Spotify Connect devices, and Android `AudioEffect` control session integration.
* **Permanent Local Library**: IndexedDB + localStorage persistence with automatic Android MediaStore background scanning.

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
