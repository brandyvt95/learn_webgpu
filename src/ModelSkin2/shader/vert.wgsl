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
@group(2) @binding(0) var<storage, read> inverseBindMatrices: array<mat4x4<f32>>;
@group(2) @binding(1) var<storage, read> jointMatrices: array<mat4x4<f32>>;

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,

};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) vNormal : vec3<f32>
};

@vertex
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output : VertexOutput;
var pos = vec4<f32>(input.position, 1.0);
  var skinnedPos = vec4<f32>(0.0);

  for (var i = 0u; i < 4u; i = i + 1u) {
    // let jointIndex = input.skinIndices[i];
    // let weight = input.skinWeights[i];
    skinnedPos += jointMatrices[vertexIndex] * pos ;
  }    
      // ma trận * vector4
let finalPos = camera_uniforms.modelMatrix * skinnedPos;

  output.position =  camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  * finalPos ;
  output.vNormal = input.normal;
  return output;
}