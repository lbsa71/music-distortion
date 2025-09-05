import { AudioBands, AppConfig } from '../core/config.js';

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  private fftBuffer: Float32Array;
  private timeBuffer: Float32Array;
  private isActive = false;
  
  // Silence detection
  private silenceStartTime: number | null = null;
  private soundStartTime: number | null = null;
  private lastRms = 0;
  private lastDebugTime = 0;
  
  // EMA for band normalization
  private lowEma = 0;
  private midEma = 0;
  private highEma = 0;
  private readonly emaAlpha = 0.1;

  constructor(private config: AppConfig) {
    this.fftBuffer = new Float32Array(new ArrayBuffer(config.fftSize / 2 * 4));
    this.timeBuffer = new Float32Array(new ArrayBuffer(config.fftSize * 4));
  }

  async initialize(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      
      // Create audio graph
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyser
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = 0.75;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      
      // Connect nodes
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      
      this.isActive = true;
      console.log('Audio analyzer initialized');
    } catch (error) {
      console.error('Error initializing audio analyzer:', error);
      throw error;
    }
  }

  getAudioBands(): AudioBands {
    if (!this.analyser || !this.isActive) {
      console.log('Audio analyzer not active or analyser missing');
      return { low: 0, mid: 0, high: 0 };
    }

    const fftData = new Float32Array(this.fftBuffer.length);
    this.analyser.getFloatFrequencyData(fftData);
    
    // Debug: Check if we're getting any data
    const maxValue = Math.max(...fftData);
    const minValue = Math.min(...fftData);
    console.log('FFT data range:', minValue, 'to', maxValue);
    
    const sampleRate = this.audioContext!.sampleRate;
    const binCount = fftData.length;
    const binSize = sampleRate / 2 / binCount;
    
    console.log('Sample rate:', sampleRate, 'Bin count:', binCount, 'Bin size:', binSize);
    
    // Map frequency ranges to bin indices
    const lowStart = Math.floor(this.config.lowBand[0] / binSize);
    const lowEnd = Math.floor(this.config.lowBand[1] / binSize);
    const midStart = Math.floor(this.config.midBand[0] / binSize);
    const midEnd = Math.floor(this.config.midBand[1] / binSize);
    const highStart = Math.floor(this.config.highBand[0] / binSize);
    const highEnd = Math.floor(this.config.highBand[1] / binSize);
    
    console.log('Band ranges - Low:', lowStart, '-', lowEnd, 'Mid:', midStart, '-', midEnd, 'High:', highStart, '-', highEnd);
    
    // Calculate band energies (convert from dB to linear)
    let lowSum = 0, midSum = 0, highSum = 0;
    let lowCount = 0, midCount = 0, highCount = 0;
    
    for (let i = lowStart; i <= lowEnd && i < binCount; i++) {
      lowSum += Math.pow(10, fftData[i] / 20);
      lowCount++;
    }
    
    for (let i = midStart; i <= midEnd && i < binCount; i++) {
      midSum += Math.pow(10, fftData[i] / 20);
      midCount++;
    }
    
    for (let i = highStart; i <= highEnd && i < binCount; i++) {
      highSum += Math.pow(10, fftData[i] / 20);
      highCount++;
    }
    
    // Average and normalize
    const low = lowCount > 0 ? lowSum / lowCount : 0;
    const mid = midCount > 0 ? midSum / midCount : 0;
    const high = highCount > 0 ? highSum / highCount : 0;
    
    console.log('Raw band values - Low:', low, 'Mid:', mid, 'High:', high);
    
    // Apply EMA smoothing
    this.lowEma = this.lowEma * (1 - this.emaAlpha) + low * this.emaAlpha;
    this.midEma = this.midEma * (1 - this.emaAlpha) + mid * this.emaAlpha;
    this.highEma = this.highEma * (1 - this.emaAlpha) + high * this.emaAlpha;
    
    // Scale up the values to make them more visible
    const scale = 1000; // Scale factor to make small values visible
    
    const result = {
      low: Math.min(this.lowEma * scale, 1.0),
      mid: Math.min(this.midEma * scale, 1.0),
      high: Math.min(this.highEma * scale, 1.0),
    };
    
    console.log('Final band values:', result);
    return result;
  }

  getRMS(): number {
    if (!this.analyser || !this.isActive) {
      return 0;
    }

    const timeData = new Float32Array(this.timeBuffer.length);
    this.analyser.getFloatTimeDomainData(timeData);
    
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = timeData[i];
      sum += sample * sample;
    }
    
    this.lastRms = Math.sqrt(sum / timeData.length);
    return this.lastRms;
  }

  checkSilence(): { isSilent: boolean; shouldResume: boolean } {
    const rms = this.getRMS();
    const now = performance.now();
    
    // Debug logging every 100ms to avoid spam
    if (now - (this.lastDebugTime || 0) > 100) {
      console.log('Audio RMS:', rms, 'Silence threshold:', this.config.silenceRms, 'Resume threshold:', this.config.silenceRms * 1.25);
      this.lastDebugTime = now;
    }
    
    if (rms < this.config.silenceRms) {
      // Below silence threshold
      if (this.silenceStartTime === null) {
        this.silenceStartTime = now;
      }
      this.soundStartTime = null;
      
      const silenceDuration = now - this.silenceStartTime;
      return {
        isSilent: silenceDuration >= this.config.silenceHoldMs,
        shouldResume: false,
      };
    } else if (rms > this.config.silenceRms * 1.25) {
      // Above resume threshold (with hysteresis)
      if (this.soundStartTime === null) {
        this.soundStartTime = now;
      }
      this.silenceStartTime = null;
      
      const soundDuration = now - this.soundStartTime;
      return {
        isSilent: false,
        shouldResume: soundDuration >= this.config.resumeHoldMs,
      };
    } else {
      // In between thresholds - maintain current state
      return {
        isSilent: this.silenceStartTime !== null,
        shouldResume: this.soundStartTime !== null,
      };
    }
  }

  setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(gain, this.audioContext!.currentTime);
    }
  }

  destroy(): void {
    this.isActive = false;
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('Audio analyzer destroyed');
  }
}