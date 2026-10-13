package com.pioneerdsp.app;

import android.media.audiofx.AudioEffect;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.PresetReverb;
import android.util.Log;

import java.util.HashMap;
import java.util.Map;

public class PioneerAudioEffectManager {
    private static final String TAG = "PioneerAudioEffect";
    private static PioneerAudioEffectManager instance;

    private final Map<Integer, SessionBundle> activeSessions = new HashMap<>();

    private short[] bandLevels = new short[10];
    private short bassStrength = 0; // 0 to 1000
    private short reverbPreset = PresetReverb.PRESET_NONE;
    private boolean isEnabled = true;

    public static class SessionBundle {
        public int sessionId;
        public Equalizer equalizer;
        public BassBoost bassBoost;
        public PresetReverb presetReverb;

        public void release() {
            if (equalizer != null) {
                try { equalizer.setEnabled(false); equalizer.release(); } catch(Exception ignored) {}
            }
            if (bassBoost != null) {
                try { bassBoost.setEnabled(false); bassBoost.release(); } catch(Exception ignored) {}
            }
            if (presetReverb != null) {
                try { presetReverb.setEnabled(false); presetReverb.release(); } catch(Exception ignored) {}
            }
        }
    }

    private PioneerAudioEffectManager() {}

    public static synchronized PioneerAudioEffectManager getInstance() {
        if (instance == null) {
            instance = new PioneerAudioEffectManager();
        }
        return instance;
    }

    public synchronized void attachAudioSession(int sessionId, String callingPackage) {
        if (sessionId <= 0 && sessionId != AudioEffect.ERROR_BAD_VALUE) return;
        if (activeSessions.containsKey(sessionId)) return;

        Log.i(TAG, "Attaching Pioneer DSP to Session " + sessionId + " (from: " + callingPackage + ")");
        SessionBundle bundle = new SessionBundle();
        bundle.sessionId = sessionId;

        try {
            bundle.equalizer = new Equalizer(1000, sessionId);
            bundle.equalizer.setEnabled(isEnabled);
            applyEqualizerToSession(bundle.equalizer);

            bundle.bassBoost = new BassBoost(1000, sessionId);
            if (bundle.bassBoost.getStrengthSupported()) {
                bundle.bassBoost.setEnabled(isEnabled && bassStrength > 0);
                bundle.bassBoost.setStrength(bassStrength);
            }

            bundle.presetReverb = new PresetReverb(1000, sessionId);
            bundle.presetReverb.setEnabled(isEnabled && reverbPreset != PresetReverb.PRESET_NONE);
            bundle.presetReverb.setPreset(reverbPreset);

            activeSessions.put(sessionId, bundle);
            Log.i(TAG, "Pioneer DSP attached successfully to session " + sessionId);
        } catch(Exception e) {
            Log.e(TAG, "AudioEffect attach error on session " + sessionId + ": " + e.getMessage());
            bundle.release();
        }
    }

    public synchronized void detachAudioSession(int sessionId) {
        SessionBundle bundle = activeSessions.remove(sessionId);
        if (bundle != null) {
            Log.i(TAG, "Detaching Pioneer DSP from session " + sessionId);
            bundle.release();
        }
    }

    private void applyEqualizerToSession(Equalizer eq) {
        if (eq == null) return;
        short bands = eq.getNumberOfBands();
        for (short i = 0; i < bands; i++) {
            if (i < bandLevels.length) {
                eq.setBandLevel(i, bandLevels[i]);
            }
        }
    }

    public synchronized void setBandLevel(short band, short millibels) {
        if (band >= 0 && band < bandLevels.length) {
            bandLevels[band] = millibels;
            for (SessionBundle b : activeSessions.values()) {
                if (b.equalizer != null && band < b.equalizer.getNumberOfBands()) {
                    b.equalizer.setBandLevel(band, millibels);
                }
            }
        }
    }

    public synchronized void setBassStrength(short strength) {
        this.bassStrength = strength;
        for (SessionBundle b : activeSessions.values()) {
            if (b.bassBoost != null && b.bassBoost.getStrengthSupported()) {
                b.bassBoost.setEnabled(isEnabled && strength > 0);
                b.bassBoost.setStrength(strength);
            }
        }
    }

    public synchronized void setPresetReverb(short preset) {
        this.reverbPreset = preset;
        for (SessionBundle b : activeSessions.values()) {
            if (b.presetReverb != null) {
                b.presetReverb.setEnabled(isEnabled && preset != PresetReverb.PRESET_NONE);
                b.presetReverb.setPreset(preset);
            }
        }
    }
}
