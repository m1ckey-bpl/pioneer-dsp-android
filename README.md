# Pioneer DSP for Android 🎵
**Audiophile Audio Effects Engine, 10-Band Graphic Equalizer, Spotify Integration & Local Music Player**

[![Build Android APK](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml/badge.svg)](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml)
[![Release](https://img.shields.io/github/v/release/m1ckey-bpl/pioneer-dsp-android?color=cyan)](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases)

---

## 🎧 Overview

**Pioneer DSP for Android** is an open-source, high-fidelity music player and real-time audio effects processing application. It combines a 32-bit floating point WebAudio DSP pipeline for local media with Android's native `android.media.audiofx` framework and Spotify Web API integration.

### ✨ Key Features (v4.0.2 Master Acoustic Cockpit Edition):
* **Custom Bespoke Icon Suite**: Entirely custom-drawn geometric line icon family (Home, Search, Library, Studio Equalizer, Cockpit Settings, Play, Previous/Next, Shuffle, Repeat, Spatial Reverb) with uniform 1.8px stroke weight and electric cyan illumination.
* **Ground-Up Recomposed Now Playing Deck**: Purpose-designed circular turntable gauge chassis with concentric vinyl micro-grooves, illuminated strobe ticks, and holographic spindle—completely replacing the old oversized rectangular wallpaper look.
* **Signature Hardware Play/Pause Dial**: 76mm dual-ring tactile control dial with brushed metallic titanium rim, Electric Cyan to Neon Violet core, and high-contrast play/pause glyphs.
* **Sculpted Step & Telemetry Controls**: Chamfered capsule step buttons, shuffle/repeat micro-controls with active cyan indicator LEDs, and modular 3D Concert Hall & 10-band EQ quick switches.
* **Integrated Cockpit Dashboard**: Recomposed Home telemetry deck with framed artwork, 60 FPS oscilloscope spectrum analyzer, dual-meter tone faders, and tactile push-button acoustic presets.
* **Persistent Docked Mini-Player**: Hairline Electric Cyan progress rail, framed artwork with neon corner brackets, and tactile mini play dial sitting flush above the bottom navigation bar.
* **10-Band Graphic Equalizer**: Studio-console ISO standard frequency bands (31Hz, 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) with precision fader rails, illuminated studio fader caps, and real-time canvas spectrum visualization.
* **Todoroki Super Bass & Spatial Reverb**: Dual-stage bass architecture (80Hz low-shelf + 60Hz punch peaking filter up to +14 dB) and 3D synthetic impulse convolution reverb.
* **OnePlus Nord CE5 Responsive Architecture**: `100dvh` viewport with safe-area display inset handling (`env(safe-area-inset-top)` / `bottom`).

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

## 📥 Download
Download the latest installable APK from the [Releases](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases) tab:
* **[Pioneer DSP v4.0.2 Release](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases/tag/v4.0.2)** — Direct install APK: `Pioneer_DSP_v4.0.2.apk`
