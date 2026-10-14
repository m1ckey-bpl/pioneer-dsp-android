// Pioneer DSP - Sound Tune Audio Processing Engine & Persistent Local Storage
// Master Redesign Edition v4.0.0
// Real-Time 32-bit Floating Point Audio Processing & Hardware-Accelerated Acoustics

class PioneerAudioDB {
  constructor() {
    this.dbName = 'PioneerDSP_Storage_v4';
    this.version = 1;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('songs')) {
          db.createObjectStore('songs', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        reject(e);
      };
    });
  }

  async saveSong(song) {
    try {
      const db = await this.open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readwrite');
        const store = tx.objectStore('songs');
        const req = store.put(song);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e);
      });
      this.syncMetadataCache();
      return true;
    } catch(e) {
      console.warn('DB saveSong warning:', e);
      return false;
    }
  }

  async getAllSongs() {
    try {
      const db = await this.open();
      const songs = await new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readonly');
        const store = tx.objectStore('songs');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e);
      });

      if (songs && songs.length > 0) {
        return songs;
      }
      return this.getMetadataCache();
    } catch(e) {
      console.warn('DB getAllSongs error, falling back to cache:', e);
      return this.getMetadataCache();
    }
  }

  async deleteSong(id) {
    try {
      const db = await this.open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readwrite');
        const store = tx.objectStore('songs');
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e);
      });
      this.syncMetadataCache();
      return true;
    } catch(e) {
      return false;
    }
  }

  async clearAll() {
    try {
      const db = await this.open();
      const tx = db.transaction('songs', 'readwrite');
      tx.objectStore('songs').clear();
      localStorage.removeItem('pioneer_songs_cache_v4');
    } catch(e) {}
  }

  syncMetadataCache() {
    try {
      if (!window.dspEngine || !window.dspEngine.songs) return;
      const stripped = window.dspEngine.songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration || 0,
        fileSize: s.fileSize || '',
        contentUri: s.contentUri || '',
        albumId: s.albumId || 0,
        addedAt: s.addedAt || Date.now()
      }));
      localStorage.setItem('pioneer_songs_cache_v4', JSON.stringify(stripped));
    } catch(e) {}
  }

  getMetadataCache() {
    try {
      const raw = localStorage.getItem('pioneer_songs_cache_v4');
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  }
}

class PioneerDSPEngine {
  constructor() {
    this.audioCtx = null;
    this.db = new PioneerAudioDB();

    // Playback State
    this.sourceType = 'none'; // 'local', 'stream', 'none'
    this.sourceNode = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.pauseOffset = 0;
    this.startTime = 0;
    this.duration = 0;
    this.playbackRate = 1.0;
    this.isRepeat = 'off'; // 'off', 'all', 'one'
    this.isShuffle = false;

    // HTML5 Audio Streaming Element (Routed into WebAudio 32-bit DSP pipeline)
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';
    this.mediaElementSource = null;
    this.streamQueue = [];
    this.streamIndex = -1;

    // Track Library
    this.songs = [];
    this.currentIndex = -1;
    this.currentBuffer = null;
    this.activeTrack = null;

    // DSP Tuning State & Parameters
    this.preampGain = 0; // -12 to +12 dB
    this.superBassGain = 0; // 0 to 14 dB (Todoroki 63Hz punch)
    this.deepBassGain = 0; // 0 to 12 dB (Sub-Bass 31Hz depth)
    this.midGain = 0; // -10 to +10 dB (1.5kHz)
    this.trebleGain = 0; // -10 to +10 dB (10kHz air)
    this.volume = 1.0; // 0.0 to 1.0 master volume

    this.ambienceMode = 'hall'; // 'hall', 'room', 'studio', 'arena'
    this.reverbMix = 0; // 0 to 100%
    this.balance = 0; // -1.0 to +1.0
    this.cabinPosition = 'all'; // 'all', 'fl', 'fr'

    // 10-Band Graphic EQ Frequencies (ISO Standard Bands)
    this.eqFreqs = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.eqFilters = [];
    this.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Audio Graph Nodes
    this.preampNode = null;
    this.superBassShelf = null;
    this.superBassPeak = null;
    this.deepBassFilter = null;
    this.midFilter = null;
    this.trebleFilter = null;
    this.convolverNode = null;
    this.dryGain = null;
    this.wetGain = null;
    this.reverbSum = null;
    this.pannerNode = null;
    this.cabinDelayL = null;
    this.cabinDelayR = null;
    this.masterVolumeNode = null;
    this.limiterNode = null;
    this.analyser = null;

    // Visualizer Spectrum Buffer
    this.spectrumBuffer = new Uint8Array(64);

    // Impulse Cache
    this.impulseBuffers = {};
  }

  // Initialize Web Audio Processing Pipeline
  async initAudioContext() {
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass({ latencyHint: 'playback' });

    // 1. Preamp Gain Node (-12dB to +12dB)
    this.preampNode = this.audioCtx.createGain();
    this.preampNode.gain.value = this.dbToLinear(this.preampGain);

    // Connect HTML5 Audio element to Pioneer DSP preamp
    if (this.audioElement && !this.mediaElementSource) {
      try {
        this.mediaElementSource = this.audioCtx.createMediaElementSource(this.audioElement);
        this.mediaElementSource.connect(this.preampNode);
      } catch (err) {
        console.warn('HTML5 Audio MediaElementSource connection notice:', err);
      }
    }

    // 2. 10-Band Graphic Equalizer Peaking Filters
    this.eqFilters = [];
    let prevFilter = this.preampNode;
    this.eqFreqs.forEach((freq, idx) => {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = (freq === 31 || freq === 16000) ? 1.0 : 1.414;
      filter.gain.value = this.eqGains[idx];
      prevFilter.connect(filter);
      this.eqFilters.push(filter);
      prevFilter = filter;
    });

    // 3. Todoroki Super Bass Architecture (Dual Stage: 80Hz Low-Shelf + 60Hz Peak)
    this.superBassShelf = this.audioCtx.createBiquadFilter();
    this.superBassShelf.type = 'lowshelf';
    this.superBassShelf.frequency.value = 80;
    this.superBassShelf.gain.value = this.superBassGain * 0.7;

    this.superBassPeak = this.audioCtx.createBiquadFilter();
    this.superBassPeak.type = 'peaking';
    this.superBassPeak.frequency.value = 60;
    this.superBassPeak.Q.value = 1.6;
    this.superBassPeak.gain.value = this.superBassGain * 0.6;

    prevFilter.connect(this.superBassShelf);
    this.superBassShelf.connect(this.superBassPeak);

    // 4. Deep Sub-Bass Low-Shelf Filter (35Hz foundation)
    this.deepBassFilter = this.audioCtx.createBiquadFilter();
    this.deepBassFilter.type = 'lowshelf';
    this.deepBassFilter.frequency.value = 35;
    this.deepBassFilter.gain.value = this.deepBassGain;
    this.superBassPeak.connect(this.deepBassFilter);

    // 5. Midrange Tone Peaking Filter (1.5kHz vocal presence, Q=1.2)
    this.midFilter = this.audioCtx.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1500;
    this.midFilter.Q.value = 1.2;
    this.midFilter.gain.value = this.midGain;
    this.deepBassFilter.connect(this.midFilter);

    // 6. Treble Tone High-Shelf Filter (10kHz air & clarity)
    this.trebleFilter = this.audioCtx.createBiquadFilter();
    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.frequency.value = 10000;
    this.trebleFilter.gain.value = this.trebleGain;
    this.midFilter.connect(this.trebleFilter);

    // 7. Convolution Reverb Ambience Simulation & Equal-Power Wet/Dry Mixer
    this.convolverNode = this.audioCtx.createConvolver();
    this.convolverNode.normalize = false; // Disable default L2 auto-attenuation so reverb is vividly audible
    this.convolverNode.buffer = await this.getImpulseResponse(this.ambienceMode);

    this.dryGain = this.audioCtx.createGain();
    this.wetGain = this.audioCtx.createGain();
    this.reverbSum = this.audioCtx.createGain();

    this.updateReverbGains();

    this.trebleFilter.connect(this.dryGain);
    this.trebleFilter.connect(this.convolverNode);
    this.convolverNode.connect(this.wetGain);

    this.dryGain.connect(this.reverbSum);
    this.wetGain.connect(this.reverbSum);

    // 8. Car Cabin Time Alignment (Channel Delay Processing)
    const splitter = this.audioCtx.createChannelSplitter(2);
    const merger = this.audioCtx.createChannelMerger(2);
    this.cabinDelayL = this.audioCtx.createDelay(0.05);
    this.cabinDelayR = this.audioCtx.createDelay(0.05);
    this.updateCabinDelays();

    this.reverbSum.connect(splitter);
    splitter.connect(this.cabinDelayL, 0);
    splitter.connect(this.cabinDelayR, 1);
    this.cabinDelayL.connect(merger, 0, 0);
    this.cabinDelayR.connect(merger, 0, 1);

    // 9. Stereo Balance Panner Node (-1.0 Left to +1.0 Right)
    this.pannerNode = this.audioCtx.createStereoPanner();
    this.pannerNode.pan.value = this.balance;
    merger.connect(this.pannerNode);

    // 10. Master Volume Gain Node
    this.masterVolumeNode = this.audioCtx.createGain();
    this.masterVolumeNode.gain.value = this.volume;
    this.pannerNode.connect(this.masterVolumeNode);

    // 11. Transparent Peak Limiter (Clipping & Distortion Protection with Soft Knee)
    this.limiterNode = this.audioCtx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1.0; // -1.0 dBFS ceiling
    this.limiterNode.knee.value = 6.0; // Soft 6dB musical knee
    this.limiterNode.ratio.value = 12.0; // Effective limiting ratio without squashing transients
    this.limiterNode.attack.value = 0.005; // 5ms attack
    this.limiterNode.release.value = 0.18; // 180ms smooth release
    this.masterVolumeNode.connect(this.limiterNode);

    // 12. 60fps Real-time Spectrum Analyser
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.82;
    this.limiterNode.connect(this.analyser);

    // 13. Final Audio Destination (Headphones / Speakers / DAC)
    this.analyser.connect(this.audioCtx.destination);
  }

  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  // Algorithmic Acoustic Impulse Responses (High-Fidelity Studio & Hall Reverberation)
  async getImpulseResponse(mode) {
    if (this.impulseBuffers[mode]) return this.impulseBuffers[mode];
    if (!this.audioCtx) return null;

    const sampleRate = this.audioCtx.sampleRate;
    let duration = 3.2; // Concert Hall
    let decayRate = 2.2;
    let initialGain = 0.65;

    if (mode === 'largeHall' || mode === 'arena') {
      duration = 4.5;
      decayRate = 1.6;
      initialGain = 0.70;
    } else if (mode === 'cathedral') {
      duration = 5.5;
      decayRate = 1.2;
      initialGain = 0.75;
    } else if (mode === 'mediumRoom' || mode === 'studio' || mode === 'room') {
      duration = 1.4;
      decayRate = 4.2;
      initialGain = 0.50;
    } else if (mode === 'plate') {
      duration = 2.0;
      decayRate = 3.0;
      initialGain = 0.60;
    }

    const length = Math.floor(sampleRate * duration);
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * decayRate);
      // Diffuse reflections with stereo decorrelation
      const lNoise = (Math.random() * 2 - 1);
      const rNoise = (Math.random() * 2 - 1);
      const earlyBoost = (i < sampleRate * 0.06) ? 1.5 : 1.0;
      left[i] = lNoise * env * earlyBoost * initialGain;
      right[i] = rNoise * env * earlyBoost * initialGain;
    }

    this.impulseBuffers[mode] = impulse;
    return impulse;
  }

  updateReverbGains() {
    if (!this.dryGain || !this.wetGain || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const ratio = Math.max(0, Math.min(100, this.reverbMix)) / 100.0;
    // Equal-power crossfade curve
    const dry = Math.cos(ratio * 0.5 * Math.PI);
    const wet = Math.sin(ratio * 0.5 * Math.PI) * 1.4;
    this.dryGain.gain.setTargetAtTime(dry, now, 0.03);
    this.wetGain.gain.setTargetAtTime(wet, now, 0.03);
  }

  // Real-time DSP Setters
  setPreamp(db) {
    this.preampGain = parseFloat(db);
    if (this.preampNode && this.audioCtx) {
      this.preampNode.gain.setTargetAtTime(this.dbToLinear(this.preampGain), this.audioCtx.currentTime, 0.02);
    }
  }

  setEQBand(index, gainDB) {
    this.eqGains[index] = parseFloat(gainDB);
    if (this.eqFilters[index] && this.audioCtx) {
      this.eqFilters[index].gain.setTargetAtTime(this.eqGains[index], this.audioCtx.currentTime, 0.02);
    }
    if (window.PioneerBridge && typeof window.PioneerBridge.syncNativeEQ === 'function') {
      window.PioneerBridge.syncNativeEQ(index, this.eqGains[index]);
    }
  }

  setSuperBass(gainDB) {
    this.superBassGain = Math.max(0, Math.min(14, parseFloat(gainDB)));
    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      if (this.superBassShelf) {
        this.superBassShelf.gain.setTargetAtTime(this.superBassGain * 0.7, now, 0.02);
      }
      if (this.superBassPeak) {
        this.superBassPeak.gain.setTargetAtTime(this.superBassGain * 0.6, now, 0.02);
      }
    }
    if (window.PioneerBridge && typeof window.PioneerBridge.syncNativeBass === 'function') {
      window.PioneerBridge.syncNativeBass(this.superBassGain);
    }
  }

  setDeepBass(gainDB) {
    this.deepBassGain = Math.max(0, Math.min(12, parseFloat(gainDB)));
    if (this.deepBassFilter && this.audioCtx) {
      this.deepBassFilter.gain.setTargetAtTime(this.deepBassGain, this.audioCtx.currentTime, 0.02);
    }
  }

  setMid(gainDB) {
    this.midGain = parseFloat(gainDB);
    if (this.midFilter && this.audioCtx) {
      this.midFilter.gain.setTargetAtTime(this.midGain, this.audioCtx.currentTime, 0.02);
    }
  }

  setTreble(gainDB) {
    this.trebleGain = parseFloat(gainDB);
    if (this.trebleFilter && this.audioCtx) {
      this.trebleFilter.gain.setTargetAtTime(this.trebleGain, this.audioCtx.currentTime, 0.02);
    }
  }

  async setAmbienceMode(mode) {
    this.ambienceMode = mode;
    if (this.convolverNode && this.audioCtx) {
      this.convolverNode.buffer = await this.getImpulseResponse(mode);
    }
    if (window.PioneerBridge && typeof window.PioneerBridge.syncNativeReverb === 'function') {
      window.PioneerBridge.syncNativeReverb(mode);
    }
  }

  setReverbMix(percent) {
    this.reverbMix = parseFloat(percent);
    this.updateReverbGains();
  }

  setBalance(val) {
    this.balance = Math.max(-1, Math.min(1, parseFloat(val)));
    if (this.pannerNode && this.audioCtx) {
      this.pannerNode.pan.setTargetAtTime(this.balance, this.audioCtx.currentTime, 0.02);
    }
  }

  setMasterVolume(val) {
    this.volume = Math.max(0, Math.min(1.0, parseFloat(val)));
    if (this.masterVolumeNode && this.audioCtx) {
      this.masterVolumeNode.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.02);
    }
  }

  setCabinPosition(pos) {
    this.cabinPosition = pos;
    this.updateCabinDelays();
  }

  updateCabinDelays() {
    if (!this.cabinDelayL || !this.cabinDelayR || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (this.cabinPosition === 'fl') {
      // Driver focus: delay left speaker slightly (0.9ms) to align acoustic arrival
      this.cabinDelayL.delayTime.setTargetAtTime(0.0009, now, 0.03);
      this.cabinDelayR.delayTime.setTargetAtTime(0.0, now, 0.03);
    } else if (this.cabinPosition === 'fr') {
      this.cabinDelayL.delayTime.setTargetAtTime(0.0, now, 0.03);
      this.cabinDelayR.delayTime.setTargetAtTime(0.0009, now, 0.03);
    } else {
      // Center / All Seats
      this.cabinDelayL.delayTime.setTargetAtTime(0.0, now, 0.03);
      this.cabinDelayR.delayTime.setTargetAtTime(0.0, now, 0.03);
    }
  }

  // Presets Configuration

  // --- iOS Sound Tune Feature Parity Methods ---
  async toggleConcertHall() {
    this.isConcertHallEnabled = !this.isConcertHallEnabled;
    if (this.isConcertHallEnabled) {
      this.ambienceMode = 'concertHall';
      if (this.convolverNode && this.audioCtx) {
        this.convolverNode.buffer = await this.getImpulseResponse('concertHall');
      }
      this.reverbMix = 65.0;
      this.updateReverbGains();

      this.setEQBand(1, 4.5); // 63Hz
      this.setEQBand(8, 3.5); // 8kHz
      this.setEQBand(9, 4.0); // 16kHz

      if (window.PioneerBridge && typeof window.PioneerBridge.syncNativeReverb === 'function') {
        window.PioneerBridge.syncNativeReverb('hall');
      }
    } else {
      this.reverbMix = 0.0;
      this.updateReverbGains();
      this.applyPreset(this.currentPreset || 'flat');

      if (window.PioneerBridge && typeof window.PioneerBridge.syncNativeReverb === 'function') {
        window.PioneerBridge.syncNativeReverb('none');
      }
    }
    return this.isConcertHallEnabled;
  }

  async setReverbRoom(room) {
    this.ambienceMode = room;
    if (this.convolverNode && this.audioCtx) {
      this.convolverNode.buffer = await this.getImpulseResponse(room);
    }
    if (window.PioneerBridge && typeof window.PioneerBridge.syncNativeReverb === 'function') {
      window.PioneerBridge.syncNativeReverb(room);
    }
  }

  setReverbWetDry(val) {
    this.setReverbMix(val);
  }

  setListeningPosition(pos) {
    this.listeningPosition = pos;
    let pan = 0.0;
    let delayL = 0.0;
    let delayR = 0.0;

    if (pos === 'frontLeft' || pos === 'fl' || pos === 'DRIVER (FL)') {
      pan = -0.45;
      delayR = 0.0018; // 1.8ms delay on opposite speaker to align acoustic wavefront to driver
      delayL = 0.0;
    } else if (pos === 'frontRight' || pos === 'fr' || pos === 'PASSENGER (FR)') {
      pan = 0.45;
      delayL = 0.0018;
      delayR = 0.0;
    } else if (pos === 'frontCenter' || pos === 'fc' || pos === 'FRONT CENTER') {
      pan = 0.0;
      delayL = 0.0005;
      delayR = 0.0005;
    } else {
      // ALL SEATS
      pan = 0.0;
      delayL = 0.0;
      delayR = 0.0;
    }

    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      if (this.pannerNode) this.pannerNode.pan.setTargetAtTime(pan, now, 0.03);
      if (this.cabinDelayL) this.cabinDelayL.delayTime.setTargetAtTime(delayL, now, 0.03);
      if (this.cabinDelayR) this.cabinDelayR.delayTime.setTargetAtTime(delayR, now, 0.03);
    }
  }

  resetEQToZero() {
    this.resetEQ();
    this.applyPreset('flat');
  }

  setMasterGain(percent) {
    const p = Math.max(0, Math.min(100, parseFloat(percent)));
    this.setMasterVolume(p / 100.0);
  }

  getByteFrequencyData(array) {
    if (this.analyser && this.isPlaying && !this.isPaused) {
      this.analyser.getByteFrequencyData(array);
    } else {
      array.fill(0);
    }
  }

  applyPreset(presetName) {
    this.currentPreset = presetName;
    const presets = {
      flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      concertHall: [0, 4.5, 0, 0, 0, 0, 0, 0, 3.5, 4.0],
      superBass: [6, 8, 6, 2, 0, 0, 0, 1, 2, 3],
      dynamic: [5, 4, 2, 0, -1, 1, 3, 5, 6, 5],
      vocal: [-2, -1, 0, 2, 4, 5, 4, 2, 1, 0],
      club: [7, 7, 4, 1, -1, 1, 3, 5, 6, 6],
      // Aliases
      bass: [6, 8, 6, 2, 0, 0, 0, 1, 2, 3],
      rock: [5, 4, 2, 0, -1, 1, 3, 5, 6, 5],
      hall: [0, 4.5, 0, 0, 0, 0, 0, 0, 3.5, 4.0]
    };

    const targetGains = presets[presetName] || presets.flat;
    targetGains.forEach((g, idx) => this.setEQBand(idx, g));

    if (presetName === 'bass') {
      this.setSuperBass(9);
      this.setDeepBass(4);
      this.setReverbMix(0);
    } else if (presetName === 'deep_bass') {
      this.setSuperBass(5);
      this.setDeepBass(8);
      this.setReverbMix(0);
    } else if (presetName === 'hall') {
      this.setSuperBass(0);
      this.setDeepBass(0);
      this.setAmbienceMode('hall');
      this.setReverbMix(65);
    } else if (presetName === 'studio') {
      this.setSuperBass(0);
      this.setDeepBass(0);
      this.setAmbienceMode('studio');
      this.setReverbMix(30);
    } else {
      this.setSuperBass(0);
      this.setDeepBass(0);
      this.setReverbMix(0);
    }
  }

  resetEQ() {
    this.applyPreset('flat');
    this.setPreamp(0);
  }

  saveCustomPreset(name) {
    try {
      const presets = this.getCustomPresets();
      presets[name] = {
        eq: [...this.eqGains],
        preamp: this.preampGain,
        superBass: this.superBassGain,
        deepBass: this.deepBassGain,
        mid: this.midGain,
        treble: this.trebleGain,
        reverbMix: this.reverbMix,
        ambienceMode: this.ambienceMode
      };
      localStorage.setItem('pioneer_custom_presets_v4', JSON.stringify(presets));
      return true;
    } catch(e) {
      return false;
    }
  }

  getCustomPresets() {
    try {
      const data = localStorage.getItem('pioneer_custom_presets_v4');
      return data ? JSON.parse(data) : {};
    } catch(e) {
      return {};
    }
  }

  applyCustomPreset(name) {
    const presets = this.getCustomPresets();
    const p = presets[name];
    if (!p) return false;
    if (p.eq) p.eq.forEach((g, idx) => this.setEQBand(idx, g));
    if (p.preamp !== undefined) this.setPreamp(p.preamp);
    if (p.superBass !== undefined) this.setSuperBass(p.superBass);
    if (p.deepBass !== undefined) this.setDeepBass(p.deepBass);
    if (p.mid !== undefined) this.setMid(p.mid);
    if (p.treble !== undefined) this.setTreble(p.treble);
    if (p.reverbMix !== undefined) this.setReverbMix(p.reverbMix);
    if (p.ambienceMode) this.setAmbienceMode(p.ambienceMode);
    return true;
  }

  // --- Real Media Playback Pipeline ---

  stopPlayback() {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      } catch (e) {}
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    this.isPlaying = false;
    this.isPaused = false;
    this.pauseOffset = 0;
  }

  // Get proxied stream URL to bypass CORS and prevent WebAudio muting on Android WebView
  getProxiedStreamUrl(url) {
    if (!url) return '';
    if (url.startsWith('https://pioneer.local/') || url.startsWith('http://localhost') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    // Route through native Android streaming proxy to guarantee permissive CORS and non-muted 32-bit float WebAudio pipeline
    return 'https://pioneer.local/stream?url=' + encodeURIComponent(url);
  }

  // Preload stream audio buffer in background for tracks with finite duration (< 30 minutes)
  async preloadStreamBuffer(track) {
    try {
      const proxiedUrl = this.getProxiedStreamUrl(track.streamUrl);
      let arrayBuffer = null;
      try {
        const resp = await fetch(proxiedUrl);
        if (resp.ok) {
          arrayBuffer = await resp.arrayBuffer();
        }
      } catch (e) {}

      if (!arrayBuffer && window.PioneerBridge && typeof window.PioneerBridge.fetchOnlineAudioBase64 === 'function') {
        const b64 = window.PioneerBridge.fetchOnlineAudioBase64(track.streamUrl);
        if (b64 && b64.length > 0) {
          const binStr = atob(b64);
          const len = binStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
          arrayBuffer = bytes.buffer;
        }
      }

      if (arrayBuffer && this.audioCtx && this.activeTrack && this.activeTrack.id === track.id) {
        this.currentBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        if (this.currentBuffer && this.currentBuffer.duration && isFinite(this.currentBuffer.duration)) {
          this.duration = this.currentBuffer.duration;
          track.duration = Math.round(this.duration);
        }
      }
    } catch (e) {
      // Non-critical background task; progressive stream continues playing uninterrupted
    }
  }

  // Play streaming audio via HTML5 Audio API routed into Pioneer DSP
  async playStreamTrack(track, queue = null, index = -1) {
    if (!track || !track.streamUrl) return false;
    await this.initAudioContext();
    this.stopPlayback();

    if (Array.isArray(queue) && queue.length > 0) {
      this.streamQueue = queue;
      this.streamIndex = index >= 0 ? index : queue.findIndex(t => t.id === track.id);
    }

    this.sourceType = 'stream';
    this.activeTrack = track;
    this.duration = track.duration || 0;

    if (!this.audioElement) {
      this.audioElement = new Audio();
    }
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';

    // Ensure MediaElementSource is hooked into WebAudio DSP Preamp
    if (!this.mediaElementSource && this.preampNode) {
      try {
        this.mediaElementSource = this.audioCtx.createMediaElementSource(this.audioElement);
        this.mediaElementSource.connect(this.preampNode);
      } catch (e) {}
    }

    const proxiedUrl = this.getProxiedStreamUrl(track.streamUrl);
    this.audioElement.src = proxiedUrl;
    this.audioElement.playbackRate = this.playbackRate;

    this.audioElement.onloadedmetadata = () => {
      if (this.audioElement.duration && isFinite(this.audioElement.duration)) {
        this.duration = this.audioElement.duration;
        track.duration = Math.round(this.duration);
      }
    };

    this.audioElement.onended = () => {
      if (this.isPlaying && !this.isPaused) {
        if (this.isRepeat === 'one') {
          this.audioElement.currentTime = 0;
          this.audioElement.play().catch(() => {});
        } else {
          this.playNext();
        }
      }
    };

    this.audioElement.onerror = async (e) => {
      console.warn('HTML5 Audio stream proxy event, checking fallback...', e);
      if (this.audioElement.src === proxiedUrl && proxiedUrl !== track.streamUrl) {
        try {
          this.audioElement.src = track.streamUrl;
          await this.audioElement.play();
        } catch (err2) {}
      }
    };

    try {
      await this.audioElement.play();
      this.isPlaying = true;
      this.isPaused = false;

      // Preload buffer in background for tracks with known finite duration (<30 mins)
      if (track.duration && track.duration > 0 && track.duration < 1800 && !track.isLive) {
        this.preloadStreamBuffer(track);
      }
      return true;
    } catch (err) {
      console.warn('Initial proxied stream play error, trying direct stream:', err);
      try {
        this.audioElement.src = track.streamUrl;
        await this.audioElement.play();
        this.isPlaying = true;
        this.isPaused = false;
        return true;
      } catch (directErr) {
        console.error('Failed to trigger audio stream playback:', directErr);
        this.stopPlayback();
        throw directErr;
      }
    }
  }

  // Play a local audio file
  async playLocalSong(index) {
    if (index < 0 || index >= this.songs.length) return false;
    await this.initAudioContext();
    this.stopPlayback();

    this.currentIndex = index;
    const song = this.songs[index];
    this.activeTrack = song;
    this.sourceType = 'local';

    try {
      let arrayBuffer = null;

      // Option A: Loaded from IndexedDB Blob / File
      if (song.blob) {
        arrayBuffer = await song.blob.arrayBuffer();
      }
      // Option B: MediaStore Content URI via Native Stream / Proxy
      else if (song.contentUri) {
        const proxyUrl = 'https://pioneer.local/media?uri=' + encodeURIComponent(song.contentUri);
        try {
          const resp = await fetch(proxyUrl);
          if (resp.ok) {
            arrayBuffer = await resp.arrayBuffer();
          }
        } catch(netErr) {}

        // Fallback: If proxy fetch fails, try Native Bridge base64 reader
        if (!arrayBuffer && window.PioneerBridge && typeof window.PioneerBridge.readAudioBase64 === 'function') {
          const b64 = window.PioneerBridge.readAudioBase64(song.contentUri);
          if (b64 && b64.length > 0) {
            const binStr = atob(b64);
            const len = binStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
            arrayBuffer = bytes.buffer;
          }
        }
      }

      if (!arrayBuffer) {
        throw new Error('Unable to read audio data for ' + song.title);
      }

      this.currentBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      this.duration = this.currentBuffer.duration;
      song.duration = Math.round(this.duration);

      this.sourceNode = this.audioCtx.createBufferSource();
      this.sourceNode.buffer = this.currentBuffer;
      this.sourceNode.playbackRate.value = this.playbackRate;
      this.sourceNode.connect(this.preampNode);

      this.sourceNode.onended = () => {
        if (this.isPlaying && !this.isPaused) {
          if (this.isRepeat === 'one') {
            this.playLocalSong(this.currentIndex);
          } else {
            this.playNext();
          }
        }
      };

      this.startTime = this.audioCtx.currentTime;
      this.pauseOffset = 0;
      this.sourceNode.start(0);
      this.isPlaying = true;
      this.isPaused = false;
      return true;
    } catch(err) {
      console.error('Failed to play local song:', err);
      this.stopPlayback();
      throw err;
    }
  }

  // Playback Control
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
      return false;
    } else {
      this.resume();
      return true;
    }
  }

  pause() {
    if (this.sourceType === 'stream' && this.audioElement) {
      this.audioElement.pause();
      this.isPlaying = false;
      this.isPaused = true;
    } else if (this.sourceNode && this.isPlaying && !this.isPaused) {
      this.pauseOffset = (this.audioCtx.currentTime - this.startTime) % (this.duration || 1);
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch(e) {}
      this.sourceNode = null;
      this.isPlaying = false;
      this.isPaused = true;
    }
  }

  async resume() {
    if (this.sourceType === 'stream' && this.audioElement && this.isPaused) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      await this.audioElement.play();
      this.isPlaying = true;
      this.isPaused = false;
    } else if (this.isPaused && this.currentBuffer && this.audioCtx) {
      this.sourceNode = this.audioCtx.createBufferSource();
      this.sourceNode.buffer = this.currentBuffer;
      this.sourceNode.playbackRate.value = this.playbackRate;
      this.sourceNode.connect(this.preampNode);

      this.sourceNode.onended = () => {
        if (this.isPlaying && !this.isPaused) {
          if (this.isRepeat === 'one') {
            this.playLocalSong(this.currentIndex);
          } else {
            this.playNext();
          }
        }
      };

      this.startTime = this.audioCtx.currentTime - this.pauseOffset;
      this.sourceNode.start(0, this.pauseOffset);
      this.isPlaying = true;
      this.isPaused = false;
    } else if (this.currentIndex >= 0) {
      this.playLocalSong(this.currentIndex);
    }
  }

  seek(ratio) {
    if (this.sourceType === 'stream' && this.audioElement) {
      const dur = this.getCurrentDuration();
      if (dur > 0) {
        this.audioElement.currentTime = Math.max(0, Math.min(dur, dur * ratio));
      }
      return;
    }

    if (!this.currentBuffer) return;
    const targetTime = Math.max(0, Math.min(this.duration, this.duration * ratio));
    this.pauseOffset = targetTime;

    if (this.isPlaying && this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch(e) {}
      this.sourceNode = this.audioCtx.createBufferSource();
      this.sourceNode.buffer = this.currentBuffer;
      this.sourceNode.playbackRate.value = this.playbackRate;
      this.sourceNode.connect(this.preampNode);
      this.sourceNode.onended = () => {
        if (this.isPlaying && !this.isPaused) {
          if (this.isRepeat === 'one') {
            this.playLocalSong(this.currentIndex);
          } else {
            this.playNext();
          }
        }
      };
      this.startTime = this.audioCtx.currentTime - targetTime;
      this.sourceNode.start(0, targetTime);
    }
  }

  async playNext() {
    if (this.sourceType === 'stream' && this.streamQueue.length > 0) {
      let nextIdx;
      if (this.isShuffle) {
        nextIdx = Math.floor(Math.random() * this.streamQueue.length);
      } else {
        nextIdx = (this.streamIndex + 1) % this.streamQueue.length;
      }
      const nextTrack = this.streamQueue[nextIdx];
      if (nextTrack) {
        if (!nextTrack.streamUrl && window.youtubeMusicEngine) {
          try {
            const res = await window.youtubeMusicEngine.resolveAudioStream(nextTrack.videoId || nextTrack.id);
            Object.assign(nextTrack, res);
          } catch(e) {}
        }
        await this.playStreamTrack(nextTrack, this.streamQueue, nextIdx);
        if (window.onPlaybackTrackChanged) window.onPlaybackTrackChanged(nextTrack);
      }
      return;
    }

    if (this.songs.length === 0) return;
    let nextIdx;
    if (this.isShuffle) {
      nextIdx = Math.floor(Math.random() * this.songs.length);
    } else {
      nextIdx = (this.currentIndex + 1) % this.songs.length;
    }
    await this.playLocalSong(nextIdx);
  }

  async playPrev() {
    if (this.sourceType === 'stream' && this.streamQueue.length > 0) {
      let prevIdx;
      if (this.isShuffle) {
        prevIdx = Math.floor(Math.random() * this.streamQueue.length);
      } else {
        prevIdx = (this.streamIndex - 1 + this.streamQueue.length) % this.streamQueue.length;
      }
      const prevTrack = this.streamQueue[prevIdx];
      if (prevTrack) {
        if (!prevTrack.streamUrl && window.youtubeMusicEngine) {
          try {
            const res = await window.youtubeMusicEngine.resolveAudioStream(prevTrack.videoId || prevTrack.id);
            Object.assign(prevTrack, res);
          } catch(e) {}
        }
        await this.playStreamTrack(prevTrack, this.streamQueue, prevIdx);
        if (window.onPlaybackTrackChanged) window.onPlaybackTrackChanged(prevTrack);
      }
      return;
    }

    if (this.songs.length === 0) return;
    let prevIdx;
    if (this.isShuffle) {
      prevIdx = Math.floor(Math.random() * this.songs.length);
    } else {
      prevIdx = (this.currentIndex - 1 + this.songs.length) % this.songs.length;
    }
    await this.playLocalSong(prevIdx);
  }

  getCurrentTime() {
    if (this.sourceType === 'stream' && this.audioElement) {
      return this.audioElement.currentTime || 0;
    }
    if (!this.isPlaying || !this.audioCtx) return this.pauseOffset;
    if (this.isPaused) return this.pauseOffset;
    const elapsed = this.audioCtx.currentTime - this.startTime;
    return Math.min(this.duration || 0, Math.max(0, elapsed));
  }

  getCurrentDuration() {
    if (this.sourceType === 'stream' && this.audioElement && this.audioElement.duration && isFinite(this.audioElement.duration)) {
      return this.audioElement.duration;
    }
    return this.duration || (this.songs[this.currentIndex]?.duration || 0);
  }

  // File Management & IndexedDB Persistence
  async loadSavedSongs() {
    try {
      const saved = await this.db.getAllSongs();
      this.songs = saved || [];
      return this.songs;
    } catch(e) {
      this.songs = [];
      return [];
    }
  }

  async importFiles(files) {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = 'local_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const nameParts = file.name.replace(/\.[^/.]+$/, '').split(' - ');
      const artist = nameParts.length > 1 ? nameParts[0].trim() : 'Local Artist';
      const title = nameParts.length > 1 ? nameParts.slice(1).join(' - ').trim() : nameParts[0].trim();
      const fileSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

      const songObj = {
        id: id,
        title: title,
        artist: artist,
        album: 'Imported Music',
        duration: 0,
        fileSize: fileSize,
        blob: file,
        addedAt: Date.now()
      };

      this.songs.push(songObj);
      await this.db.saveSong(songObj);
    }
  }

  async importMediaStoreTracks(tracks) {
    if (!tracks || !Array.isArray(tracks)) return;
    for (const t of tracks) {
      const exists = this.songs.some(s => s.contentUri === t.contentUri || s.id === t.id);
      if (!exists) {
        const songObj = {
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration || 0,
          fileSize: (t.size / (1024 * 1024)).toFixed(1) + ' MB',
          contentUri: t.contentUri,
          albumId: t.albumId,
          addedAt: Date.now()
        };
        this.songs.push(songObj);
        await this.db.saveSong(songObj);
      }
    }
    this.db.syncMetadataCache();
  }

  async removeSong(id) {
    const idx = this.songs.findIndex(s => s.id === id);
    if (idx !== -1) {
      if (idx === this.currentIndex) {
        this.stopPlayback();
        this.currentIndex = -1;
      } else if (idx < this.currentIndex) {
        this.currentIndex--;
      }
      this.songs.splice(idx, 1);
      await this.db.deleteSong(id);
    }
  }
}

window.dspEngine = new PioneerDSPEngine();
