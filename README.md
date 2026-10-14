# Pioneer DSP for Android 🎵
**Audiophile Audio Effects Engine, 10-Band Graphic Equalizer, Spotify Integration & Local Music Player**

[![Build Android APK](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml/badge.svg)](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml)
[![Release](https://img.shields.io/github/v/release/m1ckey-bpl/pioneer-dsp-android?color=orange)](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases)

---

## 📱 Overview

**Pioneer DSP for Android** (v4.5.1) is a comprehensive layout overhaul, restoration, and audiophile upgrade of the Pioneer DSP Android application. It combines a 32-bit floating point WebAudio DSP engine with Android's native `android.media.audiofx` framework, Spotify Web API PKCE integration, MediaStore auto-scanning, and an authentic 6-tab Cockpit Bottom Navigation Bar.

> [!NOTE]
> **Pure Dark Acoustic Cockpit**: 100% removal of all anime character artwork, manga portraits, and face wallpapers. Built with a clean midnight-black (`#070a10`) and titanium-navy (`#0a0f17`) background, subtle acoustic frequency waves, neon cyan (`#00E5FF`), magenta (`#FE0979`), and signature Pioneer amber-orange (`#FF6B00`).

### 🎛️ Key Restorations & Features:
* **UI Layout & Viewport Overhaul (v4.5.0)**:
  - Eliminated the oversized, cropped logo artwork bug that dominated and distorted the screen.
  - Replaced floating detached mini-player with a seamless integrated bottom player deck docked flush above the 6-tab bottom navigation bar.
  - Flexbox column viewport architecture (`100dvh`) with safe-area insets (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`) supporting OnePlus Nord CE5 (2400x1080 / 20:9) and edge-to-edge displays.
* **10-Band Graphic Equalizer Cockpit Screen**:
  - Full visible 10-band ISO graphic faders (31Hz, 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) with dedicated vertical wrap containers (height 150px) preventing collapsed controls.
  - Real-time frequency response curve canvas with baseline grid and neon-cyan response line.
  - EQ acoustic profile presets bar (FLAT, BASS BOOST, VOCAL, ROCK/DYNAMIC, CLUB, CONCERT HALL).
  - Todoroki Super Bass dual-stage boost card (80Hz low-shelf + 60Hz punch boost) with quick dB pills (OFF, SUBTLE +4.5dB, PUNCH +9.0dB, MAX +14dB).
  - Treble Brilliance & Clarity card (10kHz high-shelf) with quick pills (FLAT, CRISP +3dB, AIR BOOST +6dB, ULTRA +9dB).
  - 3D Acoustic Reverb Environment card with room selection (Concert Hall, Arena, Cathedral, Studio, Plate) and wet/dry mix slider.
  - Every fader and slider directly modulates audio in real time.
* **Seeking & Playback Glitch Permanent Fix**: Detaches `onended` before stopping `AudioBufferSourceNode` to eliminate unintended track skips or restarts, with an `isUserSeeking` state lock on progress sliders.
* **Automatic Local Music Scanning**: Android MediaStore indexed audio scanning with dynamic permission checks (`READ_MEDIA_AUDIO` on Android 13/14, `READ_EXTERNAL_STORAGE` on older versions), extracting real album art, titles, artists, and durations.
* **Spotify Web API & PKCE OAuth**: Complete PKCE authorization flow (`loginPKCE()`), Android deep-link handling (`pioneerdsp://callback`), track/album search, user playlists explorer, Spotify Connect device discovery, and hardware `AudioEffect` synchronization.
* **Unified Online Music Discovery**: Instant search across YouTube Music (Data API v3 + public gateways) and over 40,000 public international live radio stations, streamed through the native proxy directly into the 32-bit floating point WebAudio DSP pipeline.
* **Legitimate Media Downloader**: Dedicated download manager for direct user audio URLs, podcasts, and Creative Commons open audio, with progress feedback and automatic IndexedDB & device library integration.
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
