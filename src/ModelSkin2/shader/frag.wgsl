   // Fragment Shader
@fragment
fn main(@location(0) vNormal : vec3<f32>) -> @location(0) vec4<f32> {
  let light = normalize(vec3<f32>(1.0, 1.0, 1.0));
  let brightness = max(dot(normalize(vNormal), light), 0.0);
  return vec4<f32>(vNormal, 1.0);
}