import { AppConfig } from '../core/config.js';
import { enumerateAudioDevices } from '../audio/input.js';

export interface UIElements {
  audioInputSelect: HTMLSelectElement;
  startAudioBtn: HTMLButtonElement;
  stopAudioBtn: HTMLButtonElement;
  tileSizeSlider: HTMLInputElement;
  distortionStrengthSlider: HTMLInputElement;
  cycleDurationSlider: HTMLInputElement;
  silenceThresholdSlider: HTMLInputElement;
  audioTransitionThresholdSlider: HTMLInputElement;
  audioTransitionHoldSlider: HTMLInputElement;
  nextImageBtn: HTMLButtonElement;
  freezeAudioBtn: HTMLButtonElement;
  overlay: HTMLElement;
  enableAudioBtn: HTMLButtonElement;
  visualizeWithoutAudioBtn: HTMLButtonElement;
  
  // Status displays
  fpsDisplay: HTMLElement;
  rmsDisplay: HTMLElement;
  stateDisplay: HTMLElement;
  lowBandDisplay: HTMLElement;
  midBandDisplay: HTMLElement;
  highBandDisplay: HTMLElement;
  
  // Value displays
  tileSizeValue: HTMLElement;
  distortionStrengthValue: HTMLElement;
  cycleDurationValue: HTMLElement;
  silenceThresholdValue: HTMLElement;
  audioTransitionThresholdValue: HTMLElement;
  audioTransitionHoldValue: HTMLElement;
}

export class UIController {
  private elements: UIElements;
  private config: AppConfig;
  private listeners: { [key: string]: Function[] } = {};

  constructor(config: AppConfig) {
    this.config = config;
    this.elements = this.getUIElements();
    this.initializeControls();
    this.setupEventListeners();
  }

  private getUIElements(): UIElements {
    const get = (id: string) => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`UI element not found: ${id}`);
      }
      return element;
    };

    return {
      audioInputSelect: get('audio-input-select') as HTMLSelectElement,
      startAudioBtn: get('start-audio') as HTMLButtonElement,
      stopAudioBtn: get('stop-audio') as HTMLButtonElement,
      tileSizeSlider: get('tile-size') as HTMLInputElement,
      distortionStrengthSlider: get('distortion-strength') as HTMLInputElement,
      cycleDurationSlider: get('cycle-duration') as HTMLInputElement,
      silenceThresholdSlider: get('silence-threshold') as HTMLInputElement,
      audioTransitionThresholdSlider: get('audio-transition-threshold') as HTMLInputElement,
      audioTransitionHoldSlider: get('audio-transition-hold') as HTMLInputElement,
      nextImageBtn: get('next-image') as HTMLButtonElement,
      freezeAudioBtn: get('freeze-audio') as HTMLButtonElement,
      overlay: get('overlay'),
      enableAudioBtn: get('enable-audio') as HTMLButtonElement,
      visualizeWithoutAudioBtn: get('visualize-without-audio') as HTMLButtonElement,
      
      fpsDisplay: get('fps'),
      rmsDisplay: get('rms'),
      stateDisplay: get('state'),
      lowBandDisplay: get('low-band'),
      midBandDisplay: get('mid-band'),
      highBandDisplay: get('high-band'),
      
      tileSizeValue: get('tile-size-value'),
      distortionStrengthValue: get('distortion-strength-value'),
      cycleDurationValue: get('cycle-duration-value'),
      silenceThresholdValue: get('silence-threshold-value'),
      audioTransitionThresholdValue: get('audio-transition-threshold-value'),
      audioTransitionHoldValue: get('audio-transition-hold-value'),
    };
  }

  private initializeControls(): void {
    // Set initial values
    this.elements.tileSizeSlider.value = this.config.gridTileSize.toString();
    this.elements.distortionStrengthSlider.value = this.config.distortionStrength.toString();
    this.elements.cycleDurationSlider.value = this.config.cycleSeconds.toString();
    this.elements.silenceThresholdSlider.value = this.config.silenceRms.toString();
    this.elements.audioTransitionThresholdSlider.value = this.config.audioTransitionThreshold.toString();
    this.elements.audioTransitionHoldSlider.value = this.config.audioTransitionHoldMs.toString();
    
    // Update value displays
    this.updateValueDisplays();
  }

  private setupEventListeners(): void {
    // Audio controls
    this.elements.startAudioBtn.addEventListener('click', () => {
      this.emit('start-audio');
    });
    
    this.elements.stopAudioBtn.addEventListener('click', () => {
      this.emit('stop-audio');
    });
    
    this.elements.audioInputSelect.addEventListener('change', () => {
      this.emit('audio-device-changed', this.elements.audioInputSelect.value);
    });
    
    // Visual controls with live updates
    this.elements.tileSizeSlider.addEventListener('input', () => {
      this.config.gridTileSize = parseInt(this.elements.tileSizeSlider.value);
      this.updateValueDisplays();
      this.emit('tile-size-changed', this.config.gridTileSize);
    });
    
    this.elements.distortionStrengthSlider.addEventListener('input', () => {
      this.config.distortionStrength = parseFloat(this.elements.distortionStrengthSlider.value);
      this.updateValueDisplays();
      this.emit('distortion-strength-changed', this.config.distortionStrength);
    });
    
    this.elements.cycleDurationSlider.addEventListener('input', () => {
      this.config.cycleSeconds = parseInt(this.elements.cycleDurationSlider.value);
      this.updateValueDisplays();
      this.emit('cycle-duration-changed', this.config.cycleSeconds);
    });
    
    this.elements.silenceThresholdSlider.addEventListener('input', () => {
      this.config.silenceRms = parseFloat(this.elements.silenceThresholdSlider.value);
      this.updateValueDisplays();
      this.emit('silence-threshold-changed', this.config.silenceRms);
    });
    
    this.elements.audioTransitionThresholdSlider.addEventListener('input', () => {
      this.config.audioTransitionThreshold = parseFloat(this.elements.audioTransitionThresholdSlider.value);
      this.updateValueDisplays();
      this.emit('audio-transition-threshold-changed', this.config.audioTransitionThreshold);
    });
    
    this.elements.audioTransitionHoldSlider.addEventListener('input', () => {
      this.config.audioTransitionHoldMs = parseInt(this.elements.audioTransitionHoldSlider.value);
      this.updateValueDisplays();
      this.emit('audio-transition-hold-changed', this.config.audioTransitionHoldMs);
    });
    
    // Debug controls
    this.elements.nextImageBtn.addEventListener('click', () => {
      this.emit('next-image');
    });
    
    this.elements.freezeAudioBtn.addEventListener('click', () => {
      this.emit('freeze-audio');
    });
    
    // Overlay controls
    this.elements.enableAudioBtn.addEventListener('click', () => {
      this.emit('enable-audio');
    });
    
    this.elements.visualizeWithoutAudioBtn.addEventListener('click', () => {
      this.emit('visualize-without-audio');
    });
  }

  private updateValueDisplays(): void {
    this.elements.tileSizeValue.textContent = `${this.config.gridTileSize}px`;
    this.elements.distortionStrengthValue.textContent = this.config.distortionStrength.toFixed(1);
    this.elements.cycleDurationValue.textContent = `${this.config.cycleSeconds}s`;
    this.elements.silenceThresholdValue.textContent = this.config.silenceRms.toFixed(3);
    this.elements.audioTransitionThresholdValue.textContent = this.config.audioTransitionThreshold.toFixed(1);
    this.elements.audioTransitionHoldValue.textContent = `${this.config.audioTransitionHoldMs}ms`;
  }

  async populateAudioDevices(): Promise<void> {
    try {
      const devices = await enumerateAudioDevices();
      this.clearAudioDeviceOptions();
      
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Default Audio Input';
      this.elements.audioInputSelect.appendChild(defaultOption);
      
      // Add device options
      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label;
        this.elements.audioInputSelect.appendChild(option);
      });
      
      console.log(`Populated ${devices.length} audio devices`);
    } catch (error) {
      console.error('Error populating audio devices:', error);
    }
  }

  private clearAudioDeviceOptions(): void {
    while (this.elements.audioInputSelect.firstChild) {
      this.elements.audioInputSelect.removeChild(this.elements.audioInputSelect.firstChild);
    }
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  private emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(...args));
    }
  }

  // UI State management
  showOverlay(): void {
    this.elements.overlay.classList.remove('hidden');
  }

  hideOverlay(): void {
    this.elements.overlay.classList.add('hidden');
  }

  setAudioControlsEnabled(enabled: boolean): void {
    this.elements.startAudioBtn.disabled = !enabled;
    this.elements.stopAudioBtn.disabled = enabled;
    this.elements.audioInputSelect.disabled = !enabled;
  }

  // Status updates
  updateFPS(fps: number): void {
    this.elements.fpsDisplay.textContent = `FPS: ${fps.toFixed(0)}`;
  }

  updateRMS(rms: number): void {
    this.elements.rmsDisplay.textContent = `RMS: ${rms.toFixed(3)}`;
  }

  updateState(state: string): void {
    this.elements.stateDisplay.textContent = `State: ${state}`;
  }

  updateAudioBands(low: number, mid: number, high: number): void {
    this.elements.lowBandDisplay.textContent = low.toFixed(2);
    this.elements.midBandDisplay.textContent = mid.toFixed(2);
    this.elements.highBandDisplay.textContent = high.toFixed(2);
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }
}