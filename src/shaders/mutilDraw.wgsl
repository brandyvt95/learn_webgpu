struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>
}

struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}

@group(0) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
@vertex
fn vs_main(@location(0) pos: vec3<f32>, @location(1) color: vec3<f32>) -> VertexOut {
  var out: VertexOut;
  out.position = camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  *  camera_uniforms.modelMatrix *   vec4(pos, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
  return vec4(color, 1.0);
}
