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

struct InstanceData {
  tileX: f32,
  tileY: f32,
  brightness: f32,
  pad: f32,
}

struct VSInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
}

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) tileUV: vec2<f32>,
  @location(2) brightness: f32,
}

@group(0) @binding(0) var<uniform> uniforms: FrameUniforms;
@group(0) @binding(1) var<storage, read> instances: array<InstanceData>;

@vertex
fn main(
  input: VSInput,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let instance = instances[instanceIndex];
  
  // Calculate tile position
  let tileSize = 2.0 / vec2<f32>(uniforms.cols, uniforms.rows);
  let tilePos = vec2<f32>(instance.tileX, instance.tileY) * tileSize - 1.0 + tileSize * 0.5;
  
  // Scale vertex position to tile size
  let localPos = input.position * tileSize * 0.5;
  let worldPos = tilePos + localPos;
  
  // Calculate UV coordinates for the tile
  let tileUV = vec2<f32>(instance.tileX / uniforms.cols, instance.tileY / uniforms.rows);
  let localUV = input.uv / vec2<f32>(uniforms.cols, uniforms.rows);
  let finalUV = tileUV + localUV;
  
  var output: VSOutput;
  output.position = vec4<f32>(worldPos, 0.0, 1.0);
  output.uv = finalUV;
  output.tileUV = input.uv;
  output.brightness = instance.brightness;
  
  return output;
}