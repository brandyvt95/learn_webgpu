  // Vertex Shader
struct Uniforms {
  modelViewProjectionMatrix : mat4x4<f32>
};
struct CameraUniforms {
  modelMatrix : mat4x4<f32>,
  viewMatrix : mat4x4<f32>,
  projectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  padding : f32, // <- để giữ alignment 16 bytes
}
@group(0) @binding(0)var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var<uniform> camera_uniforms: CameraUniforms;
@group(2) @binding(0) var<storage> inJoints: array<u32>;
struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) vNormal : vec3<f32>
};

@vertex
fn main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  output.position =  camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  *  camera_uniforms.modelMatrix *  vec4<f32>(input.position, 1.0);
  output.vNormal = input.normal;
  return output;
}