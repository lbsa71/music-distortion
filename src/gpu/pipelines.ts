import { GPUDeviceInfo } from './device.js';

// Shader sources - will be loaded dynamically
async function loadShader(path: string): Promise<string> {
  const response = await fetch(path);
  return response.text();
}

export interface PipelineResources {
  grayscaleComputePipeline: GPUComputePipeline;
  mosaicRenderPipeline: GPURenderPipeline;
  sampler: GPUSampler;
  uniformBindGroupLayout: GPUBindGroupLayout;
  textureBindGroupLayout: GPUBindGroupLayout;
  grayscaleBindGroupLayout: GPUBindGroupLayout;
}

export async function createPipelines(deviceInfo: GPUDeviceInfo): Promise<PipelineResources> {
  const { device, format } = deviceInfo;

  // Load shader sources
  const grayscaleCompShader = await loadShader('/src/gpu/shaders/grayscale.comp.wgsl');
  const mosaicVertShader = await loadShader('/src/gpu/shaders/mosaic.vert.wgsl');
  const mosaicFragShader = await loadShader('/src/gpu/shaders/mosaic.frag.wgsl');

  // Create sampler
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  // Create bind group layouts
  const uniformBindGroupLayout = device.createBindGroupLayout({
    label: 'Uniform Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' }
      }
    ]
  });

  const textureBindGroupLayout = device.createBindGroupLayout({
    label: 'Texture Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' }
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' }
      }
    ]
  });

  const grayscaleBindGroupLayout = device.createBindGroupLayout({
    label: 'Grayscale Compute Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'float' }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { 
          access: 'write-only',
          format: 'rgba8unorm'
        }
      }
    ]
  });

  // Create grayscale compute pipeline
  const grayscaleComputePipeline = device.createComputePipeline({
    label: 'Grayscale Compute Pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [grayscaleBindGroupLayout]
    }),
    compute: {
      module: device.createShaderModule({
        label: 'Grayscale Compute Shader',
        code: grayscaleCompShader
      }),
      entryPoint: 'main'
    }
  });

  // Create render pipeline
  const mosaicRenderPipeline = device.createRenderPipeline({
    label: 'Mosaic Render Pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [uniformBindGroupLayout, textureBindGroupLayout]
    }),
    vertex: {
      module: device.createShaderModule({
        label: 'Mosaic Vertex Shader',
        code: mosaicVertShader
      }),
      entryPoint: 'main',
      buffers: [
        {
          arrayStride: 16, // 4 floats (position + uv)
          attributes: [
            {
              format: 'float32x2',
              offset: 0,
              shaderLocation: 0, // position
            },
            {
              format: 'float32x2',
              offset: 8,
              shaderLocation: 1, // uv
            }
          ]
        }
      ]
    },
    fragment: {
      module: device.createShaderModule({
        label: 'Mosaic Fragment Shader',
        code: mosaicFragShader
      }),
      entryPoint: 'main',
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
  });

  return {
    grayscaleComputePipeline,
    mosaicRenderPipeline,
    sampler,
    uniformBindGroupLayout,
    textureBindGroupLayout,
    grayscaleBindGroupLayout,
  };
}