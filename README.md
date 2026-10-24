# NOIR for Android 🎛️
**Audiophile Audio Effects Engine, 10-Band Graphic Equalizer, Spotify Integration & Local Music Player**

[![Build Android APK](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml/badge.svg)](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml)
[![Release](https://img.shields.io/github/v/release/m1ckey-bpl/pioneer-dsp-android?color=cyan)](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases)

---

## 🎧 Overview

**NOIR for Android** is an open-source, high-fidelity music player and real-time audio effects processing application. It combines a 32-bit floating point WebAudio DSP pipeline for local media with Android's native `android.media.audiofx` framework and Spotify Web API integration.

### ✨ Key Features (v4.0.9):
* **NOIR listening room**: Album artwork and playback controls take focus, supported by a live spectrum, quick bass and treble adjustments, Concert Hall access, and the selected acoustic profile.
* **Refined graphite and glass interface**: Obsidian surfaces, pearl text, icy-cyan highlights, restrained blur, fine edge reflections, and reduced-motion support across five tabs.
* **Search and library**: Search local indexed audio and Spotify tracks with source filters; scan Android MediaStore, import audio files, browse playlists, and play actual library results.
* **Mobile 10-band equalizer**: Clearly labeled 31 Hz to 16 kHz bands with dB readouts, presets and saved custom curves, plus preamp, bass, sub-bass, mid, treble, reverb, cabin position, and balance controls.
* **Persistent playback**: Mini-player and expanded vinyl-inspired now-playing view with transport, shuffle, repeat, seeking, artwork, and current DSP status.
* **Existing audio integrations**: Local WebAudio DSP, Spotify Connect, Android media session and notification controls, and the established JavaScript/native bridge remain connected to their existing behavior.
* **Phone-first layout**: Safe-area spacing, scroll clearance beneath fixed controls, reachable touch targets, keyboard-aware resizing, and visible focus and pressed states.

---
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
gradle assembleRelease
```
The compiled APK will be located at:
`app/build/outputs/apk/release/app-release.apk`.

---

## 📲 Download
Download the latest installable APK from the [Releases](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases) tab:
* **[NOIR v4.0.9 Release](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases/tag/v4.0.9)** — Install `NOIR.apk` or `Pioneer_DSP.apk`.
