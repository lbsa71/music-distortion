// Energy rays shooting up from bottom - laser beam effect
@group(0) @binding(0) var<uniform> screenSize: vec2<f32>;
@group(0) @binding(1) var<uniform> audioIntensity: f32;
@group(0) @binding(2) var<uniform> time: f32;

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = fragCoord.xy / screenSize;
  
  // Create 3 shooting laser beams
  var finalColor = vec3<f32>(0.0);
  
  for (var i = 0; i < 3; i++) {
    let rayIndex = f32(i);
    let rayX = 0.2 + rayIndex * 0.3; // Position rays across screen
    
    // Calculate ray position and movement (shooting up from bottom)
    let movementSpeed = 0.3 + audioIntensity * 1.5; // Audio-reactive speed
    let rayBottom = 1.0 - fract(time * movementSpeed); // Start from bottom, move up
    let rayTop = rayBottom + (0.8 + audioIntensity * 0.4); // Long laser beams
    
    // Check if current pixel is within ray
    let distanceFromCenter = abs(uv.x - rayX);
    let rayWidth = 0.02 + audioIntensity * 0.05; // Thin laser beams
    
    if (distanceFromCenter < rayWidth && uv.y >= rayBottom && uv.y <= rayTop) {
      // Create laser beam effect with intensity falloff
      let normalizedY = (uv.y - rayBottom) / (rayTop - rayBottom);
      
      // Laser beam intensity - brighter at bottom, fading toward top
      let baseIntensity = 1.0 - normalizedY * 0.3; // Fade from bottom to top
      let widthFalloff = 1.0 - smoothstep(0.0, rayWidth, distanceFromCenter);
      let intensity = baseIntensity * widthFalloff;
      
      // Color based on ray index - bright laser colors
      let rayColor = vec3<f32>(
        1.0, // Bright red
        0.3 + rayIndex * 0.2, // Some green variation
        0.8 - rayIndex * 0.3  // Blue variation
      );
      
      finalColor += rayColor * intensity * (0.7 + audioIntensity * 0.3);
    }
  }
  
  return vec4<f32>(finalColor, 0.9);
}