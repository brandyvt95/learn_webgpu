struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
}
struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragPosition: vec4f,
}

@vertex
fn main(
  @location(0) position : vec4f,
  @location(1) uv : vec2f
) -> VertexOutput {
  var output : VertexOutput;
  output.Position =camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  *  camera_uniforms.modelMatrix * position;
  output.fragUV = uv;
  output.fragPosition = 0.5 * (position + vec4(1.0, 1.0, 1.0, 1.0));
  return output;
}
