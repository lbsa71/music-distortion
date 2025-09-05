# WebGPU Music-Reactive Image Mosaic

A TypeScript single-page application that creates an audio-reactive image mosaic using WebGPU (with WebGL2 fallback).

## Features

✅ **WebGPU Rendering** - Primary renderer with WGSL compute and render pipelines  
✅ **WebGL2 Fallback** - Automatic fallback for broader device compatibility  
✅ **Audio Reactivity** - Real-time FFT analysis with low/mid/high frequency bands  
✅ **Tile-based Mosaic** - Instanced rendering with audio-reactive distortion  
✅ **Image Cycling** - Automatic image transitions every 30 seconds  
✅ **Silence Detection** - Fade to black when audio is silent, resume on sound  
✅ **State Machine** - Clean state transitions (BOOT → IDLE → FADE_IN → RUN → TRANSITION)  
✅ **Live Controls** - Real-time adjustment of visual parameters  

## Screenshots

### Initial Audio Permission Dialog
![Audio Permission](https://github.com/user-attachments/assets/02afc94d-2064-452c-a9d2-3607f72d48a8)

### Running Visualization
![Running Application](https://github.com/user-attachments/assets/7a237f0f-df01-449b-82ec-02fd2a49ad2c)

## Setup & Installation

```bash
# Clone the repository
git clone <repository-url>
cd music-distortion

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Audio Setup**: Grant microphone permissions or choose "Visualize Without Audio"
2. **Controls**: Adjust tile size, distortion strength, cycle duration, and silence threshold
3. **Visual Experience**: Watch as the mosaic responds to audio with distortions and transitions

## Technical Architecture

### Core Modules
- **Audio Processing**: `getUserMedia`, FFT analysis, silence detection
- **GPU Rendering**: WebGPU pipelines with WGSL shaders, WebGL2 fallback
- **State Management**: Finite state machine for application flow
- **Image Loading**: Preloading and caching with `createImageBitmap`

### Rendering Pipeline
1. **Grayscale Conversion**: Compute shader converts images to grayscale
2. **Tile Generation**: Instanced quads for mosaic tiles
3. **Audio-Reactive Distortion**: Fragment shader applies FFT-based effects
4. **Smooth Transitions**: Alpha blending between current and next images

### Performance Targets
- **60 FPS** at 1080p on integrated GPUs
- **Instanced rendering** for thousands of tiles
- **Minimal CPU usage** with GPU-accelerated processing

## Audio Configuration

The application supports various audio inputs:
- **Microphone**: Direct microphone input
- **Stereo Mix**: System audio (if available)
- **Custom Devices**: Any available audio input device

### Silence Detection
- Configurable RMS threshold (default: 0.01)
- Hysteresis to prevent flapping
- Automatic fade to black and resume

## Browser Compatibility

- **WebGPU**: Chrome/Edge 113+, Firefox with flag
- **WebGL2 Fallback**: All modern browsers
- **Audio**: Requires secure context (HTTPS/localhost)

## Development

### Project Structure
```
src/
├── core/          # App coordination, config, state machine
├── audio/         # Audio input, FFT analysis
├── gpu/           # WebGPU/WebGL2 renderers, shaders
├── images/        # Image loading and management  
├── ui/            # Control panel and user interface
└── main.ts        # Application entry point
```

### Key Technologies
- **TypeScript** with ES2022 target
- **Vite** for development and building
- **WebGPU Types** for GPU API access
- **Web Audio API** for audio processing

## Troubleshooting

### WebGPU Issues
- Enable experimental WebGPU flags in Chrome
- Check `chrome://gpu` for WebGPU support status
- Application automatically falls back to WebGL2

### Audio Issues
- Ensure secure context (HTTPS or localhost)
- Check browser permissions for microphone access
- For Stereo Mix: Enable in Windows sound settings

### Performance Issues
- Reduce tile size for better performance
- Lower distortion strength on slower devices
- Check GPU compatibility and drivers

## License

MIT License - see LICENSE file for details
