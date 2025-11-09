@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(srcTex);
  if (gid.x >= dims.x || gid.y >= dims.y) { 
    return; 
  }
  
  let color = textureLoad(srcTex, vec2<i32>(gid.xy), 0);
  let luminance = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
  
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(luminance, luminance, luminance, 1.0));
}