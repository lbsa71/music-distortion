export type AppState = 'BOOT' | 'IDLE' | 'FADE_IN' | 'RUN' | 'TRANSITION' | 'FADE_OUT' | 'BLACK';

export interface AppConfig {
  cycleSeconds: number;
  gridTileSize: number;
  fadeInMs: number;
  transitionMs: number;
  fadeOutMs: number;
  fftSize: 2048 | 1024 | 512;
  silenceRms: number;
  silenceHoldMs: number;
  resumeHoldMs: number;
  distortionStrength: number;
  audioTransitionThreshold: number;
  audioTransitionHoldMs: number;
  lowBand: [number, number];
  midBand: [number, number];
  highBand: [number, number];
  // Enhanced audio-reactive effect controls
  rippleIntensity: number;
  pulseIntensity: number;
  detailIntensity: number;
  beatIntensity: number;
  rotationIntensity: number;
  flowIntensity: number;
  // Random intensity cycling
  enableRandomIntensities: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  cycleSeconds: 30,
  gridTileSize: 32,
  fadeInMs: 1200,
  transitionMs: 2000,
  fadeOutMs: 600,
  fftSize: 2048,
  silenceRms: 0.01,
  silenceHoldMs: 3000,
  resumeHoldMs: 500,
  distortionStrength: 1.0,
  audioTransitionThreshold: 0.3,
  audioTransitionHoldMs: 1000,
  lowBand: [20, 200],
  midBand: [200, 2000],
  highBand: [2000, 8000],
  // Enhanced audio-reactive effect defaults
  rippleIntensity: 1.0,
  pulseIntensity: 1.0,
  detailIntensity: 1.0,
  beatIntensity: 1.0,
  rotationIntensity: 1.0,
  flowIntensity: 1.0,
  // Random intensity cycling
  enableRandomIntensities: true,
};

export interface TileUniforms {
  time: number;
  alpha: number;
  cols: number;
  rows: number;
  imgW: number;
  imgH: number;
  strength: number;
  rippleIntensity: number;
  pulseIntensity: number;
  detailIntensity: number;
  beatIntensity: number;
  rotationIntensity: number;
  flowIntensity: number;
}

export interface AudioBands {
  low: number;
  mid: number;
  high: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Generate logarithmically weighted random intensity (tends towards lower values)
export function generateLogWeightedIntensity(min: number = 0.1, max: number = 2.0): number {
  // Generate random value between 0 and 1
  const random = Math.random();
  
  // Apply logarithmic weighting (square root to bias towards lower values)
  const weighted = Math.sqrt(random);
  
  // Scale to desired range
  return min + (max - min) * weighted;
}