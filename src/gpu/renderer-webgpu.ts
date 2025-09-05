import { GPUDeviceInfo } from './device.js';
import { TextureManager } from './textures.js';
import { BufferManager } from './buffers.js';
import { createPipelines, PipelineResources } from './pipelines.js';
import { LoadedImage } from '../images/loader.js';
import { TileUniforms, AudioBands } from '../core/config.js';

export class WebGPURenderer {
  private deviceInfo: GPUDeviceInfo;
  private textureManager: TextureManager;
  private bufferManager: BufferManager;
  private pipelines: PipelineResources | null = null;
  
  private uniformBindGroup: GPUBindGroup | null = null;
  private textureBindGroup: GPUBindGroup | null = null;
  private grayscaleBindGroup: GPUBindGroup | null = null;

  constructor(deviceInfo: GPUDeviceInfo) {
    this.deviceInfo = deviceInfo;
    this.textureManager = new TextureManager(deviceInfo);
    this.bufferManager = new BufferManager(deviceInfo);
  }

  async initialize(): Promise<void> {
    try {
      this.pipelines = await createPipelines(this.deviceInfo);
      console.log('WebGPU renderer initialized');
    } catch (error) {
      console.error('Error initializing WebGPU renderer:', error);
      throw error;
    }
  }

  setCurrentImage(image: LoadedImage, tileSize: number): void {
    this.textureManager.setCurrentImage(image);
    this.updateTileGrid(image, tileSize);
    this.updateBindGroups();
  }

  setNextImage(image: LoadedImage): void {
    this.textureManager.setNextImage(image);
    this.updateBindGroups();
  }

  private updateTileGrid(image: LoadedImage, tileSize: number): void {
    const cols = Math.ceil(image.width / tileSize);
    const rows = Math.ceil(image.height / tileSize);
    
    this.bufferManager.createInstanceBuffer(cols, rows, image.width, image.height);
  }

  private updateBindGroups(): void {
    if (!this.pipelines) return;

    const uniformBuffer = this.bufferManager.getUniformBuffer();
    const instanceBuffer = this.bufferManager.getInstanceBuffer();
    const currentTex = this.textureManager.getCurrentTexture();
    const nextTex = this.textureManager.getNextTexture();
    const fftTex = this.textureManager.getFftTexture();
    const grayscaleTex = this.textureManager.getGrayscaleTexture();

    if (!uniformBuffer || !instanceBuffer || !currentTex || !fftTex) {
      return;
    }

    // Create uniform bind group
    this.uniformBindGroup = this.deviceInfo.device.createBindGroup({
      label: 'Uniform Bind Group',
      layout: this.pipelines.uniformBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer }
        },
        {
          binding: 1,
          resource: { buffer: instanceBuffer }
        }
      ]
    });

    // Create texture bind group
    if (nextTex) {
      this.textureBindGroup = this.deviceInfo.device.createBindGroup({
        label: 'Texture Bind Group',
        layout: this.pipelines.textureBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: this.pipelines.sampler
          },
          {
            binding: 1,
            resource: currentTex.createView()
          },
          {
            binding: 2,
            resource: nextTex.createView()
          },
          {
            binding: 3,
            resource: fftTex.createView()
          }
        ]
      });
    }

    // Create grayscale bind group
    if (grayscaleTex) {
      this.grayscaleBindGroup = this.deviceInfo.device.createBindGroup({
        label: 'Grayscale Bind Group',
        layout: this.pipelines.grayscaleBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: currentTex.createView()
          },
          {
            binding: 1,
            resource: grayscaleTex.createView()
          }
        ]
      });
    }
  }

  render(uniforms: TileUniforms, audioBands: AudioBands): void {
    if (!this.pipelines || !this.uniformBindGroup || !this.textureBindGroup) {
      return;
    }

    // Update uniforms
    this.bufferManager.updateUniforms(uniforms);
    
    // Update FFT data
    this.textureManager.updateFftData(audioBands.low, audioBands.mid, audioBands.high);

    // Get command encoder
    const commandEncoder = this.deviceInfo.device.createCommandEncoder({
      label: 'Render Command Encoder'
    });

    // Run grayscale compute pass (if needed)
    if (this.grayscaleBindGroup) {
      const computePass = commandEncoder.beginComputePass({
        label: 'Grayscale Compute Pass'
      });
      
      computePass.setPipeline(this.pipelines.grayscaleComputePipeline);
      computePass.setBindGroup(0, this.grayscaleBindGroup);
      
      // Dispatch compute shader
      const workgroupsX = Math.ceil(uniforms.imgW / 16);
      const workgroupsY = Math.ceil(uniforms.imgH / 16);
      computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
      
      computePass.end();
    }

    // Render pass
    const renderPass = commandEncoder.beginRenderPass({
      label: 'Mosaic Render Pass',
      colorAttachments: [
        {
          view: this.deviceInfo.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipelines.mosaicRenderPipeline);
    renderPass.setBindGroup(0, this.uniformBindGroup);
    renderPass.setBindGroup(1, this.textureBindGroup);

    const vertexBuffer = this.bufferManager.getVertexBuffer();
    if (vertexBuffer) {
      renderPass.setVertexBuffer(0, vertexBuffer);
      
      // Draw instanced tiles
      const tileCount = this.bufferManager.getTileCount();
      renderPass.draw(6, tileCount); // 6 vertices per quad, instanced
    }

    renderPass.end();

    // Submit commands
    this.deviceInfo.device.queue.submit([commandEncoder.finish()]);
  }

  swapTextures(): void {
    this.textureManager.swapTextures();
    this.updateBindGroups();
  }

  resize(width: number, height: number): void {
    this.deviceInfo.canvas.width = width;
    this.deviceInfo.canvas.height = height;
    
    this.deviceInfo.context.configure({
      device: this.deviceInfo.device,
      format: this.deviceInfo.format,
      alphaMode: 'premultiplied',
    });
  }

  destroy(): void {
    this.textureManager.destroy();
    this.bufferManager.destroy();
    console.log('WebGPU renderer destroyed');
  }
}