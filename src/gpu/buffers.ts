import { TileUniforms } from '../core/config.js';
import { GPUDeviceInfo } from './device.js';

// WebGPU types
declare global {
  const GPUBufferUsage: {
    readonly VERTEX: number;
    readonly UNIFORM: number;
    readonly STORAGE: number;
    readonly COPY_DST: number;
  };
}

export interface TileInstance {
  tileX: number;
  tileY: number;
  brightness: number;
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

      // Each instance is 4 floats (16 bytes)
      const bufferSize = tileCount * 16;
      
      this.instanceBuffer = this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      const instanceData = new Float32Array(this.instanceBuffer.getMappedRange());
      
      // Fill instance data
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = (row * cols + col) * 4;
          
          // Calculate tile UV coordinates and brightness sampling
          const tileX = col;
          const tileY = row;
          
          // Sample brightness from center of tile region
          // For now, use a simple pattern - this would be updated with actual image analysis
          const brightness = 0.5 + 0.5 * Math.sin((col + row) * 0.1);
          
          instanceData[index + 0] = tileX;     // tileX
          instanceData[index + 1] = tileY;     // tileY
          instanceData[index + 2] = brightness; // brightness
          instanceData[index + 3] = 0;         // padding
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
    const instanceData = new Float32Array(tileCount * 4);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = (row * cols + col) * 4;
        
        // Keep existing position data
        instanceData[index + 0] = col;
        instanceData[index + 1] = row;
        
        // Update brightness
        const brightness = brightnessSampler(col / cols, row / rows);
        instanceData[index + 2] = brightness;
        instanceData[index + 3] = 0;
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