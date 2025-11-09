import { LoadedImage } from '../images/loader.js';
import { GPUDeviceInfo } from './device.js';

export class TextureManager {
  private device: GPUDevice;
  private currentTexture: GPUTexture | null = null;
  private nextTexture: GPUTexture | null = null;
  private grayscaleTexture: GPUTexture | null = null;
  private fftTexture: GPUTexture | null = null;

  constructor(deviceInfo: GPUDeviceInfo) {
    this.device = deviceInfo.device;
    this.initializeFftTexture();
  }

  private initializeFftTexture(): void {
    // Create a small texture for FFT band data (1x1 RGBA)
    this.fftTexture = this.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }

  async createTextureFromImage(image: LoadedImage): Promise<GPUTexture> {
    const texture = this.device.createTexture({
      size: [image.width, image.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | 
             GPUTextureUsage.COPY_DST | 
             GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Copy image data to texture
    this.device.queue.copyExternalImageToTexture(
      { source: image.bitmap },
      { texture },
      [image.width, image.height, 1]
    );

    // Wait for the copy operation to complete
    await this.device.queue.onSubmittedWorkDone();

    return texture;
  }

  createGrayscaleTexture(width: number, height: number): GPUTexture {
    return this.device.createTexture({
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | 
             GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST,
    });
  }

  async setCurrentImage(image: LoadedImage): Promise<void> {
    // Clean up old texture
    if (this.currentTexture) {
      this.currentTexture.destroy();
      this.currentTexture = null;
    }

    this.currentTexture = await this.createTextureFromImage(image);
    
    // Create/update grayscale texture
    if (this.grayscaleTexture) {
      this.grayscaleTexture.destroy();
      this.grayscaleTexture = null;
    }
    this.grayscaleTexture = this.createGrayscaleTexture(image.width, image.height);
  }

  async setNextImage(image: LoadedImage): Promise<void> {
    // Clean up old texture
    if (this.nextTexture) {
      this.nextTexture.destroy();
      this.nextTexture = null;
    }

    this.nextTexture = await this.createTextureFromImage(image);
  }

  swapTextures(): void {
    // Swap current and next textures
    const temp = this.currentTexture;
    this.currentTexture = this.nextTexture;
    this.nextTexture = temp;
  }

  updateFftData(low: number, mid: number, high: number): void {
    if (!this.fftTexture) return;

    // Convert float values (0-1) to normalized bytes (0-255)
    const fftData = new Uint8Array([
      Math.round(low * 255),
      Math.round(mid * 255), 
      Math.round(high * 255),
      255 // alpha
    ]);
    
    this.device.queue.writeTexture(
      { texture: this.fftTexture },
      fftData,
      { bytesPerRow: 4 }, // 4 bytes per pixel
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );
  }

  getCurrentTexture(): GPUTexture | null {
    return this.currentTexture;
  }

  getNextTexture(): GPUTexture | null {
    return this.nextTexture;
  }

  getGrayscaleTexture(): GPUTexture | null {
    return this.grayscaleTexture;
  }

  getFftTexture(): GPUTexture | null {
    return this.fftTexture;
  }

  // Validate that all required textures exist and are valid
  isValidForRendering(): boolean {
    return !!(
      this.currentTexture &&
      this.fftTexture &&
      this.grayscaleTexture
    );
  }

  destroy(): void {
    if (this.currentTexture) {
      this.currentTexture.destroy();
      this.currentTexture = null;
    }
    
    if (this.nextTexture) {
      this.nextTexture.destroy();
      this.nextTexture = null;
    }
    
    if (this.grayscaleTexture) {
      this.grayscaleTexture.destroy();
      this.grayscaleTexture = null;
    }
    
    if (this.fftTexture) {
      this.fftTexture.destroy();
      this.fftTexture = null;
    }
  }
}