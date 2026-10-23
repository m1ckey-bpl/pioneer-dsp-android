# NOIR for Android 🎛️
**Audiophile Audio Effects Engine, 10-Band Graphic Equalizer, Spotify Integration & Local Music Player**

[![Build Android APK](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml/badge.svg)](https://github.com/m1ckey-bpl/pioneer-dsp-android/actions/workflows/build-android.yml)
[![Release](https://img.shields.io/github/v/release/m1ckey-bpl/pioneer-dsp-android?color=cyan)](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases)

---

## 🎧 Overview

**NOIR for Android** is an open-source, high-fidelity music player and real-time audio effects processing application. It combines a 32-bit floating point WebAudio DSP pipeline for local media with Android's native `android.media.audiofx` framework and Spotify Web API integration.

### ✨ Key Features (v4.0.7 Complete NOIR UI Redesign & Fluid Animation Edition):
* **Monochrome Analog Luxury Aesthetic**: Pure velvet noir (`#08090C`), charcoal graphite, titanium silver, and platinum off-white visual system. Subtle analog film grain texture, refined specular reflections, and elimination of excessive neon or cartoon gradients.
* **Fluid Animation & Physical Vinyl Interaction**: Hardware-accelerated 24-second physical vinyl record turntable animation that smoothly spins during active playback and pauses when idle. Silky 260ms tab transitions with micro-slides, smooth slide-up Now Playing sheet, and tactile button press-scale feedback (`transform: scale(0.92-0.94)`).
* **Studio Monochrome Oscilloscope Spectrum**: Real-time 60 FPS canvas spectrum analyzer visualizer rendered with analog oscilloscope grid and a high-contrast platinum silver-to-graphite gradient.
* **Precision Hardware Faders & Tactile Dials**: 76mm dual-ring tactile master play dial with brushed graphite rim and high-contrast platinum core; precision vertical studio console fader caps with center notches and decibel readouts.
* **New App Identity & Visual Branding**: Full rebrand to **NOIR** with bespoke vinyl record & tonearm insignia, high-resolution launcher icons across all screen densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi), and updated system notifications.
* **Crisp Dual-Bar Hardware Pause Glyphs**: Completely resolved the central play/pause icon glitch where pause bars merged into a solid black block. Redesigned with two distinct, perfectly proportioned rounded vertical bars (`rx="1.2"`) separated by a wide 4-unit gap, eliminating stroke bleeding and letting the electric cyan-violet gradient shine cleanly between the bars.
* **Live 10-Band Graphic Equalizer DSP Engine**: Fully operational real-time audio equalization across all 10 standard ISO bands (31Hz, 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz). Moving any fader instantly modifies the 32-bit floating-point WebAudio BiquadFilter pipeline and dispatches real-time updates to native Android `AudioEffect` / `Equalizer` sessions (`syncNativeEQBand`) without lag or parameter queue contention.
* **Custom EQ Presets & Persistent Memory**: Complete support for creating, naming, and saving custom EQ curves via the "Save Custom" interface. Custom presets dynamically appear as interactive chips in both the Acoustic Profiles deck and the Equalizer tab, persist across app restarts via local storage, and can be removed with dedicated one-tap delete chips.
* **Decoupled Tone & Reverb Architecture**: Presets now strictly modulate frequency equalization without wiping out or resetting independent tone enhancements (Todoroki Super Bass, Deep Bass punch, Treble clarity, and Concert Hall spatial reverb remain under independent user control).
* **Native Android Foreground Audio Service**: Full Android `ForegroundService` with `foregroundServiceType="mediaPlayback"`, keeping the audio engine alive with high process priority when minimized or switching apps.
* **System Media Notification & Lock-Screen Controller**: Native `NotificationCompat.MediaStyle` media controls featuring Play, Pause, Next, Previous, seeking, and live track metadata/album artwork display on lock screen and notification shade.
* **Direct DSP Effect Quick Toggles**: Custom notification action buttons allowing immediate toggling of Concert Hall spatial reverb and cycling through all 10 DSP equalizer presets (including saved custom presets) without unlocking or opening the app.
* **Audio Focus & Headset Disconnect Protection**: Graceful audio focus handling (`AUDIOFOCUS_GAIN`, `AUDIOFOCUS_LOSS`, and transient ducking), plus automatic pause on headphone or Bluetooth disconnect (`ACTION_AUDIO_BECOMING_NOISY`).
* **Doze Mode & CPU Sleep Prevention**: High-efficiency CPU `PARTIAL_WAKE_LOCK` active strictly while music is playing, preventing stutter, glitching, or buffer underruns when the screen is locked.
* **Intelligent Background Visualizer Throttling**: 60 FPS spectrum analyzer canvas rendering automatically pauses when the screen turns off or the app is minimized, dropping background CPU usage by >90% while keeping audio processing at 100% fidelity.
* **Accurate & Glitch-Free Audio Scrubbing**: Complete resolution of WebAudio onended race conditions—eliminating accidental track skips and restarts on seek. Includes drag settling guards, touch/pointer scrub protection, buffer boundary clamping, and precise timestamp synchronization across both local WebAudio DSP and Spotify Connect.
* **Embedded Album Artwork Display**: Automatic extraction of embedded ID3 APIC / album art from downloaded local files via MediaMetadataRetriever, Android 10+ Scoped Storage thumbnail loader, and local image proxy (`https://pioneer.local/artwork`), rendering album covers across Hero card, Docked Mini-Player, Now Playing turntable deck, and Library song lists.
* **Custom Bespoke Icon Suite**: Entirely custom-drawn geometric line icon family (Home, Search, Library, Studio Equalizer, Cockpit Settings, Play, Previous/Next, Shuffle, Repeat, Spatial Reverb) with uniform 1.8px stroke weight and electric cyan illumination.
* **Ground-Up Recomposed Now Playing Deck**: Purpose-designed circular turntable gauge chassis with concentric vinyl micro-grooves, illuminated strobe ticks, and holographic spindle—completely replacing the old oversized rectangular wallpaper look.
* **Signature Hardware Play/Pause Dial**: 76mm dual-ring tactile control dial with brushed metallic titanium rim, Electric Cyan to Neon Violet core, and high-contrast play/pause glyphs.
* **Sculpted Step & Telemetry Controls**: Chamfered capsule step buttons, shuffle/repeat micro-controls with active cyan indicator LEDs, and modular 3D Concert Hall & 10-band EQ quick switches.
* **Integrated Cockpit Dashboard**: Recomposed Home telemetry deck with framed artwork, 60 FPS oscilloscope spectrum analyzer, dual-meter tone faders, and tactile push-button acoustic presets.
* **Persistent Docked Mini-Player**: Hairline Electric Cyan progress rail, framed artwork with neon corner brackets, and tactile mini play dial sitting flush above the bottom navigation bar.
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
`app/build/outputs/apk/release/Pioneer_DSP.apk`.

---

## 📲 Download
Download the latest installable APK from the [Releases](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases) tab:
* **[NOIR v4.0.7 Release](https://github.com/m1ckey-bpl/pioneer-dsp-android/releases/tag/v4.0.7)** — Direct install APK: `NOIR.apk` (or `Pioneer_DSP.apk`)
