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
  
  // Settings modal elements
  settingsToggle: HTMLButtonElement;
  settingsModal: HTMLElement;
  settingsClose: HTMLButtonElement;
  
  // Audio-reactive effect controls
  rippleIntensitySlider: HTMLInputElement;
  pulseIntensitySlider: HTMLInputElement;
  detailIntensitySlider: HTMLInputElement;
  beatIntensitySlider: HTMLInputElement;
  rotationIntensitySlider: HTMLInputElement;
  flowIntensitySlider: HTMLInputElement;
  enableRandomIntensitiesCheckbox: HTMLInputElement;
  
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
  rippleIntensityValue: HTMLElement;
  pulseIntensityValue: HTMLElement;
  detailIntensityValue: HTMLElement;
  beatIntensityValue: HTMLElement;
  rotationIntensityValue: HTMLElement;
  flowIntensityValue: HTMLElement;
}

export class UIController {
  private elements: UIElements;
  private config: AppConfig;
  private listeners: { [key: string]: Function[] } = {};

  constructor(config: AppConfig) {
    this.config = config;
    console.log('UIController: Starting initialization...');
    try {
      this.elements = this.getUIElements();
      console.log('UIController: Elements found successfully');
      this.initializeControls();
      console.log('UIController: Controls initialized');
      this.setupEventListeners();
      console.log('UIController: Event listeners setup complete');
    } catch (error) {
      console.error('UIController initialization error:', error);
      throw error;
    }
  }

  private getUIElements(): UIElements {
    const get = (id: string) => {
      const element = document.getElementById(id);
      if (!element) {
        console.error(`UI element not found: ${id}`);
        // Create a placeholder element to prevent crashes
        const placeholder = document.createElement('div');
        placeholder.id = id;
        placeholder.style.display = 'none';
        document.body.appendChild(placeholder);
        return placeholder;
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
      
      // Settings modal elements
      settingsToggle: get('settings-toggle') as HTMLButtonElement,
      settingsModal: get('settings-modal'),
      settingsClose: get('settings-close') as HTMLButtonElement,
      
      // Audio-reactive effect controls
      rippleIntensitySlider: get('ripple-intensity') as HTMLInputElement,
      pulseIntensitySlider: get('pulse-intensity') as HTMLInputElement,
      detailIntensitySlider: get('detail-intensity') as HTMLInputElement,
      beatIntensitySlider: get('beat-intensity') as HTMLInputElement,
      rotationIntensitySlider: get('rotation-intensity') as HTMLInputElement,
      flowIntensitySlider: get('flow-intensity') as HTMLInputElement,
      enableRandomIntensitiesCheckbox: get('enable-random-intensities') as HTMLInputElement,
      
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
      rippleIntensityValue: get('ripple-intensity-value'),
      pulseIntensityValue: get('pulse-intensity-value'),
      detailIntensityValue: get('detail-intensity-value'),
      beatIntensityValue: get('beat-intensity-value'),
      rotationIntensityValue: get('rotation-intensity-value'),
      flowIntensityValue: get('flow-intensity-value'),
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
    
    // Set audio-reactive effect initial values
    this.elements.rippleIntensitySlider.value = this.config.rippleIntensity.toString();
    this.elements.pulseIntensitySlider.value = this.config.pulseIntensity.toString();
    this.elements.detailIntensitySlider.value = this.config.detailIntensity.toString();
    this.elements.beatIntensitySlider.value = this.config.beatIntensity.toString();
    this.elements.rotationIntensitySlider.value = this.config.rotationIntensity.toString();
    this.elements.flowIntensitySlider.value = this.config.flowIntensity.toString();
    this.elements.enableRandomIntensitiesCheckbox.checked = this.config.enableRandomIntensities;
    
    // Update value displays
    this.updateValueDisplays();
  }

  private setupEventListeners(): void {
    // Settings modal controls
    this.elements.settingsToggle.addEventListener('click', () => {
      this.toggleSettingsModal();
    });
    
    this.elements.settingsClose.addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Close modal when clicking outside
    this.elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsModal) {
        this.hideSettingsModal();
      }
    });
    
    // Audio controls
    this.elements.startAudioBtn.addEventListener('click', () => {
      this.emit('start-audio');
    });
    
    this.elements.stopAudioBtn.addEventListener('click', () => {
      this.emit('stop-audio');
    });
    
    this.elements.audioInputSelect.addEventListener('change', () => {
      const deviceId = this.elements.audioInputSelect.value;
      this.saveAudioDeviceSelection(deviceId);
      this.emit('audio-device-changed', deviceId);
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
    
    // Audio-reactive effect controls
    this.elements.rippleIntensitySlider.addEventListener('input', () => {
      this.config.rippleIntensity = parseFloat(this.elements.rippleIntensitySlider.value);
      this.updateValueDisplays();
      this.emit('ripple-intensity-changed', this.config.rippleIntensity);
    });
    
    this.elements.pulseIntensitySlider.addEventListener('input', () => {
      this.config.pulseIntensity = parseFloat(this.elements.pulseIntensitySlider.value);
      this.updateValueDisplays();
      this.emit('pulse-intensity-changed', this.config.pulseIntensity);
    });
    
    this.elements.detailIntensitySlider.addEventListener('input', () => {
      this.config.detailIntensity = parseFloat(this.elements.detailIntensitySlider.value);
      this.updateValueDisplays();
      this.emit('detail-intensity-changed', this.config.detailIntensity);
    });
    
    this.elements.beatIntensitySlider.addEventListener('input', () => {
      this.config.beatIntensity = parseFloat(this.elements.beatIntensitySlider.value);
      this.updateValueDisplays();
      this.emit('beat-intensity-changed', this.config.beatIntensity);
    });
    
    this.elements.rotationIntensitySlider.addEventListener('input', () => {
      this.config.rotationIntensity = parseFloat(this.elements.rotationIntensitySlider.value);
      this.updateValueDisplays();
      this.emit('rotation-intensity-changed', this.config.rotationIntensity);
    });
    
    this.elements.flowIntensitySlider.addEventListener('input', () => {
      this.config.flowIntensity = parseFloat(this.elements.flowIntensitySlider.value);
      this.updateValueDisplays();
      this.emit('flow-intensity-changed', this.config.flowIntensity);
    });
    
    // Random intensity checkbox
    this.elements.enableRandomIntensitiesCheckbox.addEventListener('change', () => {
      this.config.enableRandomIntensities = this.elements.enableRandomIntensitiesCheckbox.checked;
      this.emit('random-intensities-changed', this.config.enableRandomIntensities);
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
    // Calculate tile count for display
    const imageWidth = 1920; // Default image width
    const imageHeight = 1080; // Default image height
    const cols = Math.ceil(imageWidth / this.config.gridTileSize);
    const rows = Math.ceil(imageHeight / this.config.gridTileSize);
    const tileCount = cols * rows;
    
    this.elements.tileSizeValue.textContent = `${this.config.gridTileSize}px (${tileCount} tiles)`;
    this.elements.distortionStrengthValue.textContent = this.config.distortionStrength.toFixed(1);
    this.elements.cycleDurationValue.textContent = `${this.config.cycleSeconds}s`;
    this.elements.silenceThresholdValue.textContent = this.config.silenceRms.toFixed(3);
    this.elements.audioTransitionThresholdValue.textContent = this.config.audioTransitionThreshold.toFixed(1);
    this.elements.audioTransitionHoldValue.textContent = `${this.config.audioTransitionHoldMs}ms`;
    
    // Audio-reactive effect value displays
    this.elements.rippleIntensityValue.textContent = this.config.rippleIntensity.toFixed(1);
    this.elements.pulseIntensityValue.textContent = this.config.pulseIntensity.toFixed(1);
    this.elements.detailIntensityValue.textContent = this.config.detailIntensity.toFixed(1);
    this.elements.beatIntensityValue.textContent = this.config.beatIntensity.toFixed(1);
    this.elements.rotationIntensityValue.textContent = this.config.rotationIntensity.toFixed(1);
    this.elements.flowIntensityValue.textContent = this.config.flowIntensity.toFixed(1);
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
      
      // Restore saved audio device selection
      this.restoreAudioDeviceSelection();
      
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

  private saveAudioDeviceSelection(deviceId: string): void {
    try {
      localStorage.setItem('music-mosaic-audio-device', deviceId);
      console.log('Saved audio device selection:', deviceId);
    } catch (error) {
      console.error('Error saving audio device selection:', error);
    }
  }

  private restoreAudioDeviceSelection(): void {
    try {
      const savedDeviceId = localStorage.getItem('music-mosaic-audio-device');
      if (savedDeviceId !== null) {
        // Check if the saved device still exists in the options
        const optionExists = Array.from(this.elements.audioInputSelect.options)
          .some(option => option.value === savedDeviceId);
        
        if (optionExists) {
          this.elements.audioInputSelect.value = savedDeviceId;
          console.log('Restored audio device selection:', savedDeviceId);
        } else {
          console.log('Saved audio device no longer available, using default');
        }
      }
    } catch (error) {
      console.error('Error restoring audio device selection:', error);
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

  updateAudioEffectIntensities(intensities: {
    rippleIntensity: number;
    pulseIntensity: number;
    detailIntensity: number;
    beatIntensity: number;
    rotationIntensity: number;
    flowIntensity: number;
  }): void {
    this.elements.rippleIntensitySlider.value = intensities.rippleIntensity.toString();
    this.elements.pulseIntensitySlider.value = intensities.pulseIntensity.toString();
    this.elements.detailIntensitySlider.value = intensities.detailIntensity.toString();
    this.elements.beatIntensitySlider.value = intensities.beatIntensity.toString();
    this.elements.rotationIntensitySlider.value = intensities.rotationIntensity.toString();
    this.elements.flowIntensitySlider.value = intensities.flowIntensity.toString();
    
    this.updateValueDisplays();
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  // Settings modal methods
  private toggleSettingsModal(): void {
    this.elements.settingsModal.classList.toggle('hidden');
  }

  private hideSettingsModal(): void {
    this.elements.settingsModal.classList.add('hidden');
  }

  showSettingsModal(): void {
    this.elements.settingsModal.classList.remove('hidden');
  }
}