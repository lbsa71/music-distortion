import { MusicMosaicApp } from './core/app.js';

async function main() {
  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // Get canvas element
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    // Create and initialize app
    console.log('Starting WebGPU Music-Reactive Image Mosaic...');
    const app = new MusicMosaicApp(canvas);
    await app.initialize();

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      app.destroy();
    });

    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('Page hidden - pausing app');
      } else {
        console.log('Page visible - resuming app');
      }
    });

    console.log('App started successfully');
  } catch (error) {
    console.error('Failed to start app:', error);
    
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      z-index: 10000;
      max-width: 80%;
      text-align: center;
    `;
    errorDiv.innerHTML = `
      <h3>Failed to Initialize</h3>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <p>Please check the console for more details.</p>
    `;
    document.body.appendChild(errorDiv);
  }
}

// Start the application
main();