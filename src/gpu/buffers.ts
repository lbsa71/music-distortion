import { TileUniforms, DetailedAudioData } from '../core/config.js';
import { GPUDeviceInfo } from './device.js';

// WebGPU types are imported from @webgpu/types

export interface TileInstance {
  tileX: number;
  tileY: number;
  brightness: number;
  audioOffsetX: number;
  audioOffsetY: number;
  audioIntensity: number;
  pad: number;
}

export class BufferManager {
  private device: any;
  private vertexBuffer: any = null;
  private instanceBuffer: any = null;
  private uniformBuffer: any = null;
  private currentCols = 0;
  private currentRows = 0;

  constructor(deviceInfo: GPUDeviceInfo) {
    this.device = deviceInfo.device;
    this.createVertexBuffer();
    this.createUniformBuffer();
  }

  private createVertexBuffer(): void {
    // Create a quad (two triangles)
    const vertices = new Float32Array([
      // Position   UV
      -1.0, -1.0,   0.0, 1.0,  // Bottom-left
       1.0, -1.0,   1.0, 1.0,  // Bottom-right
       1.0,  1.0,   1.0, 0.0,  // Top-right
      -1.0, -1.0,   0.0, 1.0,  // Bottom-left
       1.0,  1.0,   1.0, 0.0,  // Top-right
      -1.0,  1.0,   0.0, 0.0,  // Top-left
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();
  }

  private createUniformBuffer(): void {
    // Size for TileUniforms struct (13 floats = 52 bytes)
    this.uniformBuffer = this.device.createBuffer({
      size: 52,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  createInstanceBuffer(cols: number, rows: number, _imageWidth: number, _imageHeight: number): void {
    const tileCount = cols * rows;
    
    // Only recreate if size changed
    if (this.currentCols !== cols || this.currentRows !== rows) {
      if (this.instanceBuffer) {
        this.instanceBuffer.destroy();
      }

      // Each instance is 7 floats (28 bytes)
      const bufferSize = tileCount * 28;
      
      this.instanceBuffer = this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      const instanceData = new Float32Array(this.instanceBuffer.getMappedRange());
      
      // Fill instance data
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = (row * cols + col) * 7;
          
          // Calculate tile UV coordinates and brightness sampling
          const tileX = col;
          const tileY = row;
          
          // Sample brightness from center of tile region
          // For now, use a simple pattern - this would be updated with actual image analysis
          const brightness = 0.5 + 0.5 * Math.sin((col + row) * 0.1);
          
          // Generate per-tile audio movement patterns
          // Each tile gets unique movement characteristics based on position
          const normalizedX = col / cols;
          const normalizedY = row / rows;
          
          // Create complex movement patterns using multiple sine waves
          const freq1 = 2.0 + normalizedX * 3.0;
          const freq2 = 1.5 + normalizedY * 2.5;
          const freq3 = 3.0 + (normalizedX + normalizedY) * 2.0;
          
          // X movement: combination of different frequencies
          const audioOffsetX = 0.1 * (
            Math.sin(normalizedX * freq1 * Math.PI) * 0.4 +
            Math.cos(normalizedY * freq2 * Math.PI) * 0.3 +
            Math.sin((normalizedX + normalizedY) * freq3 * Math.PI) * 0.3
          );
          
          // Y movement: different pattern for variety
          const audioOffsetY = 0.1 * (
            Math.cos(normalizedX * freq2 * Math.PI) * 0.3 +
            Math.sin(normalizedY * freq1 * Math.PI) * 0.4 +
            Math.cos((normalizedX - normalizedY) * freq3 * Math.PI) * 0.3
          );
          
          // Audio intensity varies by position (will be updated with real audio data)
          const audioIntensity = 0.5 + 0.5 * Math.sin((col + row) * 0.2);
          
          instanceData[index + 0] = tileX;           // tileX
          instanceData[index + 1] = tileY;           // tileY
          instanceData[index + 2] = brightness;      // brightness
          instanceData[index + 3] = audioOffsetX;     // audioOffsetX
          instanceData[index + 4] = audioOffsetY;    // audioOffsetY
          instanceData[index + 5] = audioIntensity;   // audioIntensity
          instanceData[index + 6] = 0;               // padding
        }
      }

      this.instanceBuffer.unmap();
      
      this.currentCols = cols;
      this.currentRows = rows;
    }
  }

  updateUniforms(uniforms: TileUniforms): void {
    if (!this.uniformBuffer) return;

    const data = new Float32Array([
      uniforms.time,
      uniforms.alpha,
      uniforms.cols,
      uniforms.rows,
      uniforms.imgW,
      uniforms.imgH,
      uniforms.strength,
      uniforms.rippleIntensity,
      uniforms.pulseIntensity,
      uniforms.detailIntensity,
      uniforms.beatIntensity,
      uniforms.rotationIntensity,
      uniforms.flowIntensity,
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  updateInstanceBrightness(cols: number, rows: number, brightnessSampler: (x: number, y: number) => number): void {
    if (!this.instanceBuffer || this.currentCols !== cols || this.currentRows !== rows) {
      return;
    }

    const tileCount = cols * rows;
    const instanceData = new Float32Array(tileCount * 7);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = (row * cols + col) * 7;
        
        // Keep existing position data
        instanceData[index + 0] = col;
        instanceData[index + 1] = row;
        
        // Update brightness
        const brightness = brightnessSampler(col / cols, row / rows);
        instanceData[index + 2] = brightness;
        
        // Keep existing audio movement data (will be updated separately)
        const normalizedX = col / cols;
        const normalizedY = row / rows;
        
        const freq1 = 2.0 + normalizedX * 3.0;
        const freq2 = 1.5 + normalizedY * 2.5;
        const freq3 = 3.0 + (normalizedX + normalizedY) * 2.0;
        
        const audioOffsetX = 0.1 * (
          Math.sin(normalizedX * freq1 * Math.PI) * 0.4 +
          Math.cos(normalizedY * freq2 * Math.PI) * 0.3 +
          Math.sin((normalizedX + normalizedY) * freq3 * Math.PI) * 0.3
        );
        
        const audioOffsetY = 0.1 * (
          Math.cos(normalizedX * freq2 * Math.PI) * 0.3 +
          Math.sin(normalizedY * freq1 * Math.PI) * 0.4 +
          Math.cos((normalizedX - normalizedY) * freq3 * Math.PI) * 0.3
        );
        
        const audioIntensity = 0.5 + 0.5 * Math.sin((col + row) * 0.2);
        
        instanceData[index + 3] = audioOffsetX;
        instanceData[index + 4] = audioOffsetY;
        instanceData[index + 5] = audioIntensity;
        instanceData[index + 6] = 0;
      }
    }

    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
  }

  updateInstanceAudioMovement(cols: number, rows: number, audioBands: { low: number; mid: number; high: number }, time: number): void {
    if (!this.instanceBuffer || this.currentCols !== cols || this.currentRows !== rows) {
      return;
    }

    const tileCount = cols * rows;
    const instanceData = new Float32Array(tileCount * 7);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = (row * cols + col) * 7;
        
        // Keep existing position data
        instanceData[index + 0] = col;
        instanceData[index + 1] = row;
        
        // Keep existing brightness (will be updated separately)
        const brightness = 0.5 + 0.5 * Math.sin((col + row) * 0.1);
        instanceData[index + 2] = brightness;
        
        // Calculate complex audio-reactive movement
        const normalizedX = col / cols;
        const normalizedY = row / rows;
        
        // Each tile responds differently to different frequency bands
        const lowResponse = audioBands.low * (0.5 + 0.5 * Math.sin(normalizedX * 4.0 * Math.PI));
        const midResponse = audioBands.mid * (0.5 + 0.5 * Math.cos(normalizedY * 3.0 * Math.PI));
        const highResponse = audioBands.high * (0.5 + 0.5 * Math.sin((normalizedX + normalizedY) * 5.0 * Math.PI));
        
        // Create time-varying movement patterns
        const timePhase1 = time * 0.5 + normalizedX * 2.0 * Math.PI;
        const timePhase2 = time * 0.7 + normalizedY * 1.5 * Math.PI;
        const timePhase3 = time * 1.2 + (normalizedX + normalizedY) * 3.0 * Math.PI;
        
        // X movement: combination of different audio bands and time
        const audioOffsetX = 0.15 * (
          Math.sin(timePhase1) * lowResponse * 0.4 +
          Math.cos(timePhase2) * midResponse * 0.3 +
          Math.sin(timePhase3) * highResponse * 0.3
        );
        
        // Y movement: different pattern for variety
        const audioOffsetY = 0.15 * (
          Math.cos(timePhase2) * lowResponse * 0.3 +
          Math.sin(timePhase1) * midResponse * 0.4 +
          Math.cos(timePhase3) * highResponse * 0.3
        );
        
        // Audio intensity combines all bands with position-based weighting
        const audioIntensity = (lowResponse + midResponse + highResponse) / 3.0;
        
        instanceData[index + 3] = audioOffsetX;
        instanceData[index + 4] = audioOffsetY;
        instanceData[index + 5] = audioIntensity;
        instanceData[index + 6] = 0;
      }
    }

    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
  }

  updateInstanceDetailedAudioMovement(cols: number, rows: number, detailedAudio: DetailedAudioData, time: number): void {
    if (!this.instanceBuffer || this.currentCols !== cols || this.currentRows !== rows) {
      return;
    }

    const tileCount = cols * rows;
    const instanceData = new Float32Array(tileCount * 7);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = (row * cols + col) * 7;
        
        // Keep existing position data
        instanceData[index + 0] = col;
        instanceData[index + 1] = row;
        
        // Keep existing brightness (will be updated separately)
        const brightness = 0.5 + 0.5 * Math.sin((col + row) * 0.1);
        instanceData[index + 2] = brightness;
        
        // Calculate complex audio-reactive movement using detailed audio data
        const normalizedX = col / cols;
        const normalizedY = row / rows;
        
        // Use spectral centroid to influence movement patterns
        const centroidInfluence = detailedAudio.spectralCentroid;
        const rolloffInfluence = detailedAudio.spectralRolloff;
        
        // Each tile responds differently to different frequency bands
        const lowResponse = detailedAudio.bands.low * (0.5 + 0.5 * Math.sin(normalizedX * 4.0 * Math.PI));
        const midResponse = detailedAudio.bands.mid * (0.5 + 0.5 * Math.cos(normalizedY * 3.0 * Math.PI));
        const highResponse = detailedAudio.bands.high * (0.5 + 0.5 * Math.sin((normalizedX + normalizedY) * 5.0 * Math.PI));
        
        // Create time-varying movement patterns with beat detection
        const beatMultiplier = detailedAudio.beatDetected ? 2.0 : 1.0;
        const timePhase1 = time * 0.5 + normalizedX * 2.0 * Math.PI;
        const timePhase2 = time * 0.7 + normalizedY * 1.5 * Math.PI;
        const timePhase3 = time * 1.2 + (normalizedX + normalizedY) * 3.0 * Math.PI;
        
        // X movement: combination of different audio bands, spectral properties, and time
        const audioOffsetX = 0.2 * beatMultiplier * (
          Math.sin(timePhase1) * lowResponse * 0.3 +
          Math.cos(timePhase2) * midResponse * 0.3 +
          Math.sin(timePhase3) * highResponse * 0.2 +
          Math.cos(timePhase1 + centroidInfluence * 2.0) * centroidInfluence * 0.1 +
          Math.sin(timePhase2 + rolloffInfluence * 1.5) * rolloffInfluence * 0.1
        );
        
        // Y movement: different pattern for variety
        const audioOffsetY = 0.2 * beatMultiplier * (
          Math.cos(timePhase2) * lowResponse * 0.3 +
          Math.sin(timePhase1) * midResponse * 0.3 +
          Math.cos(timePhase3) * highResponse * 0.2 +
          Math.sin(timePhase2 + centroidInfluence * 1.5) * centroidInfluence * 0.1 +
          Math.cos(timePhase1 + rolloffInfluence * 2.0) * rolloffInfluence * 0.1
        );
        
        // Audio intensity combines all bands with spectral properties
        const audioIntensity = (
          lowResponse * 0.4 +
          midResponse * 0.3 +
          highResponse * 0.2 +
          centroidInfluence * 0.05 +
          rolloffInfluence * 0.05
        );
        
        instanceData[index + 3] = audioOffsetX;
        instanceData[index + 4] = audioOffsetY;
        instanceData[index + 5] = audioIntensity;
        instanceData[index + 6] = 0;
      }
    }

    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
  }

  getVertexBuffer(): any {
    return this.vertexBuffer;
  }

  getInstanceBuffer(): any {
    return this.instanceBuffer;
  }

  getUniformBuffer(): any {
    return this.uniformBuffer;
  }

  getTileCount(): number {
    return this.currentCols * this.currentRows;
  }

  destroy(): void {
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }
    
    if (this.instanceBuffer) {
      this.instanceBuffer.destroy();
      this.instanceBuffer = null;
    }
    
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
  }
}