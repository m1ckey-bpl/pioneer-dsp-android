// Pioneer DSP - Official Spotify Web API & OAuth PKCE Integration Service
class SpotifyPKCEService {
  constructor() {
    this.storageKey = 'pioneer_spotify_auth';
    this.configKey = 'pioneer_spotify_config';
    
    // Default Configuration
    const savedConfig = this.loadConfig();
    this.clientId = savedConfig.clientId || 'YOUR_SPOTIFY_CLIENT_ID';
    this.redirectUri = savedConfig.redirectUri || 'pioneerdsp://callback';
    this.scope = [
      'user-read-private',
      'user-read-email',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read',
      'user-read-playback-position'
    ].join(' ');

    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.userProfile = null;
    this.devices = [];
    this.activeDeviceId = null;

    this.restoreSession();
  }

  // Load / Save Developer Configuration
  loadConfig() {
    try {
      const data = localStorage.getItem(this.configKey);
      if (!data) return {};
      return JSON.parse(data);
    } catch(e) {
      return {};
    }
  }

  saveConfig(clientId, redirectUri) {
    this.clientId = (clientId || '').trim();
    if (redirectUri && redirectUri.trim()) {
      this.redirectUri = redirectUri.trim();
    }
    localStorage.setItem(this.configKey, JSON.stringify({
      clientId: this.clientId,
      redirectUri: this.redirectUri
    }));
  }

  // Session Restoration & Safe Token Persistence (Defensive against raw string tokens)
  restoreSession() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;

      let data = null;
      try {
        data = JSON.parse(raw);
      } catch(err) {
        // If raw was accidentally stored as an unquoted token string (e.g. "CKDPLRNDbL...")
        if (typeof raw === 'string' && raw.length > 20) {
          this.accessToken = raw;
          this.expiresAt = Date.now() + 3600000;
          return;
        }
      }

      if (data && typeof data === 'object') {
        this.accessToken = data.accessToken || null;
        this.refreshToken = data.refreshToken || null;
        this.expiresAt = data.expiresAt || 0;
        this.userProfile = data.userProfile || null;
      }
    } catch(e) {
      console.warn('Notice while restoring Spotify session:', e);
    }
  }

  saveSession() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt,
        userProfile: this.userProfile
      }));
    } catch(e) {
      console.warn('Failed to save Spotify session:', e);
    }
  }

  clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.userProfile = null;
    this.devices = [];
    this.activeDeviceId = null;
    localStorage.removeItem(this.storageKey);
  }

  isAuthenticated() {
    return !!(this.accessToken && Date.now() < this.expiresAt);
  }

  hasRefreshToken() {
    return !!this.refreshToken;
  }

  // PKCE Cryptographic Utilities
  generateRandomString(length = 64) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      text += possible[values[i] % possible.length];
    }
    return text;
  }

  async sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  }

  base64urlencode(a) {
    let str = '';
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Step 1: Initiate Spotify Authorization Code with PKCE
  async generateAuthUrl() {
    if (!this.clientId || this.clientId === 'YOUR_SPOTIFY_CLIENT_ID') {
      throw new Error('CONFIG_REQUIRED: Please enter your Spotify Client ID in Settings first.');
    }

    const codeVerifier = this.generateRandomString(64);
    const hashed = await this.sha256(codeVerifier);
    const codeChallenge = this.base64urlencode(hashed);
    const state = this.generateRandomString(16);

    // Persist code verifier and state for validation upon callback
    localStorage.setItem('spotify_pkce_verifier', codeVerifier);
    localStorage.setItem('spotify_pkce_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: this.scope,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: this.redirectUri,
      state: state
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  // Step 2: Handle OAuth Callback and Exchange Code for Access Token
  async handleAuthCallback(callbackUrl) {
    try {
      if (!callbackUrl) {
        throw new Error('Callback URL is empty.');
      }

      let code = null;
      let error = null;
      let state = null;

      // Tier 1: Standard URL parser
      try {
        const urlObj = new URL(callbackUrl);
        code = urlObj.searchParams.get('code');
        error = urlObj.searchParams.get('error');
        state = urlObj.searchParams.get('state');
      } catch(e) {}

      // Tier 2: Query string parser for custom scheme URIs
      if (!code && !error) {
        let queryString = '';
        const qIndex = callbackUrl.indexOf('?');
        if (qIndex !== -1) {
          queryString = callbackUrl.substring(qIndex + 1);
          const hashIndex = queryString.indexOf('#');
          if (hashIndex !== -1) queryString = queryString.substring(0, hashIndex);
        } else {
          const hashIndex = callbackUrl.indexOf('#');
          if (hashIndex !== -1) queryString = callbackUrl.substring(hashIndex + 1);
        }

        if (queryString) {
          const params = new URLSearchParams(queryString);
          code = code || params.get('code');
          error = error || params.get('error');
          state = state || params.get('state');
        }
      }

      // Tier 3: Regex fallbacks
      if (!code) {
        const matchCode = callbackUrl.match(/[?&#]code=([^&#]+)/);
        if (matchCode) code = decodeURIComponent(matchCode[1]);
      }
      if (!error) {
        const matchErr = callbackUrl.match(/[?&#]error=([^&#]+)/);
        if (matchErr) error = decodeURIComponent(matchErr[1]);
      }
      if (!state) {
        const matchState = callbackUrl.match(/[?&#]state=([^&#]+)/);
        if (matchState) state = decodeURIComponent(matchState[1]);
      }

      if (error) {
        if (error === 'access_denied') {
          throw new Error('Spotify authorization was cancelled or denied by user.');
        }
        throw new Error(`Spotify Authorization Error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code found in callback URL.');
      }

      const savedState = localStorage.getItem('spotify_pkce_state');
      if (savedState && state && state !== savedState) {
        console.warn('OAuth state mismatch detected; proceeding with PKCE verification.');
      }

      const codeVerifier = localStorage.getItem('spotify_pkce_verifier');
      if (!codeVerifier) {
        throw new Error('PKCE Code Verifier not found in storage. Please tap Connect again.');
      }

      // Exchange code for token via official Spotify endpoint
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier
        })
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch(e) {
        throw new Error(`Token exchange returned non-JSON: ${responseText.substring(0, 150)}`);
      }

      if (!response.ok || data.error) {
        const errorDetail = data.error_description || data.error || 'Token exchange failed';
        throw new Error(`Token Exchange Failed: ${errorDetail}`);
      }

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || this.refreshToken;
      this.expiresAt = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

      // Cleanup PKCE temp keys
      localStorage.removeItem('spotify_pkce_verifier');
      localStorage.removeItem('spotify_pkce_state');

      // Fetch user profile and available playback devices
      await this.fetchUserProfile();
      await this.getAvailableDevices();
      this.saveSession();

      return { success: true, profile: this.userProfile };
    } catch(err) {
      console.error('Spotify Auth Callback Error:', err);
      throw err;
    }
  }

  // Token Refresh
  async refreshAccessToken() {
    if (!this.refreshToken) {
      this.clearSession();
      throw new Error('No refresh token available. Re-authorization required.');
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        })
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch(e) {
        this.clearSession();
        throw new Error('Token refresh response was not valid JSON.');
      }

      if (!response.ok || data.error) {
        this.clearSession();
        throw new Error(data.error_description || 'Token refresh failed.');
      }

      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      this.expiresAt = Date.now() + (data.expires_in * 1000) - 60000;
      this.saveSession();
      return this.accessToken;
    } catch(e) {
      this.clearSession();
      throw e;
    }
  }

  // Authorized API Request Wrapper with Safe Non-JSON / HTTP Error / Rate Limit Handling
  async apiRequest(endpoint, method = 'GET', body = null) {
    if (!this.accessToken) {
      throw new Error('NOT_AUTHENTICATED: Please connect your Spotify account.');
    }

    if (Date.now() >= this.expiresAt) {
      await this.refreshAccessToken();
    }

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    let response = await fetch(`https://api.spotify.com/v1${endpoint}`, options);

    if (response.status === 401) {
      // Token expired mid-flight; attempt refresh once
      await this.refreshAccessToken();
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      response = await fetch(`https://api.spotify.com/v1${endpoint}`, { method, headers, body: options.body });
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '2';
      throw new Error(`Spotify Rate Limit: Please wait ${retryAfter} seconds.`);
    }

    // HTTP 204 No Content: Typical for successful playback commands (play, pause, seek, volume)
    if (response.status === 204) {
      return null;
    }

    const responseText = await response.text();
    let data = null;
    if (responseText && responseText.trim().length > 0) {
      try {
        data = JSON.parse(responseText);
      } catch(parseErr) {
        // Plain text response
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 150)}`);
        }
        return responseText;
      }
    }

    if (!response.ok) {
      let message = `HTTP ${response.status} Error`;
      if (data && data.error) {
        if (typeof data.error === 'string') {
          message = data.error;
        } else if (data.error.message) {
          message = data.error.message;
        }
      }

      // Map common Spotify Web API error conditions to actionable advice
      if (response.status === 404 && message.toLowerCase().includes('device')) {
        message = 'Player command failed: No active device found. Launch Spotify on your phone, PC, or speaker, or select a device below.';
      } else if (response.status === 403) {
        message = 'Spotify restriction: Spotify Premium is required for remote playback control, or action forbidden on this track.';
      }

      throw new Error(message);
    }

    return data;
  }

  // Official Web API Endpoints: User Profile
  async fetchUserProfile() {
    const profile = await this.apiRequest('/me');
    let followersCount = 0;
    if (profile && profile.followers && typeof profile.followers.total === 'number') {
      followersCount = profile.followers.total;
    }
    this.userProfile = {
      id: profile ? profile.id : 'unknown',
      displayName: (profile && (profile.display_name || profile.id)) ? (profile.display_name || profile.id) : 'Spotify User',
      email: profile ? (profile.email || '') : '',
      images: profile ? (profile.images || []) : [],
      product: profile ? (profile.product || 'free') : 'free',
      country: profile ? (profile.country || '') : '',
      followers: followersCount
    };
    this.saveSession();
    return this.userProfile;
  }

  // Official Web API Endpoints: Devices Management
  async getAvailableDevices() {
    try {
      const data = await this.apiRequest('/me/player/devices');
      this.devices = (data && data.devices) ? data.devices : [];
      const activeDev = this.devices.find(d => d.is_active);
      if (activeDev) {
        this.activeDeviceId = activeDev.id;
      } else if (this.devices.length > 0 && !this.activeDeviceId) {
        this.activeDeviceId = this.devices[0].id;
      }
      return this.devices;
    } catch(e) {
      console.warn('Failed to fetch Spotify devices:', e);
      return this.devices || [];
    }
  }

  async transferPlayback(deviceId, play = false) {
    if (!deviceId) throw new Error('Target device ID is required.');
    this.activeDeviceId = deviceId;
    return await this.apiRequest('/me/player', 'PUT', {
      device_ids: [deviceId],
      play: play
    });
  }

  // Playlists & Tracks
  async getUserPlaylists(limit = 30) {
    const data = await this.apiRequest(`/me/playlists?limit=${limit}`);
    return (data && data.items) ? data.items : [];
  }

  async getPlaylistTracks(playlistId, limit = 50) {
    const data = await this.apiRequest(`/playlists/${playlistId}/tracks?limit=${limit}`);
    return (data && data.items) ? data.items : [];
  }

  // Spotify Search API
  async search(query, types = 'track,artist,album,playlist') {
    if (!query || !query.trim()) return { tracks: [], artists: [], albums: [], playlists: [] };
    const q = encodeURIComponent(query.trim());
    const data = await this.apiRequest(`/search?q=${q}&type=${types}&limit=20`);
    return {
      tracks: (data && data.tracks && data.tracks.items) ? data.tracks.items : [],
      artists: (data && data.artists && data.artists.items) ? data.artists.items : [],
      albums: (data && data.albums && data.albums.items) ? data.albums.items : [],
      playlists: (data && data.playlists && data.playlists.items) ? data.playlists.items : []
    };
  }

  // Playback Control & State
  async getPlaybackState() {
    const state = await this.apiRequest('/me/player');
    if (state && state.device) {
      this.activeDeviceId = state.device.id;
    }
    return state;
  }

  async play(contextUri = null, uris = null, deviceId = null) {
    // If deviceId wasn't passed, check active or auto-detect
    let targetDevice = deviceId || this.activeDeviceId;
    if (!targetDevice) {
      const devs = await this.getAvailableDevices();
      if (devs && devs.length > 0) {
        targetDevice = devs[0].id;
        this.activeDeviceId = targetDevice;
      }
    }

    const query = targetDevice ? `?device_id=${encodeURIComponent(targetDevice)}` : '';
    const body = {};
    if (contextUri) body.context_uri = contextUri;
    if (uris) body.uris = uris;

    return await this.apiRequest(`/me/player/play${query}`, 'PUT', Object.keys(body).length > 0 ? body : null);
  }

  async pause() {
    return await this.apiRequest('/me/player/pause', 'PUT');
  }

  async next() {
    return await this.apiRequest('/me/player/next', 'POST');
  }

  async previous() {
    return await this.apiRequest('/me/player/previous', 'POST');
  }

  async setVolume(volumePercent) {
    const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
    return await this.apiRequest(`/me/player/volume?volume_percent=${vol}`, 'PUT');
  }

  async seek(positionMs) {
    return await this.apiRequest(`/me/player/seek?position_ms=${Math.round(positionMs)}`, 'PUT');
  }

  async setShuffle(state = true) {
    return await this.apiRequest(`/me/player/shuffle?state=${!!state}`, 'PUT');
  }

  async setRepeat(state = 'context') {
    // 'track', 'context', or 'off'
    return await this.apiRequest(`/me/player/repeat?state=${state}`, 'PUT');
  }

  logout() {
    this.clearSession();
  }
}

window.spotifyService = new SpotifyPKCEService();
