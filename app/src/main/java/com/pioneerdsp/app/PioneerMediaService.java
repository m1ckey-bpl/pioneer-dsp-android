package com.pioneerdsp.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;

import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PioneerMediaService extends Service {
    private static final String TAG = "PioneerMediaService";
    private static final String CHANNEL_ID = "pioneer_dsp_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_PLAY = "com.pioneerdsp.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.pioneerdsp.app.ACTION_PAUSE";
    public static final String ACTION_TOGGLE_PLAY = "com.pioneerdsp.app.ACTION_TOGGLE_PLAY";
    public static final String ACTION_NEXT = "com.pioneerdsp.app.ACTION_NEXT";
    public static final String ACTION_PREV = "com.pioneerdsp.app.ACTION_PREV";
    public static final String ACTION_SEEK_TO = "com.pioneerdsp.app.ACTION_SEEK_TO";
    public static final String ACTION_STOP = "com.pioneerdsp.app.ACTION_STOP";
    public static final String ACTION_TOGGLE_CONCERT_HALL = "com.pioneerdsp.app.ACTION_TOGGLE_CONCERT_HALL";
    public static final String ACTION_CYCLE_PRESET = "com.pioneerdsp.app.ACTION_CYCLE_PRESET";
    public static final String EXTRA_SEEK_MS = "seek_position_ms";

    public interface PlaybackActionListener {
        void onPlayRequested();
        void onPauseRequested();
        void onNextRequested();
        void onPrevRequested();
        void onSeekRequested(long positionMs);
        void onConcertHallToggled();
        void onPresetCycled();
        void onAudioDucking(boolean duck);
    }

    private static volatile PioneerMediaService instance;
    private static PlaybackActionListener actionListener;

    private MediaSessionCompat mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private PowerManager.WakeLock wakeLock;
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();

    // Current State
    private String currentTitle = "Pioneer DSP Ready";
    private String currentArtist = "Audiophile Processing Active";
    private String currentAlbum = "";
    private long currentDurationMs = 0;
    private long currentPositionMs = 0;
    private boolean isPlaying = false;
    private boolean isConcertHall = false;
    private String currentPreset = "Flat";
    private String currentCoverUrl = "";
    private Bitmap currentCoverBitmap = null;
    private boolean resumeOnFocusGain = false;
    private boolean isForeground = false;

    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        public PioneerMediaService getService() {
            return PioneerMediaService.this;
        }
    }

    public static PioneerMediaService getInstance() {
        return instance;
    }

    public static void setActionListener(PlaybackActionListener listener) {
        actionListener = listener;
    }

    private final BroadcastReceiver becomingNoisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                Log.i(TAG, "Audio becoming noisy (headphone/BT disconnected) -> Pausing playback");
                if (actionListener != null) {
                    actionListener.onPauseRequested();
                }
            }
        }
    };

    private final AudioManager.OnAudioFocusChangeListener audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int focusChange) {
            switch (focusChange) {
                case AudioManager.AUDIOFOCUS_LOSS:
                    Log.i(TAG, "AudioFocus LOSS -> pausing");
                    resumeOnFocusGain = false;
                    if (actionListener != null) actionListener.onPauseRequested();
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    Log.i(TAG, "AudioFocus LOSS_TRANSIENT -> pausing");
                    if (isPlaying) {
                        resumeOnFocusGain = true;
                        if (actionListener != null) actionListener.onPauseRequested();
                    }
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    Log.i(TAG, "AudioFocus LOSS_TRANSIENT_CAN_DUCK -> ducking");
                    if (actionListener != null) actionListener.onAudioDucking(true);
                    break;
                case AudioManager.AUDIOFOCUS_GAIN:
                    Log.i(TAG, "AudioFocus GAIN -> restoring");
                    if (actionListener != null) actionListener.onAudioDucking(false);
                    if (resumeOnFocusGain) {
                        resumeOnFocusGain = false;
                        if (actionListener != null) actionListener.onPlayRequested();
                    }
                    break;
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PioneerDSP:MediaPlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        createNotificationChannel();
        initMediaSession();

        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        registerReceiver(becomingNoisyReceiver, filter);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Pioneer DSP Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("High-Fidelity Audio Playback Controls & Status");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "PioneerDSP");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

        Intent mediaButtonIntent = new Intent(Intent.ACTION_MEDIA_BUTTON);
        mediaButtonIntent.setClass(this, MediaButtonReceiver.class);
        PendingIntent mbrIntent = PendingIntent.getBroadcast(
                this, 0, mediaButtonIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        mediaSession.setMediaButtonReceiver(mbrIntent);

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                requestAudioFocus();
                if (actionListener != null) actionListener.onPlayRequested();
            }

            @Override
            public void onPause() {
                if (actionListener != null) actionListener.onPauseRequested();
            }

            @Override
            public void onSkipToNext() {
                if (actionListener != null) actionListener.onNextRequested();
            }

            @Override
            public void onSkipToPrevious() {
                if (actionListener != null) actionListener.onPrevRequested();
            }

            @Override
            public void onSeekTo(long pos) {
                if (actionListener != null) actionListener.onSeekRequested(pos);
            }

            @Override
            public void onStop() {
                if (actionListener != null) actionListener.onPauseRequested();
                abandonAudioFocus();
                stopForeground(true);
                isForeground = false;
            }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if (ACTION_TOGGLE_CONCERT_HALL.equals(action)) {
                    if (actionListener != null) actionListener.onConcertHallToggled();
                } else if (ACTION_CYCLE_PRESET.equals(action)) {
                    if (actionListener != null) actionListener.onPresetCycled();
                }
            }
        });

        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MediaButtonReceiver.handleIntent(mediaSession, intent);

        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            switch (action) {
                case ACTION_PLAY:
                    requestAudioFocus();
                    if (actionListener != null) actionListener.onPlayRequested();
                    break;
                case ACTION_PAUSE:
                    if (actionListener != null) actionListener.onPauseRequested();
                    break;
                case ACTION_TOGGLE_PLAY:
                    if (isPlaying) {
                        if (actionListener != null) actionListener.onPauseRequested();
                    } else {
                        requestAudioFocus();
                        if (actionListener != null) actionListener.onPlayRequested();
                    }
                    break;
                case ACTION_NEXT:
                    if (actionListener != null) actionListener.onNextRequested();
                    break;
                case ACTION_PREV:
                    if (actionListener != null) actionListener.onPrevRequested();
                    break;
                case ACTION_SEEK_TO:
                    long seekMs = intent.getLongExtra(EXTRA_SEEK_MS, 0);
                    if (actionListener != null) actionListener.onSeekRequested(seekMs);
                    break;
                case ACTION_TOGGLE_CONCERT_HALL:
                    if (actionListener != null) actionListener.onConcertHallToggled();
                    break;
                case ACTION_CYCLE_PRESET:
                    if (actionListener != null) actionListener.onPresetCycled();
                    break;
                case ACTION_STOP:
                    if (actionListener != null) actionListener.onPauseRequested();
                    stopForeground(true);
                    isForeground = false;
                    releaseWakeLock();
                    break;
            }
        }

        return START_STICKY;
    }

    public synchronized void updatePlaybackState(
            String title,
            String artist,
            String album,
            long durationSec,
            long currentPosSec,
            boolean playing,
            String coverUrl,
            boolean concertHallActive,
            String presetName
    ) {
        this.currentTitle = (title != null && !title.isEmpty()) ? title : "Pioneer Audio Track";
        this.currentArtist = (artist != null && !artist.isEmpty()) ? artist : "Pioneer DSP";
        this.currentAlbum = album != null ? album : "";
        this.currentDurationMs = durationSec * 1000L;
        this.currentPositionMs = currentPosSec * 1000L;
        this.isPlaying = playing;
        this.isConcertHall = concertHallActive;
        this.currentPreset = (presetName != null && !presetName.isEmpty()) ? presetName : "Flat";

        if (playing) {
            acquireWakeLock();
            requestAudioFocus();
        } else {
            releaseWakeLock();
        }

        // Update MediaSession metadata & state
        updateMediaSessionPlaybackState();

        // Check if artwork URL changed
        if (coverUrl != null && !coverUrl.equals(this.currentCoverUrl)) {
            this.currentCoverUrl = coverUrl;
            loadArtworkAsync(coverUrl);
        } else {
            publishNotification();
        }
    }

    private void updateMediaSessionPlaybackState() {
        long actions = PlaybackStateCompat.ACTION_PLAY
                | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO
                | PlaybackStateCompat.ACTION_STOP;

        PlaybackStateCompat.CustomAction concertAction = new PlaybackStateCompat.CustomAction.Builder(
                ACTION_TOGGLE_CONCERT_HALL,
                isConcertHall ? "Concert Hall: ON" : "Concert Hall: OFF",
                R.drawable.ic_media_concert
        ).build();

        PlaybackStateCompat.CustomAction presetAction = new PlaybackStateCompat.CustomAction.Builder(
                ACTION_CYCLE_PRESET,
                "Preset: " + currentPreset,
                R.drawable.ic_media_eq
        ).build();

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .addCustomAction(concertAction)
                .addCustomAction(presetAction)
                .setState(state, currentPositionMs, 1.0f)
                .build();

        mediaSession.setPlaybackState(playbackState);
    }

    private void loadArtworkAsync(String coverUrl) {
        artworkExecutor.execute(() -> {
            Bitmap bmp = null;
            try {
                if (coverUrl.startsWith("data:image")) {
                    String base64Data = coverUrl.substring(coverUrl.indexOf(",") + 1);
                    byte[] decoded = Base64.decode(base64Data, Base64.DEFAULT);
                    bmp = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                } else if (coverUrl.startsWith("https://pioneer.local/artwork")) {
                    Uri u = Uri.parse(coverUrl);
                    String uriParam = u.getQueryParameter("uri");
                    String albumIdParam = u.getQueryParameter("albumId");
                    long albumId = 0;
                    if (albumIdParam != null && !albumIdParam.isEmpty()) {
                        try { albumId = Long.parseLong(albumIdParam); } catch(Exception ignored) {}
                    }
                    if (MainActivity.getInstance() != null) {
                        byte[] bytes = MainActivity.getInstance().extractTrackArtworkBytes(uriParam, albumId);
                        if (bytes != null && bytes.length > 0) {
                            bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                        }
                    }
                } else if (coverUrl.startsWith("content://") || coverUrl.startsWith("file://")) {
                    try (InputStream is = getContentResolver().openInputStream(Uri.parse(coverUrl))) {
                        bmp = BitmapFactory.decodeStream(is);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Artwork decode error: " + e.getMessage());
            }

            if (bmp == null) {
                try {
                    bmp = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
                } catch (Exception ignored) {}
            }

            currentCoverBitmap = bmp;
            updateMediaSessionMetadata();
            publishNotification();
        });
    }

    private void updateMediaSessionMetadata() {
        Bitmap art = (currentCoverBitmap != null) ? currentCoverBitmap
                : BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs);

        if (art != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, art);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, art);
        }

        mediaSession.setMetadata(metaBuilder.build());
    }

    private void publishNotification() {
        Notification notification = buildNotification();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (isPlaying) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isForeground = true;
        } else {
            if (isForeground) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH);
                } else {
                    stopForeground(false);
                }
                isForeground = false;
            }
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, notification);
            }
        }
    }

    private Notification buildNotification() {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, openAppIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        PendingIntent prevIntent = getServiceActionPendingIntent(ACTION_PREV, 1);
        PendingIntent playPauseIntent = getServiceActionPendingIntent(ACTION_TOGGLE_PLAY, 2);
        PendingIntent nextIntent = getServiceActionPendingIntent(ACTION_NEXT, 3);
        PendingIntent concertIntent = getServiceActionPendingIntent(ACTION_TOGGLE_CONCERT_HALL, 4);
        PendingIntent presetIntent = getServiceActionPendingIntent(ACTION_CYCLE_PRESET, 5);
        PendingIntent stopIntent = getServiceActionPendingIntent(ACTION_STOP, 6);

        String effectSubText = (isConcertHall ? "CONCERT HALL" : "STUDIO") + " • " + currentPreset.toUpperCase();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_media_play)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist + (currentAlbum.isEmpty() ? "" : " • " + currentAlbum))
                .setSubText(effectSubText)
                .setContentIntent(contentIntent)
                .setDeleteIntent(stopIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .setShowWhen(false)
                .setColor(0xFF00D9FF) // Pioneer Electric Cyan Accent
                .addAction(R.drawable.ic_media_prev, "Previous", prevIntent)
                .addAction(isPlaying ? R.drawable.ic_media_pause : R.drawable.ic_media_play, isPlaying ? "Pause" : "Play", playPauseIntent)
                .addAction(R.drawable.ic_media_next, "Next", nextIntent)
                .addAction(R.drawable.ic_media_concert, isConcertHall ? "Hall: ON" : "Hall: OFF", concertIntent)
                .addAction(R.drawable.ic_media_eq, "Preset: " + currentPreset, presetIntent)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2)
                        .setShowCancelButton(true)
                        .setCancelButtonIntent(stopIntent));

        if (currentCoverBitmap != null) {
            builder.setLargeIcon(currentCoverBitmap);
        } else {
            Bitmap icon = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            if (icon != null) builder.setLargeIcon(icon);
        }

        return builder.build();
    }

    private PendingIntent getServiceActionPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, PioneerMediaService.class);
        intent.setAction(action);
        return PendingIntent.getService(
                this, requestCode, intent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );
    }

    private void requestAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (audioFocusRequest == null) {
                AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(attributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(audioFocusChangeListener)
                        .build();
            }
            audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            audioManager.requestAudioFocus(
                    audioFocusChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
            );
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(audioFocusChangeListener);
        }
    }

    private void acquireWakeLock() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(12 * 60 * 60 * 1000L); // Max 12 hours safe timeout
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        releaseWakeLock();
        abandonAudioFocus();

        try {
            unregisterReceiver(becomingNoisyReceiver);
        } catch (Exception ignored) {}

        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }

        artworkExecutor.shutdown();
    }
}
