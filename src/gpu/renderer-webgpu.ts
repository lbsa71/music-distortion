import { GPUDeviceInfo } from './device.js';
import { TextureManager } from './textures.js';
import { BufferManager } from './buffers.js';
import { createPipelines, PipelineResources } from './pipelines.js';
import { LoadedImage } from '../images/loader.js';
import { TileUniforms, AudioBands, DetailedAudioData } from '../core/config.js';

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

  async setCurrentImage(image: LoadedImage, tileSize: number): Promise<void> {
    await this.textureManager.setCurrentImage(image);
    this.updateTileGrid(image, tileSize);
    this.updateBindGroups();
  }

  async setNextImage(image: LoadedImage): Promise<void> {
    await this.textureManager.setNextImage(image);
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

    // Validate all required resources exist
    if (!uniformBuffer || !instanceBuffer || !this.textureManager.isValidForRendering()) {
      console.warn('Missing required resources for bind group creation');
      return;
    }

    try {
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

      // Create texture bind group - only if we have both current and next textures
      if (nextTex) {
        console.log('Creating texture bind group with textures:', {
          currentTex: !!currentTex,
          nextTex: !!nextTex,
          fftTex: !!fftTex,
          sampler: !!this.pipelines.sampler
        });
        
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
              resource: currentTex!.createView()
            },
            {
              binding: 2,
              resource: nextTex.createView()
            },
            {
              binding: 3,
              resource: fftTex!.createView()
            }
          ]
        });
        
        console.log('Texture bind group created successfully');
      } else {
        // Clear texture bind group if next texture is not available
        this.textureBindGroup = null;
        console.log('No next texture available, clearing texture bind group');
      }

      // Create grayscale bind group
      if (grayscaleTex) {
        this.grayscaleBindGroup = this.deviceInfo.device.createBindGroup({
          label: 'Grayscale Bind Group',
          layout: this.pipelines.grayscaleBindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: currentTex!.createView()
            },
            {
              binding: 1,
              resource: grayscaleTex.createView()
            }
          ]
        });
      } else {
        this.grayscaleBindGroup = null;
      }
    } catch (error) {
      console.error('Error creating bind groups:', error);
      // Clear bind groups on error to prevent using invalid ones
      this.uniformBindGroup = null;
      this.textureBindGroup = null;
      this.grayscaleBindGroup = null;
    }
  }

  private isValidForRendering(): boolean {
    return !!(
      this.pipelines &&
      this.uniformBindGroup &&
      this.textureManager.isValidForRendering() &&
      this.bufferManager.getUniformBuffer() &&
      this.bufferManager.getInstanceBuffer()
    );
  }

  render(uniforms: TileUniforms, audioBands: AudioBands): void {
    if (!this.isValidForRendering()) {
      console.warn('Renderer not ready for rendering, skipping frame');
      return;
    }

    // Update uniforms
    this.bufferManager.updateUniforms(uniforms);
    
    // Update per-tile audio movement
    this.bufferManager.updateInstanceAudioMovement(
      uniforms.cols,
      uniforms.rows,
      audioBands,
      uniforms.time
    );
    
    // Update FFT data
    this.textureManager.updateFftData(audioBands.low, audioBands.mid, audioBands.high);

    try {
      // Get command encoder
      const commandEncoder = this.deviceInfo.device.createCommandEncoder({
        label: 'Render Command Encoder'
      });

      // Run grayscale compute pass (if needed)
      if (this.grayscaleBindGroup) {
        const computePass = commandEncoder.beginComputePass({
          label: 'Grayscale Compute Pass'
        });
        
        computePass.setPipeline(this.pipelines!.grayscaleComputePipeline);
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

      renderPass.setPipeline(this.pipelines!.mosaicRenderPipeline);
      renderPass.setBindGroup(0, this.uniformBindGroup);
      
      // Only set texture bind group if it exists
      if (this.textureBindGroup) {
        console.log('Setting texture bind group in render pass');
        renderPass.setBindGroup(1, this.textureBindGroup);
      } else {
        console.warn('No texture bind group available for render pass');
      }

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
    } catch (error) {
      console.error('Error during render:', error);
      // Try to recreate bind groups on render error
      this.updateBindGroups();
    }
  }

  swapTextures(): void {
    this.textureManager.swapTextures();
    this.updateBindGroups();
  }

  renderWithDetailedAudio(uniforms: TileUniforms, detailedAudio: DetailedAudioData): void {
    if (!this.isValidForRendering()) {
      console.warn('Renderer not ready for rendering, skipping frame');
      return;
    }

    // Update uniforms
    this.bufferManager.updateUniforms(uniforms);
    
    // Update per-tile audio movement with detailed audio data
    this.bufferManager.updateInstanceDetailedAudioMovement(
      uniforms.cols,
      uniforms.rows,
      detailedAudio,
      uniforms.time
    );
    
    // Update FFT data
    this.textureManager.updateFftData(detailedAudio.bands.low, detailedAudio.bands.mid, detailedAudio.bands.high);

    try {
      // Get command encoder
      const commandEncoder = this.deviceInfo.device.createCommandEncoder({
        label: 'Render Command Encoder'
      });

      // Run grayscale compute pass (if needed)
      if (this.grayscaleBindGroup) {
        const computePass = commandEncoder.beginComputePass({
          label: 'Grayscale Compute Pass'
        });
        
        computePass.setPipeline(this.pipelines!.grayscaleComputePipeline);
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

      renderPass.setPipeline(this.pipelines!.mosaicRenderPipeline);
      renderPass.setBindGroup(0, this.uniformBindGroup);
      
      // Only set texture bind group if it exists
      if (this.textureBindGroup) {
        console.log('Setting texture bind group in render pass');
        renderPass.setBindGroup(1, this.textureBindGroup);
      } else {
        console.warn('No texture bind group available for render pass');
      }

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
    } catch (error) {
      console.error('Error during render:', error);
      // Try to recreate bind groups on render error
      this.updateBindGroups();
    }
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
    // Clear bind groups first
    this.uniformBindGroup = null;
    this.textureBindGroup = null;
    this.grayscaleBindGroup = null;
    
    this.textureManager.destroy();
    this.bufferManager.destroy();
    console.log('WebGPU renderer destroyed');
  }
}