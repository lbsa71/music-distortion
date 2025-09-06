export class WebGPUEnergyRaysRenderer {
  private device: GPUDevice;
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private fragShaderModule!: GPUShaderModule;
  private screenSizeBuffer!: GPUBuffer;
  private audioDataBuffer!: GPUBuffer;
  private timeBuffer!: GPUBuffer;
  private renderBindGroup!: GPUBindGroup;

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    this.context = canvas.getContext('webgpu')!;
    
    // Size the canvas to match the main canvas
    this.resizeCanvas();
    
    this.context.configure({
      device: this.device,
      format: 'bgra8unorm',
      alphaMode: 'premultiplied'
    });

    // Set canvas background to transparent
    this.canvas.style.background = 'transparent';
  }

  private resizeCanvas(): void {
    const mainCanvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (mainCanvas) {
      const rect = mainCanvas.getBoundingClientRect();
      this.canvas.width = rect.width * window.devicePixelRatio;
      this.canvas.height = rect.height * window.devicePixelRatio;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      console.log('Energy rays canvas resized to:', this.canvas.width, 'x', this.canvas.height);
    }
  }

  async initialize(): Promise<void> {
    await this.createShaders();
    await this.createBuffers();
    await this.createPipelines();
    await this.createBindGroups();
  }

  private async createShaders(): Promise<void> {
    // Load fragment shader only
    const fragResponse = await fetch('/src/gpu/shaders/energy-rays.frag.wgsl');
    if (!fragResponse.ok) {
      throw new Error(`Failed to load fragment shader: ${fragResponse.status}`);
    }
    const fragCode = await fragResponse.text();
    console.log('Fragment shader loaded, length:', fragCode.length);

    // Create fragment shader module
    this.fragShaderModule = this.device.createShaderModule({
      code: fragCode
    });
    
    console.log('Shader module created successfully');
  }

  private async createBuffers(): Promise<void> {
    console.log('Creating buffers...');
    // Create screen size buffer
    this.screenSizeBuffer = this.device.createBuffer({
      size: 2 * 4, // 2 floats
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create audio data buffer
    this.audioDataBuffer = this.device.createBuffer({
      size: 1 * 4, // 1 float for intensity
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create time buffer
    this.timeBuffer = this.device.createBuffer({
      size: 1 * 4, // 1 float for time
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Initialize with current screen size and default audio data
    this.updateScreenSize();
    this.setAudioData({ intensity: 0.0 });
    this.updateTime();
    console.log('Buffers created successfully');
  }

  private updateScreenSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenSize = new Float32Array([
      rect.width * window.devicePixelRatio,
      rect.height * window.devicePixelRatio
    ]);
    
    // Debug: log canvas size occasionally
    if (Math.random() < 0.01) { // ~1/100 chance
      console.log('Energy rays canvas size:', {
        rect: rect,
        devicePixelRatio: window.devicePixelRatio,
        screenSize: screenSize,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height
      });
    }
    
    this.device.queue.writeBuffer(this.screenSizeBuffer, 0, screenSize);
  }

  setAudioData(audioData: { intensity: number }): void {
    const intensity = new Float32Array([audioData.intensity]);
    this.device.queue.writeBuffer(this.audioDataBuffer, 0, intensity);
    
    // Debug: log audio intensity occasionally
    if (Math.random() < 0.1) { // ~1/10 chance for more frequent logging
      console.log('Energy rays audio intensity:', audioData.intensity);
    }
  }

  private updateTime(): void {
    const time = new Float32Array([performance.now() / 1000.0]);
    this.device.queue.writeBuffer(this.timeBuffer, 0, time);
  }

  private async createBindGroups(): Promise<void> {
    console.log('Creating render bind group...');
    // Create render bind group with screen size, audio data, and time buffers
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.screenSizeBuffer
          }
        },
        {
          binding: 1,
          resource: {
            buffer: this.audioDataBuffer
          }
        },
        {
          binding: 2,
          resource: {
            buffer: this.timeBuffer
          }
        }
      ]
    });
    console.log('Render bind group created successfully');
  }

  private async createPipelines(): Promise<void> {
    console.log('Creating render pipeline...');
    try {
      // Create render pipeline only
      this.pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: this.device.createShaderModule({
            code: `
              @vertex
              fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                var pos = array<vec2<f32>, 6>(
                  vec2<f32>(-1.0, -1.0),
                  vec2<f32>( 1.0, -1.0),
                  vec2<f32>(-1.0,  1.0),
                  vec2<f32>(-1.0,  1.0),
                  vec2<f32>( 1.0, -1.0),
                  vec2<f32>( 1.0,  1.0)
                );
                return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
              }
            `
          }),
          entryPoint: 'main'
        },
        fragment: {
          module: this.fragShaderModule,
          entryPoint: 'main',
          targets: [{
            format: 'bgra8unorm',
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'src-alpha',
                dstFactor: 'one',
                operation: 'add'
              }
            }
          }]
        },
        primitive: {
          topology: 'triangle-list'
        }
      });
      console.log('Render pipeline created successfully');
    } catch (error) {
      console.error('Error creating render pipeline:', error);
      throw error;
    }
  }

  render(): void {
    try {
      this.updateScreenSize();
      this.updateTime();
      
      const commandEncoder = this.device.createCommandEncoder();
      
      // Render pass - draw energy rays
      const textureView = this.context.getCurrentTexture().createView();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          loadOp: 'clear',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          storeOp: 'store'
        }]
      });

      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(0, this.renderBindGroup);
      renderPass.draw(6);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);
      
      // Debug: log every 60 frames to avoid spam
      if (Math.random() < 0.016) { // ~1/60 chance
        console.log('Energy rays renderer: rendering frame');
      }
    } catch (error) {
      console.error('Error in energy rays render method:', error);
    }
  }

  start(): void {
    const animate = () => {
      this.render();
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // Handle window resize
  handleResize(): void {
    this.resizeCanvas();
  }
}
