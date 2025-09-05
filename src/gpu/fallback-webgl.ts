import { LoadedImage } from '../images/loader.js';
import { TileUniforms, AudioBands } from '../core/config.js';

const vertexShaderSource = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_alpha;
uniform float u_cols;
uniform float u_rows;
uniform float u_imgW;
uniform float u_imgH;
uniform float u_strength;

in vec2 a_position;
in vec2 a_uv;
in vec4 a_instance; // x, y, brightness, pad

out vec2 v_uv;
out vec2 v_tileUV;
out float v_brightness;

void main() {
  // Calculate tile position
  vec2 tileSize = 2.0 / vec2(u_cols, u_rows);
  vec2 tilePos = a_instance.xy * tileSize - 1.0 + tileSize * 0.5;
  
  // Scale vertex position to tile size
  vec2 localPos = a_position * tileSize * 0.5;
  vec2 worldPos = tilePos + localPos;
  
  // Calculate UV coordinates for the tile
  vec2 tileUV = a_instance.xy / vec2(u_cols, u_rows);
  vec2 localUV = a_uv / vec2(u_cols, u_rows);
  vec2 finalUV = tileUV + localUV;
  
  gl_Position = vec4(worldPos, 0.0, 1.0);
  v_uv = finalUV;
  v_tileUV = a_uv;
  v_brightness = a_instance.z;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_alpha;
uniform float u_strength;
uniform sampler2D u_currentTex;
uniform sampler2D u_nextTex;
uniform vec3 u_audioBands; // low, mid, high

in vec2 v_uv;
in vec2 v_tileUV;
in float v_brightness;

out vec4 fragColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 curlNoise(vec2 p) {
  float eps = 0.001;
  float x = hash(p + vec2(eps, 0.0)) - hash(p - vec2(eps, 0.0));
  float y = hash(p + vec2(0.0, eps)) - hash(p - vec2(0.0, eps));
  return vec2(y, -x) / (2.0 * eps);
}

void main() {
  vec3 bands = u_audioBands;
  float low = bands.r;
  float mid = bands.g;
  float high = bands.b;
  
  float brightness = v_brightness;
  
  // Flow field for smooth motion
  vec2 flow = curlNoise(v_uv * 2.0 + u_time * 0.2) * 0.002;
  
  // Audio-reactive distortion
  float dx = u_strength * ((0.6 * low + 0.2 * mid) * mix(0.3, 1.0, brightness)) * 0.01;
  float dy = u_strength * ((0.6 * mid + 0.2 * high) * mix(1.0, 0.4, brightness)) * 0.01;
  
  // Apply distortion and flow
  vec2 distortedUV = v_uv + vec2(dx, dy) + flow;
  distortedUV = clamp(distortedUV, vec2(0.0), vec2(1.0));
  
  // Sample textures with grayscale conversion
  vec4 currentColor = texture(u_currentTex, distortedUV);
  vec4 nextColor = texture(u_nextTex, distortedUV);
  
  // Convert to grayscale
  float currentLum = dot(currentColor.rgb, vec3(0.299, 0.587, 0.114));
  float nextLum = dot(nextColor.rgb, vec3(0.299, 0.587, 0.114));
  
  vec3 currentGray = vec3(currentLum);
  vec3 nextGray = vec3(nextLum);
  
  // Transition blend
  vec3 blendedColor = mix(currentGray, nextGray, u_alpha);
  
  // Apply global alpha for fade in/out
  fragColor = vec4(blendedColor, 1.0) * u_alpha;
}`;

export class WebGL2Renderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private instanceBuffer: WebGLBuffer | null = null;
  
  private currentTexture: WebGLTexture | null = null;
  private nextTexture: WebGLTexture | null = null;
  
  private uniforms: { [key: string]: WebGLUniformLocation | null } = {};
  private currentCols = 0;
  private currentRows = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
    });
    
    if (!gl) {
      throw new Error('WebGL2 not supported');
    }
    
    this.gl = gl;
  }

  async initialize(): Promise<void> {
    const gl = this.gl;
    
    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }
    
    // Create program
    this.program = gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create shader program');
    }
    
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(this.program);
      throw new Error(`Shader program link error: ${error}`);
    }
    
    // Get uniform locations
    this.uniforms = {
      u_time: gl.getUniformLocation(this.program, 'u_time'),
      u_alpha: gl.getUniformLocation(this.program, 'u_alpha'),
      u_cols: gl.getUniformLocation(this.program, 'u_cols'),
      u_rows: gl.getUniformLocation(this.program, 'u_rows'),
      u_imgW: gl.getUniformLocation(this.program, 'u_imgW'),
      u_imgH: gl.getUniformLocation(this.program, 'u_imgH'),
      u_strength: gl.getUniformLocation(this.program, 'u_strength'),
      u_currentTex: gl.getUniformLocation(this.program, 'u_currentTex'),
      u_nextTex: gl.getUniformLocation(this.program, 'u_nextTex'),
      u_audioBands: gl.getUniformLocation(this.program, 'u_audioBands'),
    };
    
    this.createBuffers();
    
    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    console.log('WebGL2 renderer initialized');
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      console.error(`Shader compile error: ${error}`);
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  private createBuffers(): void {
    const gl = this.gl;
    
    // Create VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    
    // Create vertex buffer (quad)
    const vertices = new Float32Array([
      // Position   UV
      -1.0, -1.0,   0.0, 1.0,
       1.0, -1.0,   1.0, 1.0,
       1.0,  1.0,   1.0, 0.0,
      -1.0, -1.0,   0.0, 1.0,
       1.0,  1.0,   1.0, 0.0,
      -1.0,  1.0,   0.0, 0.0,
    ]);
    
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Position attribute
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    
    // UV attribute
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    
    gl.bindVertexArray(null);
  }

  private createTextureFromImage(image: LoadedImage): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    if (!texture) {
      throw new Error('Failed to create texture');
    }
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image.bitmap);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    return texture;
  }

  setCurrentImage(image: LoadedImage, tileSize: number): void {
    if (this.currentTexture) {
      this.gl.deleteTexture(this.currentTexture);
    }
    
    this.currentTexture = this.createTextureFromImage(image);
    this.updateTileGrid(image, tileSize);
  }

  setNextImage(image: LoadedImage): void {
    if (this.nextTexture) {
      this.gl.deleteTexture(this.nextTexture);
    }
    
    this.nextTexture = this.createTextureFromImage(image);
  }

  private updateTileGrid(image: LoadedImage, tileSize: number): void {
    const cols = Math.ceil(image.width / tileSize);
    const rows = Math.ceil(image.height / tileSize);
    
    this.currentCols = cols;
    this.currentRows = rows;
    
    // Create instance data
    const tileCount = cols * rows;
    const instanceData = new Float32Array(tileCount * 4);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = (row * cols + col) * 4;
        const brightness = 0.5 + 0.5 * Math.sin((col + row) * 0.1);
        
        instanceData[index + 0] = col;
        instanceData[index + 1] = row;
        instanceData[index + 2] = brightness;
        instanceData[index + 3] = 0;
      }
    }
    
    // Update instance buffer
    if (this.instanceBuffer) {
      this.gl.deleteBuffer(this.instanceBuffer);
    }
    
    this.instanceBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, instanceData, this.gl.DYNAMIC_DRAW);
  }

  render(uniforms: TileUniforms, audioBands: AudioBands): void {
    const gl = this.gl;
    
    if (!this.program || !this.vao || !this.currentTexture) {
      return;
    }
    
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    
    // Set uniforms
    gl.uniform1f(this.uniforms.u_time, uniforms.time);
    gl.uniform1f(this.uniforms.u_alpha, uniforms.alpha);
    gl.uniform1f(this.uniforms.u_cols, uniforms.cols);
    gl.uniform1f(this.uniforms.u_rows, uniforms.rows);
    gl.uniform1f(this.uniforms.u_imgW, uniforms.imgW);
    gl.uniform1f(this.uniforms.u_imgH, uniforms.imgH);
    gl.uniform1f(this.uniforms.u_strength, uniforms.strength);
    gl.uniform3f(this.uniforms.u_audioBands, audioBands.low, audioBands.mid, audioBands.high);
    
    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture);
    gl.uniform1i(this.uniforms.u_currentTex, 0);
    
    if (this.nextTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.nextTexture);
      gl.uniform1i(this.uniforms.u_nextTex, 1);
    }
    
    // Clear and render
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Simple non-instanced rendering (would need extension for true instancing)
    const tileCount = this.currentCols * this.currentRows;
    for (let i = 0; i < tileCount; i++) {
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  swapTextures(): void {
    const temp = this.currentTexture;
    this.currentTexture = this.nextTexture;
    this.nextTexture = temp;
  }

  resize(width: number, height: number): void {
    this.gl.canvas.width = width;
    this.gl.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  destroy(): void {
    const gl = this.gl;
    
    if (this.currentTexture) gl.deleteTexture(this.currentTexture);
    if (this.nextTexture) gl.deleteTexture(this.nextTexture);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.instanceBuffer) gl.deleteBuffer(this.instanceBuffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    
    console.log('WebGL2 renderer destroyed');
  }
}