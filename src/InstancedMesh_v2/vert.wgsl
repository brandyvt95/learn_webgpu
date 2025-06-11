
struct CameraUniforms {
  modelMatrix : mat4x4 < f32>,
  viewMatrix : mat4x4 < f32>,
  projectionMatrix : mat4x4 < f32>,
  cameraPosition : vec3 < f32>,
  padding : f32,//<- để giữ alignment 16 bytes
}
struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragPosition : vec4f,
  @location(2) @interpolate(flat) instanceIdx : u32,
}

@group(0) @binding(0) var<uniform> camera_uniforms : CameraUniforms;
// @group(1) @binding(0) var<uniform> uTime : f32;
//@group(2) @binding(0) var<storage, read> points : array<vec3 < f32>>;
// @group(2) @binding(0) var<storage, read> SEGMENT_COORD : array<f32>;
// @group(2) @binding(1) var<storage, read> segmentMeta : array<vec4 < u32>>;
// @group(2) @binding(2) var<storage, read> extraMeta : array<u32>;
@group(3) @binding(0) var<storage, read> outputPassCompute : array<vec4<f32>>;
@vertex
fn main(
@builtin(vertex_index) vertexIdxInInstance : u32,
@builtin(instance_index) instanceIdx : u32,
@location(0) position : vec3 < f32>,
@location(1) uv : vec2f
) -> VertexOutput {
  var output : VertexOutput;
  let baseIndex2 = instanceIdx * 24u + vertexIdxInInstance;
  let posCompute = outputPassCompute[baseIndex2];
  let rlsPos = vec4<f32>( posCompute.xyz * .1, 1.0);
  
  output.Position = camera_uniforms.projectionMatrix *
  camera_uniforms.viewMatrix *
  camera_uniforms.modelMatrix *
  rlsPos;

  output.fragUV = uv;
  output.fragPosition = rlsPos * 10.;
  output.instanceIdx = instanceIdx;
  return output;
}
