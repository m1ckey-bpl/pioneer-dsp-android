package com.pioneerdsp.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.util.Log;

public class AudioSessionReceiver extends BroadcastReceiver {
    private static final String TAG = "AudioSessionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        int sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);
        String packageName = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME);

        Log.d(TAG, "AudioSession broadcast: " + action + " | ID: " + sessionId + " | Pkg: " + packageName);

        if (sessionId == AudioEffect.ERROR_BAD_VALUE || sessionId <= 0) return;

        if (AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION.equals(action)) {
            PioneerAudioEffectManager.getInstance().attachAudioSession(sessionId, packageName);
        } else if (AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION.equals(action)) {
            PioneerAudioEffectManager.getInstance().detachAudioSession(sessionId);
        }
    }
}
