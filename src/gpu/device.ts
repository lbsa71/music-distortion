export interface GPUDeviceInfo {
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
}

export async function initializeWebGPU(canvas: HTMLCanvasElement): Promise<GPUDeviceInfo | null> {
  try {
    // Check WebGPU support
    if (!navigator.gpu) {
      console.warn('WebGPU not supported');
      return null;
    }

    // Request adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!adapter) {
      console.warn('No WebGPU adapter found');
      return null;
    }

    console.log('WebGPU adapter info:', {
      vendor: adapter.info?.vendor || 'Unknown',
      architecture: adapter.info?.architecture || 'Unknown',
      device: adapter.info?.device || 'Unknown',
    });

    // Request device
    const device = await adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {
        maxTextureDimension2D: 2048,
        maxBindGroups: 4,
      },
    });

    // Configure canvas context
    const context = canvas.getContext('webgpu');
    if (!context) {
      console.error('Failed to get WebGPU context');
      return null;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    // Set up error handling
    device.addEventListener('uncapturederror', (event) => {
      console.error('WebGPU uncaptured error:', event.error);
      
      // Log additional context for debugging
      if (event.error instanceof GPUValidationError) {
        console.error('Validation error details:', {
          message: event.error.message,
          stack: (event.error as any).stack
        });
      }
    });

    // Handle device loss
    device.addEventListener('lost', (event: any) => {
      console.error('WebGPU device lost:', event.reason);
      if (event.reason === 'destroyed') {
        console.log('Device was intentionally destroyed');
      } else {
        console.error('Device lost unexpectedly:', event.message);
      }
    });

    console.log('WebGPU initialized successfully');
    console.log('Canvas format:', format);
    console.log('Device limits:', device.limits);

    return {
      adapter,
      device,
      context,
      format,
      canvas,
    };
  } catch (error) {
    console.error('Error initializing WebGPU:', error);
    return null;
  }
}

export function resizeCanvas(deviceInfo: GPUDeviceInfo, width: number, height: number): void {
  const { canvas, context, device, format } = deviceInfo;
  
  // Update canvas size
  canvas.width = width;
  canvas.height = height;
  
  // Reconfigure context
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });
}

export async function checkWebGPUFeatures(): Promise<{
  supported: boolean;
  features: string[];
  limits: Record<string, number>;
}> {
  if (!navigator.gpu) {
    return {
      supported: false,
      features: [],
      limits: {},
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        features: [],
        limits: {},
      };
    }

    const device = await adapter.requestDevice();
    
    return {
      supported: true,
      features: Array.from(device.features),
      limits: {
        maxTextureDimension2D: device.limits.maxTextureDimension2D,
        maxBindGroups: device.limits.maxBindGroups,
        maxBufferSize: device.limits.maxBufferSize,
        maxComputeWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: device.limits.maxComputeWorkgroupSizeY,
      },
    };
  } catch (error) {
    console.error('Error checking WebGPU features:', error);
    return {
      supported: false,
      features: [],
      limits: {},
    };
  }
}