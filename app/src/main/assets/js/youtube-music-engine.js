/**
 * Pioneer DSP - Music Playback Engine
 * Powered by YouTube Data API v3, HTML5 Audio API, LRCLIB API & Media Session API
 * 
 * Provides:
 * 1. Music Search & Metadata via YouTube Data API v3 with automatic public gateway fallbacks.
 * 2. Authorized audio-streaming stream resolution.
 * 3. LRCLIB synchronized lyrics fetching and timing parser.
 * 4. W3C Media Session API lock-screen & notification shade integration.
 */

class YouTubeMusicEngine {
  constructor() {
    this.storageKeyApiKey = 'pioneer_yt_api_key';
    this.apiKey = localStorage.getItem(this.storageKeyApiKey) || '';
    
    // Public Fallback Gateways for Search & Stream Resolution
    this.pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.private.coffee',
      'https://pipedapi.leptons.xyz'
    ];
    this.invidiousInstances = [
      'https://invidious.nerdvpn.de',
      'https://inv.tux.pizza',
      'https://vid.puffyan.us'
    ];
    
    // Lyrics cache
    this.lyricsCache = new Map();
    this.activeLyrics = null;
  }

  getApiKey() {
    return this.apiKey;
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.apiKey) {
      localStorage.setItem(this.storageKeyApiKey, this.apiKey);
    } else {
      localStorage.removeItem(this.storageKeyApiKey);
    }
  }

  // --- YouTube Search & Metadata ---
  async search(query) {
    const q = (query || '').trim();
    if (!q) return [];

    // Option A: If custom YouTube Data API v3 key is configured, use official API
    if (this.apiKey) {
      try {
        const results = await this.searchViaYouTubeDataApi(q);
        if (results && results.length > 0) return results;
      } catch (err) {
        console.warn('YouTube Data API search failed, falling back to public music gateways:', err);
      }
    }

    // Option B: Public Gateways Fallback (Works out-of-the-box without key)
    return await this.searchViaPublicGateways(q);
  }

  async searchViaYouTubeDataApi(query) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=25&q=${encodeURIComponent(query)}&key=${encodeURIComponent(this.apiKey)}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      throw new Error(`YouTube API HTTP ${resp.status}: ${JSON.stringify(errJson)}`);
    }
    const data = await resp.json();
    if (!data.items) return [];

    return data.items.map(item => {
      const id = typeof item.id === 'object' ? item.id.videoId : item.id;
      const snippet = item.snippet || {};
      const thumbs = snippet.thumbnails || {};
      const artwork = (thumbs.high && thumbs.high.url) ||
                      (thumbs.medium && thumbs.medium.url) ||
                      (thumbs.default && thumbs.default.url) ||
                      'assets/logo.png';
      
      // Clean artist / title heuristic
      let title = snippet.title || 'Unknown Title';
      // Decode HTML entities
      title = this.decodeHtmlEntities(title);
      let artist = snippet.channelTitle || 'YouTube Music';
      artist = this.decodeHtmlEntities(artist);

      return {
        id: id,
        videoId: id,
        title: title,
        artist: artist,
        album: 'YouTube Music Stream',
        artwork: artwork,
        source: 'youtube',
        duration: 0 // Duration will be populated upon stream resolution
      };
    });
  }

  async searchViaPublicGateways(query) {
    // Try Piped Search
    for (const base of this.pipedInstances) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const url = `${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) {
          const data = await resp.json();
          const items = data.items || data;
          if (Array.isArray(items) && items.length > 0) {
            return items.filter(it => it.type === 'stream' || it.url).map(it => {
              const videoId = (it.url || '').replace('/watch?v=', '').replace('/', '');
              return {
                id: videoId || it.id,
                videoId: videoId || it.id,
                title: this.decodeHtmlEntities(it.title || 'Unknown'),
                artist: this.decodeHtmlEntities(it.uploaderName || it.artist || 'YouTube Music'),
                album: 'YouTube Music Stream',
                artwork: it.thumbnail || 'assets/logo.png',
                source: 'youtube',
                duration: it.duration || 0
              };
            });
          }
        }
      } catch (e) {}
    }

    // Try Invidious Search
    for (const base of this.invidiousInstances) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const url = `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) {
          const items = await resp.json();
          if (Array.isArray(items) && items.length > 0) {
            return items.map(it => {
              const thumbs = it.videoThumbnails || [];
              const artwork = (thumbs[0] && thumbs[0].url) || 'assets/logo.png';
              return {
                id: it.videoId,
                videoId: it.videoId,
                title: this.decodeHtmlEntities(it.title || 'Unknown'),
                artist: this.decodeHtmlEntities(it.author || 'YouTube Music'),
                album: 'YouTube Music Stream',
                artwork: artwork,
                source: 'youtube',
                duration: it.lengthSeconds || 0
              };
            });
          }
        }
      } catch (e) {}
    }

    return [];
  }

  // --- Audio Stream Resolver ---
  async resolveAudioStream(videoId) {
    if (!videoId) throw new Error('Missing videoId');

    // 1. Try Piped Streams API
    for (const base of this.pipedInstances) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4500);
        const url = `${base}/streams/${videoId}`;
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) {
          const data = await resp.json();
          const audioStreams = data.audioStreams || [];
          if (audioStreams.length > 0) {
            // Sort by bitrate descending to get pristine audio fidelity
            audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const best = audioStreams[0];
            return {
              streamUrl: best.url,
              mimeType: best.mimeType || 'audio/mp4',
              bitrate: best.bitrate,
              title: data.title,
              artist: data.uploader,
              duration: data.duration,
              artwork: data.thumbnailUrl
            };
          }
        }
      } catch (e) {}
    }

    // 2. Try Invidious Streams API
    for (const base of this.invidiousInstances) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4500);
        const url = `${base}/api/v1/videos/${videoId}`;
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) {
          const data = await resp.json();
          const adaptive = data.adaptiveFormats || [];
          const audioFormats = adaptive.filter(f => (f.type || '').startsWith('audio/'));
          if (audioFormats.length > 0) {
            audioFormats.sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
            const best = audioFormats[0];
            return {
              streamUrl: best.url,
              mimeType: best.type,
              bitrate: best.bitrate,
              title: data.title,
              artist: data.author,
              duration: data.lengthSeconds,
              artwork: (data.videoThumbnails && data.videoThumbnails[0]) ? data.videoThumbnails[0].url : null
            };
          }
        }
      } catch (e) {}
    }

    throw new Error('Unable to resolve direct audio stream from authorized gateways.');
  }

  // --- LRCLIB API Lyrics Integration ---
  async fetchLyrics(title, artist, duration) {
    if (!title) return null;

    const cacheKey = `${(title || '').toLowerCase()}|${(artist || '').toLowerCase()}`;
    if (this.lyricsCache.has(cacheKey)) {
      return this.lyricsCache.get(cacheKey);
    }

    // Heuristically clean title and artist for LRCLIB search
    const cleanTitle = this.cleanTrackTitle(title);
    const cleanArtist = this.cleanArtistName(artist);

    // 1. Precise lookup via /api/get
    try {
      let getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      if (duration && duration > 0) {
        getUrl += `&duration=${Math.round(duration)}`;
      }
      const resp = await fetch(getUrl, {
        headers: { 'User-Agent': 'PioneerDSP/4.1 (https://github.com/m1ckey-bpl/pioneer-dsp-android)' }
      });
      if (resp.ok) {
        const data = await resp.json();
        const processed = this.processLyricsData(data);
        this.lyricsCache.set(cacheKey, processed);
        this.activeLyrics = processed;
        return processed;
      }
    } catch (e) {}

    // 2. Fuzzy search via /api/search
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + cleanArtist)}`;
      const resp = await fetch(searchUrl, {
        headers: { 'User-Agent': 'PioneerDSP/4.1 (https://github.com/m1ckey-bpl/pioneer-dsp-android)' }
      });
      if (resp.ok) {
        const list = await resp.json();
        if (Array.isArray(list) && list.length > 0) {
          // Prefer items that have syncedLyrics
          list.sort((a, b) => {
            if (a.syncedLyrics && !b.syncedLyrics) return -1;
            if (!a.syncedLyrics && b.syncedLyrics) return 1;
            return 0;
          });
          const processed = this.processLyricsData(list[0]);
          this.lyricsCache.set(cacheKey, processed);
          this.activeLyrics = processed;
          return processed;
        }
      }
    } catch (e) {}

    const emptyResult = {
      plainLyrics: 'No lyrics available for this track.',
      syncedLyrics: null,
      parsedSynced: [],
      instrumental: false
    };
    this.lyricsCache.set(cacheKey, emptyResult);
    this.activeLyrics = emptyResult;
    return emptyResult;
  }

  processLyricsData(data) {
    if (!data) return null;
    const isInstrumental = !!data.instrumental;
    const plainLyrics = isInstrumental ? 'Instrumental Track' : (data.plainLyrics || '');
    const syncedLyrics = isInstrumental ? null : (data.syncedLyrics || null);
    const parsedSynced = syncedLyrics ? this.parseLrc(syncedLyrics) : [];

    return {
      id: data.id,
      title: data.trackName,
      artist: data.artistName,
      album: data.albumName,
      instrumental: isInstrumental,
      plainLyrics: plainLyrics,
      syncedLyrics: syncedLyrics,
      parsedSynced: parsedSynced
    };
  }

  // Parse LRC formatted string: [mm:ss.xx] Lyric text
  parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split(/\r?\n/);
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let match;
      const times = [];
      while ((match = timeReg.exec(trimmed)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseFloat(match[2]);
        times.push(min * 60 + sec);
      }

      const text = trimmed.replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
      for (const t of times) {
        result.push({ time: t, text: text });
      }
    }

    result.sort((a, b) => a.time - b.time);
    return result;
  }

  cleanTrackTitle(title) {
    if (!title) return '';
    return title
      .replace(/\s*[\(\[](?:Official\s*(?:Music\s*)?(?:Video|Audio|Lyric|HD|4K|Visualizer)?|Audio|Video|Lyrics?|Remastered|Explicit)[\)\]]/gi, '')
      .replace(/\s*ft\.?.*$/i, '')
      .replace(/\s*feat\.?.*$/i, '')
      .trim();
  }

  cleanArtistName(artist) {
    if (!artist) return '';
    return artist
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .trim();
  }

  decodeHtmlEntities(str) {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }
}

// Instantiate globally
window.youtubeMusicEngine = new YouTubeMusicEngine();
