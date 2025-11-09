// Simple Energy Rays Compute Shader for debugging
@group(0) @binding(0) var<storage, read_write> rays: array<f32>;
@group(0) @binding(1) var<uniform> audio: f32;
@group(0) @binding(2) var<uniform> screenSize: vec2<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= arrayLength(&rays)) {
    return;
  }

  // Simple test - just set some values
  rays[index] = f32(index) * 0.1 + audio;
}
