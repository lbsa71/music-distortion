import { StateMachine } from './fsm.js';
import { DEFAULT_CONFIG, AppConfig, TileUniforms, AudioBands, DetailedAudioData, clamp, easeInOutCubic, generateLogWeightedIntensity } from './config.js';
import { AudioAnalyzer } from '../audio/analyzer.js';
import { getAudioStream, stopAudioStream, requestAudioPermission } from '../audio/input.js';
import { ImageLoader, LoadedImage } from '../images/loader.js';
import { initializeWebGPU, checkWebGPUFeatures } from '../gpu/device.js';
import { WebGPURenderer } from '../gpu/renderer-webgpu.js';
import { WebGL2Renderer } from '../gpu/fallback-webgl.js';
import { UIController } from '../ui/controls.js';
import { WebGPUEnergyRaysRenderer } from '../gpu/webgpu-energy-rays.js';

export class MusicMosaicApp {
  private canvas: HTMLCanvasElement;
  private starsCanvas: HTMLCanvasElement;
  private config: AppConfig;
  private stateMachine: StateMachine;
  private uiController: UIController;
  
  // Core systems
  private audioAnalyzer: AudioAnalyzer | null = null;
  private audioStream: MediaStream | null = null;
  private imageLoader: ImageLoader;
  private renderer: WebGPURenderer | WebGL2Renderer | null = null;
  private energyRaysRenderer: WebGPUEnergyRaysRenderer | null = null;
  
  // State
  private isRunning = false;
  private fpsCounter = { frames: 0, lastTime: 0, fps: 0 };
  
  // Timing
  private cycleStartTime = 0;
  private transitionStartTime = 0;
  private fadeStartTime = 0;
  
  // Images
  private currentImage: LoadedImage | null = null;
  private nextImage: LoadedImage | null = null;
  
  // Audio reactive state
  private lastAudioBands: AudioBands = { low: 0, mid: 0, high: 0 };
  private audioFrozen = false;
  
  // Audio transition state
  private audioTransitionStartTime: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.starsCanvas = document.getElementById('stars-canvas') as HTMLCanvasElement;
    if (!this.starsCanvas) {
      throw new Error('Stars canvas not found');
    }
    this.config = { ...DEFAULT_CONFIG };
    this.stateMachine = new StateMachine();
    this.uiController = new UIController(this.config);
    this.imageLoader = new ImageLoader();
    
    this.setupEventListeners();
    this.setupStateMachine();
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Music Mosaic App...');
      
      // Initialize image loader
      console.log('Step 1: Initializing image loader...');
      await this.imageLoader.initialize();
      console.log('✓ Image loader initialized');
      
      // Try WebGPU first, fallback to WebGL2
      console.log('Step 2: Initializing renderer...');
      await this.initializeRenderer();
      console.log('✓ Renderer initialized');
      
      // Setup UI
      console.log('Step 3: Setting up UI...');
      await this.uiController.populateAudioDevices();
      console.log('✓ Audio devices populated');
      this.uiController.showOverlay();
      console.log('✓ Overlay shown');
      
      // Transition to IDLE state
      console.log('Step 4: Transitioning to IDLE state...');
      this.stateMachine.transitionTo('IDLE');
      console.log('✓ State transitioned to IDLE');
      
      // Initialize energy rays renderer with separate WebGPU device
      console.log('Step 5: Initializing energy rays renderer...');
      const webgpuFeatures = await checkWebGPUFeatures();
      console.log('WebGPU features:', webgpuFeatures);
      console.log('Renderer type:', this.renderer?.constructor.name);
      
      if (webgpuFeatures.supported && this.renderer instanceof WebGPURenderer) {
        try {
          console.log('Creating separate WebGPU adapter...');
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            console.log('Adapter created, requesting device...');
            const device = await adapter.requestDevice();
            console.log('Device created, initializing energy rays renderer...');
            this.energyRaysRenderer = new WebGPUEnergyRaysRenderer(device, this.starsCanvas);
            await this.energyRaysRenderer.initialize();
            console.log('Energy rays renderer initialized, starting...');
            this.energyRaysRenderer.start();
            console.log('✓ WebGPU energy rays renderer initialized with separate device');
          } else {
            console.log('⚠ Failed to get WebGPU adapter for energy rays');
          }
        } catch (error) {
          console.error('Error initializing energy rays renderer:', error);
          this.energyRaysRenderer = null;
        }
      } else {
        console.log('⚠ WebGPU not supported or main renderer not WebGPU, skipping energy rays');
      }
      
      console.log('App initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  private async initializeRenderer(): Promise<void> {
    try {
      // Check WebGPU support
      const webgpuFeatures = await checkWebGPUFeatures();
      console.log('WebGPU support:', webgpuFeatures);
      
      if (webgpuFeatures.supported) {
        const deviceInfo = await initializeWebGPU(this.canvas);
        if (deviceInfo) {
          this.renderer = new WebGPURenderer(deviceInfo);
          await this.renderer.initialize();
          console.log('Using WebGPU renderer');
          return;
        }
      }
      
      // Fallback to WebGL2
      console.log('Falling back to WebGL2 renderer');
      this.renderer = new WebGL2Renderer(this.canvas);
      await this.renderer.initialize();
    } catch (error) {
      console.error('Error initializing renderer:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // UI event handlers
    this.uiController.on('enable-audio', () => this.enableAudio());
    this.uiController.on('visualize-without-audio', () => this.startWithoutAudio());
    this.uiController.on('start-audio', () => this.startAudio());
    this.uiController.on('stop-audio', () => this.stopAudio());
    this.uiController.on('next-image', () => this.forceNextImage());
    this.uiController.on('freeze-audio', () => this.toggleAudioFreeze());
    
    // Window resize
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize(); // Initial resize
  }

  private setupStateMachine(): void {
    this.stateMachine.onStateEnter('FADE_IN', () => this.onFadeInStart());
    this.stateMachine.onStateEnter('RUN', () => this.onRunStart());
    this.stateMachine.onStateEnter('TRANSITION', () => this.onTransitionStart());
    this.stateMachine.onStateEnter('FADE_OUT', () => this.onFadeOutStart());
    this.stateMachine.onStateEnter('BLACK', () => this.onBlackStart());
  }

  private handleResize(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (this.renderer) {
      this.renderer.resize(width, height);
    }
    
    // Also resize energy rays canvas
    if (this.energyRaysRenderer) {
      this.energyRaysRenderer.handleResize();
    }
  }

  // Audio handling
  private async enableAudio(): Promise<void> {
    try {
      const hasPermission = await requestAudioPermission();
      if (hasPermission) {
        await this.uiController.populateAudioDevices();
        this.uiController.hideOverlay();
        this.uiController.setAudioControlsEnabled(true);
      }
    } catch (error) {
      console.error('Error enabling audio:', error);
    }
  }

  private async startWithoutAudio(): Promise<void> {
    this.uiController.hideOverlay();
    this.uiController.setAudioControlsEnabled(false);
    this.startVisualization();
  }

  private async startAudio(): Promise<void> {
    try {
      this.audioStream = await getAudioStream();
      
      this.audioAnalyzer = new AudioAnalyzer(this.config);
      await this.audioAnalyzer.initialize(this.audioStream);
      
      this.startVisualization();
      this.uiController.setAudioControlsEnabled(false);
    } catch (error) {
      console.error('Error starting audio:', error);
    }
  }

  private stopAudio(): void {
    if (this.audioAnalyzer) {
      this.audioAnalyzer.destroy();
      this.audioAnalyzer = null;
    }
    
    if (this.audioStream) {
      stopAudioStream(this.audioStream);
      this.audioStream = null;
    }
    
    this.stopVisualization();
    this.uiController.setAudioControlsEnabled(true);
  }

  private async startVisualization(): Promise<void> {
    if (this.isRunning) return;
    
    try {
      // Load initial image
      this.currentImage = await this.imageLoader.loadRandomImage();
      console.log('Current image loaded:', this.currentImage.url);
      
      if (this.renderer && this.currentImage) {
        await this.renderer.setCurrentImage(this.currentImage, this.config.gridTileSize);
        this.stateMachine.transitionTo('FADE_IN');
        this.startRenderLoop();
      }
    } catch (error) {
      console.error('Error starting visualization:', error);
    }
  }

  private stopVisualization(): void {
    this.isRunning = false;
    this.stateMachine.reset();
    this.uiController.updateState('IDLE');
  }

  private async resumeVisualization(): Promise<void> {
    console.log('Resuming visualization...');
    try {
      // Generate new random intensities for the resumed image
      this.generateRandomIntensities();
      
      // Load the next image in sequence for resuming
      this.currentImage = await this.imageLoader.loadNextImage();
      console.log('Resume image loaded:', this.currentImage.url);
      
      if (this.renderer && this.currentImage) {
        await this.renderer.setCurrentImage(this.currentImage, this.config.gridTileSize);
        this.stateMachine.transitionTo('FADE_IN');
        // Don't call startRenderLoop() since it's already running
        console.log('Visualization resumed successfully');
      }
    } catch (error) {
      console.error('Error resuming visualization:', error);
    }
  }

  private generateRandomIntensities(): void {
    if (this.config.enableRandomIntensities) {
      this.config.rippleIntensity = generateLogWeightedIntensity(0.1, 2.0);
      this.config.pulseIntensity = generateLogWeightedIntensity(0.1, 2.0);
      this.config.detailIntensity = generateLogWeightedIntensity(0.1, 2.0);
      this.config.beatIntensity = generateLogWeightedIntensity(0.1, 2.0);
      this.config.rotationIntensity = generateLogWeightedIntensity(0.1, 2.0);
      this.config.flowIntensity = generateLogWeightedIntensity(0.1, 2.0);
      
      // Update the UI sliders to reflect the new values
      this.uiController.updateAudioEffectIntensities({
        rippleIntensity: this.config.rippleIntensity,
        pulseIntensity: this.config.pulseIntensity,
        detailIntensity: this.config.detailIntensity,
        beatIntensity: this.config.beatIntensity,
        rotationIntensity: this.config.rotationIntensity,
        flowIntensity: this.config.flowIntensity,
      });
      
      console.log('Generated random intensities:', {
        ripple: this.config.rippleIntensity.toFixed(2),
        pulse: this.config.pulseIntensity.toFixed(2),
        detail: this.config.detailIntensity.toFixed(2),
        beat: this.config.beatIntensity.toFixed(2),
        rotation: this.config.rotationIntensity.toFixed(2),
        flow: this.config.flowIntensity.toFixed(2)
      });
    }
  }

  private generateRandomTileSize(): void {
    if (this.config.enableRandomTileSize) {
      // Exponential distribution gravitating toward smaller tiles
      // 6 is perfect low center, 200 is nice high center
      const minTileSize = 6;
      const maxTileSize = 200;
      
      // Generate exponential random value (0 to 1)
      const exponential = -Math.log(Math.random());
      
      // Map to tile size range, with bias toward smaller values
      const normalized = Math.min(exponential / 4.0, 1.0); // Cap at 4 for reasonable distribution
      const tileSize = Math.round(minTileSize + (maxTileSize - minTileSize) * normalized);
      
      this.config.gridTileSize = tileSize;
      
      // Update the UI slider
      this.uiController.updateTileSize(this.config.gridTileSize);
      
      console.log('Generated new random tile size:', this.config.gridTileSize);
    }
  }

  // State machine handlers
  private onFadeInStart(): void {
    this.fadeStartTime = performance.now();
    console.log('Fade in started');
  }

  private onRunStart(): void {
    this.cycleStartTime = performance.now();
    this.preloadNextImage();
    console.log('Run phase started');
  }

  private onTransitionStart(): void {
    this.transitionStartTime = performance.now();
    this.generateRandomIntensities(); // Generate new random intensities for the next image
    this.generateRandomTileSize(); // Generate new random tile size for the next image
    console.log('Transition started');
  }

  private onFadeOutStart(): void {
    this.fadeStartTime = performance.now();
    console.log('Fade out started');
  }

  private onBlackStart(): void {
    console.log('Black phase started');
  }

  // Image management
  private async preloadNextImage(): Promise<void> {
    try {
      this.nextImage = await this.imageLoader.preloadNextImage();
      console.log('Next image preloaded:', this.nextImage.url);
      if (this.renderer && this.nextImage) {
        await this.renderer.setNextImage(this.nextImage);
      }
    } catch (error) {
      console.error('Error preloading next image:', error);
    }
  }

  private async forceNextImage(): Promise<void> {
    if (this.stateMachine.getCurrentState() === 'RUN') {
      console.log('Forcing next image...');
      try {
        // Load the actual next image (advancing the index)
        this.nextImage = await this.imageLoader.loadNextImage();
        console.log('Next image loaded:', this.nextImage.url);
        
        if (this.renderer && this.nextImage) {
          await this.renderer.setNextImage(this.nextImage);
        }
        
        this.stateMachine.transitionTo('TRANSITION');
      } catch (error) {
        console.error('Error loading next image:', error);
      }
    }
  }

  private toggleAudioFreeze(): void {
    this.audioFrozen = !this.audioFrozen;
    console.log('Audio frozen:', this.audioFrozen);
  }

  // Render loop
  private startRenderLoop(): void {
    this.isRunning = true;
    this.render();
  }

  private render = (): void => {
    if (!this.isRunning) return;
    
    const now = performance.now();
    
    // Update FPS counter
    this.updateFPS(now);
    
    // Get audio data
    const audioBands = this.getAudioBands();
    const rms = this.audioAnalyzer?.getRMS() || 0;
    
    // Get detailed audio data for enhanced movement
    let detailedAudio: DetailedAudioData | null = null;
    if (this.audioAnalyzer) {
      detailedAudio = this.audioAnalyzer.getDetailedAudioData();
    }
    
    // Check silence if audio is active
    if (this.audioAnalyzer) {
      const silenceState = this.audioAnalyzer.checkSilence();
      this.handleSilenceDetection(silenceState);
      
      // Check for audio-reactive image transitions
      this.handleAudioTransition(audioBands, rms, now);
    }
    
    // Update state machine
    this.updateStateMachine(now);
    
    // Create uniforms for rendering
    const uniforms = this.createUniforms(now);
    
    // Render frame with enhanced audio data
    if (this.renderer) {
      if (detailedAudio && 'renderWithDetailedAudio' in this.renderer) {
        // Use WebGPU renderer with detailed audio data
        (this.renderer as WebGPURenderer).renderWithDetailedAudio(uniforms, detailedAudio);
      } else {
        // Fallback to basic audio bands
        this.renderer.render(uniforms, audioBands);
      }
    }
    
    // Update UI
    this.updateUI(audioBands, rms);
    
    requestAnimationFrame(this.render);
  };

  private updateFPS(now: number): void {
    this.fpsCounter.frames++;
    if (now - this.fpsCounter.lastTime >= 1000) {
      this.fpsCounter.fps = Math.round((this.fpsCounter.frames * 1000) / (now - this.fpsCounter.lastTime));
      this.fpsCounter.frames = 0;
      this.fpsCounter.lastTime = now;
    }
  }

  private getAudioBands(): AudioBands {
    if (!this.audioAnalyzer || this.audioFrozen) {
      return this.lastAudioBands;
    }
    
    const bands = this.audioAnalyzer.getAudioBands();
    this.lastAudioBands = bands;
    return bands;
  }

  private handleSilenceDetection(silenceState: { isSilent: boolean; shouldResume: boolean }): void {
    const currentState = this.stateMachine.getCurrentState();
    
    console.log('Silence detection:', { 
      isSilent: silenceState.isSilent, 
      shouldResume: silenceState.shouldResume, 
      currentState 
    });
    
    if (silenceState.isSilent && (currentState === 'RUN' || currentState === 'TRANSITION')) {
      console.log('Transitioning to FADE_OUT due to silence');
      this.stateMachine.transitionTo('FADE_OUT');
    } else if (silenceState.shouldResume && currentState === 'BLACK') {
      console.log('Resuming visualization from BLACK state');
      this.resumeVisualization();
    }
  }

  private handleAudioTransition(audioBands: AudioBands, rms: number, now: number): void {
    const currentState = this.stateMachine.getCurrentState();
    
    // Only trigger transitions during RUN state
    if (currentState !== 'RUN') {
      this.audioTransitionStartTime = null;
      return;
    }
    
    // Calculate combined audio intensity (RMS + band energy)
    const combinedIntensity = rms + (audioBands.low + audioBands.mid + audioBands.high) / 3;
    
    // Pass audio data to energy rays renderer
    if (this.energyRaysRenderer) {
      this.energyRaysRenderer.setAudioData({
        intensity: combinedIntensity
      });
    }
    
    if (combinedIntensity >= this.config.audioTransitionThreshold) {
      // Above threshold - start counting
      if (this.audioTransitionStartTime === null) {
        this.audioTransitionStartTime = now;
        console.log('Audio transition threshold reached:', combinedIntensity);
      }
      
      const holdDuration = now - this.audioTransitionStartTime;
      if (holdDuration >= this.config.audioTransitionHoldMs) {
        console.log('Audio transition triggered after', holdDuration, 'ms');
        this.stateMachine.transitionTo('TRANSITION');
        this.audioTransitionStartTime = null;
      }
    } else {
      // Below threshold - reset counter
      this.audioTransitionStartTime = null;
    }
  }

  private updateStateMachine(now: number): void {
    const currentState = this.stateMachine.getCurrentState();
    
    switch (currentState) {
      case 'FADE_IN':
        if (now - this.fadeStartTime >= this.config.fadeInMs) {
          this.stateMachine.transitionTo('RUN');
        }
        break;
        
      case 'RUN':
        if (now - this.cycleStartTime >= this.config.cycleSeconds * 1000) {
          this.stateMachine.transitionTo('TRANSITION');
        }
        break;
        
      case 'TRANSITION':
        if (now - this.transitionStartTime >= this.config.transitionMs) {
          // Swap textures and return to RUN
          if (this.renderer) {
            this.renderer.swapTextures();
          }
          console.log('Swapping images - old current:', this.currentImage?.url, 'new current:', this.nextImage?.url);
          this.currentImage = this.nextImage;
          this.nextImage = null;
          this.stateMachine.transitionTo('RUN');
        }
        break;
        
      case 'FADE_OUT':
        if (now - this.fadeStartTime >= this.config.fadeOutMs) {
          this.stateMachine.transitionTo('BLACK');
        }
        break;
    }
  }

  private createUniforms(now: number): TileUniforms {
    const currentState = this.stateMachine.getCurrentState();
    let alpha = 1.0;
    
    // Calculate alpha based on current state
    switch (currentState) {
      case 'FADE_IN':
        const fadeInProgress = clamp((now - this.fadeStartTime) / this.config.fadeInMs, 0, 1);
        alpha = easeInOutCubic(fadeInProgress);
        break;
        
      case 'TRANSITION':
        const transitionProgress = clamp((now - this.transitionStartTime) / this.config.transitionMs, 0, 1);
        alpha = easeInOutCubic(transitionProgress);
        break;
        
      case 'FADE_OUT':
        const fadeOutProgress = clamp((now - this.fadeStartTime) / this.config.fadeOutMs, 0, 1);
        alpha = 1.0 - easeInOutCubic(fadeOutProgress);
        break;
        
      case 'BLACK':
        alpha = 0.0;
        break;
    }
    
    const imageWidth = this.currentImage?.width || 1920;
    const imageHeight = this.currentImage?.height || 1080;
    const cols = Math.ceil(imageWidth / this.config.gridTileSize);
    const rows = Math.ceil(imageHeight / this.config.gridTileSize);
    
    return {
      time: now / 1000,
      alpha,
      cols,
      rows,
      imgW: imageWidth,
      imgH: imageHeight,
      strength: this.config.distortionStrength,
      rippleIntensity: this.config.rippleIntensity,
      pulseIntensity: this.config.pulseIntensity,
      detailIntensity: this.config.detailIntensity,
      beatIntensity: this.config.beatIntensity,
      rotationIntensity: this.config.rotationIntensity,
      flowIntensity: this.config.flowIntensity,
    };
  }

  private updateUI(audioBands: AudioBands, rms: number): void {
    this.uiController.updateFPS(this.fpsCounter.fps);
    this.uiController.updateRMS(rms);
    this.uiController.updateState(this.stateMachine.getCurrentState());
    this.uiController.updateAudioBands(audioBands.low, audioBands.mid, audioBands.high);
  }

  // Cleanup
  destroy(): void {
    this.stopVisualization();
    
    if (this.audioAnalyzer) {
      this.audioAnalyzer.destroy();
    }
    
    if (this.audioStream) {
      stopAudioStream(this.audioStream);
    }
    
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    this.imageLoader.clearCache();
    
    console.log('App destroyed');
  }
}