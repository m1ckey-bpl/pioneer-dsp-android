package com.pioneerdsp.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.PresetReverb;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.net.HttpURLConnection;
import java.net.URL;


public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQ = 1001;
    private static final int STORAGE_PERM_REQ = 2002;
    private String pendingAuthUrl = null;
    private boolean isPageLoaded = false;

    public class PioneerBridge {
        @JavascriptInterface
        public void openExternalBrowser(String url) {
            try {
                if (url != null && !url.isEmpty()) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public boolean hasMediaPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
            } else {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
            }
        }

        @JavascriptInterface
        public void requestMediaPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.READ_MEDIA_AUDIO}, STORAGE_PERM_REQ);
                } else {
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, STORAGE_PERM_REQ);
                }
            });
        }

        @JavascriptInterface
        public String scanMediaStoreAudio() {
            JSONArray tracks = new JSONArray();
            if (!hasMediaPermission()) {
                return tracks.toString();
            }

            try {
                Uri contentUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                String[] projection = new String[]{
                        MediaStore.Audio.Media._ID,
                        MediaStore.Audio.Media.TITLE,
                        MediaStore.Audio.Media.ARTIST,
                        MediaStore.Audio.Media.ALBUM,
                        MediaStore.Audio.Media.DURATION,
                        MediaStore.Audio.Media.SIZE,
                        MediaStore.Audio.Media.ALBUM_ID
                };
                String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
                String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

                try (Cursor cursor = getContentResolver().query(contentUri, projection, selection, null, sortOrder)) {
                    if (cursor != null) {
                        int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                        int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                        int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                        int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                        int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                        int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
                        int albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);

                        while (cursor.moveToNext()) {
                            long id = cursor.getLong(idCol);
                            String title = cursor.getString(titleCol);
                            String artist = cursor.getString(artistCol);
                            String album = cursor.getString(albumCol);
                            long durationMs = cursor.getLong(durationCol);
                            long sizeBytes = cursor.getLong(sizeCol);
                            long albumId = cursor.getLong(albumIdCol);

                            if (durationMs < 1000) continue;

                            Uri trackUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);

                            JSONObject obj = new JSONObject();
                            obj.put("id", "mediastore_" + id);
                            obj.put("title", (title != null && !title.isEmpty()) ? title : "Unknown Title");
                            obj.put("artist", (artist != null && !artist.equals("<unknown>")) ? artist : "Unknown Artist");
                            obj.put("album", (album != null && !album.equals("<unknown>")) ? album : "Unknown Album");
                            obj.put("duration", Math.round(durationMs / 1000.0));
                            obj.put("size", sizeBytes);
                            obj.put("albumId", albumId);
                            obj.put("contentUri", trackUri.toString());

                            tracks.put(obj);
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }

            return tracks.toString();
        }

        @JavascriptInterface
        public String readAudioBase64(String contentUriStr) {
            try {
                Uri uri = Uri.parse(contentUriStr);
                try (InputStream is = getContentResolver().openInputStream(uri);
                     ByteArrayOutputStream os = new ByteArrayOutputStream()) {
                    if (is == null) return "";
                    byte[] buffer = new byte[16384];
                    int read;
                    long total = 0;
                    while ((read = is.read(buffer)) != -1) {
                        os.write(buffer, 0, read);
                        total += read;
                        if (total > 35 * 1024 * 1024) break;
                    }
                    return Base64.encodeToString(os.toByteArray(), Base64.NO_WRAP);
                }
            } catch (Exception e) {
                e.printStackTrace();
                return "";
            }
        }

        @JavascriptInterface
        public boolean isNetworkConnected() {
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm == null) return false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    android.net.Network net = cm.getActiveNetwork();
                    if (net == null) return false;
                    NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                    return caps != null && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
                } else {
                    NetworkInfo ni = cm.getActiveNetworkInfo();
                    return ni != null && ni.isConnected();
                }
            } catch (Exception e) {
                return true;
            }
        }

        // Bridge methods to sync with native Android AudioEffect system
        @JavascriptInterface
        public void syncNativeEQBand(int bandIndex, float gainDb) {
            short mB = (short) Math.round(gainDb * 100.0f);
            PioneerAudioEffectManager.getInstance().setBandLevel((short) bandIndex, mB);
        }

        @JavascriptInterface
        public void syncNativeBass(float gainDb) {
            short strength = (short) Math.min(1000, Math.round((gainDb / 14.0f) * 1000.0f));
            PioneerAudioEffectManager.getInstance().setBassStrength(strength);
        }

        @JavascriptInterface
        public void syncNativeReverb(String mode) {
            short preset = PresetReverb.PRESET_NONE;
            if ("hall".equalsIgnoreCase(mode)) preset = PresetReverb.PRESET_LARGEHALL;
            else if ("room".equalsIgnoreCase(mode)) preset = PresetReverb.PRESET_LARGEROOM;
            else if ("studio".equalsIgnoreCase(mode)) preset = PresetReverb.PRESET_MEDIUMROOM;
            else if ("arena".equalsIgnoreCase(mode)) preset = PresetReverb.PRESET_PLATE;
            PioneerAudioEffectManager.getInstance().setPresetReverb(preset);
        }

        // Direct online audio buffer downloader for raw PCM decoding via decodeAudioData
        @JavascriptInterface
        public String fetchOnlineAudioBase64(String targetUrlStr) {
            try {
                if (targetUrlStr == null || targetUrlStr.isEmpty()) return "";
                URL targetUrl = new URL(targetUrlStr);
                HttpURLConnection conn = (HttpURLConnection) targetUrl.openConnection();
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(20000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; PioneerDSP/4.1)");
                int code = conn.getResponseCode();
                if (code == HttpURLConnection.HTTP_MOVED_PERM || code == HttpURLConnection.HTTP_MOVED_TEMP || code == 307 || code == 308) {
                    String loc = conn.getHeaderField("Location");
                    if (loc != null) {
                        targetUrl = new URL(loc);
                        conn = (HttpURLConnection) targetUrl.openConnection();
                        conn.setConnectTimeout(10000);
                        conn.setReadTimeout(20000);
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; PioneerDSP/4.1)");
                        code = conn.getResponseCode();
                    }
                }
                if (code == 200 || code == 206) {
                    InputStream is = conn.getInputStream();
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] data = new byte[16384];
                    int nRead;
                    while ((nRead = is.read(data, 0, data.length)) != -1) {
                        buffer.write(data, 0, nRead);
                    }
                    buffer.flush();
                    return Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return "";
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);

        settings.setUserAgentString("Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new PioneerBridge(), "PioneerBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrlRouting(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrlRouting(view, request.getUrl().toString());
            }

            private boolean handleUrlRouting(WebView view, String url) {
                if (url == null) return false;

                if (url.startsWith("pioneerdsp://") || url.startsWith("pioneerdsp:")) {
                    dispatchAuthCallback(url);
                    return true;
                }

                if (url.startsWith("file:///android_asset/")) {
                    return false;
                }

                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {}
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url != null) {
                    boolean isContentScheme = "content".equals(url.getScheme());
                    boolean isLocalMediaProxy = "pioneer.local".equals(url.getHost()) && "/media".equals(url.getPath());
                    boolean isOnlineStreamProxy = "pioneer.local".equals(url.getHost()) && "/stream".equals(url.getPath());

                    // --- Real-Time Online Stream Proxy (Bypasses CORS & Guarantees Non-Muted WebAudio DSP Pipeline) ---
                    if (isOnlineStreamProxy) {
                        try {
                            String targetUrlStr = url.getQueryParameter("url");
                            if (targetUrlStr != null && !targetUrlStr.isEmpty()) {
                                URL targetUrl = new URL(targetUrlStr);
                                HttpURLConnection conn = (HttpURLConnection) targetUrl.openConnection();
                                conn.setConnectTimeout(10000);
                                conn.setReadTimeout(15000);
                                conn.setInstanceFollowRedirects(true);
                                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; PioneerDSP/4.1)");

                                Map<String, String> reqHeaders = request.getRequestHeaders();
                                if (reqHeaders != null && reqHeaders.containsKey("Range")) {
                                    conn.setRequestProperty("Range", reqHeaders.get("Range"));
                                }

                                int responseCode = conn.getResponseCode();
                                if (responseCode == HttpURLConnection.HTTP_MOVED_PERM || 
                                    responseCode == HttpURLConnection.HTTP_MOVED_TEMP || 
                                    responseCode == 307 || responseCode == 308) {
                                    String loc = conn.getHeaderField("Location");
                                    if (loc != null) {
                                        targetUrl = new URL(loc);
                                        conn = (HttpURLConnection) targetUrl.openConnection();
                                        conn.setConnectTimeout(10000);
                                        conn.setReadTimeout(15000);
                                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; PioneerDSP/4.1)");
                                        if (reqHeaders != null && reqHeaders.containsKey("Range")) {
                                            conn.setRequestProperty("Range", reqHeaders.get("Range"));
                                        }
                                        responseCode = conn.getResponseCode();
                                    }
                                }

                                InputStream is = conn.getInputStream();
                                String mime = conn.getContentType();
                                if (mime == null || mime.isEmpty() || mime.contains("text/html")) mime = "audio/mpeg";
                                if (mime.contains(";")) mime = mime.split(";")[0].trim();

                                Map<String, String> headers = new HashMap<>();
                                headers.put("Access-Control-Allow-Origin", "*");
                                headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                                headers.put("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
                                headers.put("Accept-Ranges", "bytes");

                                String contentLen = conn.getHeaderField("Content-Length");
                                if (contentLen != null) headers.put("Content-Length", contentLen);

                                String contentRange = conn.getHeaderField("Content-Range");
                                if (contentRange != null) headers.put("Content-Range", contentRange);

                                int status = (responseCode == 206) ? 206 : 200;
                                String message = (responseCode == 206) ? "Partial Content" : "OK";

                                return new WebResourceResponse(mime, "UTF-8", status, message, headers, is);
                            }
                        } catch (Exception e) {
                            android.util.Log.e("PioneerStreamProxy", "Streaming proxy error: " + e.getMessage());
                        }
                    }

                    if (isContentScheme || isLocalMediaProxy) {
                        try {
                            Uri targetUri = isContentScheme ? url : Uri.parse(url.getQueryParameter("uri"));
                            InputStream is = getContentResolver().openInputStream(targetUri);
                            if (is != null) {
                                String mime = getContentResolver().getType(targetUri);
                                if (mime == null || mime.isEmpty()) mime = "audio/mpeg";
                                Map<String, String> headers = new HashMap<>();
                                headers.put("Access-Control-Allow-Origin", "*");
                                headers.put("Accept-Ranges", "bytes");
                                return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, is);
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                isPageLoaded = true;
                if (pendingAuthUrl != null) {
                    dispatchAuthCallback(pendingAuthUrl);
                    pendingAuthUrl = null;
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQ);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        handleIntent(getIntent());
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null) {
            // Check for Spotify Equalizer Panel Action
            if (AudioEffect.ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL.equals(intent.getAction())) {
                int sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);
                String pkg = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME);
                if (sessionId > 0) {
                    PioneerAudioEffectManager.getInstance().attachAudioSession(sessionId, pkg != null ? pkg : "com.spotify.music");
                }
            }

            // Check for Spotify OAuth deep link callback
            if (intent.getData() != null) {
                Uri data = intent.getData();
                if ("pioneerdsp".equalsIgnoreCase(data.getScheme())) {
                    String fullUrl = data.toString();
                    if (isPageLoaded) {
                        dispatchAuthCallback(fullUrl);
                    } else {
                        pendingAuthUrl = fullUrl;
                    }
                }
            }
        }
    }

    private void dispatchAuthCallback(String url) {
        if (url == null || webView == null) return;
        final String safeUrl = url.replace("\\", "\\\\").replace("'", "\\'");
        final String js = "(function() {" +
                "  var u = '" + safeUrl + "';" +
                "  if (window.spotifyAuthCallback) {" +
                "    window.spotifyAuthCallback(u);" +
                "  } else {" +
                "    window.__pendingSpotifyCallbackUrl = u;" +
                "  }" +
                "})();";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == STORAGE_PERM_REQ) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            webView.post(() -> webView.evaluateJavascript("if (window.onMediaPermissionResult) window.onMediaPermissionResult(" + granted + ");", null));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQ) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
