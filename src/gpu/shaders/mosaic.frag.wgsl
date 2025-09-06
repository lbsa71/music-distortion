struct FrameUniforms {
  time: f32,
  alpha: f32,
  cols: f32,
  rows: f32,
  imgW: f32,
  imgH: f32,
  strength: f32,
  rippleIntensity: f32,
  pulseIntensity: f32,
  detailIntensity: f32,
  beatIntensity: f32,
  rotationIntensity: f32,
  flowIntensity: f32,
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
  
  // Calculate audio intensity for different effects
  let audioIntensity = max((low + mid + high) / 3.0, 0.3); // Ensure minimum intensity for colors to show even without audio
  let bassIntensity = low;
  let trebleIntensity = high;
  
  // Multi-layered distortion effects
  
  // 1. Bass-driven ripple waves (large, slow movements)
  let rippleFreq = 3.0 + bassIntensity * 5.0;
  let rippleAmp = bassIntensity * 0.2 * uniforms.rippleIntensity;
  let ripplePhase = time * 0.5 + length(input.uv - 0.5) * rippleFreq;
  let rippleX = sin(ripplePhase) * rippleAmp;
  let rippleY = cos(ripplePhase) * rippleAmp;
  
  // 2. Mid-frequency pulsing distortion (medium movements)
  let pulseFreq = 8.0 + mid * 10.0;
  let pulseAmp = mid * 0.15 * uniforms.pulseIntensity;
  let pulsePhase = time * 2.0 + input.uv.x * pulseFreq + input.uv.y * pulseFreq;
  let pulseX = sin(pulsePhase) * pulseAmp;
  let pulseY = cos(pulsePhase * 1.3) * pulseAmp;
  
  // 3. Treble-driven fine detail distortion (small, fast movements)
  let detailFreq = 20.0 + trebleIntensity * 30.0;
  let detailAmp = trebleIntensity * 0.1 * uniforms.detailIntensity;
  let detailPhase = time * 4.0 + input.uv.x * detailFreq;
  let detailX = sin(detailPhase) * detailAmp;
  let detailY = sin(detailPhase * 1.7) * detailAmp;
  
  // 4. Beat-synchronized bursts (when all bands are high)
  let beatThreshold = 0.3; // Lower threshold for more frequent beats
  let isBeat = audioIntensity > beatThreshold;
  let beatAmp = select(0.0, audioIntensity * 0.3 * uniforms.beatIntensity, isBeat);
  let beatPhase = time * 8.0;
  let beatX = sin(beatPhase) * beatAmp;
  let beatY = cos(beatPhase) * beatAmp;
  
  // 5. Flow field for organic motion
  let flow = curlNoise(input.uv * 3.0 + time * 0.3) * 0.03 * audioIntensity * uniforms.flowIntensity;
  
  // 6. Rotation effect based on audio intensity
  let rotationAngle = audioIntensity * 0.5 * uniforms.rotationIntensity;
  let center = vec2<f32>(0.5, 0.5);
  let rotatedUV = input.uv - center;
  let cosRot = cos(rotationAngle);
  let sinRot = sin(rotationAngle);
  let rotated = vec2<f32>(
    rotatedUV.x * cosRot - rotatedUV.y * sinRot,
    rotatedUV.x * sinRot + rotatedUV.y * cosRot
  ) + center;
  
  // Combine all distortions
  var distortedUV = rotated + vec2<f32>(
    rippleX + pulseX + detailX + beatX + flow.x,
    rippleY + pulseY + detailY + beatY + flow.y
  );
  
  // Apply brightness-based modulation
  let brightnessMod = mix(0.5, 1.5, brightness);
  distortedUV = mix(input.uv, distortedUV, brightnessMod);
  
  // Clamp to valid UV range
  distortedUV = clamp(distortedUV, vec2<f32>(0.0), vec2<f32>(1.0));
  
  // Sample textures using original UV for pure images (no distortion)
  let currentColor = textureSample(currentTex, texSampler, input.uv);
  let nextColor = textureSample(nextTex, texSampler, input.uv);
  
  // Transition blend (uniforms.alpha controls transition progress)
  let blendedColor = mix(currentColor, nextColor, uniforms.alpha);
  
  // Create colored gradient overlays moving over the images
  let ambientLight = createAmbientLighting(input.uv, time, audioIntensity);
  
  // Tone-weighted screen blend: vivid swatches, preserve detail, avoid white clipping
  let luma = dot(blendedColor.rgb, vec3<f32>(0.299, 0.587, 0.114));
  let toneWeight = clamp(pow(luma, 0.5), 0.0, 1.0); // more weight on highlights, some on midtones
  let minContribution = 0.15;                       // ensure visibility even on darker areas
  let overlayStrength = 0.9;                        // strong but not blowing out
  let overlay = ambientLight * overlayStrength * mix(minContribution, 1.0, toneWeight);
  let screenBlend = 1.0 - (1.0 - blendedColor.rgb) * (1.0 - overlay);
  let finalColor = clamp(screenBlend, vec3<f32>(0.0), vec3<f32>(1.0));
  
  // Apply global alpha for fade in/out
  return vec4<f32>(finalColor, 1.0) * uniforms.alpha;
}

fn createAmbientLighting(uv: vec2<f32>, time: f32, audioIntensity: f32) -> vec3<f32> {
  // Vibrant color palette for projection - much more saturated
  let purple = vec3<f32>(0.8, 0.2, 1.0);
  let mauve = vec3<f32>(0.9, 0.4, 0.8);
  let orange = vec3<f32>(1.0, 0.4, 0.1);
  let cyan = vec3<f32>(0.1, 0.9, 1.0);
  
  // Create multiple moving light patches - much more intense
  var ambientColor = vec3<f32>(0.0);
  
  // Purple field - slow horizontal movement - MUCH MORE INTENSE
  let purplePhase = time * 0.3 + uv.x * 2.0;
  let purpleIntensity = sin(purplePhase) * 0.5 + 0.5;
  let purpleDistance = length(uv - vec2<f32>(0.3 + sin(time * 0.2) * 0.2, 0.5));
  let purpleSpot = exp(-purpleDistance * 1.2) * purpleIntensity * 1.5; // Larger, brighter
  ambientColor += purple * purpleSpot;
  
  // Mauve field - vertical movement - MUCH MORE INTENSE
  let mauvePhase = time * 0.4 + uv.y * 1.5;
  let mauveIntensity = cos(mauvePhase) * 0.5 + 0.5;
  let mauveDistance = length(uv - vec2<f32>(0.7, 0.3 + cos(time * 0.25) * 0.3));
  let mauveSpot = exp(-mauveDistance * 1.0) * mauveIntensity * 1.2; // Larger, brighter
  ambientColor += mauve * mauveSpot;
  
  // Orange field - diagonal movement - MUCH MORE INTENSE
  let orangePhase = time * 0.35 + (uv.x + uv.y) * 1.8;
  let orangeIntensity = sin(orangePhase) * 0.5 + 0.5;
  let orangeDistance = length(uv - vec2<f32>(0.2 + sin(time * 0.3) * 0.4, 0.8 + cos(time * 0.3) * 0.2));
  let orangeSpot = exp(-orangeDistance * 0.8) * orangeIntensity * 1.3; // Larger, brighter
  ambientColor += orange * orangeSpot;
  
  // Cyan field - circular movement - MUCH MORE INTENSE
  let cyanPhase = time * 0.25 + length(uv - vec2<f32>(0.5, 0.5)) * 3.0;
  let cyanIntensity = cos(cyanPhase) * 0.5 + 0.5;
  let cyanCenter = vec2<f32>(0.5, 0.5) + vec2<f32>(sin(time * 0.15), cos(time * 0.15)) * 0.3;
  let cyanDistance = length(uv - cyanCenter);
  let cyanSpot = exp(-cyanDistance * 1.0) * cyanIntensity * 1.2; // Larger, brighter
  ambientColor += cyan * cyanSpot;
  
  // Add audio-reactive pulsing to all fields - MUCH STRONGER
  let audioPulse = 1.0 + audioIntensity * 1.5;
  ambientColor *= audioPulse;
  
  // Stronger overall ambient glow for projection
  let globalAmbient = (purple + mauve + orange + cyan) * 0.2;
  ambientColor += globalAmbient;
  
  return ambientColor;
}