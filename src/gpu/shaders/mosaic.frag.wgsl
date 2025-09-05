struct FrameUniforms {
  time: f32,
  alpha: f32,
  cols: f32,
  rows: f32,
  imgW: f32,
  imgH: f32,
  strength: f32,
  pad: f32,
}

struct FSInput {
  @location(0) uv: vec2<f32>,
  @location(1) tileUV: vec2<f32>,
  @location(2) brightness: f32,
}

@group(0) @binding(0) var<uniform> uniforms: FrameUniforms;
@group(0) @binding(1) var<storage, read> instances: array<vec4<f32>>;
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var currentTex: texture_2d<f32>;
@group(1) @binding(2) var nextTex: texture_2d<f32>;
@group(1) @binding(3) var fftTex: texture_2d<f32>;

fn hash(p: vec2<f32>) -> f32 {
  let p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  let p3_dot = dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3_dot);
}

fn curlNoise(p: vec2<f32>) -> vec2<f32> {
  let eps = 0.001;
  let x = hash(p + vec2<f32>(eps, 0.0)) - hash(p - vec2<f32>(eps, 0.0));
  let y = hash(p + vec2<f32>(0.0, eps)) - hash(p - vec2<f32>(0.0, eps));
  return vec2<f32>(y, -x) / (2.0 * eps);
}

@fragment
fn main(input: FSInput) -> @location(0) vec4<f32> {
  // Read audio bands from FFT texture
  let bands = textureLoad(fftTex, vec2<i32>(0, 0), 0).rgb;
  let low = bands.r;
  let mid = bands.g;
  let high = bands.b;
  
  // Per-pixel distortion within the tile
  let brightness = input.brightness;
  let time = uniforms.time;
  
  // Flow field for smooth motion
  let flow = curlNoise(input.uv * 2.0 + time * 0.2) * 0.002;
  
  // Audio-reactive distortion
  let dx = uniforms.strength * ((0.6 * low + 0.2 * mid) * mix(0.3, 1.0, brightness)) * 0.01;
  let dy = uniforms.strength * ((0.6 * mid + 0.2 * high) * mix(1.0, 0.4, brightness)) * 0.01;
  
  // Apply distortion and flow
  var distortedUV = input.uv + vec2<f32>(dx, dy) + flow;
  distortedUV = clamp(distortedUV, vec2<f32>(0.0), vec2<f32>(1.0));
  
  // Sample textures
  let currentColor = textureSample(currentTex, texSampler, distortedUV);
  let nextColor = textureSample(nextTex, texSampler, distortedUV);
  
  // Transition blend (uniforms.alpha controls transition progress)
  let blendedColor = mix(currentColor, nextColor, uniforms.alpha);
  
  // Apply global alpha for fade in/out
  return vec4<f32>(blendedColor.rgb, 1.0) * uniforms.alpha;
}